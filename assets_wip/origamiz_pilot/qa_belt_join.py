"""QA check: place the actual belt tile directly touching every cut opening
and save a zoomed crop of each seam, so gaps/white fringe can be checked by
eye before calling anything done — per the client's explicit instruction.
"""
import os
from PIL import Image
from cut_openings import CUTS

BASE = os.path.dirname(os.path.abspath(__file__))
B = os.path.join(BASE, "buildings")
U = os.path.join(BASE, "ui")
OUT = os.path.join(BASE, "qa")
os.makedirs(OUT, exist_ok=True)

def load(p):
    return Image.open(p).convert("RGBA")

def belt_for(edge):
    belt = load(os.path.join(U, "belt_straight.png"))
    if edge in ("left", "right"):
        belt = belt.rotate(-90, expand=False)
    return belt

def main():
    for fname, cuts in CUTS.items():
        building = load(os.path.join(B, fname))
        bw, bh = building.size
        for edge, offset in cuts:
            belt = belt_for(edge)
            canvas = Image.new("RGBA", (bw + 400, bh + 400), (235, 225, 200, 255))
            bx, by = 200, 200
            canvas.alpha_composite(building, (bx, by))
            if edge == "bottom":
                pos = (bx + offset, by + bh)
                crop_box = (bx + offset - 40, by + bh - 100, bx + offset + 192 + 40, by + bh + 100)
            elif edge == "top":
                pos = (bx + offset, by - 192)
                crop_box = (bx + offset - 40, by - 100, bx + offset + 192 + 40, by + 100)
            elif edge == "left":
                pos = (bx - 192, by + offset)
                crop_box = (bx - 100, by + offset - 40, bx + 100, by + offset + 192 + 40)
            elif edge == "right":
                pos = (bx + bw, by + offset)
                crop_box = (bx + bw - 100, by + offset - 40, bx + bw + 100, by + offset + 192 + 40)
            canvas.alpha_composite(belt, pos)
            crop = canvas.crop(crop_box)
            crop = crop.resize((crop.width * 2, crop.height * 2), Image.NEAREST)
            out_path = os.path.join(OUT, f"{fname.replace('.png','')}_{edge}_{offset}.png")
            crop.convert("RGB").save(out_path)
            print("saved", out_path)

if __name__ == "__main__":
    main()
