"""Bamboo-styled wire tile sprites — replaces generate_wire_sprites.js's flat
colored line + soft shadow look with a banded bamboo-pole cross-section
(same 5-band dark/mid/light/mid/dark technique as the building curbs, just a
green bamboo palette) plus periodic darker "node" rings across the pole to
read as jointed bamboo segments, not a smooth pipe.

Same 4 path shapes as the original (forward/turn/split/cross), same 3
network variants (first/second/conflict) — network identity is still
functionally meaningful (which wire network a segment belongs to / whether
it's in conflict), so it's kept as a color shift of the SAME bamboo
material, not replaced by one flat color.

Output: wires/sets_bamboo/<variant>_<type>.png (192x192), preview only,
not wired into generate_wire_sprites.js yet.
"""
import os
import numpy as np
from PIL import Image

BASE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(BASE, "wires", "sets_bamboo")
os.makedirs(OUT, exist_ok=True)

DIM = 192
SS = 4
THICK = 24  # total pole width — close to the original's 14px core, but this
             # is a real opaque material (no soft alpha halo), so a bit
             # thicker reads better as an actual bamboo pole at this scale.
NODE_WIDTH = 10   # width of the one darker "joint ring" per segment

# (dark rim, mid, light core, mid, dark rim) per network — same 5-band idea
# as PLATFORM_FILL/CURB in build_platform.py, different hue per variant so
# the network-identity function survives the material change.
PALETTES = {
    # natural bamboo — light green, the user's explicit ask, used for the
    # first/default network (by far the most common case in play).
    "first": dict(dark=(0x5C, 0x7A, 0x2E), mid=(0x8F, 0xA5, 0x4C), light=(0xC7, 0xE0, 0x8A)),
    # second network — cooler blue-green bamboo, keeps the old blue identity
    # without introducing an unrelated material/hue.
    "second": dict(dark=(0x2E, 0x66, 0x6E), mid=(0x4C, 0x93, 0x9E), light=(0x8A, 0xCC, 0xD1)),
    # conflict — dried/warning bamboo, reddish-brown, reuses the game's
    # existing conflict-red intent without a jarring pure red.
    "conflict": dict(dark=(0x7A, 0x2E, 0x2E), mid=(0xA5, 0x4C, 0x40), light=(0xE0, 0x8A, 0x78)),
}


def _band_color_np(t, pal):
    out = np.empty(t.shape + (3,), dtype=np.uint8)
    out[:] = pal["dark"]
    out[(t >= 0.15) & (t < 0.35)] = pal["mid"]
    out[(t >= 0.35) & (t <= 0.65)] = pal["light"]
    out[(t > 0.65) & (t <= 0.85)] = pal["mid"]
    return out


PARTS = {
    "forward": [(0.5, 0, 0.5, 1)],
    "turn": [(0.5, 0.5, 0.5, 1), (0.5, 0.5, 1, 0.5)],
    "split": [(0.5, 0.5, 0.5, 1), (0, 0.5, 1, 0.5)],
    "cross": [(0, 0.5, 1, 0.5), (0.5, 0, 0.5, 1)],
}


def _segment_mask_and_dist(x1, y1, x2, y2, W, H):
    """Boolean mask of pixels within THICK/2 of the segment, plus signed
    perpendicular distance (for banding) and distance-along (for node
    rings). Segments are always purely horizontal or vertical (0/0.5/1
    fractions only), so this is a simple axis-aligned slab, no need for a
    general point-segment distance formula."""
    xx, yy = np.meshgrid(np.arange(W), np.arange(H))
    half = THICK / 2 * SS
    if y1 == y2:  # horizontal
        y0px = y1 * H
        mask = np.abs(yy - y0px) <= half
        perp_t = np.abs(yy - y0px) / half
        along = xx
    else:  # vertical
        x0px = x1 * W
        mask = np.abs(xx - x0px) <= half
        perp_t = np.abs(xx - x0px) / half
        along = yy
    # only within the segment's own span (segments already span a full
    # half-tile to the tile edge or center, per PARTS above)
    x0, x1px, y0, y1px = min(x1, x2) * W, max(x1, x2) * W, min(y1, y2) * H, max(y1, y2) * H
    if y1 == y2:
        span = (xx >= x0) & (xx <= x1px)
    else:
        span = (yy >= y0) & (yy <= y1px)
    return mask & span, np.clip(perp_t, 0, 1), along


def build_one(variant, part_id):
    pal = PALETTES[variant]
    lines = PARTS[part_id]
    W = H = DIM * SS

    canvas_rgb = np.zeros((H, W, 3), dtype=np.uint8)
    canvas_a = np.zeros((H, W), dtype=bool)

    for (x1, y1, x2, y2) in lines:
        mask, perp_t, along = _segment_mask_and_dist(x1, y1, x2, y2, W, H)
        colors = _band_color_np(perp_t, pal)
        # ONE node ring at this segment's own midpoint — NOT a periodic
        # `along % NODE_EVERY` (that was the actual bug the user caught:
        # modulo-from-zero puts a dark ring at every tile's y=0/x=0 edge,
        # i.e. at EVERY seam between two adjacent wire tiles, which reads
        # as the pole visually breaking there instead of a deliberate
        # joint). A segment's own midpoint is always safely interior
        # (96 for a full-tile run, 48/144 for a half-tile turn/split/cross
        # arm), so nodes never land on a tile boundary.
        seg_mid = (x1 + x2) / 2 * W if y1 == y2 else (y1 + y2) / 2 * H
        is_node = np.abs(along - seg_mid) < (NODE_WIDTH / 2) * SS
        colors = np.where(is_node[..., None], (np.array(pal["dark"]) * 0.7).astype(np.uint8), colors)
        canvas_rgb[mask] = colors[mask]
        canvas_a[mask] = True
        # for "cross", lines = [horizontal, vertical] so the vertical pole
        # naturally overwrites the horizontal one at the intersection here,
        # matching the original script's draw order (vertical drawn last).

    rgba = np.zeros((H, W, 4), dtype=np.uint8)
    rgba[..., :3] = canvas_rgb
    rgba[..., 3] = np.where(canvas_a, 255, 0)
    im = Image.fromarray(rgba, mode="RGBA").resize((DIM, DIM), Image.LANCZOS)
    return im


def build_all():
    for variant in PALETTES:
        for part_id in PARTS:
            im = build_one(variant, part_id)
            out_path = os.path.join(OUT, f"{variant}_{part_id}.png")
            im.save(out_path)
            print("wrote", out_path)


if __name__ == "__main__":
    build_all()
