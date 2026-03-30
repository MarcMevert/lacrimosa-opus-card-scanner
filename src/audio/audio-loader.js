/**
 * audio-loader.js
 * Lazily fetches MP3 audio tracks from a GitHub Releases base URL on first
 * request.  Downloaded blobs are converted to Object URLs and cached in memory
 * so subsequent plays of the same track are instant.
 */

/** In-memory cache: trackId → Object URL */
const cache = new Map();

/**
 * Base URL for audio release assets.
 * Override via the VITE_AUDIO_BASE_URL environment variable in a .env file.
 */
const AUDIO_BASE =
  import.meta.env.VITE_AUDIO_BASE_URL ??
  'https://github.com/MarcMevert/lacrimosa-opus-card-scanner/releases/download/audio-v1';

/**
 * Return a playable URL for the given track ID, downloading and caching the
 * MP3 on first call.
 *
 * Object URLs are stored for the lifetime of the application (18 tracks
 * maximum) and are intentionally never revoked so that repeat plays within
 * the same session are instant.
 *
 * @param {string} trackId  Card identifier, e.g. "OP-08"
 * @returns {Promise<string>} Object URL ready for use in an HTMLAudioElement
 */
export async function getTrackUrl(trackId) {
  if (cache.has(trackId)) return cache.get(trackId);

  const url = `${AUDIO_BASE}/${trackId}.mp3`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load audio for ${trackId}: HTTP ${res.status}`);

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  cache.set(trackId, objectUrl);
  return objectUrl;
}
