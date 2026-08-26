# Huts v11 — fully closed frames (openings cut precisely by code afterward),
# properly integrated corner chamfers, verified edge-to-edge fill

Root cause of two bugs found by measuring pixels directly (not eyeballing):
1. The door/gap openings were only ~28px wide, but the actual conveyor belt
   tile is 166px wide — a huge mismatch, which is why belts visually don't
   join the buildings. Fix: stop drawing openings at all this round — I will
   cut a precise 166px-wide opening myself with code afterward, using exact
   measured coordinates. Your job this round is just the closed frame/roof
   and the corner chamfer.
2. Frame edges sometimes don't reach the true canvas boundary (leaving a
   transparent margin even on "closed" sides), and there were leftover
   checkerboard/near-white artifact pixels baked in near some edges from a
   previous transparency-cutting attempt. Both must be avoided this time.

Save 5 files to
`/home/user/projects/shapez-community-edition/assets_wip/origamiz_pilot/buildings/`,
overwriting `cutter.png`, `rotator.png`, `balancer.png`, `stacker.png`,
`painter.png`. Do not touch any other file.

Attached: `hub_current.png` (frame material reference — note it fills edge-
to-edge with no padding), and the CURRENT approved roof/frame for each
building (`clean_cutter.png`, `clean_rotator.png`, `clean_balancer.png`,
`clean_stacker.png`, `clean_painter.png`) — reproduce each one's roof shape,
frame material, and proportions as closely as possible, this is not a
redesign, just two targeted fixes on top of what's already approved.

## Fix 1 — close every side completely, verify edge-to-edge fill

Every building this round: **FULLY CLOSED frame on all sides, no gap/
opening anywhere** (even on the sides that will later get one — I'm cutting
those myself with code, so draw them solid/closed here). The frame's outer
silhouette must reach x=0, x=(width-1), y=0, and y=191 directly on every
side that isn't naturally rounded by the design — check each file yourself
with PIL before finishing (sample several points along each edge, confirm
alpha>30 there) and redraw if any edge has a gap or unwanted margin.

## Fix 2 — a properly integrated corner chamfer (not a flat slice)

On the corner(s) listed below, redesign that specific corner POST itself as
if it were built/cut at an angle from the start — a genuine angled 3D wood
post with its own consistent wood-grain shading on the newly angled face,
blended naturally into the rail it connects to. This is NOT a flat 2D line
drawn across the existing post — the post's actual geometry changes at that
corner. Keep every other corner and the whole roof/frame otherwise
unchanged from the reference.

1. `cutter.png` (384x192) — chamfer the BOTTOM-RIGHT corner only.
2. `rotator.png` (192x192) — chamfer the TOP-RIGHT and BOTTOM-LEFT corners.
3. `balancer.png` (384x192) — no chamfer, just fix Fix 1 (closed + edge-to-
   edge), reproduce the current roof/frame as-is otherwise.
4. `stacker.png` (384x192) — chamfer the TOP-RIGHT corner only.
5. `painter.png` (384x192) — chamfer the BOTTOM-LEFT and BOTTOM-RIGHT
   corners.

Verify every file with PIL after saving: correct size, RGBA, real alpha
variation, edges reach the canvas boundary as described, and no pixel
within 20px of any edge has alpha between 10-220 while also being near-white
(r,g,b all above 235) — that specific combination is the checkerboard/
fringe artifact from before, if you find any, clean it (set alpha to 0)
before finishing. Report a final table.
