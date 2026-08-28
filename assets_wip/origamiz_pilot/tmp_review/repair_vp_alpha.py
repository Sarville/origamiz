import numpy as np
from PIL import Image

# The initial inspection montage retained the approved silhouette composited on
# #555. Restore the six top-edge rows that an early scratch retouch touched.
src = np.array(Image.open('tmp_review/crop_vp.png').convert('RGB'))
path = 'staging_wire_v4/virtual_processor.png'
out = np.array(Image.open(path).convert('RGBA'))
for y in range(7):
    # Paper is much lighter than the known #555 preview background. This keeps
    # the original 36px tab edge span and antialiases its transition.
    a = np.clip((src[y,:,0].astype(int) - 85) * 255 // (240 - 85), 0, 255).astype(np.uint8)
    out[y,:,3] = a
Image.fromarray(out, 'RGBA').save(path)
