"""Composite the origamiz pilot buildings + belts + toolbar into one preview scene.
Layout reflects the REAL bottom-in/top-out axis pulled from the game's own
building source files (see PROMPT8/PROMPT9), not a guessed left-right axis.
"""
import os
from PIL import Image, ImageDraw, ImageFilter

BASE = os.path.dirname(os.path.abspath(__file__))
B = os.path.join(BASE, "buildings")
I = os.path.join(BASE, "icons")
U = os.path.join(BASE, "ui")
OUT = os.path.join(BASE, "scene", "preview_scene.png")

CANVAS_W, CANVAS_H = 1450, 1550
TILE = 96

def load(path, size=None):
    im = Image.open(path).convert("RGBA")
    if size:
        im = im.resize(size, Image.LANCZOS)
    return im

def paste(canvas, im, xy):
    canvas.alpha_composite(im, xy)

def px(n):
    return round(n * TILE)

def place_building(canvas, fname, col, row, wtiles, htiles):
    im = load(os.path.join(B, fname), size=(px(wtiles), px(htiles)))
    shadow = Image.new("RGBA", im.size, (90, 70, 50, 0))
    shadow.putalpha(im.split()[-1].point(lambda a: int(a * 0.22)))
    shadow = shadow.filter(ImageFilter.GaussianBlur(6))
    paste(canvas, shadow, (px(col) + 6, px(row) + 8))
    paste(canvas, im, (px(col), px(row)))

def place_belt(canvas, kind, col, row, rotate=0):
    # Belts are now the actual procedurally-generated frames from
    # res_raw/sprites/belt/generate_belt_sprites.js (recolored/retextured to
    # our palette), not AI-drawn stand-ins — straight and turn are guaranteed
    # to share the exact same geometry/style since the same script code
    # draws both. "straight" flows bottom-to-top by default (matches this
    # project's building I/O axis). "right" is bottom-in/right-out, "left"
    # is bottom-in/left-out — both empirically confirmed by checking which
    # canvas edges their content touches.
    fname = {"straight": "belt_straight.png", "right": "belt_right.png",
              "left": "belt_left.png"}[kind]
    im = load(os.path.join(U, fname), size=(px(1), px(1)))
    if rotate:
        im = im.rotate(rotate, expand=False)
    paste(canvas, im, (px(col), px(row)))

def main():
    canvas = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))

    paper = load(os.path.join(U, "paper_background.png"))
    pw, ph = paper.size
    for y in range(0, CANVAS_H, ph):
        for x in range(0, CANVAS_W, pw):
            paste(canvas, paper, (x, y))

    grid = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grid)
    for x in range(0, CANVAS_W, TILE):
        gd.line([(x, 0), (x, CANVAS_H)], fill=(139, 107, 74, 10), width=1)
    for y in range(0, CANVAS_H, TILE):
        gd.line([(0, y), (CANVAS_W, y)], fill=(139, 107, 74, 10), width=1)
    paste(canvas, grid, (0, 0))

    # ---- hub, top-left ----
    place_building(canvas, "hub.png", 0, 0, 4, 4)

    # ---- Chain 1 (col 6-7): miner -> cutter -> stacker -> trash, flowing UP ----
    place_building(canvas, "trash.png", 6, 3, 1, 1)
    place_belt(canvas, "straight", 6, 4)   # up, stacker(left out) -> trash
    place_building(canvas, "stacker.png", 6, 5, 2, 1)
    place_belt(canvas, "straight", 6, 6)   # up, cutter(left out) -> stacker(left in)
    place_belt(canvas, "straight", 7, 6)   # up, cutter(right out) -> stacker(right in)
    place_building(canvas, "cutter.png", 6, 7, 2, 1)
    place_belt(canvas, "straight", 6, 8)   # up, miner -> cutter(left in)
    place_building(canvas, "miner.png", 6, 9, 1, 1)

    # ---- Chain 2 (col 0-5): balancer -> rotator -> [turn] -> painter -> [turn] -> tunnel, flowing UP then RIGHT ----
    place_building(canvas, "balancer.png", 0, 9, 2, 1)
    place_belt(canvas, "straight", 0, 8)   # up, balancer(left out) -> rotator in
    place_belt(canvas, "straight", 1, 8)   # up, balancer(right out) stub
    place_building(canvas, "rotator.png", 0, 7, 1, 1)
    place_belt(canvas, "straight", 0, 6)   # up, rotator out
    place_belt(canvas, "right", 0, 5)                  # bottom-in, right-out
    place_belt(canvas, "straight", 1, 5, rotate=-90)   # right, toward painter (forward is vertical, rotate to horizontal)
    place_building(canvas, "painter.png", 2, 5, 2, 1)
    place_belt(canvas, "straight", 4, 5, rotate=-90)   # right, painter out
    place_belt(canvas, "left", 5, 5, rotate=-90)       # left-in, top-out (bottom-in/left-out rotated -90 -> left-in/top-out)
    place_belt(canvas, "straight", 5, 4)   # up, toward tunnel entry
    place_building(canvas, "underground_belt_entry.png", 5, 3, 1, 1)
    # gap at row 2 = underground
    place_building(canvas, "underground_belt_exit.png", 5, 1, 1, 1)
    place_belt(canvas, "straight", 5, 0)   # up, out of the tunnel

    # ---- toolbar ----
    icon_order = [
        "miner.png", "cutter.png", "rotator.png", "balancer.png",
        "underground_belt.png", "painter.png", "stacker.png", "trash.png",
    ]
    locked_slots = 3
    slot = 96
    gap = 18
    side_margin = 60
    total_slots = len(icon_order) + locked_slots
    total_w = total_slots * slot + (total_slots - 1) * gap

    panel = load(os.path.join(U, "toolbar_panel.png"))
    pw, ph = panel.size
    target_pw = total_w + side_margin * 2
    scale = target_pw / pw
    panel = panel.resize((target_pw, int(ph * scale)), Image.LANCZOS)
    panel_x = (CANVAS_W - panel.width) // 2
    panel_y = CANVAS_H - panel.height - 40
    paste(canvas, panel, (panel_x, panel_y))

    start_x = panel_x + (panel.width - total_w) // 2
    slot_y = panel_y + (panel.height - slot) // 2

    for idx, fname in enumerate(icon_order):
        icon = load(os.path.join(I, fname), size=(int(slot * 0.8), int(slot * 0.8)))
        sx = start_x + idx * (slot + gap)
        icon_pos = (sx + (slot - icon.width) // 2, slot_y + (slot - icon.height) // 2)
        paste(canvas, icon, icon_pos)

    for j in range(locked_slots):
        idx = len(icon_order) + j
        sx = start_x + idx * (slot + gap)
        lock = Image.new("RGBA", (slot, slot), (0, 0, 0, 0))
        ld = ImageDraw.Draw(lock)
        ld.rounded_rectangle([slot * 0.15, slot * 0.15, slot * 0.85, slot * 0.85], radius=10,
                              fill=(120, 105, 80, 55))
        paste(canvas, lock, (sx, slot_y))

    canvas.convert("RGB").save(OUT.replace(".png", ".jpg"), quality=92)
    canvas.save(OUT)
    print("saved", OUT)

if __name__ == "__main__":
    main()
