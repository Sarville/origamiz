from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path('staging_wire_v4')
GREEN = np.array([105, 143, 83], dtype=np.float32)

def tint_tabs(a):
    yy, xx = np.mgrid[:192, :192]
    d = np.minimum.reduce([xx, yy, 191-xx, 191-yy])
    t = np.clip((12-d)/12, 0, 1) * .17 * (a[...,3] > 0)
    a[...,:3] = np.clip(a[...,:3].astype(float)*(1-t[...,None]) + GREEN*t[...,None], 0, 255).astype(np.uint8)

edits = {
 'virtual_processor.png': ('crop_vp.png', (68, 7, 124, 70), (239,226,207), 'ref_cutter_icon.png', (47,47), (96,39)),
 'virtual_processor-rotator.png': ('crop_vpr.png', (51, 91, 141, 158), (238,219,189), 'ref_rotator_icon.png', (58,58), (96,125)),
 'virtual_processor-stacker.png': ('crop_vps.png', (52, 104, 140, 160), (240,221,191), 'ref_stacker_icon.png', (62,49), (96,132)),
}
for name, (crop_name, box, paper, icon_name, size, center) in edits.items():
    # Recover the original approved body RGB from the 4x inspection copy made
    # before retouching; retain its original alpha silhouette from the staging file.
    alpha = Image.open(ROOT/name).convert('RGBA').getchannel('A')
    body = Image.open(Path('tmp_review')/crop_name).convert('RGB')
    arr = np.array(body.convert('RGBA'))
    arr[...,3] = np.array(alpha)
    x0,y0,x1,y1 = box
    region = arr[y0:y1, x0:x1, :3]
    # Repaint the prior mark as a continuous, fold-free paper plane.  Its four
    # boundary samples are interpolated, so the retouch inherits the panel's
    # own lighting rather than becoming a flat pasted rectangle.
    tl = tr = bl = br = np.array(paper, dtype=float)
    u = np.linspace(0, 1, x1-x0)[None, :, None]
    v = np.linspace(0, 1, y1-y0)[:, None, None]
    top = tl[None,None,:] * (1-u) + tr[None,None,:] * u
    bottom = bl[None,None,:] * (1-u) + br[None,None,:] * u
    region[:] = np.clip(top * (1-v) + bottom * v, 0, 255).astype(np.uint8)
    im = Image.fromarray(arr, 'RGBA')
    icon = Image.open(icon_name).convert('RGBA')
    icon = icon.crop(icon.getchannel('A').getbbox()).resize(size, Image.Resampling.LANCZOS)
    im.alpha_composite(icon, (int(center[0]-size[0]/2), int(center[1]-size[1]/2)))
    arr = np.array(im)
    tint_tabs(arr)
    Image.fromarray(arr, 'RGBA').save(ROOT/name)
