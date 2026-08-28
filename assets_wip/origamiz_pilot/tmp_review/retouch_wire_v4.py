from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path('staging_wire_v4')
GREEN = np.array([105, 143, 83], dtype=np.float32)  # muted bamboo green

def edge_spans(alpha):
    out = {}
    for name, line in [('top', alpha[0]), ('bottom', alpha[-1]),
                       ('left', alpha[:, 0]), ('right', alpha[:, -1])]:
        xs = np.flatnonzero(line > 0)
        out[name] = None if not len(xs) else [int(xs[0]), int(xs[-1])]
    return out

def green_tab_tint(arr):
    # Only pixels belonging to a tab that reaches a canvas edge can be affected:
    # the body itself is at least 20px from an edge.  Alpha and geometry stay intact.
    rgb = arr[..., :3].astype(np.float32)
    alpha = arr[..., 3]
    yy, xx = np.mgrid[:192, :192]
    distance = np.minimum.reduce([xx, yy, 191 - xx, 191 - yy])
    strength = np.clip((12.0 - distance) / 12.0, 0, 1) * 0.17
    strength *= (alpha > 0)
    rgb[:] = rgb * (1 - strength[..., None]) + GREEN * strength[..., None]
    arr[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8)

def clean_symbol(im, box, samples, icon_path, size, center, base=None):
    # Rebuild just the old symbol footprint as a smooth local paper plane.
    # This deliberately avoids touching its surrounding folds/body geometry.
    a = np.array(im)
    x0, y0, x1, y1 = box
    colors = []
    for sx, sy, sw, sh in samples:
        colors.append(a[sy:sy+sh, sx:sx+sw, :3].reshape(-1, 3))
    base = np.median(np.concatenate(colors), axis=0).astype(np.uint8) if base is None else np.array(base, dtype=np.uint8)
    # a feathered rounded mask makes the rebuilt flat facet blend into its paper panel.
    mask = Image.new('L', im.size, 0)
    m = np.array(mask)
    m[y0:y1, x0:x1] = 255
    mask = Image.fromarray(m).filter(ImageFilter.GaussianBlur(3))
    plane = Image.new('RGBA', im.size, tuple(base.tolist()) + (255,))
    im = Image.composite(plane, im, mask)
    # The project-approved icon is used directly (cropped to its actual alpha bounds)
    # rather than drawing a look-alike.
    icon = Image.open(icon_path).convert('RGBA')
    bbox = icon.getchannel('A').getbbox()
    icon = icon.crop(bbox).resize(size, Image.Resampling.LANCZOS)
    px = int(center[0] - size[0] / 2)
    py = int(center[1] - size[1] / 2)
    im.alpha_composite(icon, (px, py))
    return im

report_before, report_after = {}, {}
for path in sorted(ROOT.glob('*.png')):
    im = Image.open(path).convert('RGBA')
    report_before[path.name] = edge_spans(np.array(im)[..., 3])
    if path.name == 'virtual_processor.png':
        im = clean_symbol(im, (68, 7, 124, 70),
                          [(43, 18, 18, 40), (130, 18, 18, 40)],
                          Path('ref_cutter_icon.png'), (47, 47), (96, 39), (239, 226, 207))
    elif path.name == 'virtual_processor-rotator.png':
        im = clean_symbol(im, (51, 91, 141, 158),
                          [(30, 103, 16, 42), (146, 103, 16, 42)],
                          Path('ref_rotator_icon.png'), (58, 58), (96, 125), (238, 219, 189))
    elif path.name == 'virtual_processor-stacker.png':
        im = clean_symbol(im, (52, 104, 140, 160),
                          [(30, 110, 16, 40), (146, 110, 16, 40)],
                          Path('ref_stacker_icon.png'), (62, 49), (96, 132), (240, 221, 191))
    arr = np.array(im)
    green_tab_tint(arr)
    out = Image.fromarray(arr, 'RGBA')
    out.save(path)
    report_after[path.name] = edge_spans(np.array(out)[..., 3])

def fringe(path):
    a = np.array(Image.open(path).convert('RGBA'))
    alpha, rgb = a[..., 3], a[..., :3]
    # Semitransparent pixels which are nearly white are the potentially visible halo class.
    return int(np.count_nonzero((alpha > 0) & (alpha < 255) & (rgb.min(axis=2) >= 245)))

print(json.dumps({'before': report_before, 'after': report_after,
                  'near_white_fringe': {p.name: fringe(p) for p in sorted(ROOT.glob('*.png'))}}, indent=2))
