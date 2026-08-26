"""Exact geometric schematics of opening/arrow positions per building,
built from the real game source (src/js/game/buildings/*.js slot data).
Plain diagrams (not art) — passed to the image model as a precise spatial
reference, since text descriptions alone weren't reliable enough."""
import os
from PIL import Image, ImageDraw

OUT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(OUT, "schematics")

SCALE = 4  # draw big, downscale isn't needed, just draw crisp

def new_canvas(w, h):
    return Image.new("RGB", (w * SCALE, h * SCALE), "white")

def tile_rect(w_tiles, h_tiles=1, tile=192):
    return w_tiles * tile, h_tiles * tile

def draw_frame(d, w, h):
    d.rectangle([0, 0, w - 1, h - 1], outline=(120, 80, 40), width=6 * SCALE)
    # tile grid lines
    for x in range(0, w, 192 * SCALE):
        d.line([(x, 0), (x, h)], fill=(200, 170, 130), width=2 * SCALE)

def arrow(d, cx, cy, direction, color=(180, 60, 30)):
    s = 22 * SCALE
    if direction == "in_bottom":  # pointing up, sits just below bottom edge
        pts = [(cx, cy - s), (cx - s, cy + s), (cx + s, cy + s)]
    elif direction == "out_top":  # pointing up, sits just above top edge
        pts = [(cx, cy - s), (cx - s, cy + s), (cx + s, cy + s)]
    elif direction == "in_left":
        pts = [(cx - s, cy), (cx + s, cy - s), (cx + s, cy + s)]
    elif direction == "in_top":  # color input from top, pointing down into building
        pts = [(cx, cy + s), (cx - s, cy - s), (cx + s, cy - s)]
    elif direction == "out_right":
        pts = [(cx + s, cy), (cx - s, cy - s), (cx - s, cy + s)]
    d.polygon(pts, fill=color)

def label(d, xy, text):
    d.text(xy, text, fill=(0, 0, 0))

def save(im, name):
    im = im.resize((im.width // 2, im.height // 2), Image.LANCZOS)
    im.save(os.path.join(OUT, name))

def cutter():
    w, h = tile_rect(2)
    im = new_canvas(w, h)
    d = ImageDraw.Draw(im)
    draw_frame(d, w * SCALE, h * SCALE)
    tile = 192 * SCALE
    # input: bottom edge of LEFT tile
    arrow(d, tile * 0.5, h * SCALE, "in_bottom")
    label(d, (tile * 0.3, h * SCALE - 60), "IN")
    # outputs: top edge of left tile AND top edge of right tile
    arrow(d, tile * 0.5, 0, "out_top")
    arrow(d, tile * 1.5, 0, "out_top")
    label(d, (tile * 0.3, 20), "OUT")
    label(d, (tile * 1.3, 20), "OUT")
    save(im, "cutter.png")

def rotator():
    w, h = tile_rect(1)
    im = new_canvas(w, h)
    d = ImageDraw.Draw(im)
    draw_frame(d, w * SCALE, h * SCALE)
    arrow(d, w * SCALE * 0.5, h * SCALE, "in_bottom")
    arrow(d, w * SCALE * 0.5, 0, "out_top")
    label(d, (20, h * SCALE - 60), "IN")
    label(d, (20, 20), "OUT")
    save(im, "rotator.png")

def balancer():
    w, h = tile_rect(2)
    im = new_canvas(w, h)
    d = ImageDraw.Draw(im)
    draw_frame(d, w * SCALE, h * SCALE)
    tile = 192 * SCALE
    arrow(d, tile * 0.5, h * SCALE, "in_bottom")
    arrow(d, tile * 1.5, h * SCALE, "in_bottom")
    arrow(d, tile * 0.5, 0, "out_top")
    arrow(d, tile * 1.5, 0, "out_top")
    label(d, (tile * 0.3, h * SCALE - 60), "IN")
    label(d, (tile * 1.3, h * SCALE - 60), "IN")
    label(d, (tile * 0.3, 20), "OUT")
    label(d, (tile * 1.3, 20), "OUT")
    save(im, "balancer.png")

def stacker():
    w, h = tile_rect(2)
    im = new_canvas(w, h)
    d = ImageDraw.Draw(im)
    draw_frame(d, w * SCALE, h * SCALE)
    tile = 192 * SCALE
    arrow(d, tile * 0.5, h * SCALE, "in_bottom")
    arrow(d, tile * 1.5, h * SCALE, "in_bottom")
    arrow(d, tile * 0.5, 0, "out_top")  # only over LEFT tile
    label(d, (tile * 0.3, h * SCALE - 60), "IN")
    label(d, (tile * 1.3, h * SCALE - 60), "IN")
    label(d, (tile * 0.3, 20), "OUT (merged)")
    save(im, "stacker.png")

def painter():
    w, h = tile_rect(2)
    im = new_canvas(w, h)
    d = ImageDraw.Draw(im)
    draw_frame(d, w * SCALE, h * SCALE)
    tile = 192 * SCALE
    arrow(d, 0, h * SCALE * 0.5, "in_left")            # shape in: left edge, left tile
    arrow(d, tile * 1.5, 0, "in_top")                  # color in: top edge, right tile
    arrow(d, w * SCALE, h * SCALE * 0.5, "out_right")  # output: right edge, right tile
    label(d, (20, h * SCALE * 0.5 - 60), "SHAPE IN")
    label(d, (tile * 1.15, 40), "COLOR IN")
    label(d, (w * SCALE - 140, h * SCALE * 0.5 - 60), "OUT")
    save(im, "painter.png")

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    cutter()
    rotator()
    balancer()
    stacker()
    painter()
    print("schematics written to", OUT)
