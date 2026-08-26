"""Cut a small diagonal chamfer into hut corners that have no belt opening
nearby — pure geometry, no AI, so the already-verified openings/arrows are
never at risk. Echoes the original game's own diagonal-corner-cut language
(see REBRANDING_PLAN.md sec 2.3) as the source of visual variety between
buildings, applied only to the specific corners each building's real I/O
layout leaves empty.
"""
import os
from PIL import Image, ImageDraw

BASE = os.path.dirname(os.path.abspath(__file__))
B = os.path.join(BASE, "buildings")
REF = os.path.join(BASE, "ref_crops")

STROKE = (150, 98, 54, 255)
STROKE_W = 4

CORNER_XY = {
    "tl": lambda w, h: (0, 0),
    "tr": lambda w, h: (w, 0),
    "bl": lambda w, h: (0, h),
    "br": lambda w, h: (w, h),
}

def chamfer(im, corner, size):
    w, h = im.size
    cx, cy = CORNER_XY[corner](w, h)
    sx = 1 if cx == 0 else -1
    sy = 1 if cy == 0 else -1
    p2 = (cx + sx * size, cy)
    p3 = (cx, cy + sy * size)

    px = im.load()
    for y in range(min(cy, cy + sy * size), max(cy, cy + sy * size) + 1):
        for x in range(min(cx, cx + sx * size), max(cx, cx + sx * size) + 1):
            if 0 <= x < w and 0 <= y < h:
                # inside triangle test (right triangle at the corner)
                dx = abs(x - cx)
                dy = abs(y - cy)
                if dx + dy <= size:
                    r, g, b, a = px[x, y]
                    px[x, y] = (r, g, b, 0)

    d = ImageDraw.Draw(im)
    d.line([p2, p3], fill=STROKE, width=STROKE_W)
    return im

PLAN = {
    "cutter.png": [("br", 26)],
    "rotator.png": [("tr", 20), ("bl", 20)],
    "stacker.png": [("tr", 26)],
    "painter.png": [("bl", 26), ("br", 26)],
}

def main():
    for fname, corners in PLAN.items():
        src = os.path.join(REF, "clean_" + fname)
        im = Image.open(src).convert("RGBA")
        for corner, size in corners:
            chamfer(im, corner, size)
        out = os.path.join(REF, "chamfered_" + fname)
        im.save(out)
        print(fname, "-> chamfered", corners, "saved to", out)

if __name__ == "__main__":
    main()
