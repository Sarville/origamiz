"""Generic platform+curb builder for arbitrary silhouettes (rectangle +
chamfer/staircase/notch cuts), built on top of build_platform.py's shared
constants/helpers (curb bands, pyramid posts, plaque/arrow compositing).

Unlike rotator's bespoke sine-curve code, this uses an exact Euclidean
distance transform (scipy) from the platform silhouette to place the curb
ring and its dark/mid/light banding — works identically for a straight
edge, a diagonal chamfer, or a staircase notch, so one function covers all
8 remaining pilot buildings.

Belt openings are excluded from the curb using the exact same
MARGIN/BELT_WIDTH/DEPTH geometry as cut_openings.py, driven by the same
(edge, tile_offset) tables already verified against the real game source
in apply_arrows.py / cut_openings.py — reused here, not re-derived.
"""
import os
import numpy as np
from scipy.ndimage import distance_transform_edt
from PIL import Image, ImageDraw

import build_platform as bp

TILE = bp.TILE
SS = bp.SS
B = bp.B
INSET = bp.CURB_INSET + bp.CURB_THICK / 2   # corner/mid post center offset

MARGIN = 24        # == cut_openings.py
BELT_WIDTH = 145   # == cut_openings.py
DEPTH = 28         # == cut_openings.py (>= CURB_INSET+CURB_THICK so it fully clears the ring)


def _belt_opening_rect(edge, offset, w, h):
    if edge == "bottom":
        return offset + MARGIN, offset + MARGIN + BELT_WIDTH, h - DEPTH, h
    if edge == "top":
        return offset + MARGIN, offset + MARGIN + BELT_WIDTH, 0, DEPTH
    if edge == "left":
        return 0, DEPTH, offset + MARGIN, offset + MARGIN + BELT_WIDTH
    if edge == "right":
        return w - DEPTH, w, offset + MARGIN, offset + MARGIN + BELT_WIDTH
    raise ValueError(edge)


def _band_color_np(t):
    out = np.empty(t.shape + (3,), dtype=np.uint8)
    out[:] = bp.DARK[:3]
    out[(t >= 0.15) & (t < 0.35)] = bp.MID[:3]
    out[(t >= 0.35) & (t <= 0.65)] = bp.LIGHT[:3]
    out[(t > 0.65) & (t <= 0.85)] = bp.MID[:3]
    return out


def _silhouette(w_tiles, h_tiles, cut_polys, notch_ellipses):
    W, H = w_tiles * TILE * SS, h_tiles * TILE * SS
    m = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(m)
    d.rectangle([0, 0, W - 1, H - 1], fill=255)
    for poly in cut_polys or []:
        d.polygon([(x * SS, y * SS) for x, y in poly], fill=0)
    for cx, cy, rx, ry in notch_ellipses or []:
        d.ellipse([(cx - rx) * SS, (cy - ry) * SS, (cx + rx) * SS, (cy + ry) * SS], fill=0)
    corner_mask = bp._corner_round_mask(W, H, bp.CORNER_R * SS)
    return (np.array(m) > 127) & (np.array(corner_mask) > 127)


FLANK_DEPTH = 28   # how far a flank rail reaches in from the tile edge — same
                   # value as cut_openings.py's DEPTH, deep enough to clear
                   # the post and read as a rail rather than a nub.


def _flank_patches(w_tiles, h_tiles, belt_edges, plat):
    """Every belt opening has the belt's own curb rail running right up to
    ITS tile edge on both flanks — a straight plank parallel to the belt
    (banded ACROSS its width), not a cap banded along the tile edge. This
    draws that rail, positioned at the exact same CURB_INSET/CURB_THICK
    columns the belt itself uses (not a MARGIN-derived guess), so the two
    curbs land on identical pixels at the seam instead of merely being
    close.

    A top/bottom opening (belt runs along Y) gets two VERTICAL rails —
    banded across X, constant down their length — at the opening's left
    and right flank. A left/right opening (belt runs along X) gets two
    HORIZONTAL rails banded across Y, symmetrically."""
    W, H = w_tiles * TILE * SS, h_tiles * TILE * SS
    w, h = w_tiles * TILE, h_tiles * TILE
    c_inset, c_thick = bp.CURB_INSET, bp.CURB_THICK
    mask = np.zeros((H, W), dtype=bool)
    tvals = np.zeros((H, W), dtype=np.float64)
    for edge, offset in belt_edges:
        if edge in ("top", "bottom"):
            y0, y1 = (0, FLANK_DEPTH) if edge == "top" else (h - FLANK_DEPTH, h)
            left_rail = (offset + c_inset, offset + c_inset + c_thick)
            right_rail = (offset + TILE - c_inset - c_thick, offset + TILE - c_inset)
            for (rx0, rx1), outer_at_x0 in ((left_rail, True), (right_rail, False)):
                rx0, rx1 = max(0, rx0), min(w, rx1)
                if rx1 <= rx0:
                    continue
                sl = (slice(y0 * SS, y1 * SS), slice(rx0 * SS, rx1 * SS))
                mask[sl] = True
                xx = np.arange(rx0 * SS, rx1 * SS)
                t = (xx - rx0 * SS) if outer_at_x0 else (rx1 * SS - 1 - xx)
                tvals[sl] = (t / (c_thick * SS))[None, :]
        else:
            x0, x1 = (0, FLANK_DEPTH) if edge == "left" else (w - FLANK_DEPTH, w)
            top_rail = (offset + c_inset, offset + c_inset + c_thick)
            bottom_rail = (offset + TILE - c_inset - c_thick, offset + TILE - c_inset)
            for (ry0, ry1), outer_at_y0 in ((top_rail, True), (bottom_rail, False)):
                ry0, ry1 = max(0, ry0), min(h, ry1)
                if ry1 <= ry0:
                    continue
                sl = (slice(ry0 * SS, ry1 * SS), slice(x0 * SS, x1 * SS))
                mask[sl] = True
                yy = np.arange(ry0 * SS, ry1 * SS)
                t = (yy - ry0 * SS) if outer_at_y0 else (ry1 * SS - 1 - yy)
                tvals[sl] = (t / (c_thick * SS))[:, None]
    mask &= plat
    return mask, tvals


def _auto_flank_posts(w_tiles, h_tiles, belt_edges):
    """One post per flank rail, capping it right where it meets the tile
    edge — at the SAME perpendicular offset (INSET) every corner post
    already sits at, so every post lines up on one level along the curb's
    center axis. Previously this capped the rail's far/inner end instead
    (FLANK_DEPTH), which put it visibly lower than the neighboring corner
    post; and a horizontal ring segment landing between two rails with no
    post at all read as an unfinished T-joint. One post per rail at INSET
    fixes both — two rails from adjacent openings end up with two posts
    sitting right next to each other, same level, no bare joint.
    A rail right under a true corner needs no separate post — _merge_posts
    drops anything within min_dist of an explicit one."""
    w, h = w_tiles * TILE, h_tiles * TILE
    c_inset, c_thick = bp.CURB_INSET, bp.CURB_THICK
    posts = []
    for edge, offset in belt_edges:
        span = ((offset + c_inset, offset + c_inset + c_thick),
                (offset + TILE - c_inset - c_thick, offset + TILE - c_inset))
        bound = w if edge in ("top", "bottom") else h
        for r0, r1 in span:
            r0, r1 = max(0, r0), min(bound, r1)
            if r1 <= r0:
                continue
            mid = (r0 + r1) / 2
            if edge == "top":
                posts.append((mid, INSET))
            elif edge == "bottom":
                posts.append((mid, h - INSET))
            elif edge == "left":
                posts.append((INSET, mid))
            else:
                posts.append((w - INSET, mid))
    return posts


def _merge_posts(explicit, auto, min_dist=14):
    out = list(explicit)
    for ax, ay in auto:
        if all((ax - ex) ** 2 + (ay - ey) ** 2 > min_dist ** 2 for ex, ey in explicit):
            out.append((ax, ay))
    return out


def build_generic(w_tiles, h_tiles, belt_edges, post_centers,
                   cut_polys=None, notch_ellipses=None):
    W, H = w_tiles * TILE * SS, h_tiles * TILE * SS
    w, h = w_tiles * TILE, h_tiles * TILE

    plat = _silhouette(w_tiles, h_tiles, cut_polys, notch_ellipses)
    # most of these silhouettes fill the ENTIRE canvas (no transparent
    # margin at the tile's own edge, unlike rotator's pinch) — pad with a
    # 1px false border first, otherwise scipy's EDT has no "outside" to
    # measure against near the canvas edge and returns huge bogus
    # distances there instead of the real inward offset.
    dist = distance_transform_edt(np.pad(plat, 1, constant_values=False))[1:-1, 1:-1]

    c_inset, c_thick = bp.CURB_INSET * SS, bp.CURB_THICK * SS
    ring = (dist > c_inset) & (dist <= c_inset + c_thick)

    free = np.ones((H, W), dtype=bool)
    for edge, offset in belt_edges:
        x0, x1, y0, y1 = _belt_opening_rect(edge, offset, w, h)
        free[y0 * SS:y1 * SS, x0 * SS:x1 * SS] = False
    curb = ring & free

    t = np.clip((dist - c_inset) / c_thick, 0, 1)
    flank_mask, flank_t = _flank_patches(w_tiles, h_tiles, belt_edges, plat)
    curb = curb | flank_mask
    t = np.where(flank_mask, np.clip(flank_t, 0, 1), t)

    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))

    plat_img = Image.fromarray((plat * 255).astype("uint8"))
    fill_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    fill_layer.paste(Image.new("RGBA", (W, H), bp.PLATFORM_FILL), (0, 0), plat_img)
    canvas.alpha_composite(fill_layer)

    outline_ring = plat & ~(dist > 2 * SS)
    outline_layer = Image.new("RGBA", (W, H), bp.PLATFORM_OUTLINE)
    outline_layer.putalpha(Image.fromarray((outline_ring * 255).astype("uint8")))
    canvas.alpha_composite(outline_layer)

    curb_rgba = np.zeros((H, W, 4), dtype=np.uint8)
    curb_rgba[..., :3] = _band_color_np(t)
    curb_rgba[..., 3] = np.where(curb, 255, 0)
    canvas.alpha_composite(Image.fromarray(curb_rgba, mode="RGBA"))

    for cx, cy in post_centers:
        bp._draw_post(canvas, cx * SS, cy * SS, bp.POST_SIZE * SS)

    return canvas.resize((w, h), Image.LANCZOS)


# ---------------------------------------------------------------------------
# per-building specs — belt_edges/arrows are the same (edge, tile_offset)
# data already verified against real game source in cut_openings.py /
# apply_arrows.py; only reused here, not re-derived.
# ---------------------------------------------------------------------------

def _corners(w, h, skip=()):
    pts = {
        "tl": (INSET, INSET), "tr": (w - INSET, INSET),
        "bl": (INSET, h - INSET), "br": (w - INSET, h - INSET),
    }
    return [pts[k] for k in pts if k not in skip]


def _free_side_mid_posts(w, h, belt_edges):
    """One extra post at the center of any side that has NO belt opening at
    all (matches the miner.png/trash.png precedent: a lone opening's three
    free sides each get a mid-post, not just the 4 corners). A side with at
    least one opening already gets posts from _auto_flank_posts, so it's
    skipped here to avoid a redundant/clashing post."""
    used = {edge for edge, _ in belt_edges}
    posts = []
    if "top" not in used:
        posts.append((w / 2, INSET))
    if "bottom" not in used:
        posts.append((w / 2, h - INSET))
    if "left" not in used:
        posts.append((INSET, h / 2))
    if "right" not in used:
        posts.append((w - INSET, h / 2))
    return posts


# arrow screen-direction for an opening, keyed by (edge, accept-or-eject) —
# reverse-derived from every already-approved arrow in the pilot batch
# (cutter/balancer/stacker/painter): an arrow always points the direction
# material actually travels crossing that edge, in absolute screen terms,
# NOT a fixed "in vs out" convention — e.g. painter's left(accept) and
# right(eject) openings are BOTH deg=90 because material moves rightward
# through both (shape enters left moving right, exits right moving right).
_ARROW_DEG = {
    ("bottom", "accept"): 0, ("bottom", "eject"): 180,
    ("top", "accept"): 180, ("top", "eject"): 0,
    ("left", "accept"): 90, ("left", "eject"): -90,
    ("right", "accept"): -90, ("right", "eject"): 90,
}


def _arrow(edge, offset, kind, w, h):
    """(cx, cy, deg) for one opening, cx/cy at the tile edge itself (same
    convention apply_arrows already insets from), deg from _ARROW_DEG."""
    if edge == "top":
        return (offset + 96, 0, _ARROW_DEG[(edge, kind)])
    if edge == "bottom":
        return (offset + 96, h, _ARROW_DEG[(edge, kind)])
    if edge == "left":
        return (0, offset + 96, _ARROW_DEG[(edge, kind)])
    return (w, offset + 96, _ARROW_DEG[(edge, kind)])


SPECS = {
    "balancer.png": dict(
        w_tiles=2, h_tiles=1,
        belt_edges=[("bottom", 0), ("bottom", 192), ("top", 0), ("top", 192)],
        post_centers=_corners(384, 192) + [(INSET, 96), (384 - INSET, 96)],
        plaque=("balancer.png", 150, (192, 96)),
        arrows=[(96, 192, 0), (288, 192, 0), (96, 0, 0), (288, 0, 0)],
    ),
    "cutter.png": dict(
        w_tiles=2, h_tiles=1,
        belt_edges=[("bottom", 0), ("top", 0), ("top", 192)],
        cut_polys=[[(384 - 80, 192), (384, 192), (384, 192 - 80)]],
        post_centers=_corners(384, 192, skip=("br",)) + [
            (384 - 80, 192 - INSET), (384 - INSET, 192 - 80), (INSET, 96),
        ],
        plaque=("cutter.png", 150, (192, 96)),
        arrows=[(96, 192, 0), (96, 0, 0), (288, 0, 0)],
    ),
    "stacker.png": dict(
        w_tiles=2, h_tiles=1,
        belt_edges=[("bottom", 0), ("bottom", 192), ("top", 0)],
        cut_polys=[[(384 - 75, 0), (384 - 75, 25), (384 - 50, 25), (384 - 50, 50),
                     (384 - 25, 50), (384 - 25, 75), (384, 75), (384, 0)]],
        post_centers=_corners(384, 192, skip=("tr",)) + [
            (384 - 75, INSET), (384 - INSET, 75 + INSET), (INSET, 96), (384 - INSET, 133.5),
        ],
        plaque=("stacker.png", 150, (192, 96)),
        arrows=[(96, 192, 0), (288, 192, 0), (96, 0, 0)],
    ),
    "painter.png": dict(
        w_tiles=2, h_tiles=1,
        belt_edges=[("left", 0), ("top", 192), ("right", 0)],
        notch_ellipses=[(110, 192, 60, 35), (280, 192, 60, 35)],
        post_centers=_corners(384, 192) + [(96, INSET), (195, 192 - INSET)],
        plaque=("painter.png", 150, (192, 96)),
        arrows=[(0, 96, 90), (288, 0, 180), (384, 96, 90)],
    ),
    "miner.png": dict(
        w_tiles=1, h_tiles=1,
        belt_edges=[("top", 0)],
        post_centers=_corners(192, 192) + [(INSET, 96), (192 - INSET, 96), (96, 192 - INSET)],
        content="pre_platform_miner.png",
        arrows=[(96, 0, 0)],
    ),
    "trash.png": dict(
        w_tiles=1, h_tiles=1,
        belt_edges=[("bottom", 0)],
        post_centers=_corners(192, 192) + [(INSET, 96), (192 - INSET, 96), (96, INSET)],
        content="pre_platform_trash.png",
        arrows=[(96, 192, 0)],
    ),
    "underground_belt_entry.png": dict(
        w_tiles=1, h_tiles=1,
        belt_edges=[("bottom", 0)],
        post_centers=_corners(192, 192) + [(INSET, 96), (192 - INSET, 96), (96, INSET)],
        content="pre_platform_underground_belt_entry.png",
        arrows=[],
    ),
    "underground_belt_exit.png": dict(
        w_tiles=1, h_tiles=1,
        belt_edges=[("top", 0)],
        post_centers=_corners(192, 192) + [(INSET, 96), (192 - INSET, 96), (96, 192 - INSET)],
        content="pre_platform_underground_belt_exit.png",
        arrows=[],
    ),
}


def _mk(w_t, h_t, edges_kinds, plaque=None, content=None, mirror=False, plaque_size=None,
        cut_polys=None, notch_ellipses=None, corner_skip=(), free_side_mid_posts=True):
    """Build one SPECS entry from (edge, tile_offset, "accept"|"eject") triples
    — slot data read directly from src/js/game/buildings/*.js, same
    convention cut_openings.py already established. Post placement and
    arrow direction/position are then fully derived, no per-building
    hand-tuning needed (none of this second batch has bespoke shape-variety
    cuts like cutter/stacker/painter did)."""
    w, h = w_t * TILE, h_t * TILE
    belt_edges = [(e, o) for e, o, k in edges_kinds]
    posts = _corners(w, h, skip=corner_skip)
    if free_side_mid_posts:
        posts += _free_side_mid_posts(w, h, belt_edges)
    d = dict(
        w_tiles=w_t, h_tiles=h_t,
        belt_edges=belt_edges,
        post_centers=posts,
        arrows=[_arrow(e, o, k, w, h) for e, o, k in edges_kinds],
    )
    if plaque:
        d["plaque"] = (plaque, plaque_size or (150 if max(w_t, h_t) > 1 else 110), (w // 2, h // 2))
    if content:
        d["content"] = content
    if mirror:
        d["mirror"] = True
    if cut_polys:
        d["cut_polys"] = cut_polys
    if notch_ellipses:
        d["notch_ellipses"] = notch_ellipses
    return d


# ---------------------------------------------------------------------------
# Batch 2 — the remaining ~38 buildings. Slot geometry (which edge, which
# tile, accept-or-eject) read directly from src/js/game/buildings/*.js
# (ItemAcceptorComponent/ItemEjectorComponent slots; WiredPinsComponent-only
# slots are wires-layer, no belt/curb opening at all). See
# sessions/2026-08-27-*-session.md for the reasoning behind post/arrow
# auto-placement this reuses.
# ---------------------------------------------------------------------------
SPECS.update({
    # -- pure wires-layer buildings: zero belt connections, plain platform
    # (all 4 sides free -> _free_side_mid_posts adds a post on every side) --
    "analyzer.png": _mk(1, 1, [], plaque="analyzer.png"),
    "comparator.png": _mk(1, 1, [], plaque="comparator.png"),
    "constant_signal.png": _mk(1, 1, [], plaque="constant_signal.png"),
    "display.png": _mk(1, 1, [], plaque="display.png"),
    "lever.png": _mk(1, 1, [], plaque="lever.png"),
    "logic_gate.png": _mk(1, 1, [], plaque="logic_gate.png"),
    "logic_gate-not.png": _mk(1, 1, [], plaque="logic_gate.png"),
    "logic_gate-or.png": _mk(1, 1, [], plaque="logic_gate.png"),
    "logic_gate-xor.png": _mk(1, 1, [], plaque="logic_gate.png"),
    "transistor.png": _mk(1, 1, [], plaque="transistor.png"),
    "transistor-mirrored.png": _mk(1, 1, [], plaque="transistor.png", mirror=True),
    "virtual_processor.png": _mk(1, 1, [], plaque="virtual_processor.png"),
    "virtual_processor-rotator.png": _mk(1, 1, [], plaque="virtual_processor.png"),
    "virtual_processor-unstacker.png": _mk(1, 1, [], plaque="virtual_processor.png"),
    "virtual_processor-stacker.png": _mk(1, 1, [], plaque="virtual_processor.png"),
    "virtual_processor-painter.png": _mk(1, 1, [], plaque="virtual_processor.png"),
    "wire_tunnel.png": _mk(1, 1, [], plaque="wire_tunnel.png"),
    "block.png": _mk(1, 1, []),  # deliberately no plaque — plainest possible tile

    # -- single-tile, one belt opening --
    "constant_producer.png": _mk(1, 1, [("top", 0, "eject")], plaque="constant_producer.png"),
    "item_producer.png": _mk(1, 1, [("top", 0, "eject")], plaque="item_producer.png"),
    "goal_acceptor.png": _mk(1, 1, [("bottom", 0, "accept")], plaque="goal_acceptor.png"),
    "miner-chainable.png": dict(
        w_tiles=1, h_tiles=1,
        belt_edges=[("top", 0)],
        post_centers=_corners(192, 192) + [(INSET, 96), (192 - INSET, 96), (96, 192 - INSET)],
        content="pre_platform_miner.png",
        arrows=[(96, 0, 0)],
    ),
    "underground_belt_entry-tier2.png": dict(
        w_tiles=1, h_tiles=1,
        belt_edges=[("bottom", 0)],
        post_centers=_corners(192, 192) + [(INSET, 96), (192 - INSET, 96), (96, INSET)],
        content="pre_platform_underground_belt_entry.png",
        arrows=[],
    ),
    "underground_belt_exit-tier2.png": dict(
        w_tiles=1, h_tiles=1,
        belt_edges=[("top", 0)],
        post_centers=_corners(192, 192) + [(INSET, 96), (192 - INSET, 96), (96, 192 - INSET)],
        content="pre_platform_underground_belt_exit.png",
        arrows=[],
    ),

    # -- single-tile, two belt openings (straight pass-through) --
    # left+right free-side mid-posts disabled: reader has real WiredPins
    # ejectors on both those edges (see build_wire_buildings.py's bamboo
    # tab post-process below), a decorative post there would clash with it.
    "reader.png": _mk(1, 1, [("bottom", 0, "accept"), ("top", 0, "eject")], plaque="reader.png",
                       free_side_mid_posts=False),

    # -- single-tile balancer variants (compact merge/split, 3 openings) --
    "balancer-merger.png": _mk(1, 1, [
        ("bottom", 0, "accept"), ("right", 0, "accept"), ("top", 0, "eject"),
    ], plaque="balancer.png"),
    "balancer-merger-inverse.png": _mk(1, 1, [
        ("bottom", 0, "accept"), ("left", 0, "accept"), ("top", 0, "eject"),
    ], plaque="balancer.png", mirror=True),
    "balancer-splitter.png": _mk(1, 1, [
        ("bottom", 0, "accept"), ("top", 0, "eject"), ("right", 0, "eject"),
    ], plaque="balancer.png"),
    "balancer-splitter-inverse.png": _mk(1, 1, [
        ("bottom", 0, "accept"), ("top", 0, "eject"), ("left", 0, "eject"),
    ], plaque="balancer.png", mirror=True),

    # -- 2-tile-wide buildings --
    # filter: left edge is 100% free (no belt at all) -> wavy 2-bite scallop,
    # kept clear of both corner posts (>=38px buffer) so the EDT curb ring
    # stays straight and actually reaches each post instead of curving away
    # from it right at the corner (a real bug the user caught: bites too
    # close to the corner warp the curb path away from the fixed post).
    # top is free only over tile1 (tile0's top is the eject) -> a small
    # corner nick at top-right, kept shallow (reaches y=20 only) so it can't
    # touch the right-edge eject's belt opening (starts at y=MARGIN=24).
    "filter.png": _mk(2, 1, [
        ("bottom", 0, "accept"), ("top", 0, "eject"), ("right", 0, "eject"),
    ], plaque="filter.png",
        notch_ellipses=[(0, 70, 32, 32), (0, 122, 32, 32)],
        cut_polys=[[(384 - 40, 0), (384, 0), (384, 20)]]),
    # mixer: left+right are 100% free (only top/bottom carry belts) -> one
    # round bite centered on each, same "free-side scallop" language as
    # filter's, symmetric since mixer itself is symmetric.
    "mixer.png": _mk(2, 1, [
        ("top", 0, "eject"), ("bottom", 0, "accept"), ("bottom", 192, "accept"),
    ], plaque="mixer.png",
        notch_ellipses=[(0, 96, 55, 55), (384, 96, 55, 55)]),
    # painter-mirrored: same arch-notch language and exact spacing as the
    # base painter, but on the TOP edge instead of bottom — mirroring moves
    # the color-accept to tile1's bottom, so bottom is only free at tile0
    # here, while top is 100% free across both tiles (the reverse of base
    # painter, whose top is free only at tile1) — user caught this, arches
    # belong wherever there's genuinely no input, which for this variant is
    # the top.
    "painter-mirrored.png": _mk(2, 1, [
        ("left", 0, "accept"), ("bottom", 192, "accept"), ("right", 0, "eject"),
    ], plaque="painter.png",
        notch_ellipses=[(110, 0, 60, 35), (280, 0, 60, 35)]),

    # -- 4-tile-wide buildings --
    # cutter-quad: bottom is free across tiles 1-3 (only tile0 accepts) ->
    # a small corner nick right after tile0, then one big sweeping arc
    # carving away most of the bottom-right (large wide ellipse centered
    # below-right of the canvas so only its shallow top arc intersects —
    # verified it never reaches above y=100, well clear of the top-edge
    # ejects at y=0..28).
    "cutter-quad.png": _mk(4, 1, [
        ("bottom", 0, "accept"),
        ("top", 0, "eject"), ("top", 192, "eject"), ("top", 384, "eject"), ("top", 576, "eject"),
    ], plaque="cutter.png", corner_skip=("br",),  # br corner is swept away, see below
        notch_ellipses=[(230, 192, 40, 40), (768, 400, 450, 300)]),
    # painter-quad: mirror image of cutter-quad's sweep — top is free across
    # tiles 1-3 (only tile0 ejects), so the big sweep carves the top-right
    # instead of the bottom-right, staying above y=100, safely clear of the
    # bottom belt lanes (which start at y=164).
    "painter-quad.png": _mk(4, 1, [
        ("left", 0, "accept"),
        ("bottom", 0, "accept"), ("bottom", 192, "accept"),
        ("bottom", 384, "accept"), ("bottom", 576, "accept"),
        ("top", 0, "eject"),
    ], plaque="painter.png", corner_skip=("tr",),  # tr corner is swept away, see below
        notch_ellipses=[(768, -200, 450, 300)]),

    # -- 2x2 buildings --
    # storage: left+right are 100% free (only top/bottom carry belts), same
    # situation as mixer just taller -> same round-bite language, bigger.
    # No free-side mid-post here (unlike mixer) — user flagged it as a
    # redundant post floating right on the bite's own curve; the bite is
    # decoration enough, corners are enough structure.
    "storage.png": _mk(2, 2, [
        ("top", 0, "eject"), ("top", 192, "eject"),
        ("bottom", 0, "accept"), ("bottom", 192, "accept"),
    ], plaque="storage.png", plaque_size=160, free_side_mid_posts=False,
        notch_ellipses=[(0, 192, 70, 70), (384, 192, 70, 70)]),
    "painter-double.png": _mk(2, 2, [
        ("left", 0, "accept"), ("left", 192, "accept"),
        ("top", 192, "accept"), ("right", 0, "eject"),
    ], plaque="painter.png", plaque_size=160),
})


def build_all():
    ref_crops = os.path.join(bp.BASE, "ref_crops")
    for fname, spec in SPECS.items():
        auto_posts = _auto_flank_posts(spec["w_tiles"], spec["h_tiles"], spec["belt_edges"])
        posts = _merge_posts(spec["post_centers"], auto_posts)
        canvas = build_generic(
            spec["w_tiles"], spec["h_tiles"], spec["belt_edges"], posts,
            cut_polys=spec.get("cut_polys"), notch_ellipses=spec.get("notch_ellipses"),
        )
        if "plaque" in spec:
            icon_name, size, center = spec["plaque"]
            bp.apply_plaque(canvas, icon_name, *center, plaque_size=size, mirror=spec.get("mirror", False))
        if "content" in spec:
            content = Image.open(os.path.join(ref_crops, spec["content"])).convert("RGBA")
            canvas.alpha_composite(content, (0, 0))
        if spec["arrows"]:
            bp.apply_arrows(canvas, spec["arrows"])
        out_path = os.path.join(B, fname.replace(".png", "_v2.png"))
        canvas.save(out_path)
        print("wrote", out_path)


# rotator-ccw / rotator-rotate180: same footprint and same bottom-in/top-out
# slots as the base rotator (verified in src/js/game/buildings/rotator.js —
# only the ItemProcessor's rotation math differs, not the building's
# silhouette or connections), so they reuse the exact approved pinch-curve
# builder rather than build_generic.
ROTATOR_VARIANTS = ["rotator-ccw.png", "rotator-rotate180.png"]


def build_rotator_variants():
    for fname in ROTATOR_VARIANTS:
        canvas = bp.build_platform_pinched()
        bp.apply_plaque(canvas, "rotator.png", 96, 96)
        bp.apply_arrows(canvas, [(96, 192, 0), (96, 0, 0)])
        out_path = os.path.join(B, fname.replace(".png", "_v2.png"))
        canvas.save(out_path)
        print("wrote", out_path)


if __name__ == "__main__":
    build_all()
    build_rotator_variants()
