"""Build one clean, reusable arrow glyph (flat wood-brown chevron, points up)
via PIL — no AI needed for a simple functional triangle, and it guarantees
every building uses the pixel-identical arrow."""
import os
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ui", "arrow.png")
S = 4  # supersample for clean anti-aliasing
SIZE = 56

def main():
    im = Image.new("RGBA", (SIZE * S, SIZE * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    w = h = SIZE * S
    # bold upward chevron/triangle, flat wood-brown fill + darker outline
    pts = [(w * 0.5, h * 0.06), (w * 0.92, h * 0.62), (w * 0.66, h * 0.62),
           (w * 0.66, h * 0.94), (w * 0.34, h * 0.94), (w * 0.34, h * 0.62),
           (w * 0.08, h * 0.62)]
    fill = (168, 122, 66, 255)
    outline = (110, 74, 40, 255)
    d.polygon(pts, fill=fill, outline=outline)
    # thicken outline
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).polygon(pts, outline=255, width=int(5 * S))
    im.paste(Image.new("RGBA", im.size, outline), (0, 0), mask)

    im = im.resize((SIZE, SIZE), Image.LANCZOS)
    # soft drop shadow
    shadow = Image.new("RGBA", im.size, (90, 60, 30, 0))
    shadow.putalpha(im.split()[-1].point(lambda a: int(a * 0.35)))
    shadow = shadow.filter(ImageFilter.GaussianBlur(2))
    canvas = Image.new("RGBA", im.size, (0, 0, 0, 0))
    canvas.alpha_composite(shadow, (1, 2))
    canvas.alpha_composite(im, (0, 0))
    canvas.save(OUT)
    print("saved", OUT, canvas.size)

if __name__ == "__main__":
    main()
