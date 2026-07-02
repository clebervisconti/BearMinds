#!/usr/bin/env python3
"""
BearMinds — gera os ícones do PWA (public/icons/) a partir de formas vetoriais.
Determinístico, sem fontes de emoji. Rode: python3 scripts/gen-icons.py
"""
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "icons")
os.makedirs(OUT, exist_ok=True)

BG = (11, 15, 20, 255)        # #0B0F14 — brand dark
FUR = (181, 131, 90, 255)     # cub brown
FUR_DARK = (150, 106, 71, 255)
MUZZLE = (232, 213, 181, 255)
NOSE = (36, 28, 22, 255)
EYE = (28, 22, 18, 255)
ACCENT = (52, 199, 123, 255)  # green ring


def rounded_bg(size, radius_ratio=0.22, full_bleed=False):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if full_bleed:
        d.rectangle([0, 0, size, size], fill=BG)
    else:
        r = int(size * radius_ratio)
        d.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=BG)
    return img, d


def draw_bear(d, size, cx, cy, scale):
    """Desenha um urso simpático centrado em (cx, cy). scale ~ raio da cabeça."""
    head_r = scale
    ear_r = int(scale * 0.42)
    # accent ring atrás da cabeça
    ring = int(head_r * 1.18)
    d.ellipse([cx - ring, cy - ring, cx + ring, cy + ring], outline=ACCENT, width=max(2, int(size * 0.012)))
    # orelhas
    ox = int(head_r * 0.72)
    oy = int(head_r * 0.72)
    for sx in (-1, 1):
        ex, ey = cx + sx * ox, cy - oy
        d.ellipse([ex - ear_r, ey - ear_r, ex + ear_r, ey + ear_r], fill=FUR)
        ir = int(ear_r * 0.5)
        d.ellipse([ex - ir, ey - ir, ex + ir, ey + ir], fill=FUR_DARK)
    # cabeça
    d.ellipse([cx - head_r, cy - head_r, cx + head_r, cy + head_r], fill=FUR)
    # focinho
    mz_w = int(head_r * 0.9)
    mz_h = int(head_r * 0.72)
    my = cy + int(head_r * 0.24)
    d.ellipse([cx - mz_w // 2, my - mz_h // 2, cx + mz_w // 2, my + mz_h // 2], fill=MUZZLE)
    # nariz
    nz = int(head_r * 0.2)
    ny = my - int(head_r * 0.12)
    d.ellipse([cx - nz, ny - int(nz * 0.75), cx + nz, ny + int(nz * 0.75)], fill=NOSE)
    # olhos
    ey_r = max(2, int(head_r * 0.13))
    ex_off = int(head_r * 0.42)
    ey_y = cy - int(head_r * 0.18)
    for sx in (-1, 1):
        eyx = cx + sx * ex_off
        d.ellipse([eyx - ey_r, ey_y - ey_r, eyx + ey_r, ey_y + ey_r], fill=EYE)


def make(size, path, full_bleed=False, pad=0.0):
    img, d = rounded_bg(size, full_bleed=full_bleed)
    inner = 1.0 - pad
    scale = int(size * 0.30 * inner)
    draw_bear(d, size, size // 2, int(size * 0.52), scale)
    img.save(path)
    print("  •", os.path.relpath(path, ROOT), f"({size}x{size})")


print("Gerando ícones BearMinds…")
make(192, os.path.join(OUT, "icon-192.png"))
make(512, os.path.join(OUT, "icon-512.png"))
# maskable: full-bleed + safe zone (bear menor, ~80% central)
make(512, os.path.join(OUT, "icon-512-maskable.png"), full_bleed=True, pad=0.30)
make(180, os.path.join(OUT, "apple-touch-icon.png"))
# favicon 32 (bônus)
make(32, os.path.join(OUT, "favicon-32.png"))
print("✅ Ícones gerados em public/icons/")
