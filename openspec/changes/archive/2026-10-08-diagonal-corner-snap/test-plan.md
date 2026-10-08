# Test Plan

## Scope

Observable behavior of change `diagonal-corner-snap`:

1. **Snap** (`wall-drawing`, «Диагональное прилипание к углу свободного торца»): the result of
   `snapStartVertex` / `snapVertex` — `point`, `source`, `target === "corner"`, `normal`, and the square returned by
   `placementSquare(snap, size)` — for a cursor in the quadrant behind a free cap corner.
2. **Joint** (`wall-joints`, «Диагональный угловой стык»): the displayed shape of a wall pair — `displayPolygons(w, walls)`,
   `hitWall`, `contourSegments` — with an independent reference («closed L-corner» is defined by rectangles computed in the
   test from axes and thicknesses, not by production helpers).
3. **Preview** (`wall-drawing`, scenario «Превью закрытого угла»): the preview wall appended to the scene closes the corner
   (the same displayed shape as the placed wall).
4. **Edit integration**: `moveWalls` / `moveEndpointBounded` / `resizeWallBounded` keep the displayed corner consistent when the
   resulting pair satisfies the joint conditions; wall data (axes, thickness, order) is never changed by display or snap.

Coordinates in cm, zoom 1 (snap radius 6 cm), grid step 10, existing test utils (`W`, `expectPoint`, `maxOverlap`,
`deepFreeze` from `src/wall-snap.test-utils.ts`). New files: `src/wall-snap-diagonal.test.ts`,
`src/wall-geometry-diagonal-corner.test.ts`. Reference scene `A`: wall (−100,0)→(0,0), thickness 20, free end at x = 0.

## Requirements Coverage

| Requirement | Scenario | Test ID |
|---|---|---|
| wall-drawing: Диагональное прилипание | Прилипание к углу свободного торца | DS-1 |
| wall-drawing: Диагональное прилипание | Второй угол торца | DS-2 |
| wall-drawing: Диагональное прилипание | Разная толщина (new 40 on 20) | DS-3 |
| wall-drawing: Диагональное прилипание | Разная толщина (new 20 on 40, reverse) | DS-4 |
| wall-drawing: Диагональное прилипание | Вершина не зависит от направления | DS-5 |
| wall-drawing: Диагональное прилипание | Полоса за торцом — продолжение | DS-6 |
| wall-drawing: Диагональное прилипание | Курсор у грани не за торцом — грань заподлицо | DS-7 |
| wall-drawing: Диагональное прилипание | Закрытый торец | DS-8 |
| wall-drawing: Диагональное прилипание | Квадрат налагался бы на тело | DS-9 |
| wall-drawing: Диагональное прилипание | Угол стыка двух стен | DS-10 |
| wall-drawing: Диагональное прилипание | Далеко от угла | DS-11 |
| wall-drawing: Диагональное прилипание | Проём | DS-12 |
| wall-drawing: Диагональное прилипание | Превью закрытого угла | DS-13, DJ-13 |
| wall-drawing: Диагональное прилипание (start only) | Для второй вершины действуют прежние правила | DS-14 |
| wall-drawing: Диагональное прилипание (both ends of a wall) | Торец `a` (not only `b`), стена в любой ориентации | DS-15, DS-16 |
| wall-drawing: Привязка (MODIFIED) | Наружный угол — нет прилипания углом к углу (L from two walls) | DS-10 |
| wall-drawing: Привязка (MODIFIED) | Прежние прилипания (face flush, cap collinear, T) без изменений | DS-6, DS-7, DS-17 |
| wall-joints: Диагональный угловой стык | Угол закрыт | DJ-1 |
| wall-joints: Диагональный угловой стык | Разная толщина | DJ-2 |
| wall-joints: Диагональный угловой стык | Блок у поздней стены | DJ-3, DJ-4 |
| wall-joints: Диагональный угловой стык | Разные материалы | DJ-5 |
| wall-joints: Диагональный угловой стык | Непрямой угол | DJ-6 |
| wall-joints: Диагональный угловой стык | Параллельные стены на диагонали | DJ-7 |
| wall-joints: Диагональный угловой стык | Стена идёт к грани соседа | DJ-8 |
| wall-joints: Диагональный угловой стык | Другой конец в пороге | DJ-9 |
| wall-joints: Диагональный угловой стык | Сдвиг в пределах допуска / за допуском | DJ-10, DJ-11 |
| wall-joints: Диагональный угловой стык | Правка стены | DJ-12 |
| wall-joints: Диагональный угловой стык | Установка стены по диагональному прилипанию | DJ-14 |
| wall-joints: Оси и длины не меняются (existing) | Данные не изменяются | DJ-15 |

## Boundary Cases

| Case | Input | Expected |
|---|---|---|
| Quadrant edge, cap plane | cursor at `x = 0` exactly (on the cap plane), `y = 14` | not diagonal: face flush with the end (DS-7) |
| Quadrant edge, cap plane +ε | cursor `x = +0.01`, `y = 14` | diagonal (vertex (10,10)) |
| Quadrant edge, face line | cursor `x = 6`, `y = 10` exactly (on the face line) | not diagonal (cursor in the strip; cap continuation DS-6) |
| Quadrant edge, face line +ε | cursor `x = 6`, `y = 10.01` | diagonal |
| Zone limit on each axis | cursor at `K + (reach, 0⁺)` and `K + (0⁺, reach)`; reach = max(6, newHalf) | diagonal (both interpretations of "distance" agree on these points) |
| Zone limit exceeded | the same points at `reach + 0.5` | no diagonal |
| Zone depends on new thickness | new thickness 40 (reach 20): cursor at `K + (15, 0⁺)` | diagonal; with thickness 20 (reach 10) the same cursor is not |
| Zoom | zoom 0.25 (radius 24 cm > newHalf) cursor at `K + (20, 0⁺)` | diagonal (zone = radius, not newHalf) |
| Joint distance tolerance | `B` start shifted along A's axis by 0.18 cm / 0.99 cm / 1.5 cm from `S` | closed / closed / not closed (margin 1 cm) |
| Joint right angle | B turned by 0.3° / 1° | closed / not closed (RIGHT_SIN 0.5°) |
| Joint ends too close | B start at distance < half of the max thickness from A's end | not a diagonal joint (vertex rules) |
| Zero-length wall | A degenerate (a = b) next to a candidate B | no crash, no snap, no fill |

## Negative Cases

| Case | Expected behavior |
|---|---|
| Cap closed by another wall (T-abutment on the cap) | no diagonal candidate (DS-8) |
| Square of the diagonal candidate would overlap another body | candidate rejected, the other rules decide (DS-9) |
| Vertex would violate a doorway | candidate rejected (DS-12) |
| Corner of two joined walls (L, outer corner) | no diagonal target, existing behavior (DS-10) |
| Concave inner corner | no diagonal target |
| Cursor far from the corner | no diagonal, grid snap (DS-11) |
| Cursor inside the strip behind the cap | collinear cap continuation, not diagonal (DS-6) |
| Second vertex of a gesture, ray snap | no diagonal target (DS-14) |
| Parallel pair at diagonal distance | no fill (DJ-7) |
| B goes toward A's axis from `S` | no fill, existing joint rules (DJ-8) |
| Non-right angle | no fill (DJ-6) |
| A third end near either end | no fill (DJ-9) |
| Pair drifts beyond tolerance | no fill, no crash, data valid (DJ-11) |
| Walls in any array order / with unrelated walls | no exception thrown |

## Invariants

- INV-1: wall data (`a`, `b`, `thicknessCm`, `type`, `id`, order) is identical before and after display/snap calls
  (`deepFreeze` inputs) — DS-*, DJ-15.
- INV-2: the placement square from a diagonal snap touches the body of A only at the corner point `K` (intersection area 0,
  one common point) and does not overlap any body (`maxOverlap = 0`) — DS-1…4.
- INV-3: `|S − E| = sqrt(h₁² + h₂²)` and `S` lies on the face line of A, `hN` beyond the cap plane — DS-1…4, DS-16.
- INV-4: closed corner = the union of the displayed polygons of A and B equals the union of two rectangles plus the
  block; no hole inside the corner, no notch outside (area of union equals expected area) — DJ-1, DJ-2.
- INV-5: bodies of A and B plus block do not overlap with each other in area (earlier wall wins in overlaps) — DJ-1, DJ-3.
- INV-6: the union of displayed areas is independent of the array order; only ownership differs — DJ-3, DJ-4.
- INV-7: the preview (scene + preview wall) and the placed wall give the same displayed polygons for the pair — DJ-13.
- INV-8: orientation independence — the same geometry rotated by 90°/180°/270° (and mirrored) gives the rotated result
  (guards against axis-specific implementations) — DS-15, DJ-1.
- INV-9: construction never throws for any wall configuration containing the pair — DJ-9, DJ-11.

## Integration Cases

- IC-1 (DS-13, DJ-14): `chainSegment` from a diagonal start with perpendicular direction (ortho on) gives a segment whose
  start is `S`; with a typed length 504 the end is `S + (0, 504)` — length counted from the face line of A. Chain-end
  square (`chainEndSquare`) of the segment is unchanged.
- IC-2 (DJ-12): `resizeWallBounded(B, newLength)` and `moveEndpointBounded(A, far end)` leave a pair that still satisfies the
  conditions with a closed corner (block follows the ends); axes of the neighbour unchanged.
- IC-3 (DJ-12): `moveWalls` of the whole pair by a vector keeps the corner closed (translation invariance).
- IC-4: `wallClickAction` on a point inside the block selects the owner wall (later wall); on a point just outside the
  corner outline it does not select (hit-testing follows `displayPolygons`).
- IC-5 (DJ-3): deleting the later wall removes the block (displayed polygons of the earlier wall equal its plain
  rectangle); deleting the earlier wall leaves the block with the later wall's own shape unchanged.
- IC-6 (DJ-1): after the fill, snap targets are computed on the new contour: the cursor on the outer face next to the
  filled block snaps to the long outer face (no gap), not to the stale cap.

## Mutation Targets

Implementations that could pass superficially and must be caught:

- M1: vertex placed at the square center `K + (out + n)·newHalf` instead of the face-line midpoint `K + out·newHalf` (DS-1, DS-3 distances, IC-1 length).
- M2: vertex `hN` replaced by `hA`/`hW` (existing wall's half) — only distinguishable with different thicknesses (DS-3, DS-4, DJ-2).
- M3: square placed against the cap (collinear) or flush with the end instead of diagonal (DS-1 square coordinates, INV-2).
- M4: only the `b` end or only one of the two corners supported (DS-2, DS-15, DS-16).
- M5: quadrant condition `>=` instead of `>` on the cap plane / face line (boundary rows).
- M6: zone uses `radius` only, ignoring `newHalf` (or vice versa) (zoom/thickness boundary rows).
- M7: diagonal not applied before face candidate (priority) — face-flush candidate wins in the quadrant (DS-1).
- M8: `freeCap` check removed (DS-8); overlap/doorway acceptor bypassed (DS-9, DS-12).
- M9: corner proposed for L outer corner / concave corner (DS-10).
- M10: joint rule fires for parallel pairs or any pair at diagonal distance without the crossing-point test (DJ-7, DJ-8).
- M11: right-angle condition removed or widened (DJ-6; 0.3° vs 1°).
- M12: "no other ends" condition removed (DJ-9).
- M13: tolerance margin 1 cm removed/changed (DJ-10, DJ-11).
- M14: block always owned by A (the first/earlier) or always by B (DJ-3 vs DJ-4 with both orders).
- M15: block extends only one of the two extensions (A's cap by `2hB` but not the full height `2hA`, or wrong direction) — union-area equality (INV-4).
- M16: fill changes stored wall data (INV-1) or the earlier wall's polygons outside the block.
- M17: preview does not use the same classification as the placed wall (DJ-13).
- M18: ownership via deletion/hit-test not following `displayPolygons` (IC-4, IC-5).

## Out of Scope

- Diagonal snap for the second vertex / `snapOnRay`; non-right angles; corners of already joined walls (design Non-Goals).
- Canvas pixel rendering and hatch drawing (covered by display-polygon ownership); DOM wiring in `src/main.ts` (manual check, recorded in TODO.md if left).
- Mutation tooling: the project has none configured (`package.json`); the validator probes mutants by hand (M1–M18).

## Addendum after validation round 1

Spec clarified: joint tolerance is 1 cm per distance (E→I, S→I), both directions; snap zone is per axis, boundary included.
Added to the plan (all implemented in `test-suite.md`, marked R1):

| Case | Input | Expected | Test ID |
|---|---|---|---|
| Wrong decomposition (V1) | B perpendicular at `|S−E| = √200` but `S = (5, ±√175)` or `(√175, 5)` | no fill; shape = two plain rectangles | DJ-18 |
| Tolerance, all directions (V2) | B shifted by 0.18 / 0.99 along A, along B, both axes, ± | closed | DJ-10 |
| Tolerance exceeded (V2) | shifts 1.01 / 1.5 along A or B, ± | not closed, no throw | DJ-11 |
| Third end near A only (V3) | c ends at (−5,−5) or (0,−12), 6 orders | no fill, no throw | DJ-9c |
| Contour with A owning the block (V6) | order B, A; same and different materials | outer edges of block in A's contour; seam rules | DJ-5c, DJ-5d |
| Owner outline (V6) | order A, B, different materials | block edges in B's contour, no inner seam | DJ-5 |
| Grid fallback outside zone (Z2) | cursor (14, 14), (4, 24), (14, −14), reversed wall | no corner | DS-B8 |
| Zone +0.5 cm (Z1) | t20: (10.5, 10.01), (0.01, 20.5); t40: (20.5, …); zoom 0.25: (24.5, …) | no corner; inside points corner | DS-B7 |
| Zone shape (Z3) | cursor (8, 18) | corner | DS-B9 |
| Deletion (IC-5) | `deleteObjects` of A or B, both orders | block gone with its owner; control that it was closed | IC-5 |

## Addendum after validation round 2

| Case | Input | Expected | Test ID |
|---|---|---|---|
| Joined L next to a free cap (F1) | cursors (−6, −14), (−14, −6) in the zone of the L's outer corner; control: the same cursors next to a single free-cap wall | corner for the single wall, none for the L | DS-10 |
| Zone across the wall at zoom 0.25 (S1) | A t20, cursor (0.01, 25), (0.01, 34), (0.01, 34.5) | corner, corner (inclusive 24), none | DS-B10 |
| Start reference of a corner snap (S2) | `startRefOf(cornerSnap)`, ortho from the start toward a direction ≈8° from A | kind "face", normal (0, 1), angle 90°, direction not pulled to the tangent | DS-13, DS-13b, DJ-14 |
| Non-90° orientation (S3) | scene rotated by 30°, 60°, 135° | same result rotated, snap and joint | DS-15, DJ-16 |
| Exact 1.00 cm (S4) | B shifted by ±1.00 along A or along B | closed (inclusive) | DJ-10 |
| Third end 12 cm from S (S5) | c ends at (22, 10) or (10, 22), 6 orders | no fill | DJ-9d |

## Addendum after validation round 3

| Case | Input | Expected | Test ID |
|---|---|---|---|
| Zone in the wall frame (S3c) | each orientation incl. 30°/60°/135°: local cursor (9.5, 19.5) / (10.5, 10.5) / (0.5, 20.5) | corner / none / none | DS-15 |
| Tolerance in the wall frame | rot30, rot60: B shifted 0.99 (closed) and 1.01 (open) along A or B | closed / open | DJ-16b |
| Move of one wall (was DJ-12b) | `moveWalls` of A alone slants B (not a right angle) | no assertion of a closed corner; row removed. Unspecified follow behavior → TODO.md | — |

## Addendum after test change request 1 (round 5)

Zone semantics changed (user decision): diagonal only in the far part of the quadrant — both offsets from the corner within [Z/2, Z], boundaries inclusive,
Z = max(snap radius, new half-thickness). Near part keeps the flush-face snap pinned by existing tests SNAP-END-3, CV-BAND-1, SNAP-SCALE-1/2/3.

| Case | Input (wall (−100,0)→(0,0), t20, zoom 1 unless noted; K = (0, 10)) | Expected | Test |
|---|---|---|---|
| Near part keeps old behavior | (4, 14), (4.99, 18), (8, 14.99); zoom 0.25: (4, 14) | face flush, vertex (−10, 10) | DS-B1 |
| Half-zone boundary | (5, 18), (8, 15) / (4.99, 18), (8, 14.99) | corner / face | DS-B2 |
| Half-zone with other thickness / zoom | t40: (10, 25) corner, (9.9, 25) and (15, 19.9) not; zoom 0.25: (12, 30), (20, 22) corner, (11.9, 30), (20, 21.9) not | as listed | DS-B7, DS-B8 |
| Orientation | half-zone and zone probes in 9 orientations | same, in the wall frame | DS-15 |
| Mutants | M19: half-zone threshold dropped (corner from offset 0) — killed by DS-B1…B4; M20: threshold on one axis only — DS-B2; M21: threshold exclusive — DS-B2; M22: threshold fixed 5 cm instead of Z/2 — DS-B7, DS-B8 | | |