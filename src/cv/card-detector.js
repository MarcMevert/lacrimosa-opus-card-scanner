/**
 * card-detector.js
 * Promise-based wrapper around opencv-worker.js.
 *
 * Spawns a single classic Worker, waits for OpenCV to initialise, then
 * exposes a `detect(imageData)` method that resolves with the detection
 * result or null when no card is found.
 */

/** @typedef {{ x: number, y: number }} Point */
/**
 * @typedef {Object} DetectionResult
 * @property {Point[]} corners          Four corner points in the source frame
 * @property {ArrayBuffer} warpedBuffer Pixel data of the perspective-corrected card (RGBA)
 * @property {number} warpedWidth
 * @property {number} warpedHeight
 */

export class CardDetector {
  constructor() {
    this._worker = new Worker(
      new URL('./opencv-worker.js', import.meta.url),
      // Module worker – required because the worker uses ES `import` statements
      { type: 'module' },
    );

    /** @type {Map<number, { resolve: Function, reject: Function }>} */
    this._pending = new Map();
    this._nextId  = 0;

    /** Resolves once OpenCV.js has finished loading its WASM binary */
    this._ready = new Promise((resolve) => {
      this._worker.onmessage = (event) => {
        if (event.data.type === 'ready') {
          // Switch to the regular message handler after init
          this._worker.onmessage = (e) => this._handleMessage(e);
          resolve();
        }
      };
    });

    this._worker.onerror = (err) => {
      console.error('[CardDetector] Worker error:', err);
    };
  }

  /**
   * Wait until OpenCV.js is ready inside the worker.
   * @returns {Promise<void>}
   */
  waitForReady() {
    return this._ready;
  }

  /**
   * Send a frame to the worker for card detection.
   * The ImageData buffer is *transferred* (zero-copy) so the caller must not
   * use it after this call.
   *
   * @param {ImageData} imageData
   * @returns {Promise<DetectionResult | null>}
   */
  async detect(imageData) {
    await this._ready;

    return new Promise((resolve, reject) => {
      const id = this._nextId++;
      this._pending.set(id, { resolve, reject });

      // Transfer the underlying ArrayBuffer for zero-copy messaging
      this._worker.postMessage(
        {
          id,
          type: 'detect',
          width: imageData.width,
          height: imageData.height,
          buffer: imageData.data.buffer,
        },
        [imageData.data.buffer],
      );
    });
  }

  /** Terminate the worker and reject any pending calls. */
  dispose() {
    this._worker.terminate();
    for (const { reject } of this._pending.values()) {
      reject(new Error('CardDetector disposed'));
    }
    this._pending.clear();
  }

  // ── private ──────────────────────────────────────────────────────────────

  _handleMessage({ data }) {
    const entry = this._pending.get(data.id);
    if (!entry) return;
    this._pending.delete(data.id);

    if (data.type === 'error') {
      entry.reject(new Error(data.message));
    } else {
      // type === 'result'
      entry.resolve(data.corners ? data : null);
    }
  }
}
