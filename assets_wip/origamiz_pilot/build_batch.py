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
            bp.apply_plaque(canvas, icon_name, *center, plaque_size=size)
        if "content" in spec:
            content = Image.open(os.path.join(ref_crops, spec["content"])).convert("RGBA")
            canvas.alpha_composite(content, (0, 0))
        if spec["arrows"]:
            bp.apply_arrows(canvas, spec["arrows"])
        out_path = os.path.join(B, fname.replace(".png", "_v2.png"))
        canvas.save(out_path)
        print("wrote", out_path)


if __name__ == "__main__":
    build_all()
