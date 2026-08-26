"""Remove green chroma-key spill from semi-transparent edges/shadows."""
import os
from PIL import Image

BASE = os.path.dirname(os.path.abspath(__file__))

def despill(path):
    im = Image.open(path).convert("RGBA")
    px = im.load()
    w, h = im.size
    changed = 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            cap = max(r, b)
            if g > cap:
                px[x, y] = (r, cap, b, a)
                changed += 1
    im.save(path)
    return changed

def main():
    for root in ["buildings", "icons"]:
        d = os.path.join(BASE, root)
        for f in sorted(os.listdir(d)):
            p = os.path.join(d, f)
            n = despill(p)
            if n:
                print(root, f, "fixed px:", n)

if __name__ == "__main__":
    main()
