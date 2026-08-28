# General UI glyphs — group A part 1 (dark neutral flat icons)

These are generic interface glyphs (menus/buttons), NOT building icons — do
NOT use the origami-paper-fold 3D style from `icons/*.png` in this same
directory. This is a completely different, much simpler style: flat solid
silhouette glyphs, like a normal icon font. Save all outputs into
`icons_general/` in this directory (create it if missing), one PNG per
entry below, using the exact filename given.

## Style (apply identically to every icon in this batch)

Flat 2D UI glyph icon, single solid dark neutral fill color (#333438-class
near-black), no outline, no gradient, no shadow, no texture, no 3D.

Simple, bold, geometric, instantly legible at small size (some of these
render as small as 32x32px in-game — avoid fine detail that would
disappear when scaled down).

Composition: centered, generous even padding (~20% margin), fully
transparent background (alpha channel), square canvas at the exact pixel
size given per icon below.

Avoid: multiple colors, outlines/strokes, text/lettering, realistic
rendering, background shapes/panels, drop shadows.

## Icons (18 files)

1. `blueprint_marker.png`, 32x32 — a small blueprint/schematic document
   corner-fold icon (a folded-corner page with a few ruled lines), marks a
   savable building blueprint.
2. `close.png`, 64x64 — a simple X / close-window cross.
3. `delete.png`, 64x64 — a trash/waste bin with a lid.
4. `download.png`, 64x64 — a downward arrow pointing into a horizontal
   tray/shelf line.
5. `edit_key.png`, 64x64 — a pencil icon overlapping a small keyboard-key
   square (rebind a hotkey).
6. `enum_selector.png`, 64x64 — two small triangles/chevrons, one pointing
   left and one pointing right, for cycling through options.
7. `help.png`, 64x64 — a bold question mark.
8. `info_button.png`, 32x32 — a circled lowercase "i" info glyph.
9. `link.png`, 32x32 — two overlapping chain-link ovals (hyperlink icon).
10. `main_menu_exit.png`, 64x64 — a door outline with an arrow pointing
    out of it (exit/quit).
11. `main_menu_settings.png`, 64x64 — a mechanical gear/cog.
12. `mods.png`, 192x192 — a jigsaw puzzle-piece silhouette (represents
    game mods/plugins).
13. `music_off.png`, 64x64 — a musical eighth-note glyph with a diagonal
    slash through it (muted).
14. `music_on.png`, 64x64 — the same musical eighth-note glyph, no slash.
15. `pin.png`, 32x32 — a map/push pin (teardrop with a round head).
16. `puzzle_complete_indicator.png`, 256x256 — a bold checkmark inside a
    circular badge outline (completion checkmark).
17. `puzzle_completion_rate.png`, 64x64 — a small pie-chart/percentage-ring
    glyph (partial ring filled, rest outline).
18. `puzzle_plays.png`, 128x128 — a small play-triangle inside an eye
    outline (represents "number of times played").

Generate all 18 as separate transparent PNGs at their listed sizes, named
exactly as given, saved in `icons_general/`.
