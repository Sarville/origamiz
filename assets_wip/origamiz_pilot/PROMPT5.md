# Origamiz asset pilot v5 — fix openings/arrows, enlarge plaques

Targeted fix, only these 5 files, save to
`/home/user/projects/shapez-community-edition/assets_wip/origamiz_pilot/buildings/`
(overwrite `cutter.png`, `rotator.png`, `painter.png`, `stacker.png`,
`balancer.png`). Do not touch any other file.

Attached references:
- `original_cutter_1.jpg`, `original_cutter_2.jpg` — screenshots of the
  ORIGINAL (non-origami) game's cutter building on its belt lanes. Ignore
  their flat grey material entirely — we keep our paper/wood hut style. What
  to copy is the ARROW LOGIC and CLARITY: exactly one crisp, bold, high-
  contrast chevron arrow per belt lane, positioned right at that lane's
  opening on the building face, pointing in the direction items actually
  move through that specific opening (into the building at an input lane,
  out of the building at an output lane). The arrows read instantly even
  at small size — thick, simple, no clutter.
- `our_cutter_bug.jpg` — our current cutter, showing two problems to fix
  everywhere in this batch: (1) the left-side opening has incorrectly split
  into two smaller gaps instead of being ONE clean opening like the right
  side — every opening must be a single uniform rectangular gap, and where a
  building has symmetric lanes they must look identical to each other; (2)
  the roof arrow is small and floats decoratively away from the opening
  instead of sitting right at/above the opening it belongs to.
- `good_hut_balancer.png` — reminder of the base hut construction (wood
  posts, folded paper roof) to keep otherwise unchanged.

## What to fix on all 5 files

1. **Each belt-lane opening = exactly ONE clean rectangular gap**, uniform
   width matching a single belt lane, straight edges, no accidental doubling
   or splitting. Where a building has two parallel lanes on the same edge
   (e.g. cutter's two outputs, stacker's two inputs), both openings must be
   identical in size and shape to each other, evenly spaced.

2. **One crisp, bold, high-contrast arrow per opening, placed directly at
   that opening** (right above it on the wall/roof edge, not elsewhere on
   the roof), pointing in that lane's actual flow direction. Style: simple
   thick chevron, same wood-brown tone as the building's trim, flat and
   clean — must read clearly at small size, same clarity level as the
   arrows in `original_cutter_1.jpg`/`original_cutter_2.jpg`. Remove any
   previous decorative/floating roof arrow that isn't sitting at an opening.

3. **Enlarge the roof signboard plaque** carrying the building's icon to
   roughly 1.5-2x its previous size (still centered on the roof ridge, still
   dark wood with the icon embossed in light ivory paper with a drop shadow
   for contrast) — it should be the most eye-catching element on the roof,
   easily readable at a glance.

Keep everything else about each building unchanged (overall hut shape, wood/
paper materials, opening positions/counts per the function, which edges are
input vs output) — this pass only fixes opening cleanliness, arrow
placement/clarity, and plaque size.

Recap of opening layout per file (unchanged from before, just needs to be
built cleanly this time):

- `cutter.png` (384x192): one opening left (input), two identical openings
  right (two cut-half outputs), one arrow at the left opening pointing in,
  two arrows at the right openings pointing out.
- `rotator.png` (192x192): one opening left (input), one opening bottom
  (output), one arrow at each opening pointing the correct way.
- `painter.png` (384x192): one opening left (shape input), one small opening
  on a long side (color input), one opening right (output, same axis as
  shape input), one arrow at each of the three openings.
- `stacker.png` (384x192): two identical openings left (two inputs), one
  wider opening right (merged output), one arrow at each of the three
  openings.
- `balancer.png` (384x192): openings on both left and right short edges
  (symmetric multi-lane junction), one arrow at each opening pointing the
  correct way for that lane.

Verify every file with PIL after saving (correct size, RGBA, real alpha
variation). Report a final table when done.
