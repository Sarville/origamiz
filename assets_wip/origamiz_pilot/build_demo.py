"""Demo scene: place real belt tiles against each rebuilt building so curb
seams can be checked directly, not just eyeballed on the building alone."""
import os
from PIL import Image
import build_platform as bp

BASE = bp.BASE
B = bp.B
U = bp.U

belt_v = bp.build_belt_straight()          # vertical flow (up), 192x192
belt_h = belt_v.rotate(90, expand=True)    # horizontal, for painter's left/right

bg_tile = Image.open(os.path.join(U, "paper_background.png")).convert("RGBA").resize((bp.TILE, bp.TILE))


def bg(w, h):
    canvas = Image.new("RGBA", (w, h))
    for x in range(0, w, bp.TILE):
        for y in range(0, h, bp.TILE):
            canvas.paste(bg_tile, (x, y))
    return canvas


def stack_vertical(building_name, tiles_w, belt_cols_in, belt_cols_out):
    """belt_cols_in/out: list of tile-column indices (0-based) that get a
    belt tile stacked below/above."""
    im = Image.open(os.path.join(B, building_name)).convert("RGBA")
    w, h = im.size
    canvas = bg(w, h * 3)
    for col in belt_cols_out:
        canvas.alpha_composite(belt_v, (col * bp.TILE, 0))
    canvas.alpha_composite(im, (0, bp.TILE))
    for col in belt_cols_in:
        canvas.alpha_composite(belt_v, (col * bp.TILE, 2 * bp.TILE))
    return canvas


def painter_demo():
    im = Image.open(os.path.join(B, "painter_v2.png")).convert("RGBA")
    w, h = im.size  # 384x192
    canvas = bg(w + 2 * bp.TILE, h)
    canvas.alpha_composite(belt_h, (0, 0))                      # shape input, left
    canvas.alpha_composite(im, (bp.TILE, 0))
    canvas.alpha_composite(belt_h, (bp.TILE + w, 0))             # output, right
    top_belt = bg(bp.TILE, bp.TILE)
    top_belt.alpha_composite(belt_v, (0, 0))
    canvas.alpha_composite(top_belt, (bp.TILE + 192, -bp.TILE + h)) if False else None
    return canvas


scenes = {
    "balancer_demo.png": stack_vertical("balancer_v2.png", 2, [0, 1], [0, 1]),
    "cutter_demo.png": stack_vertical("cutter_v2.png", 2, [0], [0, 1]),
    "stacker_demo.png": stack_vertical("stacker_v2.png", 2, [0, 1], [0]),
    "miner_demo.png": stack_vertical("miner_v2.png", 1, [], [0]),
    "trash_demo.png": stack_vertical("trash_v2.png", 1, [0], []),
    "underground_belt_entry_demo.png": stack_vertical("underground_belt_entry_v2.png", 1, [0], []),
    "underground_belt_exit_demo.png": stack_vertical("underground_belt_exit_v2.png", 1, [], [0]),
    "painter_demo.png": painter_demo(),
}

out_dir = os.path.join(BASE, "scene")
for name, im in scenes.items():
    im.save(os.path.join(out_dir, name))
    print("wrote", name, im.size)
