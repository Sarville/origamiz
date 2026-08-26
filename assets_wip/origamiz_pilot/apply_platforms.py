"""Composite the approved miner/trash/tunnel content onto a curb-framed
platform (matching the hut frame language), gap on the side that actually
matches each building's real belt connection — same programmatic-overlay
approach as the plaques/arrows, so the existing approved art (crate,
basket, torii gates) is never redrawn/risked.
"""
import os
from PIL import Image, ImageFilter

BASE = os.path.dirname(os.path.abspath(__file__))
B = os.path.join(BASE, "buildings")
U = os.path.join(BASE, "ui")

def load(path, size=None):
    im = Image.open(path).convert("RGBA")
    if size:
        im = im.resize(size, Image.LANCZOS)
    return im

def compose(content_path, template_path, rotate, content_scale, out_path):
    template = load(template_path)
    if rotate:
        template = template.rotate(rotate, expand=False)

    canvas = Image.new("RGBA", template.size, (0, 0, 0, 0))
    canvas.alpha_composite(template)

    content = load(content_path)
    new_size = (int(content.width * content_scale), int(content.height * content_scale))
    content = content.resize(new_size, Image.LANCZOS)
    cx = (canvas.width - content.width) // 2
    cy = (canvas.height - content.height) // 2

    shadow = Image.new("RGBA", content.size, (90, 70, 50, 0))
    shadow.putalpha(content.split()[-1].point(lambda a: int(a * 0.3)))
    shadow = shadow.filter(ImageFilter.GaussianBlur(3))
    canvas.alpha_composite(shadow, (cx + 3, cy + 5))
    canvas.alpha_composite(content, (cx, cy))

    canvas.save(out_path)
    print(out_path, "<-", os.path.basename(content_path), "on", os.path.basename(template_path),
          "rotate", rotate, "scale", content_scale)

def main():
    hut_frame = os.path.join(U, "hut_frame_template.png")
    low_frame = os.path.join(U, "low_platform_frame_template.png")

    # miner: bigger, full hut-style frame, gap on TOP (real output side)
    compose(os.path.join(B, "miner.png"), hut_frame, 180, 1.18,
            os.path.join(B, "miner.png"))

    # trash: low platform, gap on BOTTOM (matches this demo's belt approach)
    compose(os.path.join(B, "trash.png"), low_frame, 0, 1.0,
            os.path.join(B, "trash.png"))

    # tunnel entry: low platform, gap on BOTTOM (real input side)
    compose(os.path.join(B, "underground_belt_entry.png"), low_frame, 0, 1.0,
            os.path.join(B, "underground_belt_entry.png"))

    # tunnel exit: low platform, gap on TOP (real output side)
    compose(os.path.join(B, "underground_belt_exit.png"), low_frame, 180, 1.0,
            os.path.join(B, "underground_belt_exit.png"))

if __name__ == "__main__":
    main()
