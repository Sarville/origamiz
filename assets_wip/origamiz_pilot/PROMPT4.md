# Origamiz asset pilot v4 — hub restore, hut refinement, belt sprites

Targeted revision. Only touch the files listed below. Everything else in
`buildings/`, `icons/`, `ui/` is already approved — do not regenerate it.

Attached references:
- `hub_target.jpg` — the client picked THIS exact hub design as the best one
  and wants it restored precisely: rounded-square wood border frame, four
  corner posts each topped with a small POINTED PYRAMID cap (not a flat
  cube), a folded-paper pagoda roof that is a big pyramid PLUS four smaller
  triangular wing flaps reaching outward toward the midpoint of each frame
  edge (giving the roof plan a soft four-pointed/cross silhouette, not a
  plain flat-sided pyramid), a wood stairway at the bottom edge, one small
  red hanko seal-stamp near the bottom-right of the roof. Reproduce this as
  closely as possible — same construction, same proportions, same palette.
- `good_hut_balancer.png` — approved hut-building base language (wood posts,
  folded paper roof, window-vs-door asymmetry) — keep this construction for
  every hut in this batch, only adding the refinements described below.
- `belt_straight_ref.png` — crop of the target conveyor-belt material: a
  cream/tan folded-paper strip with a raised, gently shadowed border wall
  along both long edges, small pale chevron ("<" or ">") arrow marks evenly
  spaced along the strip center indicating flow direction.

## Group 1 — Hub restore (save to
`/home/user/projects/shapez-community-edition/assets_wip/origamiz_pilot/buildings/`)

1. `hub.png` — 768x768px, transparent background. Reproduce `hub_target.jpg`
   as closely as possible per the description above. This is a restore, not
   a reinterpretation — match it closely.

## Group 2 — Hut refinement, 5 files, save to same `buildings/` folder
(overwrite `cutter.png`, `rotator.png`, `painter.png`, `stacker.png`,
`balancer.png`)

Keep the existing hut-building construction (wood posts + folded paper roof,
same family as `good_hut_balancer.png`) but apply THREE refinements to every
one of these 5:

(a) **Real wall openings at belt height.** Where the previous batch only
    suggested a window/door, now cut an actual open gap through the wall,
    reaching down to floor/ground level, sized and positioned exactly where
    a conveyor belt tile would physically connect to that edge — like a real
    passage a belt could run through, not a decorative window shape.

(b) **Flat directional arrow(s) painted/carved on the roof slope**, in the
    game's own visual convention (a simple flat chevron/arrow shape on the
    roof surface, same wood-brown tone, low relief) pointing toward each
    output opening — this is in addition to the physical wall opening, not
    a replacement for it.

(c) **A small signboard plaque mounted on the roof ridge, carrying the
    building's icon, REPLACING the previous 3D finial ornament.** The plaque
    is a small rectangular dark-wood signboard (like a shop nameplate/ema),
    standing upright on the ridge. On the plaque, the building's icon is
    rendered EMBOSSED/raised in the same ivory-paper material and simple
    low-poly-fold style as this project's toolbar icon set, with its own
    small drop shadow so it reads clearly raised off the dark plaque — high
    contrast against the plaque background is essential, the icon must not
    blend into it.

Per-building opening layout (exact positions matter, this is the visual
language for input vs. output):

2. `cutter.png` — 384x192px. ONE opening centered on the left short edge
   (input). TWO smaller openings side by side on the right short edge (two
   cut-half outputs). Roof arrows: two small arrows pointing right/outward
   from the two right openings. Plaque icon: crossed-blades symbol.
3. `rotator.png` — 192x192px. ONE opening on the left edge (input), ONE
   opening on the bottom edge (output, 90° turn). Roof arrow: one arrow
   curving from the input side toward the output side. Plaque icon: pinwheel
   symbol.
4. `painter.png` — 384x192px. ONE opening on the left short edge (shape
   input), ONE small opening on a long side (color input), ONE opening on
   the right short edge, same axis as the shape input (output). Roof arrow:
   one arrow pointing right toward the output. Plaque icon: brush symbol.
5. `stacker.png` — 384x192px. TWO small openings side by side on the left
   short edge (two inputs), ONE wider opening on the right short edge
   (merged output). Roof arrow: one arrow pointing right. Plaque icon:
   paper-stack symbol.
6. `balancer.png` — 384x192px. Openings on BOTH the left and right short
   edges (symmetric multi-lane junction, evenly distributes). Roof arrows:
   small arrows on both sides (bidirectional-looking, since it's a junction,
   not a single-direction building). Plaque icon: fork/merge-arrow symbol.

## Group 3 — Belt sprites (new), save to
`/home/user/projects/shapez-community-edition/assets_wip/origamiz_pilot/ui/`

Static single-frame decorative sprites (NOT a full animation set — just one
representative frame each, for a preview mockup). Match `belt_straight_ref.png`
material exactly: cream/tan folded-paper strip, raised shadowed border walls
along the long edges, small pale chevron arrow marks evenly spaced along the
center. Top-down orthographic. Transparent background outside the belt
strip's own footprint.

7. `belt_straight.png` — 192x192px. A single straight belt tile segment,
   flow direction left-to-right, 2 chevron arrows visible.
8. `belt_corner.png` — 192x192px. The same belt material turning a clean 90°
   corner (flow entering from the left edge, exiting the top edge), 1-2
   chevron arrows following the curve.

Verify every file with PIL after saving (correct size, RGBA, real alpha
variation) before moving on. Do not touch any file not listed above. Report
a final table when done.
