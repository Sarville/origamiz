# New plaque icons — 17 origami-fold symbols, matching the approved icon set exactly

This is the SAME icon style already approved and in production use (see the
8 attached reference images, attached in this exact order: balancer,
cutter, rotator, stacker, painter, miner, trash, underground_belt — these
are the exact current `icons/*.png` files, attached so you can match them
pixel-for-pixel in material/lighting/finish). This round only adds MORE
icons in that same style for buildings that don't have one yet — it is not
a redesign, do not change the style, just extend it to new symbols.

## Style (observed directly from the attached references — match exactly)

- A single folded-paper (origami) object, made of flat angular facets —
  every facet is a flat polygon with its own single flat shade, no
  gradients within a facet, no texture/grain.
- Material: warm off-white/cream card stock (base tone ~`#EDE6D3`-class),
  each facet a slightly different flat shade of that same cream depending
  on its implied fold angle relative to a top-left light source (lighter
  facets facing up/left, darker facets facing down/right) — same "paper
  fold" shading logic throughout, no other colors except a small, sparing
  functional accent (e.g. the single teal ink-drop on the painter brush) —
  most icons use ONLY the cream monochrome fold palette, add a color accent
  only where a symbol specifically needs one to read correctly (marked
  below).
- Silhouette: the object is built entirely from straight creased paper
  edges (angular facets, sharp folds) — no smooth curves, no rounded
  corners, in the same voice as a real paper-folding craft object.
- Soft, subtle ambient-occlusion-style shading at fold seams only — no
  drop shadow beneath the object, no background element, no ground plane.
- Background: fully transparent (alpha channel), object centered, small
  even padding, square canvas exactly 128x128px per icon.
- Composition is a clean 3/4-top-down-ish "product shot" angle (same as
  the references) — not flat-2D-orthographic like the building platforms,
  the icon itself has a little dimensional fold-depth to it.

## New icons to generate (17 files, save all to `icons/` in this directory)

Each entry: filename, the building function it represents (for meaning
only, don't add text/labels to the image), and a concrete fold-shape
suggestion — treat the suggestion as a starting point, prioritize looking
like a real coherent origami object over literally matching every word.

1. `analyzer.png` — reads the top-right quadrant of a shape and reports its
   properties as a signal. Fold idea: a folded paper shape divided into
   four triangular quadrants pinwheel-style (like the balancer arrow but
   as a flat quad-fan), with the top-right quadrant folded slightly
   raised/forward from the other three to show it's the one being "read".
2. `comparator.png` — outputs true only if two signals are exactly equal.
   Fold idea: two flat folded paper bars/tabs of equal length held
   perfectly level side by side, meeting at a shared center fold (an
   origami "balance/equals" glyph) — needs to read as "equals", not
   "scale".
3. `display.png` — a screen showing whatever signal it's fed. Fold idea: a
   folded paper rectangle standing on a small folded triangular stand/
   easel (like a tiny origami picture frame or screen), with ONE small
   flat colored diamond/rhombus accent centered on the "screen" face (this
   icon needs one small color accent, any calm mid-tone works, to read as
   "something is being displayed").
4. `reader.png` — measures belt throughput. Fold idea: a small folded
   paper gauge/dial shape — a fan of folded triangular "ticks" around a
   pivot with one longer folded tab as the needle, pointing to one side.
5. `item_producer.png` — sandbox/debug tool that spawns items directly
   from a signal. Fold idea: a small folded paper box/portal shape with a
   smaller folded shape emerging/popping up out of its open top — should
   read as "something appearing from a source", debug/sandbox flavored
   (e.g. a subtly dashed/perforated fold-line on the box to hint
   "debug-only", still monochrome cream, no color accent needed).
6. `constant_producer.png` — always outputs one fixed, specified shape.
   Fold idea: a folded paper stamp/seal shape — a solid faceted block with
   a distinct flat emblem shape pressed into its top face (like a signet
   stamp), conveys "always the same fixed output".
7. `constant_signal.png` — emits one fixed, unchanging signal onto the
   wires layer. Fold idea: a folded paper antenna/beacon — a small upright
   folded spike with 2-3 flat folded "ripple" fins radiating from partway
   up it (broadcast motif), monochrome cream, no accent color.
8. `lever.png` — a manual on/off switch the player toggles. Fold idea: a
   folded paper handle/toggle tab mounted on a small folded base block,
   tilted to one side like a real physical lever mid-throw (this is the
   single most important cue: it must look like a switch caught in a
   tilted "on" position, not a flat resting shape).
9. `goal_acceptor.png` — the delivery target for a level's current goal.
   Fold idea: a small folded paper pennant/flag on a short folded pole,
   OR a folded paper target/checkpoint marker shape — either way it must
   read as "the finish/goal marker", distinct silhouette from all other
   icons in the set.
10. `mixer.png` — mixes two incoming colors together (additive blend).
    Fold idea: a folded paper spiral/twist — two ribbon-like folded paper
    strips twisting around each other into one merged spiral form (a
    "blend" motif, distinct from the sharp 4-point pinwheel already used
    for `balancer.png`/analyzer — this one should read as smoother
    twisting/merging, not a crisp pinwheel star).
11. `filter.png` — routes items matching a signal condition to one output,
    the rest to another. Fold idea: a folded paper funnel/cone shape with
    a visible split at the narrow end (two small folded exit chutes
    branching from the funnel's tip instead of one), conveys "one thing
    in, sorted into two paths out".
12. `storage.png` — stores excess items up to a capacity limit (buffer).
    Fold idea: a folded paper box/crate with a hinged lid flap folded
    open, similar family to `trash.png`'s open-top container but visually
    distinct — make this one look more like a closed/sturdy storage crate
    (e.g. a flatter, more rectangular box with a proper flap) rather than
    trash's angular open hexagonal bin, so the two don't read as the same
    object.
13. `logic_gate.png` — a logic AND gate (outputs true only if both inputs
    are true). Fold idea: the classic flat-back-D-shaped AND-gate
    silhouette, built as a folded paper block with that D outline (flat
    back edge, rounded-by-facets front edge approximated with angled
    paper creases instead of a smooth curve, since this style never uses
    smooth curves — approximate the curve with 3-4 flat angled facets).
14. `logic_gate_not.png` — a logic NOT gate (inverts a boolean). Fold idea:
    a folded paper triangle (flat back edge, pointed front tip, same
    faceted-paper NOT-gate silhouette as classic electronics symbols) with
    a small separate folded paper ball/bead sitting right at the pointed
    tip (the standard NOT-gate "inversion bubble", made of paper too).
15. `logic_gate_or.png` — a logic OR gate (true if at least one input is
    true). Fold idea: same family as `logic_gate.png` but with a
    concave-curved (again, faceted/angled, not smooth) back edge instead
    of a flat one, and a more pointed front tip — the classic OR-gate
    silhouette, reproduced in folded-paper facets.
16. `logic_gate_xor.png` — a logic XOR gate (true if exactly one input is
    true, not both). Fold idea: exactly `logic_gate_or.png`'s shape, PLUS
    one extra separate thin folded paper sliver/fin just in front of the
    back edge, detached with a small gap (the classic XOR "double back
    line", as a small separate paper fold rather than a 2D line).
17. `transistor.png` — forwards an item only while a side signal is true
    (a gate). Fold idea: a folded paper valve/gate-arm shape — a small
    upright folded paper barrier arm mid-lift over a flat folded paper
    channel/lane base (like a level-crossing gate arm caught half-open),
    conveys "a gate that opens/closes a path".

## Verification (do this yourself with PIL before finishing, report a table)

For every one of the 17 files: confirm exactly 128x128px, RGBA mode, real
alpha variation (not fully opaque square, not fully transparent), and that
the visible pixels are cream/monochrome-fold-toned except where an accent
color was explicitly requested above (`display.png` only). Confirm no
background shape, no drop shadow blob, no text/watermark baked in. Save
directly into
`/home/user/projects/shapez-community-edition/assets_wip/origamiz_pilot/icons/`
using exactly the 17 filenames listed above — do not overwrite any of the 8
existing reference files in that folder.
