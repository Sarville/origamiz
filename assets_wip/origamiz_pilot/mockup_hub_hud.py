"""Mockup only — NOT wired into src/js/game/systems/hub.js. Tries the
user's proposed simplified hub info overlay (red level chip, goal shown as
just icon+numbers with no "DELIVER"/"TO UNLOCK" wording, red next-unlock
name) on the new-curb hub art (staging_hub/hub_v2.png), to check whether it
can sit in the clear band above the roof instead of covering it like the
real game's current full-sentence layout does (see src/js/game/systems/
hub.js redrawHubBaseTexture — real layout spans x~10-90/y~15-115 of the
128-unit hub texture, i.e. most of the width and height, which would bury
this project's more detailed roof art)."""
import os
from PIL import Image, ImageDraw, ImageFont

BASE = os.path.dirname(os.path.abspath(__file__))
SEAL_RED = (219, 43, 19, 255)
INK = (74, 44, 20, 255)          # matches the outline/shadow brown used elsewhere in this project
PAPER = (247, 233, 209, 255)
GRAY = (140, 128, 110, 255)

FONT_DIR = "/usr/share/fonts/truetype/dejavu/"
f_bold = lambda sz: ImageFont.truetype(FONT_DIR + "DejaVuSans-Bold.ttf", sz)
f_reg = lambda sz: ImageFont.truetype(FONT_DIR + "DejaVuSans.ttf", sz)


def _shape_icon(size):
    """Placeholder goal-shape icon — neutral tones (real shapes are
    player-colored at runtime, this is just a slot preview), same
    half-circle-quad silhouette style as the game's own shape icons."""
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.pieslice([0, 0, size - 1, size - 1], 180, 360, fill=(176, 180, 190, 255))
    d.pieslice([0, 0, size - 1, size - 1], 0, 180, fill=(210, 213, 220, 255))
    d.line([(size / 2, 0), (size / 2, size)], fill=(150, 153, 162, 255), width=max(2, size // 40))
    return im


def _text_center(d, cx, y, text, font, fill):
    bbox = d.textbbox((0, 0), text, font=font)
    w = bbox[2] - bbox[0]
    d.text((cx - w / 2, y), text, font=font, fill=fill)
    return w


def build(hub_path, out_path, level=5, delivered=0, required=170, unlock_name="ТУННЕЛЬ"):
    im = Image.open(hub_path).convert("RGBA")
    d = ImageDraw.Draw(im)

    # -- level chip: small red rounded badge, top-left, clear of the corner
    # post (post sits at ~8-31px) --
    bx0, by0, bx1, by1 = 42, 34, 132, 108
    d.rounded_rectangle([bx0, by0, bx1, by1], radius=14, fill=SEAL_RED)
    _text_center(d, (bx0 + bx1) / 2, by0 + 8, "УР.", f_bold(16), (255, 240, 235, 255))
    _text_center(d, (bx0 + bx1) / 2, by0 + 28, str(level), f_bold(34), (255, 255, 255, 255))

    # -- goal cluster: icon + "delivered / required", no label words,
    # centered in the clear band above the roof (roof's own bbox starts
    # ~y=127 on this particular render, see staging_hub/hub_v2.png) --
    icon_size = 70
    icon = _shape_icon(icon_size)
    icon_x, icon_y = 300, 28
    im.alpha_composite(icon, (icon_x, icon_y))

    num_x = icon_x + icon_size + 14
    d.text((num_x, icon_y - 2), str(delivered), font=f_bold(42), fill=INK)
    dnum_w = d.textbbox((0, 0), str(delivered), font=f_bold(42))[2]
    d.text((num_x + dnum_w + 6, icon_y + 26), "/ " + str(required), font=f_reg(22), fill=GRAY)

    # -- next unlock: red bold name, own row just under the goal cluster --
    _text_center(d, 384, 96, unlock_name, f_bold(26), SEAL_RED)

    im.save(out_path)
    print("wrote", out_path)


if __name__ == "__main__":
    build(os.path.join(BASE, "staging_hub", "hub_v2.png"),
          os.path.join(BASE, "staging_hub", "hub_hud_mockup.png"))
