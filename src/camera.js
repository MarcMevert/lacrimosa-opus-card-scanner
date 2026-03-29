/**
 * camera.js
 * Manages access to the device camera via the MediaDevices API and provides
 * a helper to capture the current video frame onto a canvas.
 */

const CAMERA_CONSTRAINTS = {
  video: {
    facingMode: 'environment', // prefer rear camera on mobile
    width: { ideal: 1280 },
    height: { ideal: 720 },
  },
  audio: false,
};

/**
 * Start the camera stream and attach it to the given <video> element.
 * @param {HTMLVideoElement} videoEl
 * @returns {Promise<MediaStream>}
 */
export async function startCamera(videoEl) {
  const stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
  videoEl.srcObject = stream;
  await new Promise((resolve, reject) => {
    videoEl.onloadedmetadata = resolve;
    videoEl.onerror = reject;
  });
  await videoEl.play();
  return stream;
}

/**
 * Stop all tracks of the given stream and detach from the video element.
 * @param {MediaStream} stream
 * @param {HTMLVideoElement} videoEl
 */
export function stopCamera(stream, videoEl) {
  stream.getTracks().forEach((track) => track.stop());
  videoEl.srcObject = null;
}

/**
 * Capture the current video frame into an OffscreenCanvas and return
 * the raw ImageData along with the frame dimensions.
 *
 * @param {HTMLVideoElement} videoEl
 * @returns {{ imageData: ImageData, width: number, height: number } | null}
 */
export function captureFrame(videoEl) {
  const { videoWidth: width, videoHeight: height } = videoEl;
  if (!width || !height) return null;

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(videoEl, 0, 0, width, height);
  return { imageData: ctx.getImageData(0, 0, width, height), width, height };
}
