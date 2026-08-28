"""Hub wire connector — the one piece build_wire_buildings.py's batch missed
(hub predates that pass, built by hand back in the original 10-building
pilot). Reuses the SAME banded bamboo shading (build_wires._band_color_np,
PALETTES["first"]) as every other wire connector in the project, not a
fresh art style, so it reads as the same connector language.

Placement: hub.js's one WiredPinsComponent slot is pos=(0,2) dir=left —
local tile row 2 of 4 on the left edge. hub.png isn't grid-built (it's
bespoke pre-algorithm art with ~50px padding, not TILE=192-aligned), so
the target position was found by inspecting the actual pixels: there's
already a horizontal wood crossbar reaching the outer curb at y=446-467
(center ~456.5), x=50 is the curb's outer edge on the flat run of the
left side, x=92 is where the crossbar is already a uniform wood colour
(measured directly off buildings/hub.png, not guessed) matching
build_platform-family tones. The pole punches through the curb at that
row and pokes out to x=8, fading from bamboo green (matches the wire
tiles) to that same wood tone by x=92, where the original untouched
crossbar art takes back over — no seam.
"""
import numpy as np
from PIL import Image

import build_wires as bw

SRC = "buildings/hub.png"
DST = "staging_hub/hub.png"
SS = 4

CY = 456.5
HALF = 10.5          # band half-thickness, matches the measured crossbar (~21px)
X_TIP = 8             # pole's outer tip, pokes into the canvas's transparent padding
X_CURB = 50           # curb's outer edge on this flat run (measured)
X_BLEND_END = 92      # by here fully the crossbar's own wood tone (measured) — original art takes over past this, no touch-up needed
NODE_X = (20, 27)     # bamboo joint ring, on the green (exposed) section only

GREEN = bw.PALETTES["first"]
WOOD = dict(dark=(150, 98, 55), mid=(216, 151, 86), light=(240, 182, 118))


def build_patch():
    W = (X_BLEND_END - X_TIP) * SS
    Hh = int(HALF * 2 + 6) * SS
    xx, yy = np.meshgrid(np.arange(W), np.arange(Hh))
    x_img = xx / SS + X_TIP
    y_img = yy / SS + (CY - HALF - 3)

    perp_t = np.clip(np.abs(y_img - CY) / HALF, 0, 1)
    green_c = bw._band_color_np(perp_t, GREEN).astype(np.float64)
    wood_c = bw._band_color_np(perp_t, WOOD).astype(np.float64)
    blend = np.clip((x_img - X_CURB) / (X_BLEND_END - X_CURB), 0, 1)[..., None]
    colors = (green_c * (1 - blend) + wood_c * blend)

    # darker bamboo joint ring, only where still green-ish (left of the curb)
    node = (x_img >= NODE_X[0]) & (x_img <= NODE_X[1])
    ring_dark = np.array(GREEN["dark"]) * 0.82
    colors = np.where(node[..., None], colors * 0.35 + ring_dark * 0.65, colors)

    # rounded pole: flat rectangle, but a circular cap on the left tip
    mask = np.abs(y_img - CY) <= HALF
    cap_cx = X_TIP + HALF
    circle = (x_img - cap_cx) ** 2 + (y_img - CY) ** 2 <= HALF ** 2
    mask = np.where(x_img < cap_cx, circle, mask)

    rgba = np.zeros((Hh, W, 4), dtype=np.uint8)
    rgba[..., :3] = np.clip(colors, 0, 255).astype(np.uint8)
    rgba[..., 3] = np.where(mask, 255, 0)
    patch = Image.fromarray(rgba, mode="RGBA")
    out_w, out_h = W // SS, Hh // SS
    return patch.resize((out_w, out_h), Image.LANCZOS), (X_TIP, int(CY - HALF - 3))


def main():
    base = Image.open(SRC).convert("RGBA")
    patch, pos = build_patch()
    base.alpha_composite(patch, pos)
    import os
    os.makedirs("staging_hub", exist_ok=True)
    base.save(DST)
    print("wrote", DST, "patch size", patch.size, "at", pos)


if __name__ == "__main__":
    main()
