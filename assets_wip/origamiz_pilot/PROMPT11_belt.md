# Fix belt_corner.png to match belt_straight.png's exact material/style

Save to `/home/user/projects/shapez-community-edition/assets_wip/origamiz_pilot/ui/belt_corner.png`
only (192x192px, transparent background). Do not touch any other file.

Attached: `belt_straight.png` — this is the APPROVED belt material and must
be matched exactly: thick beveled trapezoidal cap segments at each end of
the strip (a distinct raised plank-like border, not a thin uniform edge),
same border thickness, same warm tan/cream paper tone, same pale chevron
arrow style and size, same overall proportions (the belt lane width and
border-to-lane ratio must match precisely).

The current `belt_corner.png` (also attached, `belt_corner_current.png`) is
visibly a different, thinner, plainer style — different border weight, no
matching cap-segment paneling — inconsistent with the straight piece when
placed side by side. Redo it: the same conveyor belt material as
`belt_straight.png`, just turning a clean 90° corner (flow entering from the
left edge, exiting the top edge), with 1-2 chevron arrows following the
curve, using the exact same beveled-cap-segment border treatment,
thickness, and color as the straight reference — they must read as two
pieces of the same physical belt, not two different products.

Verify size/RGBA/alpha with PIL after saving.
