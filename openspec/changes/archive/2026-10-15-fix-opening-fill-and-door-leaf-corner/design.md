## Context

See proposal.md - Why. Current drawing (`src/render.ts`, shared by screen and PDF through render metrics):

- Room polygons are filled with `p.paper` before walls (`fillRooms`), which hides the grid inside rooms. Walls paint their own material. The opening cut removes the wall body, so the band between the jambs shows the grid.
- Per element the renderer strokes `openingLines(...).faces` (thin grey), `.jambs` and, for doors, `drawLeaf`. `openingLines(...).outline` already gives the quadrilateral between the jambs and the faces (used for selection outlines).
- `doorLeaf` (`src/doorway/doorway-layout.ts`) returns the leaf rectangle `[hinge, arcTo, arcTo+thick, hinge+thick]`, with `thick` pointing away from the closed position. The direction-zone test (`inDirectionShadow`-like code at lines ~235-244) uses "sector or leaf polygon".

## Goals / Non-Goals

**Goals:** paint the opening area with paper colour; put the leaf thickness on the sector side.

**Non-Goals:** no change to hinge point, arc, 95° angle, leaf thickness, hit-testing, canonical wall shape, storage, or the grid itself.

## Decisions

**D1. Paint the opening with `openingLines(...).outline` filled with `p.paper`, once per element, before faces/jambs/leaf/label.**
Reuses the existing polygon (no new geometry). Painted in one pass over all elements at the start of the element drawing, before the selection/hover/marquee outlines (`outline(...)` in `render.ts`) and before faces, jambs, leaf and label, so everything of the opening lies on top and the fill never covers the inner half of an outline stroke. Alternative considered: extend `fillRooms` to include opening polygons - rejected, rooms are computed from the canonical wall shape which must not change (spec `doorway`), and a free wall without a room would still show the grid. Alternative: not painting but suppressing grid lines in the polygon via clip - rejected, more code for the same pixels.
Windows use the same polygon and paint (their drawing is the `isWindow` branch of the same loop), so the fill is placed before the `isWindow` branch.
Ordering risk: a fill painted after a neighbouring element's strokes could cover them; openings never overlap (guard), but a jamb line of a wall end may sit on the polygon edge. Fill first for all elements, then stroke all, to be safe.

**D2. Flip the leaf thickness side in `doorLeaf`.**
`away` becomes the perpendicular on the `u` side (`dot(across, u) > 0`). Hinge, arc points and radius stay. `leaf` keeps the order `[hinge, arcTo, arcTo+thick, hinge+thick]`, so the hinge corner is the leaf corner touching the jamb corner. Consequences:
- the rectangle lies inside the sector except a sub-millimetre corner, so `door shadow zone` ("sector or leaf polygon") stays as written and needs no code change; only scenarios were corrected;
- the PDF/bbox code collects `l.leaf` corners and arc extremes and needs no change.

## Risks / Trade-offs

- [Leaf corner beyond arc radius by ~0.09 cm] → acceptable; the shadow-zone union still includes the polygon, so no gap.
- [Existing tests assert the old thickness side] → they derive from the old scenarios; they are updated from the new delta specs, not from the implementation (Rule 3).
- [Fill hiding a selection/hover outline] → the fill pass runs before the outlines (D1); covered by a render test and a browser check (task 4.2).

## Migration Plan

None: rendering only, no stored data.
