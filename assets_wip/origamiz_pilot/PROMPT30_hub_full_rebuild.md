# Origamiz hub — full volumetric rebuild inside the new frame

Three images attached: `hub-old.png`, `platform-new.png`, `photoreal-ref.png`.

The previous attempt (crop the roof out of `hub-old.png`, scale it up, drop
it onto `platform-new.png`) was rejected as too flat and too empty — a
small flat paper diamond floating in a big bare square. That's not what's
wanted.

## What's wanted instead

A full REBUILD of the hub as a volumetric wooden structure that fills
`platform-new.png`'s interior generously — this is the biggest, most
important building in the game (4x4 tiles, a hero centerpiece), it should
look substantial, not like a small icon on an empty platform.

`hub-old.png` is the structural/style reference — study its actual
construction, don't just reuse its silhouette:
- A raised wooden base/dais with visible support beams (the horizontal and
  vertical timber members you can see holding the structure up)
- Small entrance steps at the front (bottom), like a real approach to a
  shrine building
- The folded-paper origami roof on top (same fold pattern: a peaked
  chimney fold, four sloped facets meeting at a raised square center
  cap, two flared side "wing" facets) with the red seal near the
  bottom-right of the roof face
- Reuse these exact elements/materials/colors, just recompose them with
  more presence and volume, using most of the available interior space
  (small breathing margin to the curb, not a large empty gap)

`platform-new.png` (768x768 RGBA, transparent) is the NEW platform this
sits on — the exact frame every other building in the project now uses
(thin banded wood curb, small pyramid posts at the 4 corners + 4 side
midpoints, cream platform fill, rounded corners). Do not alter this frame:
same posts, same curb, same fill, same outline. The new structure sits
INSIDE it, on top of the cream fill.

`photoreal-ref.png` is one of this project's already-approved buildings —
match its rendering quality and lighting convention (soft directional
light from the top-left, warm ivory/ochre paper and honey-wood tones,
gentle ambient-occlusion shading in the folds/joints, a clean dark
outline around the whole silhouette). The hub should look like it belongs
in the same set as this reference, just far larger and more elaborate.

## One more constraint: leave room for a HUD overlay

The game draws a small info panel (player level, delivery goal, next
unlock) directly on top of the hub sprite at runtime, anchored near the
TOP of the building. Keep the structure's tallest point (the chimney fold)
clearly BELOW roughly the top 130px of the 768px canvas — i.e. the
overall structure should read as sitting a bit lower/more compact
vertically than `hub-old.png`'s roof did, with its peak starting no higher
than y=130, so that band stays clear and low-detail (plain platform fill
is fine there) for the overlay to sit in without fighting busy roof detail.
Everything below y=130 is free to use fully and generously.

## Output

Save the full 768x768 RGBA (transparent background) result to
`/home/user/projects/shapez-community-edition/assets_wip/origamiz_pilot/staging_hub/hub_v3.png`.
After saving, verify with PIL: canvas is 768x768 RGBA, the four 100x100
corner regions are unchanged from `platform-new.png` (nothing extends past
the rounded corners), report the new structure's opaque bounding box, and
confirm its topmost opaque pixel is at y>=130.
