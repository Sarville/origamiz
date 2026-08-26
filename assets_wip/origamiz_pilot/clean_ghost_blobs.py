"""Remove small disconnected alpha blobs (stray edit-ghost artifacts),
keeping only the main connected silhouette(s)."""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

MIN_AREA_FRAC = 0.01  # keep components covering at least 1% of the canvas

def clean(path):
    im = Image.open(path).convert("RGBA")
    arr = np.array(im)
    alpha = arr[:, :, 3]
    mask = alpha > 8
    labels, n = ndimage.label(mask)
    if n <= 1:
        return 0
    sizes = ndimage.sum(mask, labels, range(1, n + 1))
    total = mask.size
    removed = 0
    for i, size in enumerate(sizes, start=1):
        if size < total * MIN_AREA_FRAC:
            arr[labels == i, 3] = 0
            removed += 1
    if removed:
        Image.fromarray(arr, "RGBA").save(path)
    return removed

if __name__ == "__main__":
    for p in sys.argv[1:]:
        n = clean(p)
        print(p, "removed components:", n)
