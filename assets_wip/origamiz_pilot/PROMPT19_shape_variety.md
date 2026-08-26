# Shape variety pass — rotator, stacker, painter (different technique each,
# only on truly free sides, bold/clearly visible, learned from the cutter
# round: big and unmistakable, zero white/near-white fringe anywhere)

Save 3 files to
`/home/user/projects/shapez-community-edition/assets_wip/origamiz_pilot/buildings/`,
overwriting `rotator.png`, `stacker.png`, `painter.png`. Do not touch any
other file (leave `balancer.png` and `cutter.png` completely untouched — they
are already approved).

Attached: `hub_current.png` (frame/camera reference, edge-to-edge, zero
padding), `clean_cutter.png` (this project's approved big-chamfer treatment,
80x80px diagonal cut integrated into the corner post — for quality/scale
reference of "how bold and how cleanly-integrated" the modification should
read, even though these 3 use different shapes), and each building's own
current roof/frame reference (`clean_rotator.png`, `clean_stacker.png`,
`clean_painter.png` — reproduce their roof shape and frame material as
closely as possible, this is a refinement, not a redesign).

## Rule for all three: only modify sides where NO belt connects

Real input/output layout (from this game's actual source code):
- `rotator.png` (192x192): input=bottom edge, output=top edge. The LEFT and
  RIGHT edges are entirely free — no opening touches them anywhere along
  their full height.
- `stacker.png` (384x192): inputs=bottom edge (both tiles), output=top edge
  (LEFT tile only). The TOP-RIGHT corner area is free (no opening there).
- `painter.png` (384x192): input=left edge (shape, left tile), input=top
  edge (color, RIGHT tile only), output=right edge. The ENTIRE BOTTOM edge
  (both tiles) is free, and the TOP-LEFT corner area is free too.

Every building stays FULLY CLOSED on every side this round (no gap/opening
drawn anywhere — cut precisely by code afterward, as always). Keep the
existing hut construction language (wood posts + folded-paper roof) — only
the silhouette on the free sides changes, using a DIFFERENT technique per
file so the three read as visually distinct from each other and from
cutter's diagonal chamfer:

1. `rotator.png` — give BOTH the left and right edges a smooth, clearly
   visible CONCAVE curve (the frame silhouette curves inward along its
   full height on both sides, like a gentle hourglass pinch), roughly 25-35px
   deep at the curve's middle. The wood post/rail material follows this
   curve naturally (curved rail geometry, not a straight rail cutting across
   a curved gap). Top and bottom edges (where the openings will be) stay
   straight/rectangular.
2. `stacker.png` — give the TOP-RIGHT corner a bold STEPPED/staircase notch
   (2-3 visible steps cut into the corner, like a small staircase silhouette,
   overall reaching about 70-90px in from each edge at the deepest step),
   built as genuine integrated 3D frame geometry at each step (proper corner
   posts at each stair corner, not a flat cutout).
3. `painter.png` — give the ENTIRE BOTTOM edge (both tiles) a bold JAGGED/
   torn-paper-edge silhouette: 3-4 irregular triangular notches of varying
   size (roughly 20-50px deep) cut into the bottom edge, like a deckled/torn
   sheet of washi paper, with the frame's wood posts still present at
   reasonable intervals along this jagged edge (a post doesn't have to be
   exactly at the tile corners anymore, follow the jagged silhouette
   naturally). Left, right, and top edges stay straight/rectangular.

## Zero-tolerance edge check (same standard as the approved cutter.png)

After saving each file, inspect with PIL: sharp transparent-to-opaque
transitions everywhere (no partial-alpha band wider than ~2px), and
absolutely no near-white (r,g,b all above 235) pixels with alpha between 10
and 240 anywhere. Fix anything found (extend material or fully clear it)
before finishing. Report exact pixel counts fixed, not just "looks fine",
for each of the 3 files.
