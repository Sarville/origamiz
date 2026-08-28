# Origamiz — precise connector recenter, 5 files, keep the new clean outline

The 5 attached files (already the LATEST version, with the newly-cleaned
smooth single-line outline — do not touch the outline style, it's correct
now) each have specific tabs that drifted off-center during an earlier
automated cleanup attempt on my end. Everything else (body, symbol,
outline style) is approved — this is ONLY a precise repositioning of the
named tabs back to center, same technique as before: shift just that tab
(and its own short connecting stub back to the body) left/right or up/down
by the exact amount below, then re-render the joint where the shifted tab
meets the body/arm cleanly (no seam, no gap, outline stays one continuous
smooth line around the new position — same outline color/thickness as the
rest of the file).

Measured precisely with PIL (opaque content in the outermost 3px at each
edge):

- `logic_gate.png`: LEFT tab center is at x=103.5, needs to be at x=96
  (shift up... no — shift this tab's *position along the edge*, i.e.
  vertically, since it's a left-side tab: move it up by 7.5px). RIGHT tab
  center is at x=103.5 (same measurement convention, this is actually
  the tab's vertical position on the right edge) — also move up by 7.5px.
  Top tab is already correct, don't touch it.
- `transistor.png`: TOP tab center is at x=102.5, needs x=96 — shift this
  tab left by 6.5px (horizontal position, since it's a top-edge tab). Left
  and bottom tabs are already correct, don't touch them.
- `transistor-mirrored.png`: TOP tab center is at x=89.5, needs x=96 —
  shift this tab right by 6.5px. Right and bottom tabs are already
  correct, don't touch them.
- `virtual_processor-stacker.png`: TOP tab center is at x=106, needs x=96
  — shift left by 10px. BOTTOM tab center is at x=105.5, needs x=96 —
  shift left by 9.5px. Right tab is already correct, don't touch it.
- `virtual_processor-painter.png`: TOP tab center is at x=104.5, needs
  x=96 — shift left by 8.5px. BOTTOM tab center is at x=105.5, needs x=96
  — shift left by 9.5px. Right tab is already correct, don't touch it.

("x" above always means position measured along the tile's edge — for a
top/bottom tab that's literal x; for a left/right tab, per the note on
`logic_gate.png`, it's the vertical position along that edge, just using
the same 0-192 coordinate convention.)

Save each corrected file back over its own path in
`/home/user/projects/shapez-community-edition/assets_wip/origamiz_pilot/staging_wire_v5/`
(new folder, so nothing gets overwritten if this needs another pass).
Canvas stays 192x192 RGBA, transparent background outside the object, and
outside the dark outline ring.

After saving, verify with PIL for all 5 files: report the new center
position of every tab named above (should now read ~96), confirm the
outline is still one single continuous ring per file with no branch
points or gaps (you can check this by confirming the outline-colored
pixels form one connected component when combined with immediate
neighbors), and confirm no near-white semi-transparent fringe pixels were
introduced.
