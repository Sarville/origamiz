# Origamiz — 6 corrected wires-layer symbols (batch 2)

The user reviewed the wires-layer building icons and pointed out several
don't match the REAL game's own symbol for that building anymore — I'd
replaced them with an unrelated abstract concept instead of stylizing the
actual original element. Fix exactly these 6, matching the ORIGINAL
game's real building sprite as closely as possible in concept (not
copying its flat-glyph style — reinterpret the same concept as an origami
paper-fold, same technique as every other icon in this set).

Save 6 files to
`/home/user/projects/shapez-community-edition/assets_wip/origamiz_pilot/icons/`,
128x128 RGBA, transparent background. **Overwrite** `constant_signal.png`
and `lever.png` (replace their current content). **Create new**
`logic_gate_not.png`, `logic_gate_or.png`, `logic_gate_xor.png`,
`virtual_processor_unstacker.png` (these 4 don't exist yet — the base
`logic_gate.png` already exists and should stay as-is, it now represents
specifically the AND gate).

## Style — must match existing icons exactly (attached as reference)

Attached: `icons/cutter.png`, `icons/analyzer.png`, `icons/comparator.png`,
`icons/logic_gate.png`, `icons/transistor.png`, `icons/display.png` —
already-approved, do not restyle. Same construction as every one of these:
folded flat-paper facets (each facet ONE flat color, no gradients/texture),
warm cream/paper palette only (roughly `#F5EEDD` lightest through `#C9BF A0`
darkest — NOT grey, NOT white), implied light from the top-left so
top/left-facing facets are lightest and bottom/right-facing facets are
progressively darker, crisp hard creases between facets, fully opaque
(alpha=255) with a hard cutoff to alpha=0 outside the shape (no soft/blurred
edge, no near-white fringe — same zero-tolerance QA as always: scan every
file after saving for any pixel with `10 <= alpha <= 240`, fix all found,
report exact counts). Centered, small even padding, bold enough to read at
toolbar size (~40-50px). Canvas exactly 128x128px.

## The 6 symbols — what the ORIGINAL game actually shows (its real
`res_raw/sprites/buildings/*.png`, described here since you can't open
those directly — build the origami equivalent from this description)

1. `constant_signal.png` (OVERWRITE — was a 4-point star, wrong concept):
   original shows a **pulse/heartbeat waveform** — a flat zigzag line (up-
   down-up spike pattern like an EKG trace), rendered as a folded paper
   zigzag ribbon (a single folded strip bent at 4-5 sharp angles forming the
   spike shape), NOT a star.
2. `lever.png` (OVERWRITE — was a tilted handle/flag, wrong concept):
   original shows a **plain circular knob/dial** — a simple folded paper
   disc (a circle built from a few pie-slice facets fanning out from the
   center, like a folded paper coin/button), NOT a handle-on-a-stick.
3. `logic_gate_not.png` (NEW): original shows a **solid triangle** (a NOT
   gate's classic pictograph) — one bold folded paper triangle, 2-3 facets
   for a slight 3D fold crease down its middle, simple and bold.
4. `logic_gate_or.png` (NEW): original shows a **shield/fan curve** — a
   rounded, wide-based converging shape (like a curved shield or an open
   fan pinched at the bottom), distinctly WIDER and more rounded than the
   AND gate's narrower converging-flaps look in `logic_gate.png` (attached)
   — same "two things merging into one" idea, but a fuller/curvier silhouette.
5. `logic_gate_xor.png` (NEW): original shows a **circle with a cross/plus
   through it** — a folded paper disc (reuse the same disc-fold technique as
   the new lever knob) with a folded paper X or + strip laid across it,
   the strip a visibly different fold-tone than the disc so it doesn't
   disappear into it.
6. `virtual_processor_unstacker.png` (NEW): original shows a **triangle
   wedge prying into a stack of two boxes** (splitting the top layer off) —
   reuse `icons/stacker.png`'s stacked-layers construction as the base (a
   short stack of 2 flat folded layers) with a bold triangular wedge shape
   inserted at one side, as if levering the top layer up and off — this
   should read as "reverse of stacking" next to a stacker icon, not a
   generic unrelated shape.

## QA (same standard as every prior batch)

After saving all 6 files, run the PIL alpha scan per file (exact 128x128,
mode RGBA, count `10 <= alpha <= 240` pixels, flag any of those that are
also near-white `r>235 and g>235 and b>235` as the fringe bug from early
sessions) and report counts fixed per file.
