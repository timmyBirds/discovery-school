#!/usr/bin/env python3
"""Build optimised web images from src/assets into dist/assets/img.

- Photos: resized to several widths, EXIF (incl. GPS) stripped, saved as WebP + JPEG fallback.
- Logo: white matte removed with soft alpha, saved as transparent PNG.
- NAPS seal: clipped to its ring so the square white backing does not show.

Run:  python3 tools/images.py
Needs: Pillow  (pip install pillow)
"""
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src" / "assets"
OUT = ROOT / "dist" / "assets" / "img"
OUT.mkdir(parents=True, exist_ok=True)

PHOTOS = {
    # name: (source, widths)
    "lab":    ("hero.jpg",   [1800, 1200, 800, 480]),
    "campus": ("school.jpg", [1800, 1200, 800, 480]),
    "sewing": ("clubs.jpg",  [1200, 800, 480]),
}


def photo(name, source, widths):
    im = Image.open(SRC / source)
    im = ImageOps.exif_transpose(im).convert("RGB")   # honour orientation, then drop all metadata
    for w in widths:
        if w > im.width:
            continue
        h = round(im.height * w / im.width)
        r = im.resize((w, h), Image.LANCZOS)
        r.save(OUT / f"{name}-{w}.webp", "WEBP", quality=78, method=6)
        r.save(OUT / f"{name}-{w}.jpg", "JPEG", quality=80, optimize=True, progressive=True)
        print(f"{name}-{w}: webp {(OUT / f'{name}-{w}.webp').stat().st_size // 1024} KB, "
              f"jpg {(OUT / f'{name}-{w}.jpg').stat().st_size // 1024} KB")


def unmatte(source, dest, max_w, knee=60):
    """Turn a logo drawn on a white background into a transparent PNG with smooth edges.

    Alpha is derived from how far each pixel is from pure white (the darkest channel),
    reaching fully opaque once any channel is at or below `knee`. Colours are then
    un-premultiplied so anti-aliased edge pixels keep their true (dark) colour instead
    of a white fringe.
    """
    im = Image.open(SRC / source).convert("RGB")
    if im.width > max_w:
        im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
    out = Image.new("RGBA", im.size)
    src, dst = im.load(), out.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b = src[x, y]
            a = min(1.0, (255 - min(r, g, b)) / (255 - knee))
            if a <= 0.02:
                dst[x, y] = (0, 0, 0, 0)
                continue
            # un-premultiply against the white matte
            r2, g2, b2 = [max(0, min(255, round((c - (1 - a) * 255) / a))) for c in (r, g, b)]
            dst[x, y] = (r2, g2, b2, round(a * 255))
    out = out.crop(out.getbbox())
    out.save(OUT / dest, "PNG", optimize=True)
    print(f"{dest}: {(OUT / dest).stat().st_size // 1024} KB, {out.width}x{out.height}")


def seal_circle(source, dest):
    """The seal PNG has a white rounded square behind its gold ring whose corners poke
    outside the circle. Clip everything outside the ring's outer edge to transparent."""
    im = Image.open(SRC / source).convert("RGBA")
    px = im.load()
    gold = [(x, y) for y in range(im.height) for x in range(im.width)
            if px[x, y][3] > 200 and not all(c > 235 for c in px[x, y][:3])]
    xs, ys = [p[0] for p in gold], [p[1] for p in gold]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    r = max(max(xs) - min(xs), max(ys) - min(ys)) / 2 + 1
    for y in range(im.height):
        for x in range(im.width):
            if (x - cx) ** 2 + (y - cy) ** 2 > r * r:
                px[x, y] = (0, 0, 0, 0)
    im = im.crop(im.getbbox())
    im.save(OUT / dest, "PNG", optimize=True)
    print(f"{dest}: {(OUT / dest).stat().st_size // 1024} KB, {im.width}x{im.height}")


if __name__ == "__main__":
    for name, (source, widths) in PHOTOS.items():
        photo(name, source, widths)
    unmatte("logo.jpg", "logo.png", 960)
    seal_circle("naps-seal.png", "naps-seal.png")
