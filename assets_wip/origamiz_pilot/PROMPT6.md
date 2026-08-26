# Origamiz asset pilot v6 — true top-down camera, hub-style frame

Root cause of the last round's problems: the 5 hut buildings were drawn from
a slight front/elevation angle (like a dollhouse facade), not a true
top-down view — that's why the wall openings and arrows never lined up
cleanly. Fix the camera first, everything else follows from that.

Only these 5 files, save to
`/home/user/projects/shapez-community-edition/assets_wip/origamiz_pilot/buildings/`
(overwrite `cutter.png`, `rotator.png`, `painter.png`, `stacker.png`,
`balancer.png`). Do not touch any other file.

Attached references:
- `hub_current.png` — this is our current, APPROVED `buildings/hub.png`.
  Copy its CAMERA AND CONSTRUCTION LANGUAGE exactly: a true bird's-eye/
  top-down view (camera directly overhead, zero tilt) of a thin wood-post-
  and-rail border frame running around the tile's perimeter, with a folded-
  paper roof shape filling the center, seen purely from above — you can see
  the roof's ridge/fold lines and a thin strip of the frame/base around its
  edges, but you never see a "front wall face" like a dollhouse. Every hut
  below must use this exact same camera and frame construction, just with a
  differently-shaped center roof and a different perimeter opening layout
  per its function.
- `original_cutter_1.jpg`, `original_cutter_2.jpg` — for arrow clarity only
  (ignore their flat grey material): one crisp, bold, high-contrast arrow
  per belt lane, sitting right at that lane's opening, pointing the correct
  flow direction, reading instantly at small size.

## Construction pattern for all 5 (top-down, hub-style)

- Thin wood-post-and-rail border frame around the full tile footprint
  (posts at the corners, rails between them), exactly like `hub_current.png`'s
  frame, scaled to each building's own tile footprint (a 2-tile-wide
  building gets a 2-tile-wide frame, etc.).
- **Opening = a clean gap cut straight through the frame/rail at the exact
  edge-midpoint where a belt lane connects**, single lane width, seen from
  above as a simple break in the border with the paper-roof material visible
  through the gap down to a plain floor tone (not a doorway/window drawn on
  a wall face — there is no wall face in this camera, just a break in the
  perimeter frame).
- **One small, crisp, high-contrast arrow glyph right at each opening**,
  drawn flat on the roof/frame surface next to the gap (top-down, like a
  painted road-marking arrow), pointing in that lane's flow direction
  (pointing inward across the gap for an input, pointing outward across the
  gap for an output). Simple, bold, wood-brown, no clutter.
- Center roof: a simple folded-paper shape filling the middle of the frame
  (pyramid for a compact 1-tile building, a ridged/gabled long fold for a
  2-tile-wide building — pick whatever folded-roof shape reads cleanly from
  directly above), same cream paper material as before.
- **A flat BAMBOO-toned plaque, centered on the roof, seen top-down** (lying
  on the roof surface, not standing upright like a signpost — this camera is
  looking straight down at it). Light bamboo/tan wood tone (not dark wood
  this time), with the building's icon embossed on it in ivory paper with a
  small drop shadow for contrast, sized generously — it should be the clear
  focal point of the roof, easily readable at a glance, similar scale
  relationship to the roof as the hub's red seal-stamp has to its roof, but
  noticeably bigger since it carries a whole icon, not just a small mark.

## Per-building opening layout (unchanged function, just executed in the
## correct top-down camera this time)

- `cutter.png` (384x192, 2 tiles wide): one opening at the midpoint of the
  LEFT edge (input), two openings evenly spaced along the RIGHT edge (two
  cut-half outputs) — since the right edge here spans a 1-tile height, place
  the two output openings as two small adjacent gaps within that edge.
  Plaque icon: crossed-blades.
- `rotator.png` (192x192, 1 tile): one opening at the LEFT edge midpoint
  (input), one opening at the BOTTOM edge midpoint (output, marking the 90°
  turn). Plaque icon: pinwheel.
- `painter.png` (384x192, 2 tiles wide): one opening at the LEFT edge
  midpoint (shape input), one small opening at the midpoint of a LONG (top
  or bottom) edge (color input), one opening at the RIGHT edge midpoint,
  same axis as the shape input (output). Plaque icon: brush.
- `stacker.png` (384x192, 2 tiles wide): two openings evenly spaced along
  the LEFT edge (two inputs), one wider opening centered on the RIGHT edge
  (merged output). Plaque icon: paper-stack.
- `balancer.png` (384x192, 2 tiles wide): openings on both the LEFT and
  RIGHT edges (symmetric multi-lane junction), one arrow at each opening
  pointing the correct way for that lane. Plaque icon: fork/merge-arrow.

Verify every file with PIL after saving (correct size, RGBA, real alpha
variation, and — since the last two batches leaked chroma-key green at
semi-transparent edges — explicitly check no pixel has green significantly
higher than both red and blue at partial-alpha edges; fix if so). Report a
final table when done.
