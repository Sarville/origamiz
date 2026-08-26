"""Composite the uniform bamboo plaque + matching toolbar icon onto each
hut roof, programmatically (not AI-generated per building) — guarantees
every plaque is pixel-identical in style and every icon matches the toolbar
1:1, per the client's request."""
import os
from PIL import Image, ImageFilter

BASE = os.path.dirname(os.path.abspath(__file__))
B = os.path.join(BASE, "buildings")
I = os.path.join(BASE, "icons")
U = os.path.join(BASE, "ui")

# (building file, icon file, plaque size, center xy in native building px)
JOBS = [
    ("cutter.png", "cutter.png", 150, (192, 96)),
    ("balancer.png", "balancer.png", 150, (192, 96)),
    ("stacker.png", "stacker.png", 150, (192, 96)),
    ("painter.png", "painter.png", 150, (192, 96)),
    ("rotator.png", "rotator.png", 108, (96, 96)),
]

def main():
    plaque_src = Image.open(os.path.join(U, "plaque_template.png")).convert("RGBA")
    for building_file, icon_file, plaque_size, (cx, cy) in JOBS:
        bpath = os.path.join(B, building_file)
        building = Image.open(bpath).convert("RGBA")

        plaque = plaque_src.resize((plaque_size, plaque_size), Image.LANCZOS)
        icon_size = int(plaque_size * 0.6)
        icon = Image.open(os.path.join(I, icon_file)).convert("RGBA")
        icon = icon.resize((icon_size, icon_size), Image.LANCZOS)

        px = cx - plaque_size // 2
        py = cy - plaque_size // 2
        building.alpha_composite(plaque, (px, py))
        ix = cx - icon_size // 2
        iy = cy - icon_size // 2
        building.alpha_composite(icon, (ix, iy))

        building.save(bpath)
        print(building_file, "-> plaque+icon applied at", (cx, cy), "size", plaque_size)

if __name__ == "__main__":
    main()
