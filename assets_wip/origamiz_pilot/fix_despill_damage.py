"""Undo despill.py's accidental clamp of the intentional bamboo-green torii recolor.
despill damaged G -> max(R,B) wherever G was the max channel (true for our
green, hue=95deg => G is always the max channel). R and B are untouched, so
we can algebraically reconstruct the original G via the HSV formula for
hue segment 1 (60-120deg): R=v*(1-s*f), B=v*(1-s), f=0.5833.
"""
import os
from PIL import Image

BASE = os.path.dirname(os.path.abspath(__file__))
F = 95 / 60 - 1  # fractional position within the 60-120 segment = 0.58333...

def fix(path):
    im = Image.open(path).convert("RGBA")
    px = im.load()
    w, h = im.size
    fixed = 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0 or r != g or r <= b:
                continue  # only touch damaged pixels (R==G>B, despill's signature)
            R, B = r / 255, b / 255
            vs = (R - B) / (1 - F)  # v*s
            v = B + vs
            v = min(1.0, v)
            G = round(v * 255)
            if G > r:
                px[x, y] = (r, G, b, a)
                fixed += 1
    im.save(path)
    return fixed

def main():
    for f in ["underground_belt_entry.png", "underground_belt_exit.png"]:
        p = os.path.join(BASE, "buildings", f)
        n = fix(p)
        print(f, "restored px:", n)

if __name__ == "__main__":
    main()
