"""Procedural platform+curb builder — new construction algorithm.
All geometry (platform silhouette, curb banding, corner/mid posts, belt
notches) is drawn with PIL, not AI — it's measurable geometry, and AI can't
be trusted for pixel-precise shapes (see session pitfall #6).

Curb style: a flat banded "plank" cross-section (dark rim -> mid -> light
core -> mid -> dark rim), no tiled grain texture — a photographic/tiled
wood texture reads as noisy at this scale, per user feedback on the first
pass. Same band colors everywhere a curb is drawn, so buildings and belt
curbs read as one material family.
"""
import math
import os
from PIL import Image, ImageDraw, ImageFilter, ImageChops

BASE = os.path.dirname(os.path.abspath(__file__))
U = os.path.join(BASE, "ui")
B = os.path.join(BASE, "buildings")
I = os.path.join(BASE, "icons")

TILE = 192

# Every building's platform (incl. curb, incl. belt-connection flank rails)
# must fit inside a 174x174-per-tile box, leaving a flat 9px transparent
# margin against the true tile edge on every side - matches the vanilla
# reference sprite (measured directly: an original building icon sits 9px
# in from its own canvas edge). Only the direction arrow is allowed to
# poke past this margin toward the true edge - see apply_arrows below,
# unaffected by this constant. Found/measured 2026-08-28 after a user
# side-by-side compared our buildings against the vanilla original and
# found ours reach the true edge with zero margin at all, which is what
# made two adjacent buildings' curbs read as touching/overlapping instead
# of two separate tiles with a normal gap between them.
MARGIN_PX = 9

CORNER_R = 8        # platform corner fillet radius
# CURB_INSET/CURB_THICK are measured directly off ui/belt_straight.png (not
# guessed) so the building curb lands on the exact same columns as the
# belt curb at the seam: belt's solid curb band is x13..25 on the left
# (13px, x13 is the antialiased edge pixel), mirrored x166..178 on the
# right — see the pixel scan in this session's history if it needs
# re-deriving after a belt-geometry change.
CURB_INSET = 13      # gap between platform's outer edge and the curb
CURB_THICK = 13       # plank thickness
POST_SIZE = 22

DARK = (0x5A, 0x34, 0x18, 255)
MID = (0x8F, 0x5A, 0x2C, 255)
LIGHT = (0xC9, 0x92, 0x5A, 255)
HILITE = (0xE0, 0xAE, 0x78, 255)   # pyramid post top face only — brighter than the curb's LIGHT

PLATFORM_FILL = (236, 227, 200, 255)
PLATFORM_OUTLINE = (205, 182, 138, 255)

ARROW_SIZE = 42
EDGE_INSET = 26
PLAQUE_SIZE = 108


def _pinch(y, h, max_pinch):
    return max_pinch * math.sin(math.pi * y / h)


def _band_color(t):
    """t: 0=outer rim of the plank, 1=inner rim. Dark-mid-light-mid-dark."""
    if t < 0.15 or t > 0.85:
        return DARK
    if t < 0.35 or t > 0.65:
        return MID
    return LIGHT


SS = 4   # supersample factor — every curved/diagonal edge below is drawn at
         # this resolution then LANCZOS-downsampled, otherwise PIL's raw
         # per-row/per-pixel fills produce a visible staircase on any line
         # that isn't perfectly horizontal/vertical (the pinch curve, the
         # pyramid post edges).


def _corner_round_mask(w, h, radius):
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, h - 1], radius=radius, fill=255)
    return m


def _draw_post(canvas, cx, cy, size):
    """A small 4-faced pyramid (square base, apex at center) — light hits
    from the top-left (same convention as the platform's own bottom-right
    shadow), so top/left faces are bright and right/bottom faces are dark."""
    post = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(post)
    half = size / 2
    tl, tr = (cx - half, cy - half), (cx + half, cy - half)
    bl, br = (cx - half, cy + half), (cx + half, cy + half)
    apex = (cx, cy)
    d.polygon([tl, tr, apex], fill=HILITE)   # top face
    d.polygon([tr, br, apex], fill=MID)      # right face
    d.polygon([br, bl, apex], fill=DARK)     # bottom face
    d.polygon([bl, tl, apex], fill=LIGHT)    # left face
    d.rectangle([tl[0], tl[1], br[0], br[1]], outline=DARK, width=max(2, SS // 2))
    canvas.alpha_composite(post)


def build_platform_pinched(w=TILE, h=TILE, max_pinch=30):
    """Platform whose free (non-belt) left/right sides bow inward in a smooth
    sine pinch (matches the approved old rotator.png silhouette — reused
    here per the user's reference screenshot, not re-derived). Curb runs
    only along those two curved sides; top/bottom are pure belt edges with
    no curb at all, not even a stub.

    Built at SS supersample resolution and downsampled at the very end —
    see SS above.

    Everything is built within an INSET working area (iw x ih, MARGIN_PX
    smaller on every side than the true w x h canvas), then pasted into the
    true-size canvas offset by MARGIN_PX — so the whole platform+curb+posts
    stays MARGIN_PX clear of the true tile edge everywhere, matching the
    vanilla-reference margin (see MARGIN_PX's comment). Only the arrow,
    composited separately afterward by apply_arrows, is allowed to poke
    past this margin toward the true edge."""
    W, H = w * SS, h * SS
    m = MARGIN_PX * SS
    iw, ih = W - 2 * m, H - 2 * m
    pinch = max_pinch * SS
    c_inset, c_thick, corner_r, post_size = (CURB_INSET * SS, CURB_THICK * SS,
                                              CORNER_R * SS, POST_SIZE * SS)

    inset_canvas = Image.new("RGBA", (iw, ih), (0, 0, 0, 0))
    corner_mask = _corner_round_mask(iw, ih, corner_r)

    # 1. platform silhouette -----------------------------------------------
    plat_mask = Image.new("L", (iw, ih), 0)
    pmd = ImageDraw.Draw(plat_mask)
    for y in range(ih):
        lb = _pinch(y, ih, pinch)
        pmd.line([(lb, y), (iw - 1 - lb, y)], fill=255)
    plat_mask = ImageChops.multiply(plat_mask, corner_mask)

    plat = Image.new("RGBA", (iw, ih), (0, 0, 0, 0))
    plat.paste(Image.new("RGBA", (iw, ih), PLATFORM_FILL), (0, 0), plat_mask)
    inset_canvas.alpha_composite(plat)

    eroded = plat_mask.filter(ImageFilter.MinFilter(3))
    ring = ImageChops.subtract(plat_mask, eroded)
    outline = Image.new("RGBA", (iw, ih), PLATFORM_OUTLINE)
    outline.putalpha(ring)
    inset_canvas.alpha_composite(outline)

    # 2. curb — banded ribbons following the same curve, drawn, THEN any
    # cutout would go here, THEN posts on top (posts last so nothing can
    # ever clip them) ------------------------------------------------------
    curb = Image.new("RGBA", (iw, ih), (0, 0, 0, 0))
    cpx = curb.load()
    for y in range(ih):
        lb = _pinch(y, ih, pinch)
        outer_l = lb + c_inset
        inner_l = outer_l + c_thick
        for x in range(int(outer_l), int(inner_l)):
            t = (x - outer_l) / c_thick
            cpx[x, y] = _band_color(t)
        outer_r = iw - 1 - outer_l
        inner_r = iw - 1 - inner_l
        for x in range(int(inner_r), int(outer_r) + 1):
            t = (outer_r - x) / c_thick
            cpx[x, y] = _band_color(t)
    curb.putalpha(ImageChops.multiply(curb.split()[3], corner_mask))
    inset_canvas.alpha_composite(curb)

    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    canvas.alpha_composite(inset_canvas, (m, m))

    # 3. posts — corners + one at each pinch midpoint (the only free-side
    # midpoint here) -- drawn last, unclippable ------------------------
    mid_x = m + _pinch(ih / 2, ih, pinch) + c_inset + c_thick / 2
    post_centers = [
        (m + c_inset + c_thick / 2, m + c_inset + c_thick / 2),
        (W - 1 - m - c_inset - c_thick / 2, m + c_inset + c_thick / 2),
        (m + c_inset + c_thick / 2, H - 1 - m - c_inset - c_thick / 2),
        (W - 1 - m - c_inset - c_thick / 2, H - 1 - m - c_inset - c_thick / 2),
        (mid_x, H / 2),
        (W - 1 - mid_x, H / 2),
    ]
    for cx, cy in post_centers:
        _draw_post(canvas, cx, cy, post_size)

    return canvas.resize((w, h), Image.LANCZOS)


def apply_plaque(canvas, icon_name, cx, cy, plaque_size=PLAQUE_SIZE, mirror=False):
    plaque = Image.open(os.path.join(U, "plaque_template.png")).convert("RGBA")
    plaque = plaque.resize((plaque_size, plaque_size), Image.LANCZOS)
    icon_size = int(plaque_size * 0.6)
    icon = Image.open(os.path.join(I, icon_name)).convert("RGBA")
    if mirror:
        icon = icon.transpose(Image.FLIP_LEFT_RIGHT)
    icon = icon.resize((icon_size, icon_size), Image.LANCZOS)
    canvas.alpha_composite(plaque, (cx - plaque_size // 2, cy - plaque_size // 2))
    canvas.alpha_composite(icon, (cx - icon_size // 2, cy - icon_size // 2))


def apply_arrows(canvas, points):
    """points: [(cx, cy, direction_deg), ...] — same convention as apply_arrows.py:
    0=up, -90=right, 90=left, 180=down; cx/cy given AT the tile edge."""
    arrow_src = Image.open(os.path.join(U, "arrow.png")).convert("RGBA")
    arrow_src = arrow_src.resize((ARROW_SIZE, ARROW_SIZE), Image.LANCZOS)
    w, h = canvas.size
    for cx, cy, deg in points:
        icx, icy = cx, cy
        if icy == 0:
            icy += EDGE_INSET
        elif icy == h:
            icy -= EDGE_INSET
        if icx == 0:
            icx += EDGE_INSET
        elif icx == w:
            icx -= EDGE_INSET
        arrow = arrow_src.rotate(-deg, expand=False, resample=Image.BICUBIC)
        canvas.alpha_composite(arrow, (icx - ARROW_SIZE // 2, icy - ARROW_SIZE // 2))


def build_belt_straight():
    """Same lane/chevrons as the approved ui/belt_straight.png — only its
    curb columns are repainted with the same dark/mid/light bands as the
    building curb, so belt and building read as one material."""
    belt = Image.open(os.path.join(U, "belt_straight.png")).convert("RGBA")
    px = belt.load()
    w, h = belt.size
    # measured off the source file: solid curb band x14..25 (left), x166..177
    # (right), with a partial-alpha antialiased edge pixel at x13 / x178.
    for y in range(h):
        for x in list(range(13, 26)):
            t = (x - 14) / (25 - 14)
            r, g, b, a = _band_color(max(0.0, min(1.0, t)))
            px[x, y] = (r, g, b, px[x, y][3])
        for x in list(range(166, 179)):
            t = (177 - x) / (177 - 166)
            r, g, b, a = _band_color(max(0.0, min(1.0, t)))
            px[x, y] = (r, g, b, px[x, y][3])
    return belt


if __name__ == "__main__":
    canvas = build_platform_pinched()
    apply_plaque(canvas, "rotator.png", 96, 96)
    apply_arrows(canvas, [(96, 192, 0), (96, 0, 0)])
    out_path = os.path.join(B, "rotator_v2.png")
    canvas.save(out_path)
    print("wrote", out_path)

    belt = build_belt_straight()
    belt_path = os.path.join(U, "belt_straight_v2.png")
    belt.save(belt_path)
    print("wrote", belt_path)

    # demo: belt (in) -> rotator -> belt (out), stacked vertically, on a
    # patch of the paper background for context
    bg = Image.open(os.path.join(U, "paper_background.png")).convert("RGBA").resize((TILE, TILE))
    cols, rows = 3, 3
    scene = Image.new("RGBA", (TILE * cols, TILE * rows))
    for jx in range(cols):
        for jy in range(rows):
            scene.paste(bg, (jx * TILE, jy * TILE))
    cx = TILE  # middle column
    scene.alpha_composite(belt, (cx, 0 * TILE))
    scene.alpha_composite(canvas, (cx, 1 * TILE))
    scene.alpha_composite(belt, (cx, 2 * TILE))
    scene_path = os.path.join(BASE, "scene", "rotator_belt_demo.png")
    scene.save(scene_path)
    print("wrote", scene_path)
