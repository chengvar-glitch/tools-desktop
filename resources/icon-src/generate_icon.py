#!/usr/bin/env python3
"""Generate the tools-desktop app icon set.

Design: glassy multi-stop gradient rounded card + minimal geometric toolbox
glyph with an amber latch accent. Rendered at 4x supersample (4096) and
downsampled with Lanczos for clean anti-aliased edges at every size.

Outputs:
  resources/icons/icon_<size>.png   for size in 16..1024
  resources/icons/icon.ico          16..256 bundled
  resources/icons/preview.png       dark/light contact sheet for review
  resources/icon.png                replaced with the 512px build
  build/icons/<s>x<s>.png           electron-builder linux icon set
  build/icon.ico                    electron-builder win icon
  build/icon.icns                   electron-builder mac icon
"""

from __future__ import annotations

import os
import shutil

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
RES = os.path.join(ROOT, 'resources')
BUILD = os.path.join(ROOT, 'build')

# ---------------------------------------------------------------- constants
B = 4096  # supersample canvas (4x of the 1024 design grid)
S = B / 1024.0


def px(v: float) -> float:
    """Map a 1024-design-space coordinate onto the supersample canvas."""
    return v * S


CARD = (px(0), px(0), px(1024), px(1024))
CARD_RADIUS = px(232)

# diagonal gradient stops, top-left -> bottom-right
CARD_STOPS = [
    (0.00, (124, 108, 255)),  # indigo-violet
    (0.45, (63, 124, 249)),  # blue
    (1.00, (41, 196, 232)),  # cyan
]
GLOW_CYAN = (px(819), px(963), px(560), (103, 232, 249), 120)
GLOW_VIOLET = (px(102), px(20), px(500), (167, 139, 250), 110)
SHEEN_ALPHA = 105
SHEEN_EXTENT = 0.62  # fraction of card height the top sheen fades over

# glyph geometry (1024 design space)
HANDLE_C = (512.0, 392.0)
HANDLE_R = 120.0
HANDLE_W = 58.0
BODY = (256.0, 392.0, 768.0, 744.0)
BODY_RADIUS = 64.0
SEAM_Y = 500.0
LATCH = (464.0, 462.0, 560.0, 542.0)
LATCH_RADIUS = 22.0
GLYPH_TOP = (255, 255, 255)
GLYPH_BOTTOM = (219, 233, 255)
HANDLE_COLOR = (243, 247, 255)
LATCH_TOP = (255, 209, 102)
LATCH_BOTTOM = (245, 158, 11)
SHADOW_BOX = (292.0, 430.0, 732.0, 780.0)
SHADOW_RADIUS = 60.0
SHADOW_OFFSET = 26.0
SHADOW_BLUR = 46.0
SHADOW_COLOR = (23, 49, 118, 115)

SIZES = [16, 24, 32, 48, 64, 128, 256, 512, 1024]


# ---------------------------------------------------------------- helpers
def vgrad(size: tuple[int, int], y0: float, y1: float, top, bottom) -> Image.Image:
    """Vertical two-stop RGB gradient."""
    w, h = size
    t = np.clip((np.arange(h, dtype=np.float64)[:, None] - y0) / max(y1 - y0, 1.0), 0.0, 1.0)
    t = np.broadcast_to(t, (h, w))
    arr = np.empty((h, w, 3), np.uint8)
    for c in range(3):
        arr[..., c] = (top[c] + (bottom[c] - top[c]) * t).astype(np.uint8)
    return Image.fromarray(arr, 'RGB')


def diag_gradient(size: tuple[int, int], box, stops) -> Image.Image:
    """Multi-stop gradient along the box diagonal (top-left -> bottom-right)."""
    w, h = size
    y, x = np.mgrid[0:h, 0:w].astype(np.float64)
    x0, y0, x1, y1 = box
    dx, dy = x1 - x0, y1 - y0
    t = np.clip(((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy), 0.0, 1.0)
    pos = np.array([s[0] for s in stops], np.float64)
    cols = np.array([s[1] for s in stops], np.float64)
    arr = np.empty((h, w, 3), np.uint8)
    for c in range(3):
        arr[..., c] = np.interp(t, pos, cols[:, c]).astype(np.uint8)
    return Image.fromarray(arr, 'RGB')


def radial_glow(size: tuple[int, int], cx: float, cy: float, radius: float, color, max_alpha: int) -> Image.Image:
    """Soft radial glow as an RGBA layer."""
    w, h = size
    y, x = np.mgrid[0:h, 0:w].astype(np.float64)
    d = np.sqrt((x - cx) ** 2 + (y - cy) ** 2) / radius
    a = np.clip(1.0 - d, 0.0, 1.0) ** 1.6 * max_alpha
    layer = np.zeros((h, w, 4), np.uint8)
    layer[..., 0], layer[..., 1], layer[..., 2] = color
    layer[..., 3] = a.astype(np.uint8)
    return Image.fromarray(layer, 'RGBA')


def rounded_mask(size: tuple[int, int], box, radius: float) -> Image.Image:
    m = Image.new('L', size, 0)
    ImageDraw.Draw(m).rounded_rectangle(box, radius=radius, fill=255)
    return m


def scaled_alpha(layer: Image.Image, mask: Image.Image) -> Image.Image:
    """Intersect an RGBA layer's alpha with an L mask."""
    r, g, b, a = layer.split()
    a = Image.fromarray(
        (np.asarray(a, np.uint16) * np.asarray(mask, np.uint16) // 255).astype(np.uint8)
    )
    return Image.merge('RGBA', (r, g, b, a))


# ---------------------------------------------------------------- build
def build_master() -> Image.Image:
    size = (B, B)
    card_mask = rounded_mask(size, CARD, CARD_RADIUS)

    # -- card base: diagonal gradient + glows + sheen, clipped to the card
    base = diag_gradient(size, CARD, CARD_STOPS).convert('RGBA')
    base.putalpha(card_mask)  # 圆角外的四角保持透明，否则整张图是方块
    for cx, cy, radius, color, alpha in (GLOW_CYAN, GLOW_VIOLET):
        base.alpha_composite(scaled_alpha(radial_glow(size, cx, cy, radius, color, alpha), card_mask))

    sheen = Image.new('RGBA', size, (0, 0, 0, 0))
    top, bottom = CARD[1], CARD[1] + (CARD[3] - CARD[1]) * SHEEN_EXTENT
    ramp = np.zeros((B, B), np.uint8)
    rows = np.arange(B, dtype=np.float64)[:, None]
    a = np.clip((bottom - rows) / (bottom - top), 0.0, 1.0) ** 1.3 * SHEEN_ALPHA
    ramp[:, :] = a.astype(np.uint8)
    sheen = Image.merge('RGBA', (Image.new('L', size, 255),) * 3 + (Image.fromarray(ramp, 'L'),))
    base.alpha_composite(scaled_alpha(sheen, card_mask))

    # -- glyph drop shadow, blurred then clipped to the card
    shadow = Image.new('RGBA', size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        (px(SHADOW_BOX[0]), px(SHADOW_BOX[1] + SHADOW_OFFSET), px(SHADOW_BOX[2]), px(SHADOW_BOX[3] + SHADOW_OFFSET)),
        radius=px(SHADOW_RADIUS),
        fill=SHADOW_COLOR,
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(px(SHADOW_BLUR)))
    base.alpha_composite(scaled_alpha(shadow, card_mask))

    # -- toolbox glyph
    glyph = Image.new('RGBA', size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(glyph)
    # handle: top half of an annulus, ends tucked behind the body
    draw.arc(
        (px(HANDLE_C[0] - HANDLE_R), px(HANDLE_C[1] - HANDLE_R), px(HANDLE_C[0] + HANDLE_R), px(HANDLE_C[1] + HANDLE_R)),
        start=178,
        end=362,
        fill=HANDLE_COLOR,
        width=int(px(HANDLE_W)),
    )
    # body: vertical white gradient through a rounded-rect mask
    body_box = tuple(px(v) for v in BODY)
    body_mask = rounded_mask(size, body_box, px(BODY_RADIUS))
    body_layer = vgrad(size, px(BODY[1]), px(BODY[3]), GLYPH_TOP, GLYPH_BOTTOM).convert('RGBA')
    glyph.paste(body_layer, (0, 0), body_mask)
    # lid: slightly cooler tone above the seam so the box reads as a toolbox
    lid = Image.new('RGBA', size, (0, 0, 0, 0))
    ImageDraw.Draw(lid).rounded_rectangle(
        (body_box[0], body_box[1], body_box[2], px(SEAM_Y + 40)),
        radius=px(BODY_RADIUS),
        fill=(170, 195, 240, 42),
    )
    glyph.alpha_composite(scaled_alpha(lid, body_mask))
    # lid seam + latch
    seam = Image.new('RGBA', size, (0, 0, 0, 0))
    ImageDraw.Draw(seam).line(
        (px(BODY[0] + 18), px(SEAM_Y), px(BODY[2] - 18), px(SEAM_Y)),
        fill=(96, 124, 196, 80),
        width=int(px(6)),
    )
    glyph.alpha_composite(seam)
    latch_box = tuple(px(v) for v in LATCH)
    latch = vgrad(size, latch_box[1], latch_box[3], LATCH_TOP, LATCH_BOTTOM).convert('RGBA')
    glyph.paste(latch, (0, 0), rounded_mask(size, latch_box, px(LATCH_RADIUS)))
    ImageDraw.Draw(glyph).ellipse(
        (px(512 - 14), px(488), px(512 + 14), px(516)), fill=(146, 84, 10, 110)
    )
    base.alpha_composite(glyph)

    # -- glass inner edge
    edge = Image.new('RGBA', size, (0, 0, 0, 0))
    inset = px(16)
    ImageDraw.Draw(edge).rounded_rectangle(
        (CARD[0] + inset, CARD[1] + inset, CARD[2] - inset, CARD[3] - inset),
        radius=CARD_RADIUS - inset,
        outline=(255, 255, 255, 62),
        width=int(px(4)),
    )
    base.alpha_composite(edge)
    return base


def downscale_chain(master: Image.Image) -> dict[int, Image.Image]:
    """Progressive halving keeps small sizes clean."""
    out: dict[int, Image.Image] = {}
    cur = master
    cur_size = master.width
    for target in sorted(SIZES, reverse=True):
        while cur_size > target * 2:
            cur = cur.resize((cur_size // 2, cur_size // 2), Image.Resampling.LANCZOS)
            cur_size = cur.width
        if cur_size != target:
            cur = cur.resize((target, target), Image.Resampling.LANCZOS)
            cur_size = target
        out[target] = cur
    return out


def preview_sheet(images: dict[int, Image.Image]) -> Image.Image:
    """Contact sheet: big icon plus small sizes on dark and light halves."""
    cell = 300
    pad = 24
    sheet = Image.new('RGB', (cell * 2 + pad * 3, cell + pad * 2), (0, 0, 0))
    dark_bg, light_bg = (25, 28, 38), (245, 247, 250)
    smalls = [128, 64, 48, 32, 24, 16]
    for half, bg in ((0, dark_bg), (1, light_bg)):
        x0 = half * (cell + pad) + pad
        sheet.paste(bg, (x0, pad, x0 + cell, pad + cell))
        big = images[1024].resize((cell, cell), Image.Resampling.LANCZOS)
        sheet.paste(big, (x0, pad), big)
        x = x0
        for s in smalls:
            im = images[s]
            sheet.paste(im, (x, pad + cell - s), im)
            x += s + 12
    return sheet


def main() -> None:
    out_dir = os.path.join(RES, 'icons')
    os.makedirs(out_dir, exist_ok=True)
    master = build_master()
    images = downscale_chain(master)
    for s, im in images.items():
        im.save(os.path.join(out_dir, f'icon_{s}.png'), optimize=True)
    images[256].save(
        os.path.join(out_dir, 'icon.ico'),
        sizes=[(s, s) for s in (16, 24, 32, 48, 64, 128, 256)],
    )
    images[512].save(os.path.join(RES, 'icon.png'), optimize=True)
    preview_sheet(images).save(os.path.join(out_dir, 'preview.png'), optimize=True)

    # electron-builder: linux wants build/icons/<s>x<s>.png, win build/icon.ico,
    # mac build/icon.icns (all defaults, mirrored explicitly in the yml).
    icons_dir = os.path.join(BUILD, 'icons')
    os.makedirs(icons_dir, exist_ok=True)
    for s, im in images.items():
        im.save(os.path.join(icons_dir, f'{s}x{s}.png'), optimize=True)
    shutil.copyfile(os.path.join(out_dir, 'icon.ico'), os.path.join(BUILD, 'icon.ico'))
    images[1024].save(
        os.path.join(BUILD, 'icon.icns'),
        sizes=[(s, s) for s in (16, 32, 64, 128, 256, 512, 1024)],
    )
    print(
        'written: resources/icons/icon_{16..1024}.png + icon.ico + preview.png;',
        'build/icons/<s>x<s>.png + icon.ico + icon.icns',
    )


if __name__ == '__main__':
    main()
