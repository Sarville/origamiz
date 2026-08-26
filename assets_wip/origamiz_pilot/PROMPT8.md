# Origamiz asset pilot v8 — correct I/O axis (from real game source), plain
# roofs (plaque now composited separately), plaque template, tunnel-exit arrow fix

I pulled the ACTUAL input/output slot positions from this game's source code
(`src/js/game/buildings/*.js`, the real `ItemAcceptor`/`ItemEjector` slot
definitions) instead of guessing. Several of our previous huts had the wrong
axis. Fix that now — this is a correctness pass, not a style pass.

Save to `/home/user/projects/shapez-community-edition/assets_wip/origamiz_pilot/buildings/`
(overwrite `cutter.png`, `rotator.png`, `balancer.png`, `stacker.png`,
`painter.png`, `underground_belt_exit.png`). Also create ONE new file,
`ui/plaque_template.png`. Do not touch any other file.

Attached references:
- `hub_current.png` — top-down camera/frame construction language, keep using
  this exactly as before.
- `v7_cutter_for_texture.png`, `v7_balancer_for_texture.png` — current
  approved huts, for roof/frame material and arrow-drawing style ONLY (the
  actual opening positions on these two are about to change, ignore their
  current opening placement, just copy the material/line quality).

## Part 1 — Fix the 5 hut buildings' opening axis

**Important construction change: leave the roof center completely PLAIN this
time — no plaque, no icon, no finial.** A separate square sign will be
composited onto every roof afterward in a later step, so the whole point of
this pass is a clean, uncluttered roof surface (just the folded-paper roof
material) plus the corrected frame openings/arrows. Keep the same top-down
hub-style frame, corrected door/gap positions, and one crisp bold arrow per
opening (wood-brown, flat, right at the gap, matching the arrow clarity of
`v7_cutter_for_texture.png`).

Tile coordinates below: for a 2-tile-wide building, "left tile" = the left
half of the frame, "right tile" = the right half. "Bottom edge" = the edge
nearer the viewer/south side, "top edge" = the far/north side, matching
`hub_current.png`'s own up/down orientation.

1. `cutter.png` (384x192): ONE opening on the BOTTOM edge of the LEFT tile
   only (single input lane), arrow pointing inward (up into the frame). TWO
   separate openings on the TOP edge — one centered over the LEFT tile, one
   centered over the RIGHT tile (two independent output lanes, NOT next to
   each other in the middle — one per tile) — each with its own arrow
   pointing outward (up/away).
2. `rotator.png` (192x192): ONE opening on the BOTTOM edge (input), ONE
   opening on the TOP edge (output) — straight through, same axis, NOT a 90°
   bend (a rotator changes the shape's own pattern, not the belt path).
   Arrow at each: bottom arrow pointing in/up, top arrow pointing out/up.
3. `balancer.png` (384x192): TWO openings on the BOTTOM edge (one per tile,
   both inputs) and TWO openings on the TOP edge (one per tile, both
   outputs) — fully symmetric top/bottom, NOT left/right this time. Arrow at
   each of the 4 openings.
4. `stacker.png` (384x192): TWO openings on the BOTTOM edge (one per tile,
   two inputs). ONE opening on the TOP edge, positioned over the LEFT tile
   ONLY (not centered across both tiles) — the single merged output. Arrow
   at each of the 3 openings.
5. `painter.png` (384x192): keep the SAME opening layout as before (it was
   already correct: one opening on the LEFT edge of the left tile for shape
   input, one small opening on the TOP edge of the right tile for color
   input, one opening on the RIGHT edge of the right tile for output) — only
   change is removing the roof plaque, leave that roof area plain this time.

## Part 2 — Plaque template (new, reusable asset)

`ui/plaque_template.png` — 256x256px, transparent background. A single
standalone square sign/plaque, flat top-down view: light BAMBOO-toned wood
(pale warm tan-green, distinctly lighter/greener than the dark-wood plaques
used before), a simple raised rounded-square frame/bevel edge for a bit of
dimension, subtle bamboo grain texture, soft drop shadow beneath it. Leave
the entire center flat and completely EMPTY/blank (no icon, no text) — an
icon will be composited into that empty center programmatically afterward,
so the middle ~70% of the plaque must be plain, unobstructed bamboo surface.

## Part 3 — Small fix: tunnel exit arrow was on the wrong edge

`underground_belt_exit.png` — attached `current_exit.png` is today's file:
correct green torii gates, but its small arrow sits at the BOTTOM pointing
down, which is wrong — per the source code this building's output is on the
TOP edge. Fix ONLY the arrow: remove the bottom arrow, add one small arrow
at the TOP of the gate composition, pointing further upward/outward (away
from the gate, continuing up). Keep the gates themselves (shape, green
color, nested big/small composition) completely unchanged.

Verify every file with PIL after saving (correct size, RGBA, real alpha
variation, no green channel exceeding both red and blue at partial-alpha
edges — except `underground_belt_exit.png` itself, which is SUPPOSED to be
green, so skip that specific check for that one file only). Report a final
table when done.
