/**
 * main.js – SPA entry point
 *
 * Wires the camera feed → OpenCV.js WASM worker (card detection) →
 * perceptual-hash identifier → audio player → UI updates.
 */

import { startCamera, stopCamera, captureFrame } from './camera.js';
import { CardDetector } from './cv/card-detector.js';
import { identifyCard } from './cv/card-identifier.js';
import { AudioPlayer } from './audio/audio-player.js';
import { OPUS_CARDS } from './data/opus-cards.js';
import './styles.css';

// ── DOM refs ──────────────────────────────────────────────────────────────────
const videoEl        = /** @type {HTMLVideoElement}  */ (document.getElementById('camera-feed'));
const overlayCanvas  = /** @type {HTMLCanvasElement} */ (document.getElementById('overlay-canvas'));
const cardPreview    = /** @type {HTMLCanvasElement} */ (document.getElementById('card-preview'));
const scanIndicator  = /** @type {HTMLElement}       */ (document.getElementById('scan-indicator'));
const cardNameEl     = /** @type {HTMLElement}       */ (document.getElementById('card-name'));
const cardCompEl     = /** @type {HTMLElement}       */ (document.getElementById('card-composition'));
const cardMovEl      = /** @type {HTMLElement}       */ (document.getElementById('card-movement'));
const btnPlay        = /** @type {HTMLButtonElement} */ (document.getElementById('btn-play'));
const btnPause       = /** @type {HTMLButtonElement} */ (document.getElementById('btn-pause'));
const btnStop        = /** @type {HTMLButtonElement} */ (document.getElementById('btn-stop'));
const volumeSlider   = /** @type {HTMLInputElement}  */ (document.getElementById('volume-slider'));
const statusText     = /** @type {HTMLElement}       */ (document.getElementById('status-text'));

const overlayCtx     = overlayCanvas.getContext('2d');
const previewCtx     = cardPreview.getContext('2d');

// ── State ─────────────────────────────────────────────────────────────────────
const detector  = new CardDetector();
const player    = new AudioPlayer();

let cameraStream    = null;
let animFrameId     = null;
let isDetecting     = false;
let lastDetectedId  = null;

// ── Helpers ───────────────────────────────────────────────────────────────────

function setStatus(msg) {
  statusText.textContent = msg;
}

function setScanIndicator(msg) {
  scanIndicator.textContent = msg;
}

function updateCardInfo(card) {
  if (!card) {
    cardNameEl.textContent     = 'No card detected';
    cardCompEl.textContent     = '';
    cardMovEl.textContent      = '';
    btnPlay.disabled           = true;
    btnPause.disabled          = true;
    btnStop.disabled           = true;
    return;
  }
  cardNameEl.textContent = `${card.id} – ${card.name}`;
  cardCompEl.textContent = card.composition;
  cardMovEl.textContent  = card.movement;
  btnPlay.disabled       = card.audioUrl === null;
  btnPause.disabled      = !player.isPlaying;
  btnStop.disabled       = !player.hasTrack;
}

/** Draw a quadrilateral outline around the detected card in the overlay canvas. */
function drawOverlay(corners, canvasW, canvasH, videoW, videoH) {
  overlayCtx.clearRect(0, 0, canvasW, canvasH);
  if (!corners) return;

  // Scale from video coordinates to canvas display size
  const scaleX = canvasW / videoW;
  const scaleY = canvasH / videoH;

  overlayCtx.strokeStyle = '#e0a800';
  overlayCtx.lineWidth   = 3;
  overlayCtx.shadowColor = '#e0a800';
  overlayCtx.shadowBlur  = 8;

  overlayCtx.beginPath();
  corners.forEach(({ x, y }, i) => {
    const px = x * scaleX;
    const py = y * scaleY;
    i === 0 ? overlayCtx.moveTo(px, py) : overlayCtx.lineTo(px, py);
  });
  overlayCtx.closePath();
  overlayCtx.stroke();
}

/** Render the perspective-corrected card image into the small preview canvas. */
function drawCardPreview(warpedBuffer, warpedWidth, warpedHeight) {
  const imageData = new ImageData(
    new Uint8ClampedArray(warpedBuffer),
    warpedWidth,
    warpedHeight,
  );
  // Scale the warped image to fill the preview canvas (dimensions set by CSS)
  const tmpCanvas = new OffscreenCanvas(warpedWidth, warpedHeight);
  tmpCanvas.getContext('2d').putImageData(imageData, 0, 0);
  previewCtx.clearRect(0, 0, cardPreview.width, cardPreview.height);
  previewCtx.drawImage(tmpCanvas, 0, 0, cardPreview.width, cardPreview.height);
}

function clearPreview() {
  previewCtx.clearRect(0, 0, cardPreview.width, cardPreview.height);
}

// ── Main detection loop ───────────────────────────────────────────────────────

async function detectionLoop() {
  if (isDetecting) {
    animFrameId = requestAnimationFrame(detectionLoop);
    return;
  }

  // Sync overlay canvas size to the displayed video dimensions
  const { clientWidth, clientHeight } = videoEl;
  if (overlayCanvas.width !== clientWidth || overlayCanvas.height !== clientHeight) {
    overlayCanvas.width  = clientWidth;
    overlayCanvas.height = clientHeight;
  }

  const frame = captureFrame(videoEl);
  if (!frame) {
    animFrameId = requestAnimationFrame(detectionLoop);
    return;
  }

  isDetecting = true;
  try {
    const result = await detector.detect(frame.imageData);

    if (result) {
      setScanIndicator('Card detected ✓');
      drawOverlay(result.corners, clientWidth, clientHeight, frame.width, frame.height);
      drawCardPreview(result.warpedBuffer, result.warpedWidth, result.warpedHeight);

      // Identify the card via perceptual hash
      const match = identifyCard(
        new Uint8ClampedArray(result.warpedBuffer),
        result.warpedWidth,
        result.warpedHeight,
        OPUS_CARDS,
      );

      const card = match?.card ?? null;
      updateCardInfo(card);

      // Auto-play only when a new card is detected
      if (card && card.id !== lastDetectedId && card.audioUrl) {
        lastDetectedId = card.id;
        player.play(card.audioUrl).catch(console.error);
      }
    } else {
      setScanIndicator('Scanning…');
      drawOverlay(null, clientWidth, clientHeight, frame.width, frame.height);
      clearPreview();
      updateCardInfo(null);
      lastDetectedId = null;
    }
  } catch (err) {
    console.error('[detectionLoop]', err);
  } finally {
    isDetecting = false;
  }

  animFrameId = requestAnimationFrame(detectionLoop);
}

// ── Audio control bindings ────────────────────────────────────────────────────

btnPlay.addEventListener('click', () => {
  player.resume();
  btnPause.disabled = false;
  btnStop.disabled  = false;
});

btnPause.addEventListener('click', () => {
  player.pause();
  btnPause.disabled = true;
});

btnStop.addEventListener('click', () => {
  player.stop();
  btnPlay.disabled  = true;
  btnPause.disabled = true;
  btnStop.disabled  = true;
});

volumeSlider.addEventListener('input', () => {
  player.setVolume(Number(volumeSlider.value));
});

// ── Bootstrap ─────────────────────────────────────────────────────────────────

(async () => {
  setStatus('Loading OpenCV WASM…');
  setScanIndicator('Loading OpenCV…');

  await detector.waitForReady();
  setStatus('OpenCV ready. Starting camera…');

  try {
    cameraStream = await startCamera(videoEl);
  } catch (err) {
    setStatus(`Camera error: ${err.message}`);
    setScanIndicator('Camera unavailable');
    return;
  }

  setStatus('Camera active – hold an Opus card up to the camera.');
  setScanIndicator('Scanning…');
  detectionLoop();
})();

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  cancelAnimationFrame(animFrameId);
  if (cameraStream) stopCamera(cameraStream, videoEl);
  detector.dispose();
  player.stop();
});
