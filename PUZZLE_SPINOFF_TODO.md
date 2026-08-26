# TODO — Puzzle mode as a standalone spin-off game

Separate initiative from the main Yandex Games port (see `TODO.md`). Goal: take
`puzzleEdit`/`puzzlePlay` game modes, strip everything else, ship as its own
small game — same rebranded art/setting as the main port, separate listing.

Confirmed 2026-08-25 (see `TODO.md` Chunk 5): puzzle create + local playtest
already works with zero network dependency, no engine work needed there —
this file is about (a) sourcing levels and (b) cutting the standalone build.

## Level content: no free/open puzzle packs exist

Searched 2026-08-25 — official shapez.io puzzle catalog lives only on the live
`api.shapez.io` server (not in any git repo), and no CC0/public-domain puzzle
pack exists anywhere online. Only real option: **author levels by hand** in
the built-in editor. Not actually slow — local playtest is instant, no
network round-trip per iteration.

## Level progression plan (first pass, ~15 levels)

Mirrors the order the main game teaches these buildings in `levels.js`, scaled
down to small puzzle grids. Each tier assumes only the buildings introduced so
far are left enabled (`excludedBuildings` in the puzzle format) — don't let
players skip ahead with tools from a later tier.

**Tier 1 — Cutting & routing (teach the grid, no color yet)**
- L1: one cutter, trash the half you don't need — pure "does cutting work" intro.
- L2: cutter + rotator — reorient a cut half to match the target.
- L3: cutter + balancer — split one input into two parallel lines.

**Tier 2 — Color**
- L4: painter — single-color fill.
- L5: mixer — combine two colors into a third.
- L6: merger — recombine two separate belt lines into one output.

**Tier 3 — Stacking & finer geometry**
- L7: stacker — layer two shapes into one.
- L8: quad cutter — quarters instead of halves.
- L9: double painter — two colors on two quadrants in one pass.

**Tier 4 — Tight-space combinatorics**
- L10: compact splitter — precise routing where space is the constraint, not
  the mechanic.
- L11: forced belt crossings — tunnel is mandatory, not optional.
- L12: everything so far in one puzzle (cut → rotate → paint → merge) on a
  small grid — first real "capstone" level.

**Tier 5 — Wires/logic (optional expert tier, ship later if at all)**
- L13: constant signal + filter — first logic-gated routing.
- L14: logic gates — boolean-driven puzzle.
- L15: virtual processing — hardest, full signal-driven factory.

Tier 5 pulls in the wires system, which is a much bigger mental jump — treat
it as a stretch goal, not a launch requirement. 12 levels (tiers 1–4) is a
reasonable v1 scope.

## Engineering: cutting the standalone build

- [ ] Force the offline-login path (`src/js/states/login.js`) as the only
      path — no login UI at all, this build never talks to `api.shapez.io`.
- [ ] Hide/remove the online catalog tabs and submit-dialog "ok" in
      `puzzle_menu.js` / `puzzle_editor_review.js` (per `TODO.md` Chunk 5).
- [ ] Bundle the hand-authored levels as local JSON (format: see
      `src/js/savegame/puzzle_serializer.js` — building list + zone bounds +
      goal shapes, no server ID needed) and add a simple local level-select
      list replacing the removed catalog browsing UI.
- [ ] Strip `RegularGameMode`/hub/freeplay code paths from this build's entry
      point — puzzle-only build shouldn't ship the whole main-game bundle.
- [ ] Reuses whatever rebranded building sprites/theme come out of the main
      port's Chunk 1 asset work — no separate art pass needed, confirm once
      that's further along.
- [ ] Decide packaging: new `gulp/build_variants.js` variant, or a fully
      separate minimal entry bundle — pick once Chunk 3 (main port's build
      system work) is done, so the two don't duplicate build config.

## Open questions

- Ship as free-standing web game, or also a Yandex Games listing alongside
  the main port? Not decided.
- Level count for v1 — 12 (tiers 1–4) proposed above, not confirmed with user.
