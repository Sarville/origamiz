"""Clean the near-white, partial-alpha checkerboard artifact that shows up
right at the 4 rounded outer corners of a silhouette (a transparency-preview
checkerboard baked into pixels instead of true transparency). Only touches a
small margin around each true canvas corner — nothing else.
"""
import os
import sys
from PIL import Image

MARGIN = 24

def clean(path):
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    px = im.load()
    corners = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    fixed = 0
    for cx, cy in corners:
        x0, x1 = max(0, cx - MARGIN), min(w, cx + MARGIN + 1)
        y0, y1 = max(0, cy - MARGIN), min(h, cy + MARGIN + 1)
        for y in range(y0, y1):
            for x in range(x0, x1):
                r, g, b, a = px[x, y]
                if 10 < a < 230 and r > 230 and g > 230 and b > 230:
                    px[x, y] = (r, g, b, 0)
                    fixed += 1
    if fixed:
        im.save(path)
    return fixed

if __name__ == "__main__":
    for p in sys.argv[1:]:
        print(p, "fixed:", clean(p))
