# belt_corner.png is still narrower than belt_straight.png — fix the width

Save to `/home/user/projects/shapez-community-edition/assets_wip/origamiz_pilot/ui/belt_corner.png`
only (192x192px, transparent background). Do not touch any other file.

The border/cap style was fixed last round and is now correct. The remaining
problem: the belt LANE ITSELF (the cream walkway the arrows sit on) is
noticeably NARROWER on the corner piece than on the straight piece — measured
directly in pixels: on `belt_straight.png`, the lane spans from x=41 to
x=150 (109px wide) out of the 192px canvas at the vertical center. On the
current `belt_corner.png`, the equivalent lane width is only about 52px —
roughly HALF as wide as it should be.

Fix: redraw `belt_corner.png` so its lane width (both the horizontal arm and
the vertical arm of the L-shape) matches `belt_straight.png`'s lane width
EXACTLY — about 109px wide/thick out of the 192px tile, same raised border
thickness on both sides of the lane, same cap-segment style already
approved. The corner should look like the straight piece was physically
bent 90°, not like a thinner, different belt.

Attached: `belt_straight.png` (match this lane width exactly),
`belt_corner_current.png` (today's file — too narrow, fix the width only,
keep everything else about its current border/cap style).

After saving, verify with PIL: measure the opaque lane width at the middle
of the horizontal arm and report it — it must be within a few px of 109.
