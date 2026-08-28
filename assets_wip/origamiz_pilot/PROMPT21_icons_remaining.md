# Origamiz — remaining plaque/toolbar icons (batch 1 of N)

Save 19 new files to
`/home/user/projects/shapez-community-edition/assets_wip/origamiz_pilot/icons/`,
128x128 RGBA, fully transparent background outside the folded-paper shape.
Do not touch any existing file in that folder.

## Style — must match the 8 already-approved icons EXACTLY

Attached reference images (already-approved, DO NOT restyle, match their
construction technique precisely): `icons/cutter.png`, `icons/balancer.png`,
`icons/miner.png`, `icons/underground_belt.png`, `icons/trash.png`,
`icons/rotator.png`, `icons/stacker.png`, `icons/painter.png`.

These are small ORIGAMI PAPER SCULPTURES, not flat vector glyphs:
- Folded flat-paper facets, each facet a single flat fill color (no
  gradients, no texture) — the folded-polygon geometry itself is what reads
  as light/shadow, same convention as everywhere else in this project: an
  implied light source from the top-left, so top/left-facing facets get the
  lightest cream tone and bottom/right-facing facets get progressively
  darker cream/tan tones. 3-5 facet tones is normal (see `stacker.png`,
  `rotator.png`).
- One consistent cream/paper color family across all facets (roughly
  `#F5EEDD` lightest through `#C9BFA0` darkest) — this is warm off-white
  paper, NOT grey, NOT white. Do not introduce a new base hue.
- A single accent color is allowed ONLY when the building's function is
  literally about color/signal (see `painter.png`'s one teal droplet) —
  every icon in this batch is form/logic-only, so stay monochrome cream,
  no accent color for any of the 19 below.
- Crisp hard edges between facets (real fold creases), fully opaque
  (alpha=255) across the whole shape, then hard cutoff to alpha=0 outside
  it — no soft/blurred edge, no partial-alpha halo, no near-white fringe
  (same zero-tolerance QA every prior batch used: after saving each file,
  scan with PIL for any pixel with alpha strictly between 10 and 240, and
  fix every one found before finishing).
- Composition: centered, small even padding, object reads clearly at
  toolbar size (roughly 40-50px on screen) as well as it does at 128px — so
  keep the silhouette bold and simple, this is an abstract emblem of the
  function, not a literal illustration.
- Canvas exactly 128x128px, RGBA, transparent background.

## The 19 icons — one clear metaphor each, folded from paper facets

Each of these is used BOTH as a small toolbar icon and as the centered
plaque symbol embedded on top of a building's platform (see
`build_batch.py`'s `apply_plaque`) — so it must read as a self-contained
emblem, no building casing/frame around it (that's drawn separately).

1. `analyzer.png` — a square sheet of paper with its TOP-RIGHT corner alone
   folded/peeled back and forward, revealing a differently-shaded paper
   underside at that one corner only (the other three corners stay flat) —
   direct visual pun for "reads only the top-right quadrant."
2. `belt.png` — a single folded paper ribbon/strip curved into a shallow
   flowing S or loop, suggesting continuous conveyance (no wheels/rollers,
   pure folded-paper ribbon).
3. `block.png` — the plainest possible folded paper cube/box, flat-topped,
   deliberately the simplest silhouette in the whole set (a solid blocker,
   nothing decorative).
4. `comparator.png` — two identical short folded paper bars stacked one
   above the other with a clear gap between them, both bars perfectly
   parallel and the same length/tone-pattern — an origami rendition of an
   "=" (equals) glyph.
5. `constant_producer.png` — a small folded paper box with a fixed paper
   shape emerging/fused from its open top, like a stamp permanently
   pressed into the box — reads as "always outputs this one fixed thing."
6. `constant_signal.png` — a simple folded 4-pointed paper star/emblem,
   static and self-contained (a fixed beacon, not a moving part).
7. `display.png` — a folded paper rectangle standing upright on a small
   folded stand/easel, like a simple paper screen or picture frame propped
   up to face the viewer.
8. `filter.png` — a folded paper funnel/chute that splits cleanly into TWO
   separate spouts at the bottom, one wider than the other, with 2-3 small
   triangular perforations near the funnel's mouth suggesting a sieve/mesh.
9. `goal_acceptor.png` — a small folded paper flag on a short folded pole,
   flag angled as if planted at a destination.
10. `item_producer.png` — a small folded paper box with a single loose
    folded paper shape (a simple diamond/rhombus) floating just above its
    open top, mid-spawn — same "box" language as constant_producer but
    with the shape visibly separate/floating rather than fused in, to read
    as ad-hoc/debug spawning rather than a fixed constant.
11. `lever.png` — a short folded paper handle/lever tilted to one side atop
    a small folded paper base/fulcrum, like a tiny standing switch.
12. `logic_gate.png` — two folded paper flaps rising from a shared base and
    meeting/converging at a single peak in the middle (a simple gate-arch
    shape) — this is the ONE shared icon for all AND/OR/XOR/NOT variants,
    keep it generic/abstract, not specific to any single boolean operation.
13. `mixer.png` — two folded paper ribbons spiraling around each other and
    merging into one at the center, pinwheel-like but with exactly two
    interleaved ribbons (distinct from rotator's 4-armed pinwheel).
14. `reader.png` — a small folded paper dial/gauge: a rounded folded base
    with one short folded paper needle/pointer standing up off-center, like
    a tiny origami meter.
15. `storage.png` — a folded paper chest/box with a lid flap folded open and
    standing up at an angle (distinct from block's flat-closed cube and
    from stacker's flat stacked-layers — this one reads as an open
    container with capacity).
16. `transistor.png` — a folded paper flap/valve hinged open at roughly
    45°, attached to a small folded paper frame/doorway — reads as a gate
    that can swing open or stay shut. (This single icon also covers the
    mirrored variant — mirroring happens at composite time, don't draw two.)
17. `virtual_processor.png` — a folded paper rhombus/diamond rendered as a
    thin HOLLOW outline made of narrow paper strips (open center, you can
    see through the middle to transparent background) rather than a solid
    filled facet shape — the "hollow wireframe" treatment is what
    distinguishes every virtual/wires-layer building from its solid
    physical counterpart elsewhere in this set. Generic shape, not tied to
    one specific sub-operation (this one icon covers cutter/rotator/
    stacker/painter/unstacker "virtual" variants alike).
18. `wire.png` — two short folded paper ribbon ends meeting and fusing
    together at a simple angled splice/joint in the middle (a plug/connector
    pun without drawing a literal plastic plug).
19. `wire_tunnel.png` — two folded paper ribbons crossing each other in a
    clean X, with a small visible gap/step at the exact crossing point
    (one ribbon folds slightly forward, the other slightly back) making
    clear they pass over/under each other without joining.

## QA (same standard as every prior icon batch)

After saving all 19 files, run a PIL scan per file:
- exact size 128x128, mode RGBA
- count pixels with `10 <= alpha <= 240` (partial alpha) — should be a
  thin antialiasing rim only, not a haze; if any of them are near-white
  (`r>235 and g>235 and b>235`) with that partial alpha, that's the fringe
  bug from earlier sessions — fix by extending real fill or clearing to
  alpha=0, don't leave any.
Report the counts fixed per file, not just "looks fine".
