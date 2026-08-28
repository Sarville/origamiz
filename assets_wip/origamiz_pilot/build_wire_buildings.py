"""Wires-layer buildings — a completely different visual language from the
belt buildings: no platform, no wood curb, no corner posts (these are all
single-tile and the user was explicit: "они все одноклеточные, там не нужно
бортиков" — no borders needed there).

v2 of this file (first version just dropped a generic square plaque +
reused abstract icon onto every building — user correctly called this out
as "you didn't redo the buildings, you just took the icons"). This version
instead reconstructs the REAL game's own composition for each building (see
res_raw/sprites/buildings/*.png — a folded-paper "pillow" body with a small
tab poking out toward every side that has a WiredPins connection, plus a
distinct functional symbol matching what that sprite actually shows — not
one shared square icon for every building), redrawn as genuine folded
paper (diagonal fold crease, light top-left / dark bottom-right facets,
same convention as every other origami element in this project).

Connector tabs are two-tone so they read as "distinctly a connector" (the
user's ask) without losing the paper identity: paper-colored where they
meet the body, bamboo-green where they meet the wire tip — reaching
exactly to the tile edge at each real pin, position read directly from
src/js/game/buildings/*.js (not re-guessed), so they align pixel-for-pixel
with an adjacent bamboo wire tile.
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageChops

import build_platform as bp
import build_wires as bw

BASE = bp.BASE
U = bp.U
I = bp.I
B = bp.B
TILE = bp.TILE
SS = bp.SS

BODY = 136           # body "pillow" size, centered in the tile
CORNER_R = 16         # body corner fillet — rounder than the belt platform's
                       # CORNER_R=8, reads softer/more pillow-like
BODY_LIGHT = (0xEA, 0xDB, 0xAF)
BODY_DARK = (0xC7, 0xAE, 0x74)
BODY_OUTLINE = (0xA3, 0x8A, 0x55)

TAB_W = 36             # deliberately WIDER than the wire's own THICK=24 —
                       # user asked for this explicitly ("пусть будет шире,
                       # чтобы было понятно") once it turned out the actual
                       # discontinuity complaint was about wire-to-wire
                       # turn/split orientation, not this tab. A width step
                       # at the socket is fine/expected (like a wire
                       # plugging into a wider socket) as long as the COLOR
                       # doesn't hard-cut — kept the gradient below for that.
TAB_BLEND_LEN = 40     # over this many px inward from the tile edge, the
                       # band color fades from bamboo green to the body's
                       # own paper tone — a gradient, not a hard cutoff, so
                       # it reads as one continuous rounded connector that
                       # happens to change color, not two different parts.
PAPER_PALETTE = dict(dark=BODY_OUTLINE, mid=BODY_DARK, light=BODY_LIGHT)


def _body():
    """Folded-paper 'pillow': rounded rect split by one diagonal crease
    into a lighter top-left facet and a darker bottom-right facet — same
    top-left-light convention as every curb/post/icon in this project."""
    W = H = BODY * SS
    mask = bp._corner_round_mask(W, H, CORNER_R * SS)

    tri_tl = Image.new("L", (W, H), 0)
    ImageDraw.Draw(tri_tl).polygon([(0, 0), (W, 0), (0, H)], fill=255)

    base = Image.new("RGBA", (W, H), BODY_DARK + (255,))
    light = Image.new("RGBA", (W, H), BODY_LIGHT + (255,))
    base.paste(light, (0, 0), ImageChops.multiply(tri_tl, mask))
    base.putalpha(mask)

    # thin outline ring
    from PIL import ImageFilter
    eroded = mask.filter(ImageFilter.MinFilter(2 * SS + 1))
    ring = ImageChops.subtract(mask, eroded)
    outline = Image.new("RGBA", (W, H), BODY_OUTLINE + (255,))
    outline.putalpha(ring)
    base.alpha_composite(outline)

    return base.resize((BODY, BODY), Image.LANCZOS)


def _tab(direction):
    """Bamboo-to-paper connector, same width and same banded round-pole
    cross-section as the wire tiles themselves the whole way from the tile
    edge to the body — only the hue fades (green -> paper) over
    TAB_BLEND_LEN, so it reads as one continuous rounded connector, not a
    wire that stops and a separate flat-colored nub that starts."""
    half = TAB_W / 2
    cx = cy = TILE / 2
    xx, yy = np.meshgrid(np.arange(TILE), np.arange(TILE))
    green_pal = bw.PALETTES["first"]

    if direction in ("top", "bottom"):
        mask = np.abs(xx - cx) <= half
        t = np.clip(np.abs(xx - cx) / half, 0, 1)
        edge_y = 0 if direction == "top" else TILE
        mask &= (yy <= cy) if direction == "top" else (yy >= cy)
        dist_from_edge = np.abs(yy - edge_y)
    else:
        mask = np.abs(yy - cy) <= half
        t = np.clip(np.abs(yy - cy) / half, 0, 1)
        edge_x = 0 if direction == "left" else TILE
        mask &= (xx <= cx) if direction == "left" else (xx >= cx)
        dist_from_edge = np.abs(xx - edge_x)

    green_colors = bw._band_color_np(t, green_pal).astype(np.float64)
    paper_colors = bw._band_color_np(t, PAPER_PALETTE).astype(np.float64)
    blend = np.clip(dist_from_edge / TAB_BLEND_LEN, 0, 1)[..., None]
    colors = (green_colors * (1 - blend) + paper_colors * blend).astype(np.uint8)

    rgba = np.zeros((TILE, TILE, 4), dtype=np.uint8)
    rgba[..., :3] = colors
    rgba[..., 3] = np.where(mask, 255, 0)
    return Image.fromarray(rgba, mode="RGBA")


def build_wire_building(pins, icon, mirror=False, icon_scale=0.62):
    canvas = Image.new("RGBA", (TILE, TILE), (0, 0, 0, 0))
    for direction in pins:
        canvas.alpha_composite(_tab(direction))
    canvas.alpha_composite(_body(), ((TILE - BODY) // 2, (TILE - BODY) // 2))

    icon_size = int(BODY * icon_scale)
    im = Image.open(os.path.join(I, icon)).convert("RGBA")
    if mirror:
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    im = im.resize((icon_size, icon_size), Image.LANCZOS)
    canvas.alpha_composite(im, ((TILE - icon_size) // 2, (TILE - icon_size) // 2))
    return canvas


# building file -> (pin directions, icon, mirror) — pin data read directly
# from src/js/game/buildings/*.js's WiredPinsComponent slots this session
# (all pos=(0,0) since every one of these is a single tile). Icons reuse
# the PHYSICAL counterpart's icon for every virtual_processor variant
# (cutter/rotator/stacker/painter) per the user's "keep the original
# elements" steer — the real game gives virtual buildings the same symbol
# language as their physical twin, not a separate "virtual" abstraction.
SPECS = {
    "lever.png": (["top"], "lever.png"),
    "constant_signal.png": (["top"], "constant_signal.png"),
    "logic_gate.png": (["top", "left", "right"], "logic_gate.png"),
    "logic_gate-not.png": (["top", "bottom"], "logic_gate_not.png"),
    "logic_gate-or.png": (["top", "left", "right"], "logic_gate_or.png"),
    "logic_gate-xor.png": (["top", "left", "right"], "logic_gate_xor.png"),
    "transistor.png": (["top", "left", "bottom"], "transistor.png"),
    "transistor-mirrored.png": (["top", "right", "bottom"], "transistor.png", True),
    "comparator.png": (["top", "left", "right"], "comparator.png"),
    "analyzer.png": (["left", "right", "bottom"], "analyzer.png"),
    "display.png": (["bottom"], "display.png"),
    "virtual_processor.png": (["left", "right", "bottom"], "cutter.png"),
    "virtual_processor-rotator.png": (["top", "bottom"], "rotator.png"),
    "virtual_processor-unstacker.png": (["left", "right", "bottom"], "virtual_processor_unstacker.png"),
    "virtual_processor-stacker.png": (["top", "bottom", "right"], "stacker.png"),
    "virtual_processor-painter.png": (["top", "bottom", "right"], "painter.png"),
}


def build_all():
    for fname, spec in SPECS.items():
        pins, icon = spec[0], spec[1]
        mirror = spec[2] if len(spec) > 2 else False
        canvas = build_wire_building(pins, icon, mirror=mirror)
        out_path = os.path.join(B, fname.replace(".png", "_v2.png"))
        canvas.save(out_path)
        print("wrote", out_path)


# filter / reader: hybrid buildings — they keep their belt platform+curb
# (built by build_batch.py) since they carry a real physical belt lane, but
# ALSO carry one or two WiredPins (the condition/output signal) that need
# the same bamboo-tipped connector tab as the pure-wire buildings above.
# Each tab is composited UNDERNEATH the already-built platform image: where
# the platform silhouette is solid it simply covers the tab (nothing to see
# there), and where it isn't — the small gap either a free straight edge or,
# for filter, the gap its own scallop notch leaves at the exact pin
# position — the tab shows through and bridges cleanly to the tile edge.
HYBRID_WIRE_PINS = {
    "filter.png": ["left"],
    "reader.png": ["left", "right"],
}


def apply_hybrid_wire_tabs():
    for fname, pins in HYBRID_WIRE_PINS.items():
        path = os.path.join(B, fname.replace(".png", "_v2.png"))
        platform = Image.open(path).convert("RGBA")
        base = Image.new("RGBA", platform.size, (0, 0, 0, 0))
        for direction in pins:
            # _tab() always draws on its own 192x192 frame; pasting at
            # (0, 0) is correct here regardless of the building's overall
            # width because every pin used below sits on the building's
            # true left or right edge (never an interior tile boundary).
            base.alpha_composite(_tab(direction), (0, 0))
        base.alpha_composite(platform, (0, 0))
        base.save(path)
        print("wrote", path, "(+ wire tabs", pins, ")")


def build_wire_crossing():
    """wire_tunnel — NOT the body+tab+icon template the other 16 use. It has
    no WiredPinsComponent at all (src/js/game/buildings/wire_tunnel.js: a
    fixed 4-way passthrough on the wires layer, always-on, no real pin
    slots) and no function to put an icon on — its only job is to show one
    wire physically crossing another without connecting. User rejected the
    first attempt (bordered plaque + "X" icon, same template as the real
    WiredPins buildings) as not reading as a crossing at all: "просто один
    провод проходит под другим" (just one wire passing under the other).
    Reuses build_wires.build_one() unchanged — same function that renders
    the wires/sets_bamboo/*_cross.png network tiles (vertical segment
    drawn after horizontal, naturally overwriting it at the intersection,
    see the comment in build_one()) — so the building IS a static instance
    of the exact same crossing art already approved for the live wire
    network, not a new visual language."""
    return bw.build_one("first", "cross")


if __name__ == "__main__":
    build_all()
    apply_hybrid_wire_tabs()
    build_wire_crossing().save(os.path.join(B, "wire_tunnel_v2.png"))
    print("wrote", os.path.join(B, "wire_tunnel_v2.png"))
