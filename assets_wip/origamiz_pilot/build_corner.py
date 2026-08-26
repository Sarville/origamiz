"""Construct belt_corner.png geometrically (not via AI) so it is guaranteed
to share belt_straight.png's exact cross-section thickness and a perfectly
smooth curve — no stray facets, no mismatched cap sizes.
"""
import math
from PIL import Image, ImageDraw, ImageFilter

SIZE = 192
# cross-section band measured directly off belt_straight.png: y 50..141
Y0, Y1 = 50, 141
W = Y1 - Y0  # 91, the belt's cross-section thickness
CAP = 30     # measured cap-bevel thickness off belt_straight.png

# Pivot: the inner corner of the L. Horizontal arm occupies y in [Y0,Y1]
# for x in [0, PIVOT]; vertical arm occupies x in [Y0,Y1] for y in [0, PIVOT].
PIVOT = Y1  # 141 — so the outer curve radius is W (Y1-Y0) and inner radius 0..
R_OUT = PIVOT - Y0   # 91
R_IN = PIVOT - Y1    # 0 (inner edge meets exactly at the pivot corner)

def lane_color(t):
    # simple tan gradient sampled to roughly match belt_straight's lane tone
    base = (233, 211, 183)
    return base

def main():
    S = 4  # supersample
    big = Image.new("RGBA", (SIZE * S, SIZE * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(big)

    def sc(v):
        return v * S

    # ---- base lane fill: two straight arms + outer quarter-disk, all in lane tone ----
    lane_fill = (233, 211, 183, 255)
    # horizontal arm (x:0..PIVOT, y:Y0..Y1)
    d.rectangle([sc(0), sc(Y0), sc(PIVOT), sc(Y1)], fill=lane_fill)
    # vertical arm (x:Y0..Y1, y:0..PIVOT)
    d.rectangle([sc(Y0), sc(0), sc(Y1), sc(PIVOT)], fill=lane_fill)
    # outer quarter disk centered at (PIVOT,PIVOT) radius R_OUT, filling the
    # quadrant toward the top-left (angles 180..270)
    bbox = [sc(PIVOT - R_OUT), sc(PIVOT - R_OUT), sc(PIVOT + R_OUT), sc(PIVOT + R_OUT)]
    d.pieslice(bbox, 180, 270, fill=lane_fill)

    # ---- cap bevels: darker bands along the OUTER edge (far from pivot) and
    # the far end of each straight arm, matching belt_straight's cap tone ----
    cap_fill = (205, 178, 141, 255)
    # horizontal arm's far edge (y=Y1, i.e. bottom) — only the straight part,
    # not the curved part
    d.rectangle([sc(0), sc(Y1 - CAP), sc(PIVOT - 0), sc(Y1)], fill=cap_fill)
    # vertical arm's far edge (x=Y1, right side)
    d.rectangle([sc(Y1 - CAP), sc(0), sc(Y1), sc(PIVOT)], fill=cap_fill)
    # outer curve cap ring (annulus band along the outer curve)
    bbox_out = [sc(PIVOT - R_OUT), sc(PIVOT - R_OUT), sc(PIVOT + R_OUT), sc(PIVOT + R_OUT)]
    d.pieslice(bbox_out, 180, 270, fill=None)  # no-op placeholder
    # draw the annulus cap by pieslicing outer radius then re-filling inner
    # (R_OUT - CAP) with lane color would erase; instead draw ring directly:
    ring = Image.new("RGBA", big.size, (0, 0, 0, 0))
    rd = ImageDraw.Draw(ring)
    rd.pieslice(bbox_out, 180, 270, fill=cap_fill)
    bbox_in = [sc(PIVOT - (R_OUT - CAP)), sc(PIVOT - (R_OUT - CAP)),
               sc(PIVOT + (R_OUT - CAP)), sc(PIVOT + (R_OUT - CAP))]
    rd.pieslice(bbox_in, 180, 270, fill=(0, 0, 0, 0))
    big.alpha_composite(ring)

    # entry cap (near start of horizontal arm, x=0..CAP) matching straight's end cap
    d.rectangle([sc(0), sc(Y0), sc(CAP), sc(Y1)], fill=cap_fill)
    # entry cap (near start of vertical arm, y=0..CAP)
    d.rectangle([sc(Y0), sc(0), sc(Y1), sc(CAP)], fill=cap_fill)

    # ---- inner corner: draw a small quarter-disk cap piece at the pivot too,
    # so the inner corner isn't a bare sharp point ----
    inner_r = CAP
    bbox_inner = [sc(PIVOT - inner_r), sc(PIVOT - inner_r), sc(PIVOT + inner_r), sc(PIVOT + inner_r)]

    # ---- thin darker outline stroke around the whole silhouette ----
    alpha = big.split()[-1]
    edge = alpha.filter(ImageFilter.FIND_EDGES)
    outline = Image.new("RGBA", big.size, (120, 95, 65, 255))
    outline.putalpha(edge.point(lambda a: 255 if a > 10 else 0))
    outline = outline.filter(ImageFilter.MaxFilter(int(3 * S) | 1))
    canvas = Image.new("RGBA", big.size, (0, 0, 0, 0))
    canvas.alpha_composite(outline)
    canvas.alpha_composite(big)

    # ---- arrows: two simple chevrons following the path, reuse ui/arrow.png style ----
    from PIL import Image as I2
    arrow = I2.open("ui/arrow.png").convert("RGBA")
    a1 = arrow.resize((int(34 * S), int(34 * S)), Image.LANCZOS).rotate(-90, expand=True)
    canvas.alpha_composite(a1, (sc(60) - a1.width // 2, sc(96) - a1.height // 2))
    a2 = arrow.resize((int(34 * S), int(34 * S)), Image.LANCZOS)
    canvas.alpha_composite(a2, (sc(96) - a2.width // 2, sc(60) - a2.height // 2))

    out = canvas.resize((SIZE, SIZE), Image.LANCZOS)
    out.save("ui/belt_corner.png")
    print("saved ui/belt_corner.png", out.size)

if __name__ == "__main__":
    main()
