# Two reusable platform-frame templates (buildings will be composited onto
# them afterward with PIL — do not draw any crate/basket/gate content here)

Save 2 new files to
`/home/user/projects/shapez-community-edition/assets_wip/origamiz_pilot/ui/`.
Do not touch any other file.

Attached: `hub_current.png` (the approved top-down frame language: thin
wood-post-and-rail border around the tile, corner posts, seen from directly
above) and `good_hut_balancer.png` (a hut using this same frame at full
building scale) — match this exact material/construction, just apply it to
two new empty platform templates (no roof, no building on top — these are
bare frames other art will be composited onto afterward).

Both templates: 192x192px, transparent background, top-down camera, one
single GAP cut through the border on the BOTTOM edge only (centered, one
belt-lane wide, matching the gap style already used on the hut buildings —
a clean cut with nothing drawn across it) — the other three sides (left,
right, top) stay fully bordered/closed. The center of the tile stays
completely empty/transparent (just a plain simple floor tone at most, no
object, no icon — content gets composited on top afterward).

1. `hut_frame_template.png` — a FULL-HEIGHT frame matching the hut
   buildings' own border thickness and corner-post style exactly (same
   wood-post-and-rail language and proportions as `good_hut_balancer.png`'s
   frame) — this will sit behind a building's own content, so it must be
   visually identical in weight/thickness to the existing hut frames.
2. `low_platform_frame_template.png` — the SAME wood material and corner-
   post language, but a noticeably LOWER, THINNER, simpler curb ring (like
   a shallow raised lip/step around the tile edge rather than a full
   post-and-rail structure) — for smaller utility objects that sit on a
   modest base rather than inside a full building frame.

Verify both with PIL after saving (192x192, RGBA, real alpha variation,
gap present on the bottom edge, no green channel exceeding both red and
blue at partial-alpha edges).
