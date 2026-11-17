"""Draw Current's Sticker Book app icon (light, dark) and splash mark. Usage: python make_icons.py <out_dir>"""
import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw

S = 4  # supersample factor
N = 1024 * S

CORAL = (255, 122, 89, 255)
DARK_BG = (28, 25, 22, 255)
MINT = (205, 239, 217, 255)
INK = (42, 36, 32, 255)


CREAM = (246, 239, 230, 255)
BLACK = (0, 0, 0, 255)


def sticker_layer(size: int, edge, shadow_fill) -> Image.Image:
    """Mint rounded square with an outline, hard offset shadow and two waves, unrotated."""
    pad = size // 6
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    box = size - 2 * pad
    radius = box // 4
    outline = box // 26
    shadow = box // 26
    x0, y0 = pad, pad
    # hard shadow, then the outlined sticker
    d.rounded_rectangle((x0 + shadow, y0 + shadow, x0 + box + shadow, y0 + box + shadow), radius, fill=shadow_fill)
    d.rounded_rectangle((x0, y0, x0 + box, y0 + box), radius, fill=MINT, outline=edge, width=outline)
    # two waves, stamped as overlapping discs so the stroke edge stays clean
    r = box / 22
    amp = box * 0.07
    left, right = x0 + box * 0.2, x0 + box * 0.8
    steps = int((right - left) * 2)
    for cy in (y0 + box * 0.4, y0 + box * 0.62):
        for i in range(steps + 1):
            t = i / steps
            x = left + (right - left) * t
            y = cy - amp * math.sin(t * 2 * math.pi * 1.5)
            d.ellipse((x - r, y - r, x + r, y + r), fill=INK)
    return layer


def compose(bg, sticker_scale: float, tilt: float, edge=INK, shadow_fill=INK) -> Image.Image:
    canvas = Image.new("RGBA", (N, N), bg)
    size = int(N * sticker_scale)
    layer = sticker_layer(size, edge, shadow_fill).rotate(tilt, resample=Image.BICUBIC, expand=False)
    canvas.alpha_composite(layer, ((N - size) // 2, (N - size) // 2))
    return canvas.resize((1024, 1024), Image.LANCZOS)


def main() -> None:
    out = Path(sys.argv[1])
    # icons are opaque (App Store requirement); splash mark is transparent
    compose(CORAL, 0.92, 8).convert("RGB").save(out / "icon.png")
    # dark: cream die-cut edge so the sticker reads against the dark ground
    compose(DARK_BG, 0.92, 8, edge=CREAM, shadow_fill=BLACK).convert("RGB").save(out / "icon-dark.png")
    compose((0, 0, 0, 0), 1.0, 8).save(out / "splash-icon.png")


main()
