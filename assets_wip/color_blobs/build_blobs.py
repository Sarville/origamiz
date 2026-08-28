"""
Procedural "ink blob" color-item icons.

Replaces the old 3-overlapping-circles color icon
(res_raw/sprites/colors/<color>.png) with a single organic blob,
shaded like a small glossy droplet, using the exact hex values from
src/js/game/colors.js so in-game colors keep matching exactly.

Preview only - writes to assets_wip/color_blobs/preview/, nothing
under res_raw/ is touched by this script.
"""

import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy.ndimage import distance_transform_edt

OUT_DIR = "assets_wip/color_blobs/preview"
SIZE = 72
SS = 8  # supersample factor
CANVAS = SIZE * SS

# Exact palette from src/js/game/colors.js
COLORS = {
    "red": "#fd837f",
    "green": "#94fb7c",
    "blue": "#86b6f3",
    "yellow": "#fbf34d",
    "purple": "#e383f3",
    "cyan": "#36f8f3",
    "white": "#fdfbf3",
    "uncolored": "#bbb9b1",
}

EDGE_MIX = "#25292c"
EDGE_AMOUNT = 0.62
LIGHT_DIR = np.array([-0.6, -0.6, 0.9])
LIGHT_DIR = LIGHT_DIR / np.linalg.norm(LIGHT_DIR)


def hex_to_rgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i : i + 2], 16) for i in (0, 2, 4)], dtype=np.float64)


def mix(a, b, t):
    return a + (b - a) * t


def angdiff(a, b):
    return (a - b + math.pi) % (2 * math.pi) - math.pi


def blob_mask(seed=11, points=1440):
    """
    Paint-splat silhouette: a rounded core plus several elongated,
    irregular pointed rays (some with a small bulb near the tip),
    like a flicked drop of paint. Shared by every color.
    """
    rng = np.random.default_rng(seed)
    cx = cy = CANVAS / 2
    core_r0 = CANVAS * 0.23

    theta = np.linspace(0, 2 * math.pi, points, endpoint=False)
    r = np.full_like(theta, core_r0)

    # slight organic wobble so the core isn't a perfect circle
    for f, amp_frac, phase in zip(
        [2, 3, 5], rng.uniform(0.03, 0.06, 3), rng.uniform(0, 2 * math.pi, 3)
    ):
        r += amp_frac * core_r0 * np.cos(f * theta + phase)

    n_rays = rng.integers(6, 9)
    base_angles = np.linspace(0, 2 * math.pi, n_rays, endpoint=False)
    ray_angles = base_angles + rng.uniform(-0.25, 0.25, n_rays)
    ray_len = rng.uniform(CANVAS * 0.13, CANVAS * 0.24, n_rays)
    ray_sigma = rng.uniform(0.22, 0.36, n_rays)
    bulb_flags = rng.random(n_rays) < 0.35

    for ang, length, sigma, bulb in zip(ray_angles, ray_len, ray_sigma, bulb_flags):
        d = angdiff(theta, ang)
        u = np.clip(np.abs(d) / sigma, 0, 1)
        # circular (dome) profile: flat tangent at the peak, smooth all the way
        # down -> a rounded fingertip instead of a flat-cut or pointed tip
        shape = np.sqrt(1 - u**2)
        scale = 0.4 if bulb else 1.0
        r += length * shape * scale

    xs = cx + r * np.cos(theta)
    ys = cy + r * np.sin(theta)

    img = Image.new("L", (CANVAS, CANVAS), 0)
    draw = ImageDraw.Draw(img)
    draw.polygon(list(zip(xs.tolist(), ys.tolist())), fill=255)

    # for drip rays: thin neck + round ball beyond the stub, like a flicked drop
    for ang, length, bulb in zip(ray_angles, ray_len, bulb_flags):
        if not bulb:
            continue
        stub_r = core_r0 + length * 0.4 * 0.8
        ball_r = core_r0 + length * 0.95
        nx0, ny0 = cx + stub_r * math.cos(ang), cy + stub_r * math.sin(ang)
        nx1, ny1 = cx + ball_r * math.cos(ang), cy + ball_r * math.sin(ang)
        neck_w = CANVAS * 0.038
        draw.line([(nx0, ny0), (nx1, ny1)], fill=255, width=int(neck_w))
        ball_rad = max(CANVAS * 0.05, length * 0.16)
        draw.ellipse(
            [nx1 - ball_rad, ny1 - ball_rad, nx1 + ball_rad, ny1 + ball_rad], fill=255
        )

    img = img.filter(ImageFilter.GaussianBlur(CANVAS * 0.012))
    mask = np.array(img) > 127
    return mask


def shade(mask, base_hex):
    base = hex_to_rgb(base_hex)
    edge = mix(base, hex_to_rgb(EDGE_MIX), EDGE_AMOUNT)

    dist_in = distance_transform_edt(mask).astype(np.float64)

    stroke_px = CANVAS * 0.016
    inner_mask = dist_in > stroke_px
    ring = mask & ~inner_mask

    inner_depth = np.clip(dist_in - stroke_px, 0, None)
    h = inner_depth / max(inner_depth.max(), 1e-6)
    h = np.sqrt(h)  # dome profile

    gy, gx = np.gradient(h)
    normals = np.stack([-gx * 10, -gy * 10, np.ones_like(h)], axis=-1)
    normals /= np.linalg.norm(normals, axis=-1, keepdims=True)
    diffuse = np.clip(normals @ LIGHT_DIR, 0, 1)

    # subtler volume shading - stays close to the true base hue over most
    # of the surface, so the flat color still reads as the palette color
    shading = 0.82 + 0.36 * diffuse
    shading = np.clip(shading, 0.72, 1.18)

    rgb = base[None, None, :] * shading[..., None]

    # small, tight glossy glint instead of a broad wash
    spec = np.clip(diffuse, 0, 1) ** 22
    rgb += spec[..., None] * 130

    rgb = np.clip(rgb, 0, 255)

    out = np.zeros((CANVAS, CANVAS, 4), dtype=np.float64)
    out[inner_mask, 0:3] = rgb[inner_mask]
    out[inner_mask, 3] = 255
    out[ring, 0:3] = edge
    out[ring, 3] = 255

    img = Image.fromarray(out.astype(np.uint8), mode="RGBA")
    img = img.resize((SIZE, SIZE), Image.LANCZOS)
    return img


def main():
    import os

    os.makedirs(OUT_DIR, exist_ok=True)
    mask = blob_mask()

    tiles = []
    for name, hexcode in COLORS.items():
        img = shade(mask, hexcode)
        img.save(f"{OUT_DIR}/{name}.png")
        tiles.append((name, img))

    # contact sheet for quick review
    cols = 4
    rows = math.ceil(len(tiles) / cols)
    pad = 16
    cell = SIZE + pad
    sheet = Image.new("RGBA", (cols * cell + pad, rows * cell + pad), (30, 32, 36, 255))
    draw = ImageDraw.Draw(sheet)
    for i, (name, img) in enumerate(tiles):
        x = pad + (i % cols) * cell
        y = pad + (i // cols) * cell
        sheet.paste(img, (x, y), img)
    sheet.save(f"{OUT_DIR}/_contact_sheet.png")
    print("wrote", len(tiles), "blobs +", f"{OUT_DIR}/_contact_sheet.png")


if __name__ == "__main__":
    main()
