# General UI glyphs — groups B, C, D, E (white / badge / mouse-diagram / accent icons)

Same project as `PROMPT31_icons_group_a1.md`/`PROMPT32_icons_group_a2.md`
(generic interface glyphs, NOT the origami-paper-fold building-icon style
used elsewhere in this directory) but this batch has FOUR different small
sub-styles — read each group's own style block, they are NOT all the same.
Save every output into `icons_general/` in this directory, exact filenames
as given.

---

## Group B — pure white silhouette (11 files)

Flat 2D UI glyph icon, pure solid WHITE fill only (#ffffff), no outline, no
shadow, no gradient, no texture. This icon is designed to sit on top of a
colored badge/circle drawn separately by the game engine — do NOT add your
own background circle or color, white silhouette only, on a fully
transparent background. Centered, even padding, square canvas at the exact
size given.

1. `display_icons.png`, 64x64 — a small grid of 4 squares (icon-grid view
   toggle).
2. `display_list.png`, 64x64 — 3 horizontal list rows (list view toggle).
3. `display_sorted.png`, 64x64 — 3 horizontal bars of increasing length
   stacked top to bottom (sorted-list view toggle).
4. `notification_info.png`, 64x64 — a circled lowercase "i" (generic info
   notification).
5. `notification_saved.png`, 64x64 — a floppy-disk glyph (save
   notification).
6. `notification_success.png`, 64x64 — a bold checkmark.
7. `notification_upgrade.png`, 32x32 — an upward arrow (upgrade
   notification).
8. `play.png`, 64x64 — a solid play triangle (▶).
9. `puzzle_action_liked_no.png`, 128x128 — an outline (not filled)
   thumbs-up hand icon, i.e. the "not liked yet" state.
10. `puzzle_action_liked_yes.png`, 128x128 — the same thumbs-up hand icon
    fully solid-filled, i.e. the "liked" state.
11. `toggle_unit.png`, 64x64 — two small arrows curved into a swap/cycle
    loop (toggles between two measurement units).

## Group C — self-contained colored badge (2 files)

Flat 2D circular notification badge icon: solid flat color circle
background with a simple white glyph centered inside it, no gradient, no
outline, no shadow, no 3D. Centered, fully transparent background outside
the circle, square canvas exactly 64x64px.

1. `notification_error.png` — red circle background (#f3405b) with a
   white X/cross glyph centered inside.
2. `notification_warning.png` — amber/orange circle background (#ffd05e)
   with a dark exclamation-mark glyph centered inside.

## Group D — two-tone mouse diagram (3 files)

Flat 2D computer mouse diagram icon: simple rounded mouse body silhouette
in flat neutral grey (#898e93-class), with ONE mouse button visually
highlighted in a bright flat accent color (any clear, legible accent color
works) to indicate which button is meant. No gradients, no outlines beyond
the flat shape edges, no shadow, no realistic rendering — stays a simple
flat diagram. Centered, small even padding, fully transparent background,
square canvas exactly 32x32px.

1. `mouse_left.png` — the LEFT button highlighted.
2. `mouse_middle.png` — the MIDDLE button/scroll-wheel highlighted.
3. `mouse_right.png` — the RIGHT button highlighted.

## Group E — flat accent-color glyph (2 files)

Flat 2D UI glyph icon, single solid flat ACCENT color fill (not neutral
grey), no outline, no gradient, no shadow. Centered, even padding,
transparent background, square canvas at the exact size given.

1. `tutorial_arrow.png`, 128x128 — a bold downward-pointing chevron/arrow,
   bright green (#4aed86) — used as a bouncing pointer in tutorial hints.
2. `shop_active.png`, 64x64 — a 5-pointed star, bright orange (#ff4a03) —
   the "active/selected" twin of the neutral-grey `shop.png` icon from
   group A.

---

Generate all 18 files as separate transparent PNGs at their listed sizes,
named exactly as given, saved in `icons_general/`.
