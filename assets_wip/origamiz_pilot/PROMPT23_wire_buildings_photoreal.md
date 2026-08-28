# Origamiz wires-layer buildings — photoreal paper-sculpture pass

The user already ran a version of this exact task once, on ONE building
(`logic_gate` — the AND gate), and approved the result. Attached as
`ref_style.png` — MATCH THIS EXACT rendering technique for all 16 files
below: a physical white/ivory paper-sculpture product photograph, soft
studio lighting from the upper-left, gentle ambient-occlusion shadows in
every crease and between overlapping folded layers, visible paper grain/
fiber texture, subtly rounded (not razor-sharp) fold edges, a soft
contact shadow under the whole object. This is a MUCH more elaborate
render than a flat vector icon — every fold should look like it could be
physically real paper, photographed.

Also attached, `ref_flat.png` — the ORIGINAL (non-origami) game sprite for
`logic_gate`, showing the reference composition this whole family is based
on: a rounded body with small rectangular tabs poking out toward every
side that has a wire connection, and a centered functional symbol. Every
file below follows this same "body + tabs + centered symbol" composition,
just with a different tab layout and different symbol per file (all
described below), executed in the photoreal paper style of `ref_style.png`.

## Critical technical constraints (read before generating)

- **Canvas: exactly 192x192px, RGBA, transparent background** (no gray
  studio backdrop like the reference — keep the soft contact shadow, but
  it must fade to alpha=0, not sit on a solid background color, since this
  gets composited into a game over other art).
- **Paper color: warm ivory/cream, NOT stark white or light gray.** The
  reference's near-white paper risks disappearing against light game
  backgrounds — the user explicitly flagged this. Use a warm cream base
  (roughly `#EDE4CC` in the lit facets) with visibly darker warm-tan
  shadowed facets/creases (roughly `#B8A876` in shadow) — same paper
  family as the rest of this game's origami art, just rendered with this
  much more detailed photoreal folded technique instead of flat color.
- **Tabs are the wire connectors and MUST be geometrically precise** — this
  is the one part of this task that isn't purely aesthetic:
  - Each tab must be centered on the tile's own center-line: a top or
    bottom tab centered at x=96 (horizontally centered on the 192px
    canvas), a left or right tab centered at y=96 (vertically centered).
  - Each tab must reach all the way to the canvas edge (x=0/192 or
    y=0/192) — no gap between the tab's tip and the canvas border, it
    needs to butt up against an adjacent piece exactly at the edge.
  - Each tab should be roughly 36px wide at the point where it meets the
    canvas edge (a bit narrower is fine, do NOT make it much wider —
    it needs to look proportional next to a ~24px wire it plugs into).
  - The main body (not counting tabs) should be roughly 130-140px across,
    centered in the canvas, leaving room for the tabs to visibly poke out
    on their side(s).
- Save all 16 files to
  `/home/user/projects/shapez-community-edition/assets_wip/origamiz_pilot/staging_wire_v3/`
  using the exact filenames given below (each ends `.png`).

## The 16 files — tab sides + symbol (from the real game's own logic)

1. `lever.png` — tab: **top only**. Symbol: a round paper knob/disc (a
   simple folded circular button), centered.
2. `constant_signal.png` — tab: **top only**. Symbol: a folded paper
   pulse/heartbeat zigzag (EKG-style spike line).
3. `logic_gate.png` — tabs: **top, left, right**. Symbol: a bold folded
   paper "&" (ampersand) — this is exactly `ref_style.png`, reproduce it
   at the specified canvas size/tab spec (its own tabs in the reference are
   close to spec already — verify/adjust to match the precise tab rule
   above).
4. `logic_gate-not.png` — tabs: **top, bottom** (note: NO left/right tabs
   for this one). Symbol: a solid folded paper triangle.
5. `logic_gate-or.png` — tabs: **top, left, right**. Symbol: a wide rounded
   folded paper fan/shield shape (fuller and curvier than the AND gate's
   ampersand — a distinct silhouette, not another glyph).
6. `logic_gate-xor.png` — tabs: **top, left, right**. Symbol: a folded
   paper disc with a folded paper X or + strip laid across it in a
   visibly different fold-tone.
7. `transistor.png` — tabs: **top, left, bottom** (no right tab). Symbol:
   a folded paper triangle wedge mounted on a short paper post/stem (a
   valve/transistor pictograph).
8. `transistor-mirrored.png` — tabs: **top, right, bottom** (mirrored —
   note this is right instead of left, everything else the same as
   `transistor.png` including the symbol, just mirrored left-right).
9. `comparator.png` — tabs: **top, left, right**. Symbol: two short,
   parallel, horizontal folded paper bars stacked with a gap (an origami
   "=" sign).
10. `analyzer.png` — tabs: **left, right, bottom** (no top tab). Symbol: a
    square paper card with its top-right corner alone folded/peeled back,
    revealing a differently-shaded paper underside at just that one corner.
11. `display.png` — tab: **bottom only**. Symbol: a blank folded paper
    rectangle standing upright on a small folded paper stand/easel (a
    screen).
12. `virtual_processor.png` — tabs: **left, right, bottom** (no top).
    Symbol: folded paper scissors (crossed blades) — reuse the exact
    scissors concept from this project's `cutter` building, since this
    virtual-processor variant represents the same "cutter" function.
13. `virtual_processor-rotator.png` — tabs: **top, bottom**. Symbol: a
    folded paper pinwheel / circular motion arrow (same concept as this
    project's `rotator` building).
14. `virtual_processor-unstacker.png` — tabs: **left, right, bottom**.
    Symbol: a short stack of 2 folded paper layers with a bold triangular
    wedge prying/splitting the top layer off to one side.
15. `virtual_processor-stacker.png` — tabs: **top, bottom, right** (no
    left). Symbol: a short stack of folded paper layers (same concept as
    this project's `stacker` building).
16. `virtual_processor-painter.png` — tabs: **top, bottom, right** (no
    left). Symbol: a folded paper paintbrush with a single small colored
    (teal) droplet at its tip (same concept as this project's `painter`
    building).

## QA

After saving all 16 files, verify with PIL: exact 192x192, RGBA, alpha
fully transparent (0) outside the object with no stray near-white
semi-transparent fringe pixels (same standard as every icon batch this
project has done — scan for `10 <= alpha <= 240` pixels that are also
`r>235 and g>235 and b>235`, fix any found). Additionally, for each file,
report the actual pixel row/column where each tab's opaque content first
reaches the canvas edge, and how wide it is there, so the tab-alignment
spec above can be double-checked numerically, not just visually.
