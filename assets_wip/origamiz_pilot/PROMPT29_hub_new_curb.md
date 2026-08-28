# Origamiz hub — new frame, same roof identity

Two images attached.

`hub-old.png` (768x768 RGBA) is the CURRENT hub art — an early piece from
before this project's frame style was finalized. Its central motif (the
folded-paper temple roof with the raised chimney fold, the small square
post at the very center where the fold lines meet, and the red seal near
the bottom-right of the roof) is APPROVED and must be preserved essentially
as-is — same folds, same shading, same seal. Everything else in this image
(the big pyramid corner posts, the double wooden trellis frame, the little
staircase at the bottom) is the OLD frame style and must be discarded
entirely — none of it should appear in the output.

`platform-new.png` (768x768 RGBA, transparent background) is the NEW frame
style, already final — every other building in this project now uses this
exact curb: a thin banded wood plank ring just inside the rounded-corner
platform edge, with small square-based pyramid posts only at the 4 corners
and the midpoint of each side (8 posts total). Do not alter this frame at
all — same posts, same curb bands, same cream platform fill, same outline.

## The task

Composite the roof+seal motif from `hub-old.png` onto `platform-new.png`,
scaled up to fill the new frame's much more generous interior space (the
new curb is far thinner than the old double-trellis frame, so the interior
courtyard is roughly 1.5x wider in each dimension — the roof should grow
to match, staying centered, comfortably inside the curb ring with a similar
proportion of breathing room around it as it had in the old image, not
shrunk and floating in a mostly-empty platform). Keep the roof's own
proportions (width:height ratio, fold angles, chimney height) unchanged —
this is a scale-up + recomposition onto a new background, not a redesign.
No staircase, no extra frame elements — just the new platform underneath,
the roof+seal on top, nothing else added.

## Output

Save the result, full 768x768 RGBA transparent background, to
`/home/user/projects/shapez-community-edition/assets_wip/origamiz_pilot/staging_hub/hub_v2.png`.
After saving, verify with PIL: canvas is 768x768 RGBA, the four corner
100x100px regions are still fully transparent (matching platform-new.png's
own rounded corners — nothing should extend past them), and report the
opaque bounding box of the roof so I can check it actually grew to use the
new interior space.
