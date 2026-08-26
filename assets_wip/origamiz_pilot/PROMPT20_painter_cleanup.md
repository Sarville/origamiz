# painter.png — simplify the jagged bottom edge (too busy/messy right now)

Save to `/home/user/projects/shapez-community-edition/assets_wip/origamiz_pilot/buildings/painter.png`
only (384x192, transparent background). Do not touch any other file.

Attached: `hub_current.png` (frame reference), `clean_painter.png` (roof/
frame material to reproduce), `painter_current_messy.png` (today's file —
the bottom edge has too many small zigzag teeth close together, reading as
cluttered/noisy rather than an intentional design element).

## Fix: fewer, bigger, cleaner notches

Replace the current dense zigzag with just TWO large, clean triangular
notches cut into the bottom edge (one nearer the left tile, one nearer the
right tile), each roughly 45-60px deep, with a calm straight rail segment
of the frame remaining between and around them — not a continuous saw-tooth.
Think "two deliberate bites taken out of a torn paper edge", not "a zigzag
pattern". The wood posts/rails should read as clean straight or gently
angled segments meeting at each notch's two corners (proper integrated 3D
geometry there, matching the quality of the approved cutter.png chamfer) —
no more than 2 direction changes per notch.

Everything else unchanged: fully closed on left/right/top edges (I cut the
real openings with code afterward), same roof/frame material as
`clean_painter.png`, roof center stays plain (no plaque, composited
separately).

## Zero-tolerance edge check (same standard as approved files)

After saving: no partial-alpha band wider than ~2px anywhere on the
silhouette, no near-white (r,g,b>235) pixels with alpha 10-240 anywhere.
Also make sure the TOP-LEFT and TOP-RIGHT corners are NOT rounded/gapped —
fill solid right into the true canvas corner there (this file's top-left
and top-right corners must both read as fully square/solid, no visible
transparent wedge at the very corner pixel). Fix and report exact counts.
