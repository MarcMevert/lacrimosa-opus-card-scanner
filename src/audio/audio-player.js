/**
 * audio-player.js
 * Simple wrapper around the Web Audio API / HTMLAudioElement for
 * play / pause / stop / volume control of an audio URL.
 */
export class AudioPlayer {
  constructor() {
    /** @type {HTMLAudioElement | null} */
    this._audio = null;
    this._volume = 0.8;
  }

  /**
   * Load and play a new track.  If a track is already playing it is stopped
   * first. Resolves once playback starts.
   * @param {string} url
   * @returns {Promise<void>}
   */
  async play(url) {
    this.stop();
    this._audio = new Audio(url);
    this._audio.volume = this._volume;
    await this._audio.play();
  }

  /** Pause the current track (resumable). */
  pause() {
    this._audio?.pause();
  }

  /** Resume a paused track. */
  resume() {
    this._audio?.play();
  }

  /** Stop and discard the current track. */
  stop() {
    if (!this._audio) return;
    this._audio.pause();
    this._audio.currentTime = 0;
    this._audio = null;
  }

  /**
   * Set the playback volume (0.0 – 1.0).
   * @param {number} value
   */
  setVolume(value) {
    this._volume = Math.max(0, Math.min(1, value));
    if (this._audio) this._audio.volume = this._volume;
  }

  /** Whether a track is currently loaded. */
  get hasTrack() {
    return this._audio !== null;
  }

  /** Whether the current track is playing. */
  get isPlaying() {
    return this._audio ? !this._audio.paused : false;
  }
}
