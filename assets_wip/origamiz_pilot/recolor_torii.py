"""Hue-shift the torii red-orange lacquer to a bamboo green, shape/shading untouched."""
import os
import colorsys
from PIL import Image

BASE = os.path.dirname(os.path.abspath(__file__))
TARGET_HUE = 95 / 360.0  # bamboo green
SAT_SCALE = 0.5
VAL_LIFT = 0.06

def recolor(path):
    im = Image.open(path).convert("RGBA")
    px = im.load()
    w, h = im.size
    changed = 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            hh, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            # red-orange accent: hue near 0/360, reasonably saturated
            is_red = (hh < 0.08 or hh > 0.95) and s > 0.35
            if is_red:
                ns = min(1.0, s * SAT_SCALE)
                nv = min(1.0, v + VAL_LIFT)
                nr, ng, nb = colorsys.hsv_to_rgb(TARGET_HUE, ns, nv)
                px[x, y] = (round(nr * 255), round(ng * 255), round(nb * 255), a)
                changed += 1
    im.save(path)
    return changed

def main():
    for f in ["underground_belt_entry.png", "underground_belt_exit.png"]:
        p = os.path.join(BASE, "buildings", f)
        n = recolor(p)
        print(f, "recolored px:", n)

if __name__ == "__main__":
    main()
