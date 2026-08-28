"""Small torii-style gate marking each of the hub's 16 belt/item attachment
points on its otherwise solid curb (hub has no belt notches at all, unlike
the other 47 buildings which already cut a physical opening). Two short
wood pillars (same bands as build_platform's posts) carry a shallow
paper-roof cap, echoing the main roof's material so the gate reads as
"part of the same structure," not a foreign element. Span matches the
real belt-lane width (BELT_WIDTH=145, same constant build_batch.py's belt
buildings use) so it actually frames the opening a belt connects through,
not a guessed narrow arch.

Shading always stays in a fixed screen-space top-left-light convention
(matching every other paper/wood element in this project) regardless of
which of the 4 edges a gate sits on — the SHAPE rotates with direction,
the light source does not."""
from PIL import Image, ImageDraw

import build_platform as bp

SS = bp.SS
DARK, MID, LIGHT, HILITE = bp.DARK, bp.MID, bp.LIGHT, bp.HILITE
ROOF_LIGHT = (0xEA, 0xDB, 0xAF, 255)
ROOF_DARK = (0xC7, 0xAE, 0x74, 255)
ROOF_OUTLINE = (0x4A, 0x2C, 0x14, 255)

BELT_WIDTH = 145  # real belt-lane width between curbs — build_batch.py's
                   # BELT_WIDTH / cut_openings.py — the gate must span the
                   # actual opening a belt tile connects through.
TILE = bp.TILE


def _pillar(canvas, cx, cy, w, h):
    """Short wood post, axis-aligned w(x)*h(y) box, light top/dark bottom
    (fixed screen-space light-from-above, same as every post in this
    project) — reused for both orientations by swapping w/h at the call
    site, not by rotating the shading."""
    S = SS
    layer = Image.new("RGBA", (canvas.width * S, canvas.height * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x0, y0, x1, y1 = (cx - w / 2) * S, (cy - h / 2) * S, (cx + w / 2) * S, (cy + h / 2) * S
    d.rectangle([x0, y0, x1, y1], fill=MID)
    d.polygon([(x0, y0), (x1, y0), (x1, y0 + 4 * S), (x0, y0 + 4 * S)], fill=LIGHT)
    d.polygon([(x0, y1 - 4 * S), (x1, y1 - 4 * S), (x1, y1), (x0, y1)], fill=DARK)
    d.rectangle([x0, y0, x1, y1], outline=DARK, width=max(1, S // 2))
    layer = layer.resize(canvas.size, Image.LANCZOS)
    canvas.alpha_composite(layer)


def _roof_tri(canvas, apex, base_a, base_b, ridge_dir):
    """Shallow triangular paper roof, apex + two base corners (already in
    final pixel coords) — split by the line apex->base_mid, first half
    filled ROOF_LIGHT, second ROOF_DARK, matching the main temple roof's
    fold convention. `ridge_dir` is a unit (dx,dy) used only to place the
    small ridge-cap block at the apex, oriented along the roof ridge."""
    S = SS
    layer = Image.new("RGBA", (canvas.width * S, canvas.height * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    apex_s = (apex[0] * S, apex[1] * S)
    a_s = (base_a[0] * S, base_a[1] * S)
    b_s = (base_b[0] * S, base_b[1] * S)
    mid_s = ((a_s[0] + b_s[0]) / 2, (a_s[1] + b_s[1]) / 2)
    d.polygon([a_s, apex_s, mid_s], fill=ROOF_LIGHT)
    d.polygon([mid_s, apex_s, b_s], fill=ROOF_DARK)
    d.line([apex_s, mid_s], fill=ROOF_OUTLINE, width=max(1, S // 2))
    d.line([a_s, apex_s, b_s], fill=ROOF_OUTLINE, width=S)
    cap = 5 * S
    dx, dy = ridge_dir
    d.ellipse([apex_s[0] - cap / 2 - dx * cap * 0.3, apex_s[1] - cap / 2 - dy * cap * 0.3,
               apex_s[0] + cap / 2 - dx * cap * 0.3, apex_s[1] + cap / 2 - dy * cap * 0.3],
              fill=MID, outline=DARK, width=max(1, S // 3))
    layer = layer.resize(canvas.size, Image.LANCZOS)
    canvas.alpha_composite(layer)


EDGE_POST_TS = [bp.CURB_INSET + bp.CURB_THICK / 2,          # 19.5 — corner post
                4 * TILE / 2,                                 # 384  — side mid-post
                4 * TILE - (bp.CURB_INSET + bp.CURB_THICK / 2)]  # 748.5 — corner post


def _snap(t, min_dist=16):
    """If t (a pillar's tangential coordinate) lands within min_dist of an
    existing curb post, that post already fills the role — skip drawing a
    redundant pillar there and return its exact position instead, so nothing
    doubles up (same idea as build_batch.py's _merge_posts, applied here to
    the gates instead of belt-opening flank posts)."""
    for pt in EDGE_POST_TS:
        if abs(t - pt) < min_dist:
            return pt, False
    return t, True


def add_gate(canvas, cx, cy, direction, span=BELT_WIDTH, pillar_w=14, pillar_h=20, peak_h=22):
    """cx,cy: the curb CENTERLINE point for one tile's attachment (e.g. for
    a top-edge tile, (tile_center_x, CURB_INSET+CURB_THICK/2)). direction
    is which way the gate's roof points (outward from the platform):
    'top'/'bottom' (pillars spaced horizontally) or 'left'/'right' (pillars
    spaced vertically). Pillars that would land on top of an existing curb
    post are skipped (see _snap) — the roof just rests on that post."""
    if direction in ("top", "bottom"):
        t1, draw1 = _snap(cx - span / 2)
        t2, draw2 = _snap(cx + span / 2)
        sign = -1 if direction == "top" else 1  # outward = -y for top, +y for bottom
        if draw1:
            _pillar(canvas, t1, cy, pillar_w, pillar_h)
        if draw2:
            _pillar(canvas, t2, cy, pillar_w, pillar_h)
        ridge_y = cy + sign * pillar_h / 2
        apex = (cx, ridge_y + sign * peak_h)
        base_a = (t1 - (pillar_w / 2 if draw1 else 0), ridge_y - sign * 6)
        base_b = (t2 + (pillar_w / 2 if draw2 else 0), ridge_y - sign * 6)
        _roof_tri(canvas, apex, base_a, base_b, (0, sign))
    else:
        t1, draw1 = _snap(cy - span / 2)
        t2, draw2 = _snap(cy + span / 2)
        sign = -1 if direction == "left" else 1  # outward = -x for left, +x for right
        if draw1:
            _pillar(canvas, cx, t1, pillar_h, pillar_w)
        if draw2:
            _pillar(canvas, cx, t2, pillar_h, pillar_w)
        ridge_x = cx + sign * pillar_h / 2
        apex = (ridge_x + sign * peak_h, cy)
        base_a = (ridge_x - sign * 6, t1 - (pillar_w / 2 if draw1 else 0))
        base_b = (ridge_x - sign * 6, t2 + (pillar_w / 2 if draw2 else 0))
        _roof_tri(canvas, apex, base_a, base_b, (sign, 0))


def add_all_hub_gates(canvas):
    """One gate per hub accept tile — 4 per side, 16 total, positions read
    from src/js/game/buildings/hub.js's ItemAcceptorComponent loop (tiles
    0-3 on each of the 4 edges)."""
    curb_c = bp.CURB_INSET + bp.CURB_THICK / 2  # 19.5
    far_c = 4 * TILE - curb_c                    # 748.5
    centers = [i * TILE + TILE / 2 for i in range(4)]  # 96, 288, 480, 672
    for cx in centers:
        add_gate(canvas, cx, curb_c, "top")
        add_gate(canvas, cx, far_c, "bottom")
    for cy in centers:
        add_gate(canvas, curb_c, cy, "left")
        add_gate(canvas, far_c, cy, "right")


if __name__ == "__main__":
    im = Image.open("staging_hub/hub_v3.png").convert("RGBA")
    add_all_hub_gates(im)
    im.save("staging_hub/hub_v3_gates.png")
    print("wrote staging_hub/hub_v3_gates.png")
    # user-approved direction (2026-08-28) — promote to the real asset
    im.save("buildings/hub.png")
    print("wrote buildings/hub.png (final)")
