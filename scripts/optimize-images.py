#!/usr/bin/env python3
"""
optimize-images.py
------------------
Batch-converts images in public/images/ to WebP.
- Skips icons/favicons (android-*, apple-*, ms-*, favicon*)
- Skips files that are already .webp
- Skips files that are .svg, .ico, .txt
- Resizes to max 900px wide (preserving aspect ratio); does NOT upscale
- Output quality: 82
- Writes <original-stem>.webp alongside the original
- Prints a summary of space saved

Usage:
    python scripts/optimize-images.py [--dry-run]
"""

import argparse
import os
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is not installed. Run: pip install Pillow")

IMAGES_DIR = Path(__file__).parent.parent / "public" / "images"
MAX_WIDTH = 900
QUALITY = 82
SKIP_PREFIXES = ("android-", "apple-", "ms-", "favicon")
SKIP_SUFFIXES = (
    ".svg",
    ".ico",
    ".txt",
    ".webp",
    ".bin",
    ".gltf",
    ".glb",
    ".obj",
    ".mtl",
    ".fcstd",
    ".stl",
)


def should_skip(path: Path) -> bool:
    name = path.name.lower()
    if any(name.startswith(p) for p in SKIP_PREFIXES):
        return True
    if any(name.endswith(s) for s in SKIP_SUFFIXES):
        return True
    return False


def convert(src: Path, dry_run: bool) -> tuple[int, int]:
    """Return (original_bytes, webp_bytes). webp_bytes=0 if skipped/failed."""
    if should_skip(src):
        return 0, 0

    dest = src.with_suffix(".webp")

    original_size = src.stat().st_size

    if dry_run:
        print(f"  [dry-run] would convert: {src.name} -> {dest.name}")
        return original_size, 0

    try:
        with Image.open(src) as img:
            # Convert palette / RGBA modes safely
            if img.mode in ("P", "RGBA"):
                img = img.convert("RGBA")
            elif img.mode != "RGB":
                img = img.convert("RGB")

            # Downscale only — never upscale
            if img.width > MAX_WIDTH:
                ratio = MAX_WIDTH / img.width
                new_size = (MAX_WIDTH, int(img.height * ratio))
                img = img.resize(new_size, Image.LANCZOS)

            img.save(dest, "WEBP", quality=QUALITY, method=6)

        webp_size = dest.stat().st_size
        saved = original_size - webp_size
        pct = (saved / original_size * 100) if original_size else 0
        print(
            f"  {src.name:45s}  {original_size // 1024:6d} KB -> {webp_size // 1024:5d} KB  ({pct:4.0f}% smaller)"
        )
        return original_size, webp_size

    except Exception as exc:
        print(f"  ERROR converting {src.name}: {exc}", file=sys.stderr)
        return original_size, 0


def main():
    parser = argparse.ArgumentParser(description="Convert images to WebP")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be done without writing files",
    )
    args = parser.parse_args()

    if not IMAGES_DIR.is_dir():
        sys.exit(f"Images directory not found: {IMAGES_DIR}")

    # Collect all image files (non-recursive at root, but also walk subdirs)
    sources = sorted(
        p for p in IMAGES_DIR.rglob("*") if p.is_file() and not should_skip(p)
    )

    if not sources:
        print("No images to process.")
        return

    print(f"Processing {len(sources)} image(s) in {IMAGES_DIR}\n")

    total_original = 0
    total_webp = 0

    for src in sources:
        orig, webp = convert(src, dry_run=args.dry_run)
        total_original += orig
        total_webp += webp

    if not args.dry_run and total_original:
        saved = total_original - total_webp
        pct = saved / total_original * 100
        print(
            f"\nTotal: {total_original // 1024:,} KB -> {total_webp // 1024:,} KB  ({pct:.0f}% smaller, {saved // 1024:,} KB saved)"
        )


if __name__ == "__main__":
    main()
