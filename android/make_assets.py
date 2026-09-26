"""Regenerates the launcher icon and splash screens from the repo-root icon.png, promo.png and logo.png.

Run from the repo root:  python3 android/make_assets.py   (needs Pillow). Then rebuild the app.
"""
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / "android/app/src/main/res"
BG = (237, 227, 207)  # cream, matches the game's paper look; also values/ic_launcher_background.xml

icon = Image.open(ROOT / "icon.png").convert("RGBA")
icon = icon.crop(icon.getchannel("A").point(lambda v: 255 if v > 10 else 0).getbbox())
logo = Image.open(ROOT / "logo.png").convert("RGBA")
logo = logo.crop(logo.getchannel("A").point(lambda v: 255 if v > 10 else 0).getbbox())
promo = Image.open(ROOT / "promo.png").convert("RGB")


def fit(im, box_w, box_h):
    s = min(box_w / im.width, box_h / im.height)
    return im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)


def centered(canvas, im):
    canvas.alpha_composite(im, ((canvas.width - im.width) // 2, (canvas.height - im.height) // 2))
    return canvas


# Launcher icons. Adaptive foreground: 108dp canvas, art kept well inside the 66dp circular safe zone (50%: the system splash crops to a circle).
DPI = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
for name, k in DPI.items():
    d = RES / f"mipmap-{name}"
    fg_size = round(108 * k)
    centered(Image.new("RGBA", (fg_size,) * 2), fit(icon, fg_size * 0.50, fg_size * 0.50)).save(d / "ic_launcher_foreground.png")
    size = round(48 * k)
    for round_shape in (False, True):
        tile = Image.new("RGBA", (size * 4,) * 2, BG + (255,))  # 4x supersampling for smooth edges
        scale = 0.66 if round_shape else 0.78
        centered(tile, fit(icon, size * 4 * scale, size * 4 * scale))
        mask = Image.new("L", tile.size, 0)
        r = tile.width // 2 if round_shape else round(tile.width * 0.22)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, tile.width - 1, tile.height - 1), r, fill=255)
        tile.putalpha(ImageChops.multiply(tile.getchannel("A"), mask))
        tile.resize((size, size), Image.LANCZOS).save(d / ("ic_launcher_round.png" if round_shape else "ic_launcher.png"))


# Splash: promo art, cover-cropped, blurred and darkened, with the logo centered.
def splash(w, h):
    s = max(w / promo.width, h / promo.height)
    bg = promo.resize((round(promo.width * s), round(promo.height * s)), Image.LANCZOS)
    bg = bg.crop(((bg.width - w) // 2, (bg.height - h) // 2, (bg.width - w) // 2 + w, (bg.height - h) // 2 + h))
    bg = bg.filter(ImageFilter.GaussianBlur(max(w, h) / 90)).convert("RGBA")
    bg.alpha_composite(Image.new("RGBA", (w, h), (52, 42, 32, 150)))
    return centered(bg, fit(logo, w * 0.78, h * 0.5)).convert("RGB")


PORT = {"mdpi": (320, 480), "hdpi": (480, 800), "xhdpi": (720, 1280), "xxhdpi": (960, 1600), "xxxhdpi": (1280, 1920)}
for name, (w, h) in PORT.items():
    splash(w, h).save(RES / f"drawable-port-{name}/splash.png")
    splash(h, w).save(RES / f"drawable-land-{name}/splash.png")
splash(480, 320).save(RES / "drawable/splash.png")
