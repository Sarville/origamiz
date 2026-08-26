# Origamiz asset pilot v9 — precise schematic-guided redo + plaque fix

The last attempt regressed: arrows ended up floating as separate little
rounded badges OUTSIDE the building silhouette (left/right of it), not drawn
on the frame at the actual gap, and the axis still read left/right instead
of bottom/top. Also the plaque template came out looking like a ruled grid/
ledger card, not a plaque. Fixing both now with exact geometric references
instead of relying on text descriptions of position.

Save to `/home/user/projects/shapez-community-edition/assets_wip/origamiz_pilot/buildings/`
(overwrite `cutter.png`, `rotator.png`, `balancer.png`, `stacker.png`,
`painter.png`). Also overwrite `ui/plaque_template.png`. Do not touch any
other file.

Attached references:
- `hub_current.png` — top-down camera/frame material reference (keep using
  this exact construction language: thin wood-post-and-rail border frame
  around the tile footprint, seen from directly above).
- `v7_cutter_for_texture.png`, `v7_balancer_for_texture.png` — roof/frame
  material and line-quality reference ONLY, their opening positions are
  outdated, ignore those, just copy the paper/wood texture and rendering
  quality.
- `v8_cutter_BAD_floating_arrows.png` — THIS IS WHAT WENT WRONG, study it to
  avoid repeating the mistake: the arrows are drawn as separate rounded
  rectangle badges floating in the white space to the left and right of the
  building, disconnected from the frame, and there's no visible gap/opening
  cut into the frame at all. DO NOT do this.
- `schematics/cutter.png`, `schematics/rotator.png`, `schematics/balancer.png`,
  `schematics/stacker.png`, `schematics/painter.png` — exact geometric
  diagrams generated directly from this game's real source code slot data.
  Each is a plain white rectangle (matching that building's tile footprint
  exactly, 2 tiles side by side split by a thin center line, or 1 tile) with
  a dark brown outline representing the frame border, and solid red
  triangles marking EXACTLY where each opening/arrow must go and which way
  each arrow must point, labeled IN / OUT. Treat these as ground truth for
  position — the red triangle's location = the gap's location, the red
  triangle's point direction = the arrow's point direction. A triangle
  sitting ON the top or bottom edge line (not the left/right edges) means
  the gap belongs on that top/bottom edge, cut through the frame right
  there — not on the side.

## Construction rule (unchanged from before, just executed correctly this time)

For every opening: cut an actual gap through the frame at the exact spot the
matching schematic shows, then draw ONE crisp, bold, high-contrast arrow
directly ON the frame/roof surface immediately at that gap (overlapping or
touching the gap, like a painted road-marking), pointing the direction the
schematic shows. The arrow must read as part of the building's own surface,
never as a separate floating element outside the silhouette. Roof center
stays completely plain/empty (no plaque, no icon — composited separately
afterward, as before).

1. `cutter.png` (384x192) — per `schematics/cutter.png`.
2. `rotator.png` (192x192) — per `schematics/rotator.png`.
3. `balancer.png` (384x192) — per `schematics/balancer.png`.
4. `stacker.png` (384x192) — per `schematics/stacker.png`.
5. `painter.png` (384x192) — per `schematics/painter.png`.

## Plaque template fix

`ui/plaque_template.png` — 256x256px, transparent background. A simple
square wood-sign plaque, top-down, light BAMBOO-toned wood (pale warm
tan-green). Keep it SIMPLE: a flat plaque body with a subtly raised bevel
border for a little dimension, and very light, barely-visible directional
wood grain (soft parallel streaks, not a hard-edged ruled grid — no visible
crosshatch lines, no ledger/graph-paper look). Center 70% stays completely
flat, blank, empty — no icon, no text, no grid squares. Soft drop shadow
beneath it.

Verify every file with PIL after saving (correct size, RGBA, real alpha
variation, no green channel exceeding both red and blue at partial-alpha
edges). Report a final table when done.
