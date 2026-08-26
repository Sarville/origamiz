# Origamiz asset pilot v7 — 2 small targeted fixes

Only 2 files, save to
`/home/user/projects/shapez-community-edition/assets_wip/origamiz_pilot/buildings/`
(overwrite `cutter.png` and `stacker.png` only). Do not touch any other file.
The top-down hub-style camera/frame/roof/arrow work from the last round is
correct and approved — keep it exactly as-is, these are icon/opening-count
fixes only.

## `cutter.png` — icon fix only

Attached `cutter_v6_scissors.png` is the current file: correct camera,
frame, openings, and arrows, but the roof plaque shows a pair of SCISSORS —
wrong, this project deliberately replaces scissors with a KATANA motif
everywhere (see `cutter_icon_ref.png`, the approved toolbar icon, which
already shows two crossed blade shapes, not scissors). Regenerate this file
keeping literally everything else pixel-similar (frame, roof, openings,
arrow positions, plaque position/size/bamboo material) and change ONLY the
icon embossed on the plaque: two crossed katana blades (slim straight
blades, small angled hilts, crossing in an X), same ivory-embossed-on-bamboo
treatment as before.

## `stacker.png` — two fixes

Attached `stacker_v6_noplaque.png` is the current file: correct camera and
frame, but it has two problems:
1. It is MISSING its roof plaque/icon entirely — the roof is bare. Add one,
   same construction as the other 4 huts (see `balancer_v6_good_plaque.png`
   for the correct plaque construction: centered bamboo-toned rectangular
   plaque on the roof ridge, generously sized, building icon embossed in
   ivory paper with a drop shadow for contrast). Icon for this plaque: a
   small stack of 2-3 offset paper squares/plates (see `stacker_icon_ref.png`,
   the approved toolbar icon, for the exact symbol to reuse).
2. The opening/arrow layout is currently symmetric (2 arrows left, 2 arrows
   right), which is wrong for a stacker — it should be ASYMMETRIC: TWO
   openings with two arrows on the LEFT edge (two separate inputs being
   merged), but only ONE wider opening with ONE arrow on the RIGHT edge (the
   single combined output). Fix the right edge to be one wider opening/arrow
   instead of two.

Verify both files with PIL after saving (correct size 384x192, RGBA, real
alpha variation, no green channel exceeding both red and blue at
partial-alpha edges). Report a final table when done.
