# Origamiz hub — add the missing wire connector, nothing else

Attached: `hub-current.png` (768x768 RGBA, transparent background) — this is
the approved, finished hub building art. Do NOT redesign, recolor, or move
anything else in it: same posts, same paper roof folds, same red seal,
same wood tones, same outline style. This is a single small, surgical
addition.

## Why

The hub has exactly one wire (signal) connection point in the real game
data: a logical-signal OUTPUT on its LEFT edge, at the third of four tiles
down (tile row index 2 of 0-3, i.e. roughly 55-70% of the way down the
building's left side — NOT at either corner). Every other wire-carrying
building in this project (see attached `bamboo-ref.png`, one straight wire
tile) already shows its wire connections as a short bamboo-green pole tip
poking out past the building's own edge, fading into the building's own
material as it goes inward — the hub is the one building in the batch that
still has no such marker, and needs one so it visually reads as
"connectable" the same way the others do.

## Where, precisely

Look at the flat (non-rounded) part of the left edge of the building. It
sits at a constant x=50 on this 768px canvas along that whole flat run.
Partway down that run there is already a horizontal wood crossbar/rail
element reaching toward that edge, roughly around y=440-500 (below the
folded-paper roof's leftward-pointing corner, above the lower-left corner
post). That crossbar is the natural spot: extend it a short distance
further out, THROUGH the outer curb ring, so its tip now pokes past x=50
into the transparent margin (out to about x=10-14 — a reach of roughly
36-40px past the edge, similar width to the crossbar itself, ~30-36px
tall).

## Coloring

The poking-out tip should be bamboo green, matching the attached
`bamboo-ref.png` pole (colors approximately: rim #5C7A2E, mid #8FA54C,
core highlight #C7E08A — a light natural bamboo, with one subtle darker
joint-ring band partway along its length like the reference). Over roughly
the last 40px before it reaches the existing crossbar/curb, blend that
green smoothly into the hub's own warm wood-brown tone — no hard color
seam, it should read as one continuous connector piece that happens to
change material/color as it crosses the building's edge, the same
convention as the reference.

## Output

Save the edited full 768x768 RGBA image to
`/home/user/projects/shapez-community-edition/assets_wip/origamiz_pilot/staging_hub/hub.png`
(create the directory if needed). Do not overwrite the original. After
saving, verify with PIL: confirm the canvas is still 768x768 RGBA, confirm
alpha is still 0 in the far corners (untouched), and report the pixel
bounding box of the new green tip so I can check it actually pokes past
x=50.
