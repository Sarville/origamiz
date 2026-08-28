from pathlib import Path
import json
import numpy as np
from PIL import Image

root = Path('staging_wire_v4')
out = {}
for path in sorted(root.glob('*.png')):
    a = np.array(Image.open(path).convert('RGBA'))
    alpha = a[...,3]
    spans = {}
    for name, line in [('top', alpha[0]), ('bottom', alpha[-1]), ('left', alpha[:,0]), ('right', alpha[:,-1])]:
        x = np.flatnonzero(line > 0)
        spans[name] = None if not len(x) else [int(x[0]), int(x[-1])]
    fringe = int(np.count_nonzero((alpha > 0) & (alpha < 255) & (a[...,:3].min(axis=2) >= 245)))
    out[path.name] = {'size': [a.shape[1],a.shape[0]], 'mode': 'RGBA', 'tabs': spans, 'near_white_fringe_pixels': fringe}
print(json.dumps(out, indent=2))
