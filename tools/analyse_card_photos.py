#!/usr/bin/env python3
"""
analyse_card_photos.py
───────────────────────
Offline Python equivalent of the browser-side OpenCV pipeline in
src/cv/opencv-worker.js and the dHash logic in src/cv/card-identifier.js.

Detects a Lacrimosa Opus card in a JPG photo, perspective-corrects it to
250 × 350 pixels, and prints the 64-bit dHash value ready to paste into
src/data/opus-cards.js.

Pipeline (mirrors opencv-worker.js)
─────────────────────────────────────
 1. BGR → Greyscale
 2. Gaussian Blur  5 × 5
 3. Adaptive Threshold  (block 11, C = 2)
 4. Canny Edge Detection  (75 / 200)
 5. Dilation  3 × 3 kernel
 6. Find External Contours
 7. Largest Quad selection  (approxPolyDP, ε = 0.02 × perimeter)
 8. Perspective Transform → 250 × 350

dHash (mirrors card-identifier.js)
────────────────────────────────────
 • Resize to 9 × 8
 • Convert to greyscale
 • 64-bit difference hash (bit = 1 if left pixel > right pixel)

Note on high-resolution photos
────────────────────────────────
High-resolution photos (e.g. from a smartphone camera at full resolution) may
not be detected with the exact ε = 0.02 that the browser pipeline uses, because
OpenCV.js in the browser processes live camera frames at a much lower resolution.
When detection fails at the input resolution, the script automatically retries
at progressively lower working resolutions (down to 640 px wide) and, if needed,
at progressively relaxed epsilon values (up to 0.05).  When a fallback is used,
this is clearly reported in the output.

Usage
──────
  python tools/analyse_card_photos.py <image.jpg> [<image2.jpg> ...]
  python tools/analyse_card_photos.py --debug <image.jpg>
"""

import argparse
from pathlib import Path

import cv2
import numpy as np


# ── Constants ────────────────────────────────────────────────────────────────

CARD_W = 250
CARD_H = 350

# Minimum fraction of the frame area a contour must cover to be a card candidate
# (mirrors MIN_CARD_AREA_RATIO in opencv-worker.js)
MIN_CARD_AREA_RATIO = 0.05

# dHash dimensions  (mirrors HASH_W / HASH_H in card-identifier.js)
HASH_W = 9   # one wider than the hash width to produce 8 comparisons per row
HASH_H = 8

# Fallback working resolutions to try when the image is too large for ε = 0.02
# to produce a clean 4-vertex approximation.  These match typical camera stream
# widths that the browser pipeline is designed for.
_FALLBACK_WIDTHS = [1280, 1000, 800, 640]

# Fallback epsilon values (applied in order when the primary ε = 0.02 fails)
_FALLBACK_EPSILONS = [0.02, 0.03, 0.04, 0.05]


# ── Corner sorting ────────────────────────────────────────────────────────────

def sort_corners(corners):
    """
    Order four corner points as [top-left, top-right, bottom-right, bottom-left].

    Uses coordinate sums and differences, mirroring sortCorners() in
    opencv-worker.js.

    Parameters
    ----------
    corners : list of (x, y) tuples
        Four unordered corner points.

    Returns
    -------
    list of (x, y) tuples
        Corners ordered [top-left, top-right, bottom-right, bottom-left].
    """
    by_sum = sorted(corners, key=lambda p: p[0] + p[1])
    top_left     = by_sum[0]
    bottom_right = by_sum[3]
    by_diff = sorted([by_sum[1], by_sum[2]], key=lambda p: p[0] - p[1])
    top_right   = by_diff[0]
    bottom_left = by_diff[1]
    return [top_left, top_right, bottom_right, bottom_left]


# ── dHash ─────────────────────────────────────────────────────────────────────

def compute_dhash(bgr_image):
    """
    Compute the 64-bit dHash of a BGR card image.

    Mirrors computeDHash() in card-identifier.js:
      1. Resize to HASH_W × HASH_H  (9 × 8)
      2. Convert to greyscale
      3. Build 64-bit hash: bit = 1 if left pixel > right pixel

    Parameters
    ----------
    bgr_image : numpy.ndarray
        The perspective-corrected card image in BGR colour space.

    Returns
    -------
    int
        64-bit dHash value.
    """
    small = cv2.resize(bgr_image, (HASH_W, HASH_H), interpolation=cv2.INTER_AREA)
    gray  = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY).astype(float)

    hash_value = 0
    for y in range(HASH_H):
        for x in range(HASH_W - 1):
            hash_value = (hash_value << 1) | (1 if gray[y, x] > gray[y, x + 1] else 0)

    return hash_value


# ── Card detection pipeline ───────────────────────────────────────────────────

def _run_pipeline(image, eps_frac, debug_dir=None):
    """
    Run steps 1–7 of the CV pipeline on *image* with a given epsilon fraction.

    Parameters
    ----------
    image : numpy.ndarray
        BGR image to process (may be a downscaled version of the original).
    eps_frac : float
        Epsilon as a fraction of the contour perimeter for approxPolyDP.
    debug_dir : Path or None
        When set, intermediate images are written here.

    Returns
    -------
    numpy.ndarray or None
        The best 4-point approxPolyDP result in *image* coordinates, or None
        when no qualifying quadrilateral contour was found.
    """
    height, width = image.shape[:2]
    min_area = width * height * MIN_CARD_AREA_RATIO

    # 1. BGR → Greyscale
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    if debug_dir:
        cv2.imwrite(str(debug_dir / '1_gray.jpg'), gray)

    # 2. Gaussian Blur 5 × 5
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    if debug_dir:
        cv2.imwrite(str(debug_dir / '2_blurred.jpg'), blurred)

    # 3. Adaptive Threshold (block 11, C = 2)
    thresh = cv2.adaptiveThreshold(
        blurred, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY,
        11, 2,
    )
    if debug_dir:
        cv2.imwrite(str(debug_dir / '3_thresh.jpg'), thresh)

    # 4. Canny Edge Detection (thresholds 75, 200)
    edges = cv2.Canny(thresh, 75, 200)
    if debug_dir:
        cv2.imwrite(str(debug_dir / '4_canny.jpg'), edges)

    # 5. Dilation with 3 × 3 kernel
    kernel = np.ones((3, 3), np.uint8)
    dilated = cv2.dilate(edges, kernel)
    if debug_dir:
        cv2.imwrite(str(debug_dir / '5_dilated.jpg'), dilated)

    # 6. Find External Contours
    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if debug_dir:
        contour_vis = image.copy()
        cv2.drawContours(contour_vis, contours, -1, (0, 255, 0), 2)
        cv2.imwrite(str(debug_dir / '6_contours.jpg'), contour_vis)

    # 7. Largest Quadrilateral selection
    best_approx = None
    max_area    = 0

    for contour in contours:
        area = cv2.contourArea(contour)
        if area < min_area:
            continue

        peri   = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, eps_frac * peri, True)

        if len(approx) == 4 and area > max_area:
            best_approx = approx
            max_area    = area

    return best_approx


def detect_card(image, debug_dir=None):
    """
    Run the full CV pipeline on a BGR image and return the perspective-corrected
    card image together with its corner coordinates.

    Mirrors detectCard() in opencv-worker.js.  When the image is larger than
    the typical browser camera-frame resolution, detection is retried at
    progressively lower working resolutions and, if needed, with relaxed epsilon
    values so that high-resolution photos are handled robustly.

    Parameters
    ----------
    image : numpy.ndarray
        Input image in BGR colour space.
    debug_dir : Path or None
        When set, intermediate pipeline images are saved into this directory.

    Returns
    -------
    tuple (warped, corners, note) or (None, None, None)
        warped   – 250 × 350 BGR card image, or None if no card found.
        corners  – list of four (x, y) tuples in [TL, TR, BR, BL] order, or None.
        note     – human-readable string describing any fallback that was used,
                   or None when the primary ε = 0.02 was sufficient.
    """
    orig_h, orig_w = image.shape[:2]

    # Build the list of (working_image, scale, label) attempts.  Start with the
    # original resolution (scale = 1.0) then try progressively smaller widths.
    attempts = [(image, 1.0, None)]
    for target_w in _FALLBACK_WIDTHS:
        if target_w < orig_w:
            scale   = target_w / orig_w
            new_w   = target_w
            new_h   = int(orig_h * scale)
            resized = cv2.resize(image, (new_w, new_h))
            attempts.append((resized, scale, f'working resolution {new_w}×{new_h}'))

    for work_img, scale, res_label in attempts:
        for eps_frac in _FALLBACK_EPSILONS:
            # Only save debug images on the first (primary) attempt
            d = debug_dir if (scale == 1.0 and eps_frac == _FALLBACK_EPSILONS[0]) else None
            best_approx = _run_pipeline(work_img, eps_frac, debug_dir=d)

            if best_approx is None:
                continue

            # Build fallback note (None means "primary pipeline succeeded")
            note = None
            if res_label or eps_frac != 0.02:
                parts = []
                if res_label:
                    parts.append(res_label)
                if eps_frac != 0.02:
                    parts.append(f'ε = {eps_frac}')
                note = 'fallback used: ' + ', '.join(parts)

            # Scale corners back to original-image coordinates
            inv_scale   = 1.0 / scale
            raw_corners = [
                (int(pt[0][0] * inv_scale), int(pt[0][1] * inv_scale))
                for pt in best_approx
            ]

            # Sort into [top-left, top-right, bottom-right, bottom-left]
            sorted_pts = sort_corners(raw_corners)

            # 8. Perspective Transform on the original full-resolution image
            src_pts = np.array(sorted_pts, dtype=np.float32)
            dst_pts = np.array([
                [0,      0],
                [CARD_W, 0],
                [CARD_W, CARD_H],
                [0,      CARD_H],
            ], dtype=np.float32)

            M      = cv2.getPerspectiveTransform(src_pts, dst_pts)
            warped = cv2.warpPerspective(image, M, (CARD_W, CARD_H))

            return warped, sorted_pts, note

    return None, None, None


# ── Per-image analysis ────────────────────────────────────────────────────────

def analyse_image(image_path, debug=False):
    """
    Load one image, run the detection pipeline, print results, and save outputs.

    Parameters
    ----------
    image_path : Path
        Path to the input JPG (or any OpenCV-readable format).
    debug : bool
        When True, save intermediate pipeline images into a ``debug_<stem>/``
        subdirectory next to the input file.
    """
    stem = image_path.stem
    print(f"\n{'─' * 60}")
    print(f"Image : {image_path}")

    image = cv2.imread(str(image_path))
    if image is None:
        print(f"ERROR : Could not read image — check the file path and format.")
        return

    h, w = image.shape[:2]
    print(f"Size  : {w} × {h} px")

    debug_dir = None
    if debug:
        debug_dir = image_path.parent / f'debug_{stem}'
        debug_dir.mkdir(parents=True, exist_ok=True)
        print(f"Debug : saving intermediate images to {debug_dir}/")

    warped, corners, note = detect_card(image, debug_dir=debug_dir)

    if warped is None:
        print("\n⚠  No card detected.")
        print("\nTuning suggestions:")
        print("  • Ensure the card fills at least 5 % of the frame area.")
        print("  • Try better lighting to improve edge contrast.")
        print("  • Reduce background clutter so the card is the dominant rectangle.")
        print("  • If the card is very dark or low contrast, try --debug to inspect")
        print("    the intermediate pipeline images (threshold, canny, dilated).")
        return

    print(f"\n✓  Card detected" + (f"  ({note})" if note else ""))
    print(f"   Corners (TL, TR, BR, BL):")
    labels = ["top-left", "top-right", "bottom-right", "bottom-left"]
    for label, (x, y) in zip(labels, corners):
        print(f"     {label:14s}  ({x:4d}, {y:4d})")

    # Save warped image
    out_path = image_path.parent / f'warped_{stem}.jpg'
    cv2.imwrite(str(out_path), warped)
    print(f"\n   Warped card saved → {out_path}")

    # Save annotated source image in debug mode
    if debug_dir:
        annotated = image.copy()
        pts = np.array(corners, dtype=np.int32).reshape((-1, 1, 2))
        cv2.polylines(annotated, [pts], isClosed=True, color=(0, 255, 0), thickness=3)
        for (x, y), label in zip(corners, labels):
            cv2.putText(annotated, label, (x + 5, y - 5),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
        cv2.imwrite(str(debug_dir / '7_annotated.jpg'), annotated)

    # dHash
    dhash = compute_dhash(warped)
    print(f"\n   dHash:")
    print(f"     decimal : {dhash}")
    print(f"     hex     : 0x{dhash:016X}")
    print(f"     JS BigInt (for opus-cards.js) : {dhash}n")


# ── CLI entry-point ───────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description=(
            "Analyse JPG photos of Lacrimosa Opus cards, run them through the "
            "same computer vision pipeline as src/cv/opencv-worker.js, and print "
            "the dHash values needed to populate src/data/opus-cards.js."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples\n"
            "────────\n"
            "  python tools/analyse_card_photos.py PXL_20260330_082534251.jpg\n"
            "  python tools/analyse_card_photos.py --debug PXL_20260330_*.jpg\n"
        ),
    )
    parser.add_argument(
        'images',
        metavar='IMAGE',
        nargs='+',
        help='Path(s) to the JPG photo(s) to analyse.',
    )
    parser.add_argument(
        '--debug',
        action='store_true',
        help=(
            'Save intermediate pipeline images (greyscale, blurred, threshold, '
            'canny, dilated, contours) into a debug_<stem>/ directory next to '
            'each input file.'
        ),
    )

    args = parser.parse_args()

    for image_arg in args.images:
        analyse_image(Path(image_arg), debug=args.debug)

    print(f"\n{'─' * 60}")


if __name__ == '__main__':
    main()
