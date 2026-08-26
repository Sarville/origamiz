# Platform-frame templates v2 — fully closed, zero padding, edge-to-edge
# (openings are now cut precisely by code afterward, not drawn by you)

The previous version of these two templates had a bug: the frame did not
reach the canvas edges on ANY side (there was a ~15-20px transparent margin
all around, like normal icon padding). That is wrong for this asset — it
must tile flush against neighboring tiles with zero gap, so it has to fill
the full 192x192 canvas edge-to-edge on every side, no exceptions, no
padding, no icon-style margin.

Save 2 files to
`/home/user/projects/shapez-community-edition/assets_wip/origamiz_pilot/ui/`,
overwriting `hut_frame_template.png` and `low_platform_frame_template.png`.
Do not touch any other file.

Attached: `hub_current.png` (frame material reference) and
`good_hut_balancer.png` (a hut using this frame at full scale).

Both templates: 192x192px, transparent background, top-down camera,
**FULLY CLOSED on all 4 sides this time — no gap/opening at all**. The
frame's outer silhouette must touch x=0, x=191, y=0, and y=191 directly —
verify this yourself before saving (check that row 0, row 191, column 0,
and column 191 each contain opaque pixels spanning most of their length,
not just a thin sliver in the middle). The center of the tile stays
completely empty/transparent (plain, no object — content and any opening
gets added afterward by code).

1. `hut_frame_template.png` — a FULL-HEIGHT closed frame matching the hut
   buildings' own border thickness and corner-post style exactly (same
   wood-post-and-rail language and proportions as `good_hut_balancer.png`'s
   frame, corner posts at all 4 corners, rails connecting them on all 4
   sides).
2. `low_platform_frame_template.png` — same wood material and corner-post
   language, but a noticeably LOWER, THINNER, simpler closed curb ring (a
   shallow raised lip around the tile edge) instead of a full post-and-rail
   structure — for smaller utility objects on a modest base.

After saving each file, load it with PIL and print whether row 0, row 191,
column 0, and column 191 have opaque (alpha>30) pixels — if any of the four
is empty or only has a tiny sliver, redraw before finishing. Also check no
green-channel-dominant partial-alpha pixels exist at the edges.
