"""Composite the single reusable arrow glyph onto each hut at the EXACT
opening coordinates pulled from the real game source (src/js/game/buildings/
*.js acceptor/ejector slots) — see make_schematics.py for the derivation.
Guarantees every arrow is correct and pixel-consistent, independent of
whatever the AI drew (or failed to draw) underneath.
"""
import os
from PIL import Image

BASE = os.path.dirname(os.path.abspath(__file__))
B = os.path.join(BASE, "buildings")
U = os.path.join(BASE, "ui")

ARROW_SIZE = 42
# pull the arrow in from the tile edge so the whole glyph stays on-canvas
# instead of being clipped in half by the sprite boundary
EDGE_INSET = 26

# (building file, [(cx, cy, direction_deg), ...]) — cx/cy given AT the edge
# (matching the real gap coordinates), inset is applied automatically below.
# direction_deg: 0=up, -90=right, 90=left, 180=down (matches im.rotate(-deg))
JOBS = {
    "cutter.png": [
        (96, 192, 0),    # input, bottom, left tile
        (96, 0, 0),      # output, top, left tile
        (288, 0, 0),     # output, top, right tile
    ],
    "rotator.png": [
        (96, 192, 0),    # input, bottom
        (96, 0, 0),      # output, top
    ],
    "balancer.png": [
        (96, 192, 0), (288, 192, 0),   # inputs, bottom, both tiles
        (96, 0, 0), (288, 0, 0),       # outputs, top, both tiles
    ],
    "stacker.png": [
        (96, 192, 0), (288, 192, 0),   # inputs, bottom, both tiles
        (96, 0, 0),                    # output, top, LEFT tile only
    ],
    "painter.png": [
        (0, 96, 90),      # shape input, left edge, pointing right (into building)
        (288, 0, 180),    # color input, top edge, pointing down (into building)
        (384, 96, 90),    # output, right edge, pointing right (out), same y as shape input
    ],
    "miner.png": [
        (96, 0, 0),       # output, top edge (now has a real platform gap there)
    ],
    "trash.png": [
        (96, 192, 0),     # input, bottom edge (matches this demo's belt approach)
    ],
}

def inset(cx, cy, w, h, deg):
    # move the point inward along the edge normal implied by its direction
    if cy == 0:
        cy += EDGE_INSET
    elif cy == h:
        cy -= EDGE_INSET
    if cx == 0:
        cx += EDGE_INSET
    elif cx == w:
        cx -= EDGE_INSET
    return cx, cy

def main():
    arrow_src = Image.open(os.path.join(U, "arrow.png")).convert("RGBA")
    arrow_src = arrow_src.resize((ARROW_SIZE, ARROW_SIZE), Image.LANCZOS)

    for building_file, points in JOBS.items():
        bpath = os.path.join(B, building_file)
        building = Image.open(bpath).convert("RGBA")
        w, h = building.size
        for cx, cy, deg in points:
            icx, icy = inset(cx, cy, w, h, deg)
            arrow = arrow_src.rotate(-deg, expand=False, resample=Image.BICUBIC)
            px = icx - ARROW_SIZE // 2
            py = icy - ARROW_SIZE // 2
            building.alpha_composite(arrow, (px, py))
        building.save(bpath)
        print(building_file, "-> applied", len(points), "arrows")

if __name__ == "__main__":
    main()
