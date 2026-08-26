# Origamiz asset pilot v3 — hut concept + asymmetric I/O + unified icon style

This is a targeted revision, not a full redo. Only touch the files listed
below. `buildings/miner.png`, `buildings/trash.png`, `buildings/balancer.png`,
`ui/toolbar_panel.png`, `ui/paper_background.png` are already approved —
do NOT regenerate them.

Attached references:
- `origami_full.png` — overall material/palette/mood reference.
- `good_hut_balancer.png` — this IS the current `buildings/balancer.png`,
  already approved by the client as the right building language: a small
  wood-post hut with a folded-paper peaked roof, windows on the side(s) that
  receive input, an open door/threshold on the side that sends output. Use
  this exact hut construction language (wood posts, folded paper roof
  panels, roof ridge beam, window vs. door asymmetry) as the base template
  for the new hut buildings below — same family of building, different roof
  ornament and different door/window arrangement per function.
- `crane_figurine.png` — quality bar for volumetric paper folding (soft
  per-facet shading, real thickness, contact shadow). Keep using this level
  of dimensional quality, but keep detail SIMPLE — few large clean facets,
  not an intricate origami model.

## Group 1 — Buildings to REGENERATE (save to
`/home/user/projects/shapez-community-edition/assets_wip/origamiz_pilot/buildings/`,
overwrite these 6 files only)

General rule for every hut building below: the building is a small wood-post
hut with a folded-paper roof, same family as `good_hut_balancer.png`. Its
door/window layout must be ASYMMETRIC and match the building's actual
input/output sides — sides that receive input get a small closed window,
the side(s) that send output get an open door/threshold — so the shape
itself hints at data flow direction, not just a decorative detail. On top of
the roof ridge, mount ONE small volumetric ornament made of the same paper/
wood material that symbolizes the building's function (like a small roof
finial/statue) — this replaces any flat drawn symbol. Strict top-down
orthographic camera. Transparent background, alpha hugs the actual roof/post
silhouette (roof eaves can overhang the tile edges slightly like a real roof,
but the building's plan footprint must fit the given tile size). No standing
paper flag/pennant this time — the door/window asymmetry is now the sole
directional language, don't add both.

1. `hub.png` — 768x768px. REVERT to this exact earlier concept (the second
   attempt drifted into an octagonal starburst/flower shape — do NOT do
   that): a small stepped wooden shrine/pagoda platform viewed top-down —
   simple square/stepped pyramid pagoda roof (NOT star-shaped, NOT a flower,
   just a clean stepped pagoda roof over a square base), plain wood corner
   posts at the four corners only (torii-style), a short entrance stair on
   one side, one small red hanko/inkan seal-stamp mark as the only accent
   color, cream folded-paper roof panels. Simple, calm, clearly a small
   shrine building, not an ornate starburst.
2. `cutter.png` — 384x192px (2 tiles wide). A two-bay wood hut like
   `good_hut_balancer.png`. Input is a single wide opening on the LEFT short
   edge (one open door there). Output is TWO separate smaller openings
   stacked/side-by-side on the RIGHT short edge (two small windows or two
   narrow doors, one per cut half). Roof ornament: two small crossed katana
   blades mounted on the roof ridge as a roof-top ornament (slim steel-grey
   blades, tiny wood hilts), sized like a finial, not sprawling across the
   whole roof.
3. `rotator.png` — 192x192px (1 tile, compact hut). A small single-bay hut,
   same wood-post + paper-roof language, scaled down. One window on the
   input side, one open door on the output side (adjacent side, since a
   rotator turns the flow 90°). Roof ornament: a small three-dimensional
   Japanese paper pinwheel (kazaguruma) mounted upright on the roof peak
   like a finial, with a short curved motion arrow beside it.
4. `painter.png` — 384x192px (2 tiles wide). Two-bay hut. TWO input
   openings: one door on the left short edge (shape input) and one small
   window on a long side (color input). ONE door on the right short edge
   (output), same axis as the shape input. Roof ornament: a small three-
   dimensional calligraphy brush (fude) resting diagonally on the roof ridge
   with one tiny ink-color droplet beside it (droplet in a soft accent
   color, e.g. muted teal — the only non-wood/paper color on this piece).
5. `stacker.png` — 384x192px (2 tiles wide). Two-bay hut. TWO small input
   doors side by side on the LEFT short edge (two incoming shapes), merging
   into ONE wider door on the RIGHT short edge (combined output). Roof
   ornament: a small three-dimensional stack of 3 offset folded paper
   squares/plates sitting on the roof ridge like a finial, real gaps/
   thickness between layers.
6. `underground_belt_entry.png` — 192x192px. NOT a hut — a small paired
   composition of two torii gates in forced perspective, evoking a row of
   shrine gates receding into the ground (like Fushimi Inari). The gate
   CLOSEST to the viewer / nearest the tile's input edge is LARGE (the wide
   mouth items enter through), a SECOND, smaller torii gate sits just behind
   it, partially nested, implying the passage narrows into the tunnel. Red-
   orange lacquer torii color, real 3D post/beam thickness. Small arrow at
   the base pointing into the gate.

## Also regenerate its paired twin:

7. `underground_belt_exit.png` — 192x192px. Same two-torii-gate motif and
   red-orange color as item 6, but MIRRORED emphasis: the gate closest to
   the viewer / nearest the output edge is the SMALL one (items emerge
   through this narrower gate), with the LARGER torii gate behind/receding
   away from it. Small arrow at the base pointing out of the gate. Keep it
   visually paired with item 6 (same style/palette), just swap which gate is
   large vs small.

## Group 2 — Toolbar icons, ALL 8 files, REGENERATE ALL, 128x128px, save to
`/home/user/projects/shapez-community-edition/assets_wip/origamiz_pilot/icons/`
(overwrite all 8)

Problem with the previous batch: every icon used a different material/style
(a wood crate, flat steel blades, a photoreal basket, a wood-and-paper hut) —
inconsistent as a set. Fix: ALL 8 icons must now share ONE unified simple
material and style, regardless of what the matching building looks like:

- Material: a single uniform ivory/bone-white paper (~#f2ecd8 class), no
  wood tones, no steel, no basket-weave realism — just this one paper color
  throughout every icon.
- Form: a simple, low-detail volumetric paper-fold shape — think of a
  simple stylized origami toy (like a basic paper crane, frog, or star
  fold), NOT a fully detailed realistic origami model. Few large clean
  fold-facets (roughly 3-8 flat planes), soft shading between facets from an
  upper-left light, small contact shadow. Keep it clearly three-dimensional
  but small/low and simple, not tall or ornate.
- Color: stay monochrome ivory paper for all of them, with ONE exception —
  `painter.png` may keep one tiny accent-color ink droplet (soft teal or
  plum), everything else on every icon stays plain ivory.
- No casing, no card background, no ground/scene — just the bare folded
  icon shape, centered, ~15% margin, transparent background.
- Keep the same functional symbol each icon already represents (see list),
  just re-executed in this one unified ivory-paper low-poly-fold style.

8. `miner.png` — simple ivory paper folded lattice/crate silhouette.
9. `cutter.png` — simple ivory paper folded shape suggesting two crossed
   blades (fold the paper into sharp crossing blade-like points, not
   detailed metal).
10. `trash.png` — simple ivory paper folded basket/pouch shape (a simple
    folded open-top vessel, not woven-basket realism).
11. `balancer.png` — simple ivory paper folded fork/merge arrow shape.
12. `rotator.png` — simple ivory paper folded pinwheel shape (basic 4-blade
    pinwheel fold).
13. `underground_belt.png` — simple ivory paper folded gate/arch shape
    (a basic torii-like arch fold, no red color here, ivory only).
14. `painter.png` — simple ivory paper folded brush shape with one small
    accent-color ink droplet beside it (the one allowed exception).
15. `stacker.png` — simple ivory paper folded stack of 2-3 offset squares.

Work through the full list (7 buildings + 8 icons = 15 files), verify each
with PIL after saving (correct size, RGBA, real alpha variation), then report
a final table. Do not touch any file not listed above.
