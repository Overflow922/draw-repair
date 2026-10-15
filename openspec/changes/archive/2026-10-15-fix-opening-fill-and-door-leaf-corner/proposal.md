## Why

Two defects in how openings are drawn:

1. The area between the jambs of a doorway/door is not painted: the wall body is cut out and nothing replaces it, so the canvas grid shows through (faint vertical lines inside the cut). Walls and rooms hide the grid with their own fill; the opening does not.
2. The door leaf is attached wrongly: its 4 cm thickness lies outside the swing sector, so the leaf's near corner sticks up into the jamb/wall body and, next to a corner, the open leaf crosses the neighbouring wall. The leaf must touch the opening with its corner at the jamb.

## What Changes

- The area of the opening between the jambs is painted with the paper colour (hides the grid), under the thin face lines, jamb lines and the door leaf. Applies to doorways and doors; the wall body, hatch and contour stay hidden there.
- The door leaf rectangle (4 cm thick) lies on the sector side of the leaf's long side from the hinge (towards the closed position), so its corner at the hinge coincides with the jamb corner on the swing-side face and the leaf does not enter the wall body. Mirrored for the other hinge end and swing side.
- Hinge point, arc centre, arc radius and 95° opening angle are unchanged; the arc now ends on the outer long side of the leaf.
- The direction-zone shadow of a selected door no longer adds a separate leaf rectangle (it lies inside the sector).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `doorway`: «Отображение проёма» — the area between the jambs is painted with the paper colour.
- `door`: «Отображение двери» — leaf thickness lies inside the sector; «Направление выделенной двери» — zone shadow and scenarios that mention the leaf rectangle.

## Impact

- `src/render.ts` (opening drawing, paper fill before faces/jambs/leaf); `src/export/pdf.ts` (same drawing in PDF, fill is invisible but must not break contours).
- `src/doorway/doorway-layout.ts` (`doorLeaf` thickness side; direction zone shadow).
- Tests: door leaf, door render, door direction, door PDF and doorway render tests updated from the new scenarios.
- No data/storage changes.
