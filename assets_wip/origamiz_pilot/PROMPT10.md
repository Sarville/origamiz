# Origamiz asset pilot v10 — clean gaps ONLY, no arrows (arrows now
# composited programmatically, per the client's own suggestion)

Save to `/home/user/projects/shapez-community-edition/assets_wip/origamiz_pilot/buildings/`
(overwrite `cutter.png`, `rotator.png`, `balancer.png`, `stacker.png`,
`painter.png`). Do not touch any other file.

Attached references:
- `hub_current.png` — top-down camera/frame material.
- `v9_balancer_material.png` — current material/line-quality reference for
  the frame and roof (ignore its baked-in arrows, those are being removed).
- `schematics/*.png` — exact geometric diagrams from the real game source
  code (`src/js/game/buildings/*.js` acceptor/ejector slot data). Ground
  truth for WHERE each gap goes. Ignore the red triangle SHAPE — that was
  only useful for marking arrow direction in the previous pass; this time
  you're drawing NO arrows, so just use each triangle's POSITION to know
  where to cut a gap, and roughly its size for how wide the gap should be
  (one belt-lane width).

## The only job this time: correct gaps, ZERO arrows, plain roof

For every building: thin wood-post-and-rail top-down frame (same as
`hub_current.png`), a plain folded-paper roof filling the middle (same
material as `v9_balancer_material.png`), and clean simple rectangular gaps
cut straight through the frame at the exact positions below. **Do not draw
any arrow, chevron, or directional mark anywhere on any of these 5 files —
leave every gap as a plain open cut, nothing else.** Roof center stays
completely plain/empty as before (plaque composited separately too).

1. `cutter.png` (384x192): ONE gap on the BOTTOM edge, centered over the
   LEFT tile only (x≈96 of 384). TWO separate gaps on the TOP edge: one
   centered over the LEFT tile (x≈96), one centered over the RIGHT tile
   (x≈288) — these must be two clearly separate gaps with solid frame
   between them, not one wide merged gap.
2. `rotator.png` (192x192): ONE gap on the BOTTOM edge (x≈96), ONE gap on
   the TOP edge (x≈96).
3. `balancer.png` (384x192): TWO gaps on the BOTTOM edge (x≈96 and x≈288),
   TWO gaps on the TOP edge (x≈96 and x≈288).
4. `stacker.png` (384x192): TWO gaps on the BOTTOM edge (x≈96 and x≈288).
   ONE gap on the TOP edge, centered over the LEFT tile ONLY (x≈96, NOT
   centered across the whole building at x≈192 — it must sit clearly to the
   left half).
5. `painter.png` (384x192): ONE gap on the LEFT edge at the vertical center
   (y≈96) — shape input. ONE small gap on the TOP edge, centered over the
   RIGHT tile (x≈288) — color input. ONE gap on the RIGHT edge, at the SAME
   vertical center (y≈96) as the left-edge gap — output. The left-edge gap
   and right-edge gap must be at the exact same height so they visually line
   up straight across the building — this is important, double-check it.

Verify every file with PIL after saving (correct size, RGBA, real alpha
variation). Report a final table when done, including for each file how many
gaps you cut and their approximate x/y position so I can cross-check against
the schematic.
