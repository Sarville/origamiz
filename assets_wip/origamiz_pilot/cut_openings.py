"""Cut belt-matching openings with code (not AI) — guarantees the width and
position exactly match the actual belt tile (166px, measured directly off
ui/belt_straight.png), and guarantees clean alpha=0 with no checkerboard/
fringe artifact, regardless of what the AI drew in that region.
"""
import os
from PIL import Image

BASE = os.path.dirname(os.path.abspath(__file__))
B = os.path.join(BASE, "buildings")

BELT_WIDTH = 145   # belt's INNER texture lane only (excludes the belt's own
                   # 10px curb on each side) — measured off ui/belt_straight.png:
                   # curb spans x 13..25, tan texture starts at x 26. The
                   # building's own curb is meant to occupy the vacated
                   # margin band and visually continue the belt's curb line,
                   # not duplicate/cover it.
MARGIN = 24        # (192 - 145) / 2, rounded — matches beltBorder=23.5 in
                   # generate_belt_sprites.js
DEPTH = 28         # how far the cut reaches in from the tile edge

# (file, [(edge, tile_offset), ...]) — tile_offset is the local x (for top/
# bottom) or local y (for left/right) of the tile-cell this opening belongs
# to, i.e. 0 for the first tile, 192 for the second tile in a 2-wide building.
CUTS = {
    "cutter.png": [("bottom", 0), ("top", 0), ("top", 192)],
    "rotator.png": [("bottom", 0), ("top", 0)],
    "balancer.png": [("bottom", 0), ("bottom", 192), ("top", 0), ("top", 192)],
    "stacker.png": [("bottom", 0), ("bottom", 192), ("top", 0)],
    "painter.png": [("left", 0), ("top", 192), ("right", 0)],
    "miner.png": [("top", 0)],
    "trash.png": [("bottom", 0)],
    "underground_belt_entry.png": [("bottom", 0)],
    "underground_belt_exit.png": [("top", 0)],
}

def cut_opening(im, edge, offset):
    w, h = im.size
    px = im.load()
    if edge == "bottom":
        x0, x1, y0, y1 = offset + MARGIN, offset + MARGIN + BELT_WIDTH, h - DEPTH, h
    elif edge == "top":
        x0, x1, y0, y1 = offset + MARGIN, offset + MARGIN + BELT_WIDTH, 0, DEPTH
    elif edge == "left":
        x0, x1, y0, y1 = 0, DEPTH, offset + MARGIN, offset + MARGIN + BELT_WIDTH
    elif edge == "right":
        x0, x1, y0, y1 = w - DEPTH, w, offset + MARGIN, offset + MARGIN + BELT_WIDTH
    else:
        raise ValueError(edge)
    for y in range(max(0, y0), min(h, y1)):
        for x in range(max(0, x0), min(w, x1)):
            r, g, b, a = px[x, y]
            px[x, y] = (r, g, b, 0)

def main():
    for fname, cuts in CUTS.items():
        path = os.path.join(B, fname)
        im = Image.open(path).convert("RGBA")
        for edge, offset in cuts:
            cut_opening(im, edge, offset)
        im.save(path)
        print(fname, "-> cut", cuts)

if __name__ == "__main__":
    main()
