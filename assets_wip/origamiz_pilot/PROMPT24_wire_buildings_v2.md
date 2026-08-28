# Origamiz wires-layer buildings — retry, strict silhouette fidelity

The previous attempt at this (attached: `staging_wire_v3/logic_gate.png`,
call it `v3_result.png`) went wrong: given a text description of "body +
tabs + symbol", it invented its own simplified silhouette instead of
tracing the ACTUAL structure the reference photo shows. The user compared
`v3_result.png` side-by-side with their own reference photo
(`ref_logic_gate_exact.png`, attached) and said: **"кроме значка & ничего
не похоже"** ("nothing looks alike except the & glyph"). Comparing them
myself: the reference has a TWO-TIER body (a wide lower main body, AND a
narrower raised second box sitting on top of it near the top edge, with
its own small chimney tab above that), and the side tabs are a distinct
"spool/dumbbell" profile (narrower where they meet the body, flaring out
to a wider flat face further out) — `v3_result.png` has neither of these:
just one flat single-tier body and plain straight-sided tabs. This retry
must not repeat that mistake.

## Step 1 — `logic_gate.png`: don't reinterpret it, convert the exact reference

Take `ref_logic_gate_exact.png` AS-IS — same composition, same proportions,
pixel-for-pixel the same design — and turn it into a usable game asset:

- Remove the light warm-gray studio background, replace with a fully
  transparent alpha channel. The background is a soft gradient (not one
  flat color) and the paper itself is near-white, so a naive color-key
  will fail or eat into the paper — treat this as a proper foreground/
  background separation (the object has a crisp, well-lit silhouette;
  everything softly blurred/gradient at the photo's outer edges is
  background, including the soft contact shadow — keep a soft shadow, but
  fade IT to alpha=0 too, don't leave it on an opaque disc).
- Recolor the paper from near-white to warm ivory/cream (`#EDE4CC` in lit
  facets, `#B8A876` in shadowed facets/creases) — same reasoning as before,
  the user flagged that near-white risks disappearing against light game
  backgrounds. Keep every fold, crease, and the two-tier structure exactly
  as photographed — this is a recolor + background removal, NOT a redraw.
- Canvas: crop/scale to exactly 192x192px, RGBA, object centered, the top
  tab's tip reaching y=0, left/right tab tips reaching x=0/192
  respectively — same alignment rule as before: each tab centered on its
  edge (top/bottom tabs centered at x=96, left/right tabs centered at
  y=96), roughly 36px wide at the tile edge, no gap between tab tip and
  canvas border.
- Save as
  `/home/user/projects/shapez-community-edition/assets_wip/origamiz_pilot/staging_wire_v4/logic_gate.png`.

## Step 2 — the other 15: trace the REAL silhouette, don't paraphrase it

For every other file, an original (non-origami) flat game sprite is
attached — `orig_<name>.png` for each. **Trace that sprite's actual
silhouette structure first** (how many tiers does the body have, is there
a raised secondary box, exactly which sides have tabs and roughly how
big), THEN render that traced structure in the exact paper material/
technique you just produced for `logic_gate.png` in Step 1 (warm ivory
folded paper, soft photoreal shadows, visible grain, same tab "spool"
profile). Do not invent a different silhouette than what the attached
flat sprite actually shows. Where the attached flat sprite shows a raised
second tier (most of these do — see each one before assuming there isn't
one), reproduce that second tier. Where it doesn't (e.g. `display` is a
single flat panel), don't invent one.

Every file: canvas 192x192px, RGBA, transparent background, same tab
alignment rule as Step 1 (centered on the tile edge, ~36px wide, reaching
exactly to x=0/192 or y=0/192, no gap). Save all to
`staging_wire_v4/<name>.png` using the filenames below. The functional
symbol on each body (centered, on the LOWER main tier if there's a raised
second tier) stays what it was in the previous attempt — these were
approved, only the surrounding body/tab CONSTRUCTION needs fixing:

- `lever.png` (orig: `orig_lever.png`) — tab: top only. Symbol: round paper
  knob/disc.
- `constant_signal.png` (orig: `orig_constant_signal.png`) — tab: top only.
  Symbol: folded paper pulse/heartbeat zigzag.
- `logic_gate-not.png` (orig: `orig_logic_gate-not.png`) — tabs: top,
  bottom only (no left/right). Symbol: solid folded paper triangle.
- `logic_gate-or.png` (orig: `orig_logic_gate-or.png`) — tabs: top, left,
  right. Symbol: wide rounded folded paper fan/shield (fuller/curvier than
  the AND gate's ampersand).
- `logic_gate-xor.png` (orig: `orig_logic_gate-xor.png`) — tabs: top, left,
  right. Symbol: folded paper disc with a folded X/+ strip across it.
- `transistor.png` (orig: `orig_transistor.png`) — tabs: top, left, bottom
  (no right). Symbol: folded paper triangle wedge on a short post.
- `transistor-mirrored.png` (orig: `orig_transistor-mirrored.png`) — tabs:
  top, right, bottom (mirrored — right instead of left). Same symbol,
  mirrored.
- `comparator.png` (orig: `orig_comparator.png`) — tabs: top, left, right.
  Symbol: two short parallel horizontal folded paper bars ("=").
- `analyzer.png` (orig: `orig_analyzer.png`) — tabs: left, right, bottom
  (no top). Symbol: square card, top-right corner alone folded/peeled back
  revealing a different-shaded underside.
- `display.png` (orig: `orig_display.png`) — tab: bottom only. Symbol:
  blank folded paper rectangle on a small stand.
- `virtual_processor.png` (orig: `orig_virtual_processor.png`) — tabs:
  left, right, bottom (no top). Symbol: folded paper scissors (crossed
  blades) — reuse this project's `cutter` icon concept, attached as
  `ref_cutter_icon.png`.
- `virtual_processor-rotator.png` (orig: `orig_virtual_processor-rotator.png`)
  — tabs: top, bottom. Symbol: folded paper pinwheel/circular arrow, reuse
  `ref_rotator_icon.png`.
- `virtual_processor-unstacker.png` (orig:
  `orig_virtual_processor-unstacker.png`) — tabs: left, right, bottom.
  Symbol: 2-layer folded paper stack with a wedge prying the top layer off.
- `virtual_processor-stacker.png` (orig: `orig_virtual_processor-stacker.png`)
  — tabs: top, bottom, right (no left). Symbol: folded paper layer stack,
  reuse `ref_stacker_icon.png`.
- `virtual_processor-painter.png` (orig: `orig_virtual_processor-painter.png`)
  — tabs: top, bottom, right (no left). Symbol: folded paper paintbrush
  with one small teal droplet at its tip, reuse `ref_painter_icon.png`.

## QA (same standard as every batch this project has done)

After saving all 16 files (`logic_gate.png` from Step 1 + 15 from Step 2),
scan each with PIL: exact 192x192, RGBA. Report, per file, the pixel
column/row where each required tab's opaque content reaches the canvas
edge and how wide it is there (same numeric report style as last time —
that part of the previous attempt worked correctly, keep doing it). Flag
and fix any near-white semi-transparent fringe pixels
(`10 <= alpha <= 240` AND `r>235,g>235,b>235`).
