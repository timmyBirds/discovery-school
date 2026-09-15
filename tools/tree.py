#!/usr/bin/env python3
"""Generate the values-tree SVG (src/partials/tree.svg) in the style of the school's
original artwork: a leafy canopy in six colours, one per core value, labels around the
canopy, exposed roots, "Ready for Tomorrow" beside the trunk and "Rooted in Christ"
among the roots.

Run:  python3 tools/tree.py   then   python3 build.py
Pages include it with {{include:tree.svg}}.
"""
import math
import random
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "src" / "partials" / "tree.svg"
random.seed(7)

BARK = "#4a3222"
# value: (leaf shades, label colour, cluster centre, radius, label position, anchor)
VALUES = {
    "Excellence":  (["#b5306b", "#c94a83", "#9c2359"], "#9c2359", (200, 210), 82, (92, 122), "middle"),
    "Citizenship": (["#e8891d", "#f2a23d", "#c96f0f"], "#b84f0c", (305, 150), 78, (280, 56), "middle"),
    "Integrity":   (["#5b4fa8", "#7468bd", "#483d92"], "#4a3f95", (425, 160), 78, (462, 66), "middle"),
    "Discipline":  (["#2f6fb8", "#4a86c9", "#24579a"], "#24579a", (505, 260), 80, (608, 196), "middle"),
    "Wisdom":      (["#7c9a2e", "#93b043", "#5f7a20"], "#5a7020", (470, 362), 70, (606, 404), "middle"),
    "Ingenuity":   (["#2a9d8f", "#43b3a5", "#1e7a6f"], "#1e7a6f", (200, 342), 76, (84, 404), "middle"),
}
TRUNK_TOP = (352, 352)


def leaf(cx, cy, angle, scale, fill):
    return (f'<use href="#lf" fill="{fill}" '
            f'transform="translate({cx:.0f} {cy:.0f}) rotate({angle:.0f}) scale({scale:.2f})"/>')


def cluster(cx, cy, r, shades, n):
    out = []
    for _ in range(n):
        # denser toward the centre, a few strays past the radius
        d = r * math.sqrt(random.random()) * random.uniform(0.95, 1.12)
        t = random.uniform(0, 2 * math.pi)
        x, y = cx + d * math.cos(t), cy + d * math.sin(t)
        out.append(leaf(x, y, random.uniform(0, 360), random.uniform(0.8, 1.25), random.choice(shades)))
    return out


def branch(to, width):
    x0, y0 = TRUNK_TOP
    x1, y1 = to
    # stop short of the cluster centre; bend slightly for an organic feel
    x1, y1 = x0 + (x1 - x0) * 0.8, y0 + (y1 - y0) * 0.8
    cx, cy = (x0 + x1) / 2 + (y0 - y1) * 0.12, (y0 + y1) / 2 + (x1 - x0) * 0.12
    return f'<path d="M{x0} {y0} Q{cx:.0f} {cy:.0f} {x1:.0f} {y1:.0f}" stroke="{BARK}" stroke-width="{width}" fill="none" stroke-linecap="round"/>'


parts = [
    '<svg viewBox="0 0 700 680" role="img" aria-labelledby="tree-title tree-desc">',
    '<title id="tree-title">The Discovery School values tree</title>',
    '<desc id="tree-desc">A tree with exposed roots labelled Rooted in Christ, and a colourful canopy '
    'carrying the six core values: citizenship, discipline, excellence, ingenuity, integrity and wisdom. '
    'Beside the trunk: Ready for Tomorrow.</desc>',
    '<defs><path id="lf" d="M0 -16 C7 -10 8 4 0 16 C-8 4 -7 -10 0 -16 Z"/></defs>',
    # roots
    f'<g stroke="{BARK}" fill="none" stroke-linecap="round">',
    '<path d="M330 520 C300 560 250 580 190 600" stroke-width="11"/>',
    '<path d="M335 522 C320 575 280 610 240 640" stroke-width="8"/>',
    '<path d="M352 524 C350 570 335 615 320 655" stroke-width="7"/>',
    '<path d="M368 522 C385 575 420 610 455 640" stroke-width="8"/>',
    '<path d="M375 520 C410 560 460 585 520 600" stroke-width="11"/>',
    '<path d="M190 600 C160 605 140 612 118 610" stroke-width="5"/>',
    '<path d="M240 640 C225 655 205 662 190 660" stroke-width="4"/>',
    '<path d="M455 640 C470 655 490 662 508 660" stroke-width="4"/>',
    '<path d="M520 600 C550 606 570 612 592 610" stroke-width="5"/>',
    '<path d="M300 560 C280 555 262 560 248 552" stroke-width="4"/>',
    '<path d="M410 560 C430 555 448 560 462 552" stroke-width="4"/>',
    '<path d="M345 523 C330 590 300 630 270 660" stroke-width="5"/>',
    '<path d="M360 523 C372 590 400 630 430 662" stroke-width="5"/>',
    '<path d="M325 521 C280 545 230 552 165 560" stroke-width="6"/>',
    '<path d="M380 521 C425 545 475 552 540 560" stroke-width="6"/>',
    '</g>',
    # trunk
    f'<path d="M318 524 C326 470 336 410 340 352 L366 352 C370 410 380 470 388 524 Z" fill="{BARK}"/>',
]
# branches (drawn before leaves so the leaves cover their ends)
for name, (_, _, centre, _, _, _) in VALUES.items():
    parts.append(branch(centre, 9))
parts.append(branch((350, 262), 10))

# leaves: a mixed centre cluster first, then each value cluster on top
mixed = [s[0] for s, *_ in VALUES.values()]
parts += cluster(352, 262, 92, mixed, 70)
for name, (shades, _, (cx, cy), r, _, _) in VALUES.items():
    parts += cluster(cx, cy, r, shades, 72)

# labels
parts.append('<g font-family="Nunito, Segoe UI, Helvetica, Arial, sans-serif" font-weight="800" font-size="19" letter-spacing="1.5">')
for name, (_, colour, _, _, (lx, ly), anchor) in VALUES.items():
    parts.append(f'<text x="{lx}" y="{ly}" fill="{colour}" text-anchor="{anchor}">{name.upper()}</text>')
parts.append('</g>')
parts.append(f'<g font-family="Fraunces, Georgia, serif" font-weight="700" fill="{BARK}" text-anchor="middle">')
parts.append('<text x="515" y="468" font-size="30" letter-spacing="2">READY <tspan font-size="18">FOR</tspan></text>')
parts.append('<text x="515" y="502" font-size="30" letter-spacing="2">TOMORROW</text>')
parts.append('<text x="96" y="552" font-size="28" letter-spacing="2">ROOTED</text>')
parts.append('<text x="96" y="580" font-size="22">IN</text>')
parts.append('<text x="96" y="612" font-size="28" letter-spacing="2">CHRIST</text>')
parts.append('</g>')
parts.append('</svg>')

OUT.parent.mkdir(exist_ok=True)
OUT.write_text("\n".join(parts) + "\n")
print(f"wrote {OUT.relative_to(OUT.parents[2])} ({OUT.stat().st_size // 1024} KB)")
