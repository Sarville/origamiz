"""Square off each of the 4 true canvas corners by extending nearby opaque
material into any transparent gap closer to the corner than a reference
point — eliminates the "white corner" (rounded-corner gap showing
background) the client flagged. Simple flat-fill patch, not a redesign.
"""
import os
import sys
from PIL import Image

REACH = 34  # how far in from each corner to check/patch
REF = 34    # sample color from this diagonal offset

def fill_corner(im, cx, cy, sx, sy):
    # (cx,cy): the true corner. (sx,sy): direction to move inward (+1/-1).
    px = im.load()
    ref_x, ref_y = cx + sx * REF, cy + sy * REF
    ref_color = px[ref_x, ref_y]
    if ref_color[3] < 200:
        return 0
    filled = 0
    for dy in range(0, REACH):
        y = cy + sy * dy
        for dx in range(0, REACH):
            x = cx + sx * dx
            r, g, b, a = px[x, y]
            if a < 200:
                px[x, y] = ref_color
                filled += 1
    return filled

CORNERS = {
    "TL": (0, 0, 1, 1),
    "TR": (-1, 0, -1, 1),   # cx computed as w-1 at call time
    "BL": (0, -1, 1, -1),   # cy computed as h-1 at call time
    "BR": (-1, -1, -1, -1),
}

def process(path, skip=()):
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    total = 0
    for name, (cx, cy, sx, sy) in CORNERS.items():
        if name in skip:
            continue
        real_cx = w - 1 if cx == -1 else cx
        real_cy = h - 1 if cy == -1 else cy
        total += fill_corner(im, real_cx, real_cy, sx, sy)
    if total:
        im.save(path)
    return total

# (file, corners to SKIP because they carry an intentional cut there)
PLAN = {
    "balancer.png": (),
    "stacker.png": ("TR",),
    "painter.png": ("BL", "BR"),
    "cutter.png": ("BR",),
    "miner.png": (),
    "trash.png": (),
    "underground_belt_entry.png": (),
    "underground_belt_exit.png": (),
}

if __name__ == "__main__":
    if len(sys.argv) > 1:
        for p in sys.argv[1:]:
            print(p, "filled:", process(p))
    else:
        base = os.path.dirname(os.path.abspath(__file__))
        for fname, skip in PLAN.items():
            p = os.path.join(base, "buildings", fname)
            print(fname, "filled:", process(p, skip))
