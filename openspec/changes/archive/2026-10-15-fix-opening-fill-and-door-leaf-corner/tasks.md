## 1. Tests from the delta specs (before code)

- [x] 1.1 Opening fill: render test for a doorway on a wall with the grid on - area `[100, 220] x [-10, 10]` is paper colour, faces/jambs on top, grid visible outside (`doorway` «Сетка не просвечивает через проём»); same for a door.
- [x] 1.2 Window fill: render test «Сетка не просвечивает через окно» (window block lines on top of the fill).
- [x] 1.3 Selection/hover/marquee outline of an opening stays visible over the fill.
- [x] 1.4 Door leaf: update `door-leaf` / `door-render` / `door-pdf` expectations to the new scenarios (corners `(103.98, -10.35)`, `(96.14, -100.01)` and the mirrored ones) and add «Полотно не заходит в тело стены».
- [x] 1.5 Door direction: update door-direction scenarios (`door-shadow-zone`, `door-hover`) (click `(192, 50)` selects b/right; `(99.5, -70)` and `(99.5, 70)` in the sector, outside the leaf) and check shadow-zone alternatives still match.

## 2. Door leaf side

- [x] 2.1 `doorLeaf` (`src/doorway/doorway-layout.ts`): thickness on the `u` side (inside the sector); fix the comment above it.
- [x] 2.2 Check `src/export/pdf.ts` bbox and the shadow-zone test still agree (no code change expected).

## 3. Opening fill

- [x] 3.1 `src/render.ts`: fill `openingLines(...).outline` with `p.paper` for every opening (doorway, door, window) in one pass before the outlines and element strokes.
- [x] 3.2 Confirm the PDF path draws the same (fill invisible on white paper, contours unchanged).

## 4. Verification

- [x] 4.1 Formatter, lint, typecheck, full test suite.
- [x] 4.2 Browser check: doorway and door in a thick and a 10 cm wall near a corner - grid hidden in the cut, leaf corner touches the jamb corner, selected opening outline visible, direction alternatives switch correctly.
- [x] 4.3 `openspec validate fix-opening-fill-and-door-leaf-corner --strict`, `/opsx:verify`, final git diff review.
