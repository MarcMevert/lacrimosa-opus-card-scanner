/**
 * opencv-worker.js  –  ES-Module Web Worker
 *
 * Loads OpenCV.js from the local npm package (@techstark/opencv-js), which
 * ships the library pre-compiled to WebAssembly.  The WASM binary is bundled
 * by Vite (via vite-plugin-wasm + vite-plugin-top-level-await) so no CDN
 * request is needed at runtime.
 *
 * Pipeline for each frame
 * ────────────────────────
 *  1. RGBA → Grayscale
 *  2. Gaussian blur          (noise reduction)
 *  3. Adaptive threshold     (handles uneven lighting)
 *  4. Canny edge detection
 *  5. Dilation               (close small edge gaps)
 *  6. findContours           (external only)
 *  7. Largest quad selection (approxPolyDP → 4 vertices)
 *  8. Perspective transform  (warpPerspective to 250×350)
 *
 * Message protocol
 * ─────────────────
 *  Inbound  { id, type: 'detect', width, height, buffer }
 *  Outbound { id, type: 'result', corners, warpedBuffer, warpedWidth, warpedHeight }
 *           { id, type: 'result', corners: null }   ← no card found
 *           { type: 'ready' }                        ← OpenCV WASM initialised
 *           { id, type: 'error', message }
 */

// Static import – Vite resolves the WASM binary at build time
import cv from '@techstark/opencv-js';

// @techstark/opencv-js resolves top-level await internally; once this module
// is imported the cv object is fully initialised and ready to use.
self.postMessage({ type: 'ready' });

// ── Message handler ──────────────────────────────────────────────────────────

self.onmessage = function (event) {
  handleDetect(event);
};

// ── Core detection logic ─────────────────────────────────────────────────────

/** Minimum fraction of the frame area a contour must cover to be a card candidate. */
const MIN_CARD_AREA_RATIO = 0.05;

function handleDetect(event) {
  const { id, width, height, buffer } = event.data;
  try {
    const result = detectCard(new Uint8ClampedArray(buffer), width, height);
    if (result) {
      // Transfer the warped image buffer back to the main thread without copying
      self.postMessage(
        { id, type: 'result', ...result },
        [result.warpedBuffer],
      );
    } else {
      self.postMessage({ id, type: 'result', corners: null });
    }
  } catch (err) {
    self.postMessage({ id, type: 'error', message: err.message });
  }
}

/**
 * Run the full CV pipeline on one RGBA frame.
 * @param {Uint8ClampedArray} rgba  Raw pixel data (width × height × 4 bytes)
 * @param {number} width
 * @param {number} height
 * @returns {{ corners, warpedBuffer, warpedWidth, warpedHeight } | null}
 */
function detectCard(rgba, width, height) {
  // Wrap pixel data in an OpenCV Mat (RGBA, 8-bit unsigned)
  const src = cv.matFromImageData({ data: rgba, width, height });

  const gray    = new cv.Mat();
  const blurred = new cv.Mat();
  const thresh  = new cv.Mat();
  const edges   = new cv.Mat();
  const kernel  = cv.Mat.ones(3, 3, cv.CV_8U);

  try {
    // 1. Grayscale
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // 2. Gaussian blur – reduces sensor noise that would create false edges
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

    // 3. Adaptive threshold – works under uneven / low lighting
    cv.adaptiveThreshold(
      blurred, thresh, 255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY,
      11, 2,
    );

    // 4. Canny edge detection
    cv.Canny(thresh, edges, 75, 200);

    // 5. Dilation – closes small gaps in detected edges
    cv.dilate(edges, edges, kernel);

    // 6. Find external contours only
    const contours  = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(
      edges, contours, hierarchy,
      cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE,
    );

    // 7. Pick the largest quadrilateral contour that covers ≥ 5 % of the frame
    const minArea = width * height * MIN_CARD_AREA_RATIO;
    let bestApprox = null;
    let maxArea = 0;

    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);
      if (area < minArea) continue;

      const peri   = cv.arcLength(contour, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(contour, approx, 0.02 * peri, true);

      if (approx.rows === 4 && area > maxArea) {
        bestApprox?.delete();
        bestApprox = approx;
        maxArea = area;
      } else {
        approx.delete();
      }
    }

    contours.delete();
    hierarchy.delete();

    if (!bestApprox) return null;

    // Extract the 4 corner points
    const corners = Array.from({ length: 4 }, (_, i) => ({
      x: bestApprox.data32S[i * 2],
      y: bestApprox.data32S[i * 2 + 1],
    }));
    bestApprox.delete();

    // 8. Perspective transform → flat 250×350 card image
    const CARD_W = 250;
    const CARD_H = 350;
    const sorted = sortCorners(corners);

    const srcPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
      sorted[0].x, sorted[0].y,
      sorted[1].x, sorted[1].y,
      sorted[2].x, sorted[2].y,
      sorted[3].x, sorted[3].y,
    ]);
    const dstPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
      0,      0,
      CARD_W, 0,
      CARD_W, CARD_H,
      0,      CARD_H,
    ]);

    const M      = cv.getPerspectiveTransform(srcPts, dstPts);
    const warped = new cv.Mat();
    cv.warpPerspective(src, warped, M, new cv.Size(CARD_W, CARD_H));

    srcPts.delete();
    dstPts.delete();
    M.delete();

    // Copy warped pixel data into a plain ArrayBuffer for transfer
    const warpedBuffer = warped.data.slice().buffer;
    warped.delete();

    return { corners, warpedBuffer, warpedWidth: CARD_W, warpedHeight: CARD_H };

  } finally {
    // Always release OpenCV Mats to avoid WASM heap leaks
    src.delete();
    gray.delete();
    blurred.delete();
    thresh.delete();
    edges.delete();
    kernel.delete();
  }
}

/**
 * Order corners as [top-left, top-right, bottom-right, bottom-left].
 * Uses coordinate sums and differences, which is robust for near-rectangular
 * cards that may be slightly rotated.
 * @param {{ x: number, y: number }[]} corners  Four unordered points
 * @returns {{ x: number, y: number }[]}
 */
function sortCorners(corners) {
  const bySum  = [...corners].sort((a, b) => (a.x + a.y) - (b.x + b.y));
  const topLeft     = bySum[0];
  const bottomRight = bySum[3];
  const sortedByCoordinateDiff = [bySum[1], bySum[2]].sort((a, b) => (a.x - a.y) - (b.x - b.y));
  const topRight    = sortedByCoordinateDiff[0];
  const bottomLeft  = sortedByCoordinateDiff[1];
  return [topLeft, topRight, bottomRight, bottomLeft];
}
