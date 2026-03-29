/**
 * card-identifier.js
 * Perceptual image hashing (dHash) for matching a detected card image
 * against the Opus card database.
 *
 * Algorithm – Difference Hash (dHash, 64-bit)
 * ─────────────────────────────────────────────
 *  1. Resize the card image to 9 × 8 pixels using an OffscreenCanvas.
 *  2. Convert each pixel to greyscale (luminance formula).
 *  3. For every row, compare each pixel to the next one to the right.
 *  4. Encode the 64 comparisons as a BigInt (bit = 1 if left > right).
 *
 * Two hashes are considered the same card if their Hamming distance is ≤ 10
 * (out of 64 bits), which tolerates minor lighting / angle differences.
 */

const HASH_W = 9; // one wider than the hash width to produce 8 comparisons per row
const HASH_H = 8;
const MATCH_THRESHOLD = 10; // bits that may differ and still count as a match

/**
 * Compute the dHash of a card image.
 *
 * @param {Uint8ClampedArray} rgba   Raw pixel data (RGBA, width × height × 4)
 * @param {number} width
 * @param {number} height
 * @returns {bigint}
 */
export function computeDHash(rgba, width, height) {
  // Resize to HASH_W × HASH_H via an OffscreenCanvas
  const src = new OffscreenCanvas(width, height);
  src.getContext('2d').putImageData(new ImageData(rgba, width, height), 0, 0);

  const small = new OffscreenCanvas(HASH_W, HASH_H);
  const ctx   = small.getContext('2d');
  ctx.drawImage(src, 0, 0, HASH_W, HASH_H);
  const pixels = ctx.getImageData(0, 0, HASH_W, HASH_H).data;

  // Convert to greyscale
  const gray = new Float32Array(HASH_W * HASH_H);
  for (let i = 0; i < HASH_W * HASH_H; i++) {
    const base = i * 4;
    gray[i] = 0.299 * pixels[base] + 0.587 * pixels[base + 1] + 0.114 * pixels[base + 2];
  }

  // Build 64-bit hash: one bit per horizontal neighbour comparison
  let hash = 0n;
  for (let y = 0; y < HASH_H; y++) {
    for (let x = 0; x < HASH_W - 1; x++) {
      hash = (hash << 1n) | (gray[y * HASH_W + x] > gray[y * HASH_W + x + 1] ? 1n : 0n);
    }
  }
  return hash;
}

const HASH_MASK_64BIT = 0xFFFFFFFFFFFFFFFFn;

/**
 * Count the number of differing bits between two 64-bit hashes.
 * @param {bigint} a
 * @param {bigint} b
 * @returns {number}
 */
export function hammingDistance(a, b) {
  let xor = (a ^ b) & HASH_MASK_64BIT; // clamp to 64 bits
  let dist = 0;
  while (xor > 0n) {
    dist += Number(xor & 1n);
    xor >>= 1n;
  }
  return dist;
}

/**
 * Try to identify a card from a flat (perspective-corrected) RGBA image.
 *
 * @param {Uint8ClampedArray} rgba
 * @param {number} width
 * @param {number} height
 * @param {Array<{ id: string, hash: bigint|null, [key: string]: any }>} database
 * @returns {{ card: object, confidence: number } | null}
 */
export function identifyCard(rgba, width, height, database) {
  const hash = computeDHash(rgba, width, height);

  let bestCard = null;
  let minDist  = Infinity;

  for (const card of database) {
    if (card.hash === null) continue; // hash not yet computed for this card
    const dist = hammingDistance(hash, card.hash);
    if (dist < minDist) {
      minDist  = dist;
      bestCard = card;
    }
  }

  if (bestCard && minDist <= MATCH_THRESHOLD) {
    return { card: bestCard, confidence: 1 - minDist / 64 };
  }
  return null;
}
