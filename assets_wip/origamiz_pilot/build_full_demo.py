"""Full demo scene: every rebuilt building (pilot batch + batch 2, 47 total,
plus the hub) placed with real belt tiles at each connection, laid out in a
flow grid, plus an on-canvas legend (icon -> building name) at the bottom.
Run from inside this directory:
    python3 build_full_demo.py
Writes scene/full_demo.png.
"""
import os
from PIL import Image, ImageDraw, ImageFont

import build_platform as bp
import build_batch as bb

BASE = bp.BASE
B = bp.B
I = bp.I
TILE = bp.TILE

FONT = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 20)
FONT_SMALL = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 17)
FONT_TITLE = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 36)

belt_v = bp.build_belt_straight()
belt_h = belt_v.rotate(90, expand=True)

# display names — from translations/base-en.yaml `buildings:` section (the
# game's own official strings, not ad-hoc labels).
NAMES = {
    "balancer.png": "Balancer", "cutter.png": "Cutter", "stacker.png": "Stacker",
    "painter.png": "Painter", "miner.png": "Extractor", "trash.png": "Trash",
    "underground_belt_entry.png": "Tunnel", "underground_belt_exit.png": "Tunnel",
    "rotator.png": "Rotator", "rotator-ccw.png": "Rotator (CCW)",
    "rotator-rotate180.png": "Rotator (180°)",
    "analyzer.png": "Shape Analyzer", "comparator.png": "Compare",
    "constant_signal.png": "Constant Signal", "display.png": "Display",
    "lever.png": "Switch", "logic_gate.png": "AND Gate", "logic_gate-not.png": "NOT Gate",
    "logic_gate-or.png": "OR Gate", "logic_gate-xor.png": "XOR Gate",
    "transistor.png": "Transistor", "transistor-mirrored.png": "Transistor",
    "virtual_processor.png": "Virtual Cutter",
    "virtual_processor-rotator.png": "Virtual Rotator",
    "virtual_processor-unstacker.png": "Virtual Unstacker",
    "virtual_processor-stacker.png": "Virtual Stacker",
    "virtual_processor-painter.png": "Virtual Painter",
    "wire_tunnel.png": "Wire Crossing", "block.png": "Block",
    "constant_producer.png": "Constant Producer", "item_producer.png": "Item Producer",
    "goal_acceptor.png": "Goal Acceptor", "miner-chainable.png": "Extractor (Chain)",
    "underground_belt_entry-tier2.png": "Tunnel Tier II",
    "underground_belt_exit-tier2.png": "Tunnel Tier II",
    "reader.png": "Belt Reader",
    "balancer-merger.png": "Merger (compact)", "balancer-merger-inverse.png": "Merger (compact)",
    "balancer-splitter.png": "Splitter (compact)", "balancer-splitter-inverse.png": "Splitter (compact)",
    "filter.png": "Filter", "mixer.png": "Color Mixer", "painter-mirrored.png": "Painter",
    "cutter-quad.png": "Cutter (Quad)", "painter-quad.png": "Painter (Quad)",
    "painter-double.png": "Painter (Double)", "storage.png": "Storage",
    "hub.png": "Hub",
}

# icon each building's plaque uses (for the legend) — from build_batch.SPECS
# where present; the 3 rotator files and the original 7 pilot buildings not
# re-specced this session are filled in by hand (same source as before).
ICON_OF = {
    "balancer.png": "balancer.png", "cutter.png": "cutter.png", "stacker.png": "stacker.png",
    "painter.png": "painter.png", "miner.png": "miner.png", "trash.png": "trash.png",
    "underground_belt_entry.png": "underground_belt.png",
    "underground_belt_exit.png": "underground_belt.png",
    "rotator.png": "rotator.png", "rotator-ccw.png": "rotator.png",
    "rotator-rotate180.png": "rotator.png",
}
for fname, spec in bb.SPECS.items():
    if "plaque" in spec:
        ICON_OF[fname] = spec["plaque"][0]
ICON_OF["block.png"] = None  # deliberately bare, see build_batch.py

# belt_edges + tile size for every building — reuse SPECS, add the 3
# rotator files by hand (rotator itself isn't in build_batch.SPECS, it's
# built by build_platform.py directly; its footprint/slots are identical
# for all 3 variants, verified against src/js/game/buildings/rotator.js).
GEOM = {fname: (spec["w_tiles"], spec["h_tiles"], spec["belt_edges"]) for fname, spec in bb.SPECS.items()}
for r in ("rotator.png", "rotator-ccw.png", "rotator-rotate180.png"):
    GEOM[r] = (1, 1, [("bottom", 0), ("top", 0)])
# hub: 4x4, own bespoke art (not built through build_batch.py, no _v2 file,
# see make_cell's special-case below), no belt edges — its 16 item-acceptor
# arrows are baked into the art and its one WiredPins ejector (left edge,
# tile row 2) deliberately has no visual marker, matching the vanilla
# sprite (see TODO.md 2026-08-27 "hub wire-connector question" entry).
GEOM["hub.png"] = (4, 4, [])

ORDER = [
    "hub.png",
    "miner.png", "miner-chainable.png", "underground_belt_entry.png", "underground_belt_exit.png",
    "underground_belt_entry-tier2.png", "underground_belt_exit-tier2.png", "trash.png",
    "balancer.png", "balancer-merger.png", "balancer-merger-inverse.png",
    "balancer-splitter.png", "balancer-splitter-inverse.png",
    "cutter.png", "cutter-quad.png", "rotator.png", "rotator-ccw.png", "rotator-rotate180.png",
    "stacker.png", "mixer.png",
    "painter.png", "painter-mirrored.png", "painter-double.png", "painter-quad.png",
    "filter.png", "storage.png", "reader.png", "goal_acceptor.png",
    "constant_producer.png", "item_producer.png",
    "analyzer.png", "comparator.png", "display.png", "lever.png", "constant_signal.png",
    "logic_gate.png", "logic_gate-not.png", "logic_gate-or.png", "logic_gate-xor.png",
    "transistor.png", "transistor-mirrored.png",
    "virtual_processor.png", "virtual_processor-rotator.png", "virtual_processor-unstacker.png",
    "virtual_processor-stacker.png", "virtual_processor-painter.png",
    "wire_tunnel.png", "block.png",
]
assert set(ORDER) == set(NAMES), (set(NAMES) - set(ORDER), set(ORDER) - set(NAMES))


BARE_PAD = 16  # thin breathing room on a side with no belt (vs a full TILE
                # of belt length on a side that has one) — keeps a 1x1
                # wires-only building compact instead of drowning it in
                # empty paper margin sized for a belt that isn't there.


def make_cell(fname):
    w_tiles, h_tiles, belt_edges = GEOM[fname]
    w, h = w_tiles * TILE, h_tiles * TILE
    used = {edge for edge, _ in belt_edges}
    top_m = TILE if "top" in used else BARE_PAD
    bot_m = TILE if "bottom" in used else BARE_PAD
    left_m = TILE if "left" in used else BARE_PAD
    right_m = TILE if "right" in used else BARE_PAD
    cw, ch = w + left_m + right_m, h + top_m + bot_m

    canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    bg_tile = Image.open(os.path.join(bp.U, "paper_background.png")).convert("RGBA").resize((TILE, TILE))
    for x in range(0, cw, TILE):
        for y in range(0, ch, TILE):
            canvas.alpha_composite(bg_tile, (x, y))
    building_file = fname if fname == "hub.png" else fname.replace(".png", "_v2.png")
    building = Image.open(os.path.join(B, building_file)).convert("RGBA")
    canvas.alpha_composite(building, (left_m, top_m))
    for edge, offset in belt_edges:
        if edge == "top":
            canvas.alpha_composite(belt_v, (left_m + offset, top_m - TILE))
        elif edge == "bottom":
            canvas.alpha_composite(belt_v, (left_m + offset, top_m + h))
        elif edge == "left":
            canvas.alpha_composite(belt_h, (left_m - TILE, top_m + offset))
        else:
            canvas.alpha_composite(belt_h, (left_m + w, top_m + offset))
    return canvas


def label(im_w, text, font=FONT_SMALL):
    # sits on the scene's dark-brown page background (not the cream cell
    # paper), so needs the SAME light fill the title/legend text uses.
    strip = Image.new("RGBA", (im_w, 30), (0, 0, 0, 0))
    d = ImageDraw.Draw(strip)
    tw = d.textlength(text, font=font)
    d.text(((im_w - tw) / 2, 2), text, font=font, fill=(240, 230, 210, 255))
    return strip


def build_scene():
    cells = []
    for fname in ORDER:
        cell = make_cell(fname)
        strip = label(cell.width, NAMES[fname])
        combo = Image.new("RGBA", (cell.width, cell.height + strip.height), (0, 0, 0, 0))
        combo.alpha_composite(cell, (0, 0))
        combo.alpha_composite(strip, (0, cell.height))
        cells.append(combo)

    max_row_w = 2400
    pad = 16
    rows, row, row_w, row_h = [], [], 0, 0
    for c in cells:
        if row and row_w + c.width + pad > max_row_w:
            rows.append((row, row_w, row_h))
            row, row_w, row_h = [], 0, 0
        row.append(c)
        row_w += c.width + pad
        row_h = max(row_h, c.height)
    if row:
        rows.append((row, row_w, row_h))

    grid_w = max(rw for _, rw, _ in rows)
    grid_h = sum(rh for _, _, rh in rows) + pad * len(rows)

    # legend: all 27 icons + names, in its own flow row block
    legend_icons = sorted(set(v for v in ICON_OF.values() if v), key=lambda s: s)
    leg_cell_w, leg_cell_h = 170, 170
    leg_cols = 10
    leg_rows = (len(legend_icons) + leg_cols - 1) // leg_cols
    legend_h = 70 + leg_rows * leg_cell_h

    title_h = 60
    total_w = max(grid_w, leg_cols * leg_cell_w) + 40
    total_h = title_h + grid_h + 50 + legend_h + 40

    scene = Image.new("RGBA", (total_w, total_h), (60, 48, 34, 255))
    d = ImageDraw.Draw(scene)
    d.text((20, 12), "Origamiz — building set", font=FONT_TITLE, fill=(240, 230, 210, 255))

    y = title_h
    for row, row_w, row_h in rows:
        x = 20
        for c in row:
            scene.alpha_composite(c, (x, y + (row_h - c.height)))
            x += c.width + pad
        y += row_h + pad

    y += 30
    d.text((20, y), "Legend", font=FONT, fill=(240, 230, 210, 255))
    y += 40
    name_by_icon = {}
    for fname, icon in ICON_OF.items():
        if icon:
            name_by_icon.setdefault(icon, NAMES[fname])
    for idx, icon in enumerate(legend_icons):
        cx = 20 + (idx % leg_cols) * leg_cell_w
        cy = y + (idx // leg_cols) * leg_cell_h
        im = Image.open(os.path.join(I, icon)).convert("RGBA").resize((96, 96), Image.LANCZOS)
        scene.alpha_composite(im, (cx + (leg_cell_w - 96) // 2, cy))
        text = name_by_icon[icon]
        tw = d.textlength(text, font=FONT_SMALL)
        # wrap long names onto 2 lines at a space near the middle
        if tw > leg_cell_w - 10 and " " in text:
            mid = len(text) // 2
            split = text.rfind(" ", 0, mid) if text.rfind(" ", 0, mid) != -1 else text.find(" ", mid)
            line1, line2 = text[:split], text[split + 1:]
            d.text((cx + (leg_cell_w - d.textlength(line1, font=FONT_SMALL)) / 2, cy + 100),
                   line1, font=FONT_SMALL, fill=(240, 230, 210, 255))
            d.text((cx + (leg_cell_w - d.textlength(line2, font=FONT_SMALL)) / 2, cy + 122),
                   line2, font=FONT_SMALL, fill=(240, 230, 210, 255))
        else:
            d.text((cx + (leg_cell_w - tw) / 2, cy + 105), text, font=FONT_SMALL, fill=(240, 230, 210, 255))

    out_path = os.path.join(BASE, "scene", "full_demo.png")
    scene.save(out_path)
    print("wrote", out_path, scene.size)


if __name__ == "__main__":
    build_scene()
