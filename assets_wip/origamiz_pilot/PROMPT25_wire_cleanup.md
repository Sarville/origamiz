# Origamiz wires-layer buildings — retouch pass (not a regeneration)

The 16 files in `staging_wire_v4/` were just approved structurally (two-tier
body, chimney, spool tabs, tab alignment) — do NOT redesign them. This is a
targeted retouch of two specific problems the user found, done in place.

## Fix 1 — stray streak/band artifacts on the flat facets (all 16 files)

Several files (confirmed on `comparator.png`, `display.png`,
`analyzer.png`, `logic_gate.png` — but check every file, don't assume the
others are clean) have a stray soft horizontal or diagonal gradient
band/streak crossing a flat facet, that isn't part of any actual fold —
it reads as a rendering artifact (like a leftover seam or lighting glitch),
not paper. Inspect every one of the 16 files, and wherever a facet that
should be a single clean flat-shaded paper surface (per that facet's own
fold-based lighting — one lit tone per facet, smoothly and evenly, nothing
else) instead has an extra unexplained streak/band cutting across it,
remove it — repaint that facet as clean, evenly toned paper, matching the
lighting of the rest of that same facet. Do not touch facets that are
already clean. Do not change the silhouette, tabs, or symbol placement.

## Fix 2 — 3 symbols must be the EXACT existing icon, not a reinterpretation

The user pointed out that `virtual_processor.png`,
`virtual_processor-rotator.png`, and `virtual_processor-stacker.png` are
each supposed to reuse this project's own already-approved icon for
cutter/rotator/stacker (attached: `ref_cutter_icon.png`,
`ref_rotator_icon.png`, `ref_stacker_icon.png`) — but what got drawn onto
each body's lower panel is a different, invented symbol instead. Fix:

- `virtual_processor.png`: replace the current center symbol with a folded
  paper interpretation that is clearly the SAME scissors/crossed-blades
  design as `ref_cutter_icon.png` (X-crossed blade shapes), not a different
  scissors drawing.
- `virtual_processor-rotator.png`: replace the current center symbol
  (currently a triangle + a "C" with an arrow, which is wrong) with a
  folded paper pinwheel matching `ref_rotator_icon.png` — four angled
  blade shapes radiating from a center point, like a toy pinwheel.
- `virtual_processor-stacker.png`: replace the current center symbol
  (currently a diamond/rhombus stack, which is wrong) with FLAT
  RECTANGULAR folded paper layers matching `ref_stacker_icon.png` — a
  short stack of flat rectangular sheets seen edge-on, not diamonds.

Keep each file's body, tabs, and everything else exactly as it is — only
the center symbol on these 3 files changes, redrawn in the same paper
material/lighting as the rest of that body.

## Fix 3 — connector tabs read as disconnected from the wire, not plugged in

In the final composited scene (building + a bamboo wire tile on every
connected side), the user says the connector and the wire "расходятся" —
they look like two separate things placed near each other, not a joint.
Likely cause: the tab is plain paper color all the way to its tip, so
where it meets a bamboo-green wire there's a hard, unrelated color change
right at the boundary with no visual bridge. Fix: on every tab, on every
one of the 16 files, tint just the outermost ~10-12px of the tab (right at
the canvas edge where it meets the wire) with a subtle bamboo-green cast
blended into the existing paper shading (don't flatten the fold shading,
just shift its hue/tint toward bamboo green at the very tip, fading back
to the paper tone over that short distance) — so the tip visually reads
as "this paper tab plugs into that green bamboo pipe," not two unrelated
materials touching by coincidence. Keep the tab's alpha silhouette and
edge-span exactly as-is, this is a color tint only, not a shape change.

## Output

Overwrite the same 16 files in
`/home/user/projects/shapez-community-edition/assets_wip/origamiz_pilot/staging_wire_v4/`
(all 16 re-saved even if only some needed a facet fixed — but only the 3
listed above get a symbol change). Keep canvas 192x192 RGBA, transparent
background, same tab edge-alignment as before (each tab still centered on
its edge, ~36px wide, reaching exactly to the canvas boundary — do not
shift or resize the tabs while fixing the facets/symbol). Re-run the same
QA as always after saving: report each file's tab edge-spans (should be
unchanged from before) and the near-white-fringe alpha check.
