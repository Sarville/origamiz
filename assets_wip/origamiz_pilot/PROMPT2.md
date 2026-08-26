# Origamiz asset pilot v2 — volumetric redo, 20 PNGs

The first attempt failed: it produced flat rounded-rectangle "cards" with a
drawn-on symbol. That is WRONG. Study the attached reference crops closely —
they show the actual target language, which is genuinely three-dimensional
folded-paper objects (like real origami models sitting on a table), not flat
icons:

- `origami_full.png` — full reference scene (materials/palette/mood only).
- `cutter_rotator_boxes.png` — crop showing the cutter and three rotator
  buildings: each is a small folded-paper BOX with real volume — a rounded
  base, a softly peaked/pouched top (like a paper dumpling or masu box fold),
  visible fold-crease shading (each facet is a slightly different shade, not
  one flat fill), and a real drop shadow. This is the target silhouette
  language for box-shaped machines. NOT a flat rectangle with straight sharp
  edges.
- `balancer_triangles.png` — crop showing paired dark-blue-grey folded
  paper "hood"/hat shapes (like a folded paper boat or witch-hat fold),
  angular and pointed, clearly 3D with strong directional shading.
- `painter_flag.png` — crop showing a painter station: a folded paper box
  with a small folded paper PENNANT/FLAG standing straight up out of the
  surface near one corner, casting its own separate shadow onto the box below
  it. This is the correct way to mark a directional input/output side — a
  standing 3D flap, never a flat drawn diagonal cut or a flat "dog-ear"
  drawn on the surface.
- `crane_figurine.png` — an origami crane prop. This is the quality bar for
  "volume": every folded facet catches light differently (upper-left key
  light), creases read as real geometry with soft shadow, the whole object
  has genuine thickness and sits on the ground with a soft contact shadow.
  EVERY building sprite in this batch must read with this same quality of
  dimensional paper-folding, just simpler/blockier shapes.
- `toolbar_bar.png` — crop of the actual toolbar. Two critical things to
  copy exactly: (1) the bar itself is a PLAIN smooth flat honey-wood color,
  rounded corners, only a very faint horizontal grain and a thin darker wood
  trim edge top and bottom — absolutely NO repeating vertical seams, planks,
  or bamboo-segment stripes, it must read as one smooth continuous wood
  surface, not a striped pattern. (2) the icons sitting on it are small,
  genuinely three-dimensional PROP OBJECTS (a real little 3D wrench, real 3D
  scissors, a real 3D stack of layered plates, a real 3D pinwheel-like
  gem) resting directly on the bar with their own small contact shadow — they
  are NOT flat cutout glyphs and are NOT sitting inside little card/tile
  backgrounds.
- `plain_bg.png` — crop of the empty play-field background. It is very
  close to a single flat warm off-white/cream tone with only an extremely
  subtle, barely-visible mottled paper grain — do not make it visibly
  fibrous or patterned, keep it almost flat and light.

Use your image-generation tool. Save each result to the EXACT absolute path
given, at the EXACT pixel size given, as a PNG with a real alpha channel
(transparent outside the object's own irregular folded silhouette — do NOT
add a rounded-rectangle or any other card/casing shape behind the object,
the alpha shape should hug the actual paper-fold geometry). After saving,
verify with Python/PIL (correct size, mode RGBA, alpha channel actually
varies / is not just fully-opaque-everywhere for items that need
transparency) before moving on; regenerate if wrong. Work through the full
list without stopping to ask for confirmation, then report a final table.

## Group 1 — Buildings, 10 files, save under
`/home/user/projects/shapez-community-edition/assets_wip/origamiz_pilot/buildings/`
(overwrite the existing files there)

Shared rules: strict top-down orthographic camera (zero perspective/tilt).
Object should occupy roughly its full tile footprint (like a piece sitting in
its grid slot) but its outer silhouette must follow the actual folded-paper
shape, not a clean rounded rectangle. Warm cream/tan paper as the primary
material (~#f3ead9 body tone), light wood accents (~#8b6b4a) where a
building is described as having wood parts, soft per-facet shading from an
upper-left key light, one soft contact drop shadow beneath the whole object.
On items marked "FLAG: yes", add a small standing folded paper pennant near
the bottom-right area as the directional output marker, exactly like
`painter_flag.png` — a real upright 3D flap with its own shadow, not a flat
mark.

1. `hub.png` — 768x768px. FLAG: no. A small wooden shrine/pagoda platform,
   same concept as before (stepped wood dais, torii-style corner posts,
   cream folded-paper roof panels, one small red hanko seal-stamp accent) —
   this concept worked well, keep it, but render the roof panels and wood
   posts with real dimensional fold-shading like the crane reference, not
   flat fills.
2. `miner.png` — 192x192px. FLAG: no. An open wooden lattice/slatted crate —
   a small square frame built from crossed wooden slats (like a bamboo cage
   or crate rim) around the edges, open in the middle, with a small colorful
   faceted resource chunk (a generic warm-amber low-poly gem shape, not any
   specific game icon) sitting visibly inside the frame, slight shadow
   pooling around its base inside the crate.
3. `cutter.png` — 384x192px. FLAG: yes. A folded-paper box exactly in the
   volumetric style of `cutter_rotator_boxes.png`, with two crossed katana
   blades resting on top of it (slim steel-grey blades, small wood-brown
   hilts) instead of the scissors.
4. `trash.png` — 192x192px. FLAG: no. A genuinely three-dimensional woven
   bamboo basket — visible rim thickness, basket-weave relief on the curved
   walls, soft interior shadow, sitting on the tile with a contact shadow.
   Not a flat icon — an actual small basket volume.
5. `balancer.png` — 384x192px. FLAG: yes. Reinterpret as a small wooden
   building WITH A ROOF — a tiny peaked-roof hut/shrine structure (folded
   paper roof panels, wood support posts, small open threshold/doorway at
   the base implying the split/merge junction), real roof-ridge fold-shadow.
6. `rotator.png` — 192x192px. FLAG: no. A real three-dimensional Japanese
   paper pinwheel toy (kazaguruma) on a short stick — four individually
   folded/shaded pinwheel blades around a center pin, mounted upright on a
   small round wood base disc, short curved motion arrow beside it, soft
   shadow.
7. `underground_belt_entry.png` — 192x192px. FLAG: yes. A real small
   three-dimensional torii gate structure (two upright wood posts + a top
   crossbeam with real thickness/depth, red-orange lacquer paint), with a
   short arrow at its base pointing INTO the gate.
8. `underground_belt_exit.png` — 192x192px. FLAG: yes. Same 3D torii gate
   as item 7, arrow pointing OUT instead.
9. `painter.png` — 384x192px. FLAG: yes. A folded-paper box like
   `painter_flag.png`'s box, with a small real 3D calligraphy brush (fude)
   resting diagonally across the top and a tiny ink-color droplet/dish
   beside it (droplet in a soft accent color, e.g. muted teal or plum).
10. `stacker.png` — 384x192px. FLAG: yes. A genuinely three-dimensional
    stack of 3 offset folded paper squares/plates with real visible edge
    thickness and a shadow gap between each layer — like the toolbar's
    "layers" prop in `toolbar_bar.png`, just built as the whole building
    object here.

## Group 2 — Toolbar icons, 8 files, 128x128px, save under
`/home/user/projects/shapez-community-edition/assets_wip/origamiz_pilot/icons/`
(overwrite existing files)

These are small standalone 3D prop figurines exactly like the objects sitting
on `toolbar_bar.png` — NOT flat cutout glyphs, NOT a casing/card background,
just the little three-dimensional prop itself with its own soft contact
shadow, centered, transparent background, ~15% margin, same warm paper/wood
material and per-facet shading as the buildings.

11. `miner.png` — a small 3D wooden lattice crate with the same resource
    chunk inside, as building item 2, simplified for small size.
12. `cutter.png` — a small 3D pair of crossed katana blades (no box behind
    them, just the blades themselves as the prop).
13. `trash.png` — a small 3D woven bamboo basket prop.
14. `balancer.png` — a tiny 3D peaked-roof hut/shrine prop, as building
    item 5, simplified.
15. `rotator.png` — a small 3D paper pinwheel toy prop, as building item 6.
16. `underground_belt.png` — a small 3D torii gate prop (generic, no arrow
    needed), as building items 7/8.
17. `painter.png` — a small 3D calligraphy brush prop with its ink droplet.
18. `stacker.png` — a small 3D stack of 3 offset paper-square plates, exactly
    like the "layers" prop visible in `toolbar_bar.png`.

## Group 3 — UI backdrops, save under
`/home/user/projects/shapez-community-edition/assets_wip/origamiz_pilot/ui/`
(overwrite existing files)

19. `toolbar_panel.png` — 1536x320px. A plain smooth flat honey light-wood
    rounded bar, matching `toolbar_bar.png` exactly: only a very faint
    horizontal wood grain, a thin darker wood trim edge along the top and
    bottom border, soft drop shadow beneath the whole bar. Absolutely NO
    repeating vertical seams/planks/stripes — must read as one smooth
    continuous surface. Fully transparent background outside the rounded bar
    shape, no icons/text/props drawn on it, empty panel only.
20. `paper_background.png` — 1024x1024px, seamless tileable. Matching
    `plain_bg.png` almost exactly: a warm cream/off-white flat tone with only
    an extremely subtle, barely-visible mottled paper grain — nearly flat,
    do not add visible fiber lines, strong texture, or a repeating pattern
    that would read as "texture" at a glance. Tileable edge-to-edge with no
    visible seam.

Do all 20, verify each, then report the final size/transparency table.
