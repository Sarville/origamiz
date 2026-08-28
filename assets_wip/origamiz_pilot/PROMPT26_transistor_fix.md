# Origamiz — precise connector recenter, 2 files only

`staging_wire_v4/transistor.png` and `staging_wire_v4/transistor-mirrored.png`
(both attached) have their body/tabs/symbol all approved — do NOT redesign
anything. There is exactly one measured problem: the TOP tab and the
BOTTOM tab (the post's base) are both shifted right of where they need to
be. Measured precisely with PIL (opaque content in the outermost 4px at
each edge):

- `transistor.png`: top tab center is at x=102, needs to be at x=96 (shift
  left 6px). Bottom tab center is at x=105, needs to be at x=96 (shift
  left 9px). The LEFT tab (the horizontal arm) is already correct
  (x=92.5, within tolerance) — do not move it.
- `transistor-mirrored.png`: top tab center is at x=89, needs to be at
  x=96 (shift RIGHT 7px). Bottom tab center is at x=86, needs to be at
  x=96 (shift RIGHT 10px). The RIGHT tab (the horizontal arm, mirrored) is
  already correct (x=96, within tolerance) — do not move it.

Both files have the same construction: a raised top box with a chimney
tab, a vertical post below it ending in the bottom tab, and a horizontal
arm partway down connecting to the left (or right, for -mirrored) tab.
The top box+chimney and the vertical post+bottom-tab need to shift
horizontally by the amounts above — but the horizontal arm and its own
tab must stay exactly where they are (they're already correctly centered
on their edge). Since the arm physically joins the post partway down,
re-render the joint cleanly after the shift — don't leave a visible seam
or gap where the post now sits slightly left/right of where the arm
attaches; adjust the joint geometry seamlessly so it still reads as one
solid folded-paper object, just with the top/bottom tabs correctly
centered now.

Save the corrected files back over the same 2 paths in
`/home/user/projects/shapez-community-edition/assets_wip/origamiz_pilot/staging_wire_v4/`.
Canvas stays 192x192 RGBA, transparent background. After saving, verify
with PIL: report the new top/bottom/left(or right) tab center x-position
for both files (should now read ~96 for the ones that moved), and confirm
no near-white semi-transparent fringe pixels were introduced.
