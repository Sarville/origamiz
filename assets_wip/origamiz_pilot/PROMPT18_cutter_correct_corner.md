# One building, done right — cutter.png only

Stop iterating broadly. Get this ONE file genuinely correct first.

Save to `/home/user/projects/shapez-community-edition/assets_wip/origamiz_pilot/buildings/cutter.png`
only (384x192, transparent background). Do not touch any other file.

Attached: `hub_current.png` (frame material/camera reference — fills edge-to-
edge with zero padding), `clean_cutter.png` (this building's approved roof
shape and frame material — reproduce the roof and general frame construction
closely, this is a refinement not a redesign).

## What was wrong last time

The corner chamfer was cut at only ~26px — so small it barely reads as
anything at normal viewing size, effectively still just a plain rectangle.
Also, rounded/cut edges left faint whitish partial-alpha pixels visible
against a background (not full "checkerboard", but a soft light-colored
halo a few pixels wide) — this must not happen anywhere on this file.

## What to build (in order — this defines the whole pipeline)

1. **Platform**: a rectangle spanning the full 384x192 canvas edge-to-edge
   (fills x=0..383 and y=0..191 completely on the sides described below),
   EXCEPT the BOTTOM-RIGHT corner, which is cut off by a clearly large, obvious
   diagonal chamfer — the two legs of the cut should each be roughly 70-90px
   long (about a third of the tile width), not a small nibble. This must be
   unmistakable at a glance, not something you have to look closely to
   notice.
2. **Curb/frame**: the same wood-post-and-rail language as `hub_current.png`
   and `clean_cutter.png`, but its outer silhouette follows the platform's
   shape exactly, including tracking the diagonal chamfer at the bottom-right
   (the frame corner post at bottom-right is itself built at that same angle —
   genuine integrated 3D geometry with matching wood-grain shading on the
   newly angled face, not a flat 2D line pasted over a square post).
3. **Roof**: reproduce the current approved diamond/hex roof shape from
   `clean_cutter.png`, sitting inside the frame, its outline loosely
   following the platform's silhouette (so it also tapers slightly near the
   chamfered corner, not overlapping past the cut).
4. Leave every side FULLY CLOSED, no opening/gap anywhere — I will cut the
   precise belt-matching opening myself with code afterward, same as before.
   Roof center stays plain (no plaque — composited separately afterward).

## Zero-tolerance edge check

After saving, inspect with PIL: at every point along the outer silhouette
(rounded corners AND the new chamfer edge), there must be a clean, sharp
transition from fully-transparent (alpha 0) to fully-opaque material within
1-2px — no band of partial-alpha pixels wider than ~2px, and absolutely no
near-white (r,g,b all above 235) pixels with alpha between 10 and 240
anywhere in the image. If you find any, fix them (extend the solid material
outward to cover them, or set them fully transparent — whichever keeps the
silhouette clean) before finishing. Report exact pixel counts you found and
fixed, not just "looks fine."
