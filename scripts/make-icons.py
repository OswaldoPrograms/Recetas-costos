#!/usr/bin/env python3
"""Genera los iconos y las pantallas de inicio de "Mi recetario".

Dibuja la marca (un libro abierto con separador) con formas geométricas, sin
depender de tipografías del sistema, y escribe todos los tamaños que necesita
Android y la PWA.

Uso:  python scripts/make-icons.py
"""
from __future__ import annotations

import math
import os

from PIL import Image, ImageDraw

# Paleta de la app (debe coincidir con :root en www/index.html)
SAGE = (219, 229, 207)
SAGE2 = (169, 191, 147)
PAPER = (255, 247, 234)
CREAM = (248, 239, 224)
INK = (90, 74, 63)
RUST = (201, 139, 106)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")

SS = 4  # supermuestreo: se dibuja grande y se reduce para suavizar bordes


def _quad(p0, p1, p2, n=18):
    """Puntos de una curva cuadrática de Bézier."""
    pts = []
    for i in range(n + 1):
        t = i / n
        x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t**2 * p2[0]
        y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t**2 * p2[1]
        pts.append((x, y))
    return pts


def _round_corner(poly, i, radius, n=8):
    """Sustituye el vértice i de `poly` por un arco de radio aproximado."""
    p = poly[i]
    prev = poly[i - 1]
    nxt = poly[(i + 1) % len(poly)]

    def unit(a, b):
        dx, dy = b[0] - a[0], b[1] - a[1]
        length = math.hypot(dx, dy) or 1.0
        return dx / length, dy / length

    u1, u2 = unit(p, prev), unit(p, nxt)
    k = min(radius, math.hypot(prev[0] - p[0], prev[1] - p[1]) * 0.5,
            math.hypot(nxt[0] - p[0], nxt[1] - p[1]) * 0.5)
    a = (p[0] + u1[0] * k, p[1] + u1[1] * k)
    b = (p[0] + u2[0] * k, p[1] + u2[1] * k)
    arc = _quad(a, p, b, n)
    return poly[:i] + arc + poly[i + 1:]


def draw_mark(img: Image.Image, cx: float, cy: float, size: float, color=INK, ribbon=RUST):
    """Dibuja un libro abierto de ancho `size` centrado en (cx, cy)."""
    d = ImageDraw.Draw(img)
    w = size
    h = size * 0.70
    gap = w * 0.016  # separación del lomo

    for side in (-1, 1):
        spine_top = (cx + side * gap, cy - h / 2 + h * 0.05)
        spine_bottom = (cx + side * gap, cy + h / 2 - h * 0.05)
        outer_top = (cx + side * w / 2, cy - h / 2 + h * 0.07)
        outer_bottom = (cx + side * w / 2, cy + h / 2 - h * 0.07)

        top = _quad(spine_top, (cx + side * w * 0.25, cy - h / 2 - h * 0.03), outer_top)
        bottom = _quad(spine_bottom, (cx + side * w * 0.25, cy + h / 2 + h * 0.03), outer_bottom)

        poly = top + [outer_top, outer_bottom] + bottom[::-1]
        # redondear las dos esquinas exteriores (de la última a la primera,
        # para que los índices no se desplacen)
        poly = _round_corner(poly, len(top) + 1, w * 0.045)
        poly = _round_corner(poly, len(top), w * 0.045)
        d.polygon(poly, fill=color)

    # separador (ribbon) sobre la página derecha
    rx = cx + w * 0.20
    rw = w * 0.10
    rt = cy - h / 2 - h * 0.015
    rb = cy + h * 0.06
    notch = rw * 0.45
    d.polygon(
        [
            (rx, rt),
            (rx + rw, rt),
            (rx + rw, rb),
            (rx + rw / 2, rb - notch),
            (rx, rb),
        ],
        fill=ribbon,
    )


def rounded_bg(size: int, color=SAGE, radius: float = 0.225) -> Image.Image:
    """Icono cuadrado con esquinas redondeadas."""
    s = size * SS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    ImageDraw.Draw(img).rounded_rectangle((0, 0, s - 1, s - 1), radius=int(s * radius), fill=color)
    return img


def circle_bg(size: int, color=SAGE) -> Image.Image:
    s = size * SS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    ImageDraw.Draw(img).ellipse((0, 0, s - 1, s - 1), fill=color)
    return img


def icon(size: int, shape: str = "rounded", mark_scale: float = 0.56) -> Image.Image:
    if shape == "circle":
        img = circle_bg(size)
    elif shape == "none":
        img = Image.new("RGBA", (size * SS, size * SS), (0, 0, 0, 0))
    else:
        img = rounded_bg(size)
    draw_mark(img, size * SS / 2, size * SS / 2, size * SS * mark_scale)
    return img.resize((size, size), Image.LANCZOS)


def splash(w: int, h: int) -> Image.Image:
    """Fondo liso con la marca centrada."""
    img = Image.new("RGB", (w, h), CREAM)
    base = min(w, h)
    mark = icon(1024, shape="none", mark_scale=1.0)  # marca suelta, sin fondo
    scale = base * 0.42 / 1024
    nw = max(1, int(1024 * scale))
    m = mark.resize((nw, nw), Image.LANCZOS)
    img.paste(m, ((w - nw) // 2, (h - nw) // 2), m)
    return img


def main() -> None:
    icons_dir = os.path.join(ROOT, "www", "icons")
    assets_dir = os.path.join(ROOT, "assets")
    os.makedirs(icons_dir, exist_ok=True)
    os.makedirs(assets_dir, exist_ok=True)

    # --- Fuentes maestras ---
    icon(1024).save(os.path.join(assets_dir, "icon.png"))
    icon(1024, shape="none").save(os.path.join(assets_dir, "icon-foreground.png"))
    Image.new("RGB", (1024, 1024), SAGE).save(os.path.join(assets_dir, "icon-background.png"))
    splash(2732, 2732).save(os.path.join(assets_dir, "splash.png"))

    # --- PWA ---
    icon(192).save(os.path.join(icons_dir, "icon-192.png"))
    icon(512).save(os.path.join(icons_dir, "icon-512.png"))
    icon(512, mark_scale=0.46).save(os.path.join(icons_dir, "icon-maskable-512.png"))
    apple = Image.new("RGB", (180 * SS, 180 * SS), SAGE)
    draw_mark(apple, 180 * SS / 2, 180 * SS / 2, 180 * SS * 0.56)
    apple.resize((180, 180), Image.LANCZOS).save(
        os.path.join(icons_dir, "apple-touch-icon.png")
    )

    # --- Android: iconos ---
    launcher = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
    for dpi, s in launcher.items():
        folder = os.path.join(RES, f"mipmap-{dpi}")
        icon(s).save(os.path.join(folder, "ic_launcher.png"))
        icon(s, shape="circle").save(os.path.join(folder, "ic_launcher_round.png"))
        icon(int(s * 1.5), shape="none", mark_scale=0.42).save(
            os.path.join(folder, "ic_launcher_foreground.png")
        )

    # --- Android: splash (respeta el tamaño de cada carpeta del template) ---
    splash_targets = {
        os.path.join(RES, "drawable", "splash.png"): (480, 320),
        os.path.join(RES, "drawable-land-mdpi", "splash.png"): (480, 320),
        os.path.join(RES, "drawable-land-hdpi", "splash.png"): (800, 480),
        os.path.join(RES, "drawable-land-xhdpi", "splash.png"): (1280, 720),
        os.path.join(RES, "drawable-land-xxhdpi", "splash.png"): (1600, 960),
        os.path.join(RES, "drawable-land-xxxhdpi", "splash.png"): (1920, 1280),
        os.path.join(RES, "drawable-port-mdpi", "splash.png"): (320, 480),
        os.path.join(RES, "drawable-port-hdpi", "splash.png"): (480, 800),
        os.path.join(RES, "drawable-port-xhdpi", "splash.png"): (720, 1280),
        os.path.join(RES, "drawable-port-xxhdpi", "splash.png"): (960, 1600),
        os.path.join(RES, "drawable-port-xxxhdpi", "splash.png"): (1280, 1920),
    }
    for path, (w, h) in splash_targets.items():
        if os.path.isdir(os.path.dirname(path)):
            splash(w, h).save(path)

    print("Iconos y splash generados.")


if __name__ == "__main__":
    main()
