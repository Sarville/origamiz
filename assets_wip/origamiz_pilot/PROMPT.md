# Origamiz asset pilot — generate 20 PNG images

You have a native image-generation tool. Use it to generate every asset listed
below, one at a time, and save each result to the EXACT absolute file path
given, at the EXACT pixel size given, as a PNG.

An attached reference image (`origami.png`) shows the target art direction:
light and simple, materials = paper / wood / bamboo, warm cream and light-wood
tones, soft flat shading, origami paper folds (cranes, sakura petals), a
wood-toned UI panel. Match this material and color language in every asset
below. Do not copy the reference's specific scene content — only its
materials, palette, lighting, and mood.

After saving each file, verify it with Python (`PIL.Image.open(path).size` and
check `im.mode == "RGBA"` and the alpha channel is not fully opaque at the
corners) before moving to the next item. If a file is the wrong size or has no
real transparency, regenerate it. Do not stop until all 20 files exist,
correctly sized, with working alpha transparency where required.

## Shared style for all BUILDING sprites (group 1, items 1-10)

- Strictly orthographic top-down 2D view, camera pointing straight down. ZERO
  isometric tilt, zero perspective, zero foreshortening — every edge is a pure
  horizontal/vertical/diagonal line as if photographed from directly above.
- Body silhouette: rounded-rectangle casing (corner radius ~8% of tile size),
  rendered as a light wood-framed washi paper panel — thin warm mid-brown wood
  outline (~#8b6b4a class), flat warm cream paper fill (~#f3ead9 class), no
  gradients, no textures beyond a very subtle paper grain, one soft low-opacity
  drop shadow offset down-and-right as the only depth cue.
- On buildings marked "FOLD: yes" below, replace the reference game's diagonal
  corner-cut with a folded-paper dog-ear: the bottom-right corner is folded
  over diagonally like a turned paper-page corner, showing a slightly darker
  triangular paper-back underneath. This marks the output/direction side —
  keep it small and clean, not decorative clutter.
- Centered functional symbol per item below, same flat-fill + outline
  treatment, in a warm wood-brown tone unless a functional accent color is
  specified. Symbol must stay simple and instantly readable at small size —
  do not add decorative detail beyond what is needed to read the symbol.
- Fully transparent background (real alpha channel), object fills the frame
  edge-to-edge with small even padding, no rotation, no text, no watermarks,
  no 3D rendering, no photorealism.

## Group 1 — Buildings (save to res_raw/sprites/buildings/ later, for now save
## under `/home/user/projects/shapez-community-edition/assets_wip/origamiz_pilot/buildings/`)

1. `hub.png` — 768x768px. FOLD: no. The player's home base — a small
   top-down wooden shrine/pagoda platform (simple stepped wood dais, torii-
   style corner posts), cream paper roof panels. Include one small red
   hanko/inkan seal-stamp mark as the sole accent color (functional indicator,
   keep it small and off-center, like a wax-seal/stamp, not a logo).
2. `miner.png` — 192x192px. FOLD: no. Symbol: a simple bamboo dipper/ladle
   (hishaku) scooping shape — reads as "extracting a resource".
3. `cutter.png` — 384x192px (wide, landscape). FOLD: yes (bottom-right).
   Symbol: two crossed katana blades (replacing scissors), slim steel-grey
   blades with tiny wood-brown hilts, crossing in an X like open scissor
   blades would.
4. `trash.png` — 192x192px. FOLD: no. Symbol: a small woven bamboo basket
   (kuzukago), simple round basket silhouette with visible basket-weave lines.
5. `balancer.png` — 384x192px (wide). FOLD: yes (bottom-right). Symbol: a
   simple set of forking/merging arrows (one path splitting into two /
   merging into one), plain and legible, wood-brown tone — do not turn this
   into a fan or other decorative shape, keep it a clean arrow-junction glyph.
6. `rotator.png` — 192x192px. FOLD: no. Symbol: a Japanese paper pinwheel toy
   (kazaguruma) — four folded pinwheel blades around a center pin, with a
   short curved motion arrow around it to reinforce "rotation".
7. `underground_belt_entry.png` — 192x192px. FOLD: yes (bottom-right). Symbol:
   a small torii-gate arch viewed top-down (two posts + top lintel bar), warm
   red-orange torii accent color, with a short arrow pointing INTO the arch
   (entrance into the tunnel).
8. `underground_belt_exit.png` — 192x192px. FOLD: yes (bottom-right). Same
   torii-gate arch motif and red-orange accent as item 7, but the arrow points
   OUT of the arch (exit from the tunnel) — keep the two visually paired.
9. `painter.png` — 384x192px (wide). FOLD: yes (bottom-right). Symbol: a
   Japanese calligraphy brush (fude) held diagonally with a small colored ink
   droplet at its tip — tip/droplet in a soft accent color (e.g. muted teal or
   plum), brush body in wood-brown.
10. `stacker.png` — 384x192px (wide). FOLD: yes (bottom-right). Symbol: a
    small stack of 3 folded paper squares, slightly offset like a stack of
    origami paper sheets, each layer a slightly different warm cream/tan tone
    with a thin wood-brown outline.

## Group 2 — Toolbar icons (bare symbol only, NO casing/background shape,
## just the pictogram floating on transparent background)

Save under `/home/user/projects/shapez-community-edition/assets_wip/origamiz_pilot/icons/`.
All 128x128px. Style: two-tone flat duotone, mid wood-brown fill
(~#9c7b52 class) with a darker brown outline (~#6e4f30 class), uniform stroke
width ~6% of icon width, no gradients, no shadow, no casing/badge — just the
bare symbol, centered, ~15% margin. This MUST be the exact same pictogram as
the matching building above (items 2-10), just extracted without its casing —
use the corresponding building file already generated in
`assets_wip/origamiz_pilot/buildings/` as a direct visual reference so the
symbol matches 1:1, do not invent a different symbol here.

11. `miner.png` — same bamboo dipper symbol as building item 2.
12. `cutter.png` — same crossed katana symbol as building item 3.
13. `trash.png` — same bamboo basket symbol as building item 4.
14. `balancer.png` — same fork/merge arrow symbol as building item 5.
15. `rotator.png` — same paper pinwheel symbol as building item 6.
16. `underground_belt.png` — same torii-gate arch symbol as building items
    7/8, generic (no directional arrow needed here, just the arch).
17. `painter.png` — same calligraphy brush symbol as building item 9.
18. `stacker.png` — same stacked-paper-squares symbol as building item 10.

## Group 3 — UI backdrop textures

Save under `/home/user/projects/shapez-community-edition/assets_wip/origamiz_pilot/ui/`.

19. `toolbar_panel.png` — 1536x320px. A wide horizontal wood/bamboo tray-bar
    panel, matching the reference image's bottom toolbar exactly in material:
    rounded-rectangle bar, light warm wood-grain texture with visible bamboo-
    strip seams, thin darker wood trim border, soft drop shadow beneath the
    whole bar, warm cream paper-toned interior area where icons will sit.
    Fully transparent background OUTSIDE the rounded bar shape (real alpha
    channel), no icons/text/props drawn on it, empty panel only.
20. `paper_background.png` — 1024x1024px, seamless tileable. A warm cream/
    off-white washi-paper background texture, very subtle fiber grain, no
    strong highlights or shadows baked in, edge-to-edge tileable with no
    visible seam, no objects/text/logos on it.

## Order of work

Do buildings (1-10) first, then icons (11-18) using the building files as
visual reference, then the two backdrop textures (19-20) last, in any order.
Work through the list fully — this is the whole task, do not stop partway or
ask for confirmation, just generate all 20 and report a final summary table
of file path / size / transparency-check result for each.
