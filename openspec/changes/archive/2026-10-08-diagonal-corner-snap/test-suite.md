# Test Suite

Run: `npx vitest run src/wall-snap-diagonal.test.ts src/wall-geometry-diagonal-corner.test.ts`
Round 5 (after `test-change-request.md`): 60 tests discovered. Against the implementation as it stood when the request was raised (diagonal from offset 0, no half-zone), 7 fail — exactly the new near-part / half-zone tests of the R5 section — and 53 pass. The counts below (59 tests, 40 fail, 19 pass) describe the state before any implementation, after validation round 2, and are kept for history. Full suite: all other
files pass, only the two new files fail. Round 1 verdict was FAIL (V1, V2, V3, V6, Z1, Z2, IC-5 — see `test-validation.md`);
round 1 additions are marked **R1** (with a spec clarification: tolerance per distance, zone per axis); round 3 (FAIL: DJ-12b contradicted the spec and the existing move code, DJ-16 exceeded the vitest timeout, a world-axis zone survived — fixed: DJ-12b removed, shapes precomputed per scene and a ±125 box, rotated-frame probes DS-15 / DJ-16b; marked **R3**); round 2 (also FAIL: DS-10 passed for the wrong reason, no zoom-0.25 across-axis probe, `startRefOf` mapping unpinned, only 90° orientations, no exact ±1.00 cm, no third end in the ring around S) additions are marked **R2**. `tsc --noEmit` reports nothing for the new files (the corner target is compared as a
`string`, so the tests type-check before `"corner"` exists). No production code, spec, design or existing test was changed.

Contract the tests rely on (from spec/design, to be provided by the implementation):
- `snapStartVertex(...)` returns `target === "corner"`, `normal` = outward face normal, `point` = vertex `S`; the square is
  `placementSquare(snap, size)` (design D1: `base = point`);
- the corner target is offered for the **first** vertex only (`snapStartVertex`); `chainSegment` (second vertex, free and ortho ray) does not offer it;
- `startRefOf(snap)` returns a non-null reference for a corner snap whose ortho direction is the face normal (spec «Угол к стене примыкания»; not stated in design D5 — see Notes);
- `displayPolygons` / `contourSegments` / `wallClickAction` / `moveWalls` / `resizeWallBounded` / `moveEndpointBounded` are the observable API of the joint.

## Tests

### `src/wall-snap-diagonal.test.ts` (requirement: wall-drawing «Диагональное прилипание к углу свободного торца», MODIFIED «Привязка к существующим стенам»)

| ID | Requirement | Test File | Test Name | Initial Result |
|---|---|---|---|---|
| DS-1 | wall-drawing: диагональное прилипание — scenario «Прилипание к углу свободного торца»; INV-2, INV-3 | src/wall-snap-diagonal.test.ts | DS-1: курсор за торцом и за гранью — квадрат касается угла торца, вершина на линии грани | FAIL (target is "face") |
| DS-2 | «Второй угол торца» | src/wall-snap-diagonal.test.ts | DS-2: второй угол торца — со стороны y < 0 | FAIL |
| DS-3 | «Разная толщина» (new 40 on 20) | src/wall-snap-diagonal.test.ts | DS-3: новая стена толще — вершина на hN = 20 за торцом, расстояние √(10² + 20²) | FAIL |
| DS-4 | «Разная толщина» (existing 40, new 20) | src/wall-snap-diagonal.test.ts | DS-4: существующая стена толще — грань на y = 20, вершина (10, 20), расстояние √(20² + 10²) | FAIL |
| DS-5 | «Вершина не зависит от направления» (pre-click: independent of cursor position in quadrant) | src/wall-snap-diagonal.test.ts | DS-5: вершина не зависит от положения курсора внутри квадранта за углом | FAIL |
| DS-6 | «Полоса за торцом — продолжение»; MODIFIED (cap continuation unchanged) | src/wall-snap-diagonal.test.ts | DS-6: полоса стены за торцом — коллинеарное продолжение, а не диагональ | PASS (regression guard) |
| DS-7 | «Курсор у грани не за торцом — грань заподлицо»; MODIFIED | src/wall-snap-diagonal.test.ts | DS-7: курсор у грани не за плоскостью торца — грань заподлицо с торцом, как прежде | PASS (regression guard) |
| DS-8 | «Закрытый торец» | src/wall-snap-diagonal.test.ts | DS-8: торец закрыт телом другой стены — диагонали нет | PASS (negative guard) |
| DS-9 | «Квадрат налагался бы на тело» (control: corner without blocker) | src/wall-snap-diagonal.test.ts | DS-9: квадрат налагался бы на тело другой стены — диагонали нет | FAIL (control assertion: corner not offered yet) |
| DS-10 | «Угол стыка двух стен» + inner corner; MODIFIED scenario «Наружный угол — нет прилипания углом к углу» | src/wall-snap-diagonal.test.ts | DS-10: наружный угол L из двух стен и внутренний угол — не цели диагонального прилипания | FAIL (control: the same cursors next to a single free cap must offer the corner; **R2** — before, the cursor was outside every zone and the test passed for the wrong reason) |
| DS-11 | «Далеко от угла» | src/wall-snap-diagonal.test.ts | DS-11: далеко от угла прилипания нет — сетка | PASS (negative guard) |
| DS-12 | «Проём» (control: corner offered without doorway) | src/wall-snap-diagonal.test.ts | DS-12: вершина нарушила бы проём — диагонали нет | FAIL (control assertion) |
| DS-13 | «Превью закрытого угла» (start ref, ortho direction, typed length from the face line) | src/wall-snap-diagonal.test.ts | DS-13: превью — от диагонального начала перпендикулярно стене, длина откладывается от линии грани | FAIL (**R2**: also pins `startRefOf` → kind "face", normal (0, 1), angle 90°) |
| DS-14 | «для второй вершины действуют прежние правила» | src/wall-snap-diagonal.test.ts | DS-14: для второй вершины цепочки диагонали нет (прежние правила) | PASS (negative guard) |
| DS-15 | orientation independence (INV-8): 4 rotations + 2 mirrors; **R2**: also 30°, 60°, 135°; **R3**: in every orientation the zone is probed in the wall frame (local (9.5, 19.5) corner; (10.5, 10.5) and (0.5, 20.5) not) | src/wall-snap-diagonal.test.ts | DS-15: независимо от ориентации сцены — повороты и зеркала | FAIL |
| DS-16 | free end is `a` (wall drawn in reverse), both corners | src/wall-snap-diagonal.test.ts | DS-16: свободный торец — начало a стены (стена задана в обратном направлении) | FAIL |
| DS-17 | MODIFIED: T / face snapping unchanged | src/wall-snap-diagonal.test.ts | DS-17: T-прилипание к середине грани не меняется | PASS (regression guard) |
| DS-18 | degenerate wall ignored (control: corner still offered next to it) | src/wall-snap-diagonal.test.ts | DS-18: нулевая стена рядом не мешает и не даёт диагонали сама | FAIL (control assertion) |
| INV-1 | inputs not mutated (frozen walls/doorways) | src/wall-snap-diagonal.test.ts | INV-1: входные стены и проёмы не изменяются | PASS (guard) |
| DS-B1 | boundary: cap plane `x = 0` vs `x = 0.01` | src/wall-snap-diagonal.test.ts | на плоскости торца x = 0 — не диагональ, грань заподлицо; чуть за плоскостью — диагональ | FAIL |
| DS-B2 | boundary: face line `y = 10` vs `y = 10.01` | src/wall-snap-diagonal.test.ts | на линии грани y = 10 — полоса, продолжение; чуть за гранью — диагональ | FAIL |
| DS-B3 | boundary: zone limit `reach = max(6, 10) = 10`, inclusive, per axis | src/wall-snap-diagonal.test.ts | граница зоны по каждой оси: reach = max(радиус 6, полутолщина 10) = 10 включительно | FAIL |
| DS-B4 | boundary: beyond the zone on each axis → grid | src/wall-snap-diagonal.test.ts | за границей зоны на каждой оси диагонали нет — сетка | PASS (negative guard) |
| DS-B5 | zone depends on new thickness (40 vs 20) | src/wall-snap-diagonal.test.ts | зона зависит от толщины новой стены: 15 см от торца — диагональ при 40 см и сетка при 20 см | FAIL |
| DS-B6 | zone depends on zoom (radius 24 > newHalf) | src/wall-snap-diagonal.test.ts | зона зависит от масштаба: при zoom 0.25 радиус 24 см шире полутолщины | FAIL |

### `src/wall-geometry-diagonal-corner.test.ts` (requirement: wall-joints «Диагональный угловой стык»)

| ID | Requirement | Test File | Test Name | Initial Result |
|---|---|---|---|---|
| DJ-1 | wall-joints: «Угол закрыт»; INV-4, INV-5 | src/wall-geometry-diagonal-corner.test.ts | DJ-1: угол закрыт — нет выемки снаружи и просвета внутри, наружный угол (20, −10) | FAIL |
| DJ-2 | «Разная толщина» (B thicker) | src/wall-geometry-diagonal-corner.test.ts | DJ-2: разная толщина — B толще: блок x ∈ [0, 40], y ∈ [−10, 10] | FAIL |
| DJ-2b | «Разная толщина» (A thicker) | src/wall-geometry-diagonal-corner.test.ts | DJ-2b: разная толщина — A толще: блок x ∈ [0, 20], y ∈ [−20, 20] | FAIL |
| DJ-3 / DJ-4 | «Блок у поздней стены»; INV-6 (both orders) | src/wall-geometry-diagonal-corner.test.ts | DJ-3: блок принадлежит поздней стене B; объединение то же в обратном порядке (DJ-4) | FAIL |
| DJ-5 | «Разные материалы»; **R1** also asserts the owner B's own outline (block left/top/right edges, no inner seam) | src/wall-geometry-diagonal-corner.test.ts | DJ-5: разные материалы — блок штрихуется материалом поздней, шов с торцом ранней — прямая линия | FAIL |
| DJ-5b | continuity of contour, same material (seam hidden, outer face continuous) | src/wall-geometry-diagonal-corner.test.ts | DJ-5b: один материал — шов не рисуется, граница тела и блока внутри стены B не входит в контур | FAIL |
| DJ-5c | **R1** (V6) contour when A later owns the block, same material | src/wall-geometry-diagonal-corner.test.ts | DJ-5c: порядок B, A (блок у поздней A), один материал — шов скрыт, внешний контур непрерывен | FAIL |
| DJ-5d | **R1** (V6) contour when A later owns the block, different materials (seam visible) | src/wall-geometry-diagonal-corner.test.ts | DJ-5d: порядок B, A, разные материалы — шов блока и тела B прямая линия, блок в контуре A | FAIL |
| DJ-9c | **R1** (V3) third end near A's end only, 2 variants × 6 orders, frozen | src/wall-geometry-diagonal-corner.test.ts | DJ-9c: третий конец только у конца A (не в пороге S) — блок не заливается, любой порядок | PASS (negative guard) |
| DJ-18 | **R1** (V1) perpendicular pair at diagonal distance with another decomposition (3 variants, full-shape comparison) | src/wall-geometry-diagonal-corner.test.ts | DJ-18: перпендикулярная пара на диагональном расстоянии, но с другим разложением — не угол, блок не заливается | PASS (negative guard) |
| DS-B7 | **R1** (Z1) zone +0.5 cm outside / inside, thickness 20/40, zoom 1/0.25, both axes | src/wall-snap-diagonal.test.ts | DS-B7: сразу за границей зоны (+0.5 см) диагонали нет — по обеим осям, при любой толщине и масштабе | FAIL (inside half) |
| DS-B8 | **R1** (Z2) cursor outside the zone, grid square touches the wall (touched-grid fallback), 4 variants | src/wall-snap-diagonal.test.ts | DS-B8: курсор вне зоны, но квадрат по сетке касается стены — диагонали нет (прилипание к стене по прежним правилам) | PASS (negative guard) |
| DS-B9 | **R1** (Z3) zone shape: 8 cm on both axes is inside (per-axis) | src/wall-snap-diagonal.test.ts | DS-B9: форма зоны — по каждой оси от угла (по спецификации), а не по евклидову расстоянию | FAIL |
| DS-13b | **R2** (S2) ortho from a corner start does not snap to the tangent (guards `startRefOf` mapping corner → cap) | src/wall-snap-diagonal.test.ts | DS-13b: от диагонального начала орто не притягивает к оси стены (как у торца), только перпендикуляр | PASS (guard: today's face snap has the same reference; kills the corner→cap mutation) |
| DS-B10 | **R2** (S1) zone across the wall depends on zoom: 15 and 24.0 cm in, 24.5 out at zoom 0.25 | src/wall-snap-diagonal.test.ts | DS-B10: зона поперёк стены тоже зависит от масштаба: при zoom 0.25 — 24 см включительно | FAIL |
| DJ-9d | **R2** (S5) third end 12 cm from S (ring between vertex tolerance and corner threshold), far from E, 2 variants × 6 orders | src/wall-geometry-diagonal-corner.test.ts | DJ-9d: третий конец в 12 см от S (в пороге у конца B), далеко от E — блок не заливается, любой порядок | PASS (negative guard) |
| DJ-6 | «Непрямой угол» (45°, ±1° no fill; ±0.3° fill) | src/wall-geometry-diagonal-corner.test.ts | DJ-6: непрямой угол (45°, 1°) — блок не заливается; в пределах допуска (0.3°) — заливается | FAIL (0.3° half) |
| DJ-7 | «Параллельные стены на диагонали» | src/wall-geometry-diagonal-corner.test.ts | DJ-7: параллельные стены на диагонали — блок не заливается | PASS (negative guard) |
| DJ-8 | «Стена идёт к грани соседа» | src/wall-geometry-diagonal-corner.test.ts | DJ-8: стена идёт от начала к оси A — заливки нет, области как у двух прямоугольников | PASS (negative guard) |
| DJ-9 | «Другой конец в пороге»; INV-9 (all 6 array orders, frozen) | src/wall-geometry-diagonal-corner.test.ts | DJ-9: третий конец в пороге — блок не заливается, построение не падает при любом порядке | PASS (negative guard) |
| DJ-10 | «Сдвиг в пределах допуска»; **R1/R2**: 0.18/0.99/1.00 cm (inclusive) along A, along B, both axes, both directions (15 shifts) | src/wall-geometry-diagonal-corner.test.ts | DJ-10: смещение до 1.00 см включительно вдоль оси A, вдоль оси B и по обеим осям, в обе стороны — стык остаётся диагональным | FAIL |
| DJ-11 | «Смещение за допуском»; **R1**: 1.01/1.5 cm along A and along B, both directions (8 shifts), no crash | src/wall-geometry-diagonal-corner.test.ts | DJ-11: смещение 1.01 см и больше за допуском в любую сторону — блок не заливается, построение завершается | PASS (negative guard) |
| DJ-12a | «Правка стены» — move both | src/wall-geometry-diagonal-corner.test.ts | DJ-12a: перенос обеих стен вместе — угол остаётся закрытым | FAIL |
| DJ-12c | «Правка стены» — typed length of B | src/wall-geometry-diagonal-corner.test.ts | DJ-12c: ввод длины B (100 → 150) — блок на месте, ось соседней стены прежняя | FAIL |
| DJ-12d | «Правка стены» — stretch A's far end | src/wall-geometry-diagonal-corner.test.ts | DJ-12d: растяжение A за дальний конец вдоль оси — блок на месте | FAIL |
| DJ-13 | wall-drawing «Превью закрытого угла»; INV-7 | src/wall-geometry-diagonal-corner.test.ts | DJ-13: превью (стена вне массива) показывает тот же закрытый угол, что установленная стена | PASS (consistency guard, see Unexpected Passes) |
| DJ-14 | «Установка стены по диагональному прилипанию» (snap → chain → closed corner) | src/wall-geometry-diagonal-corner.test.ts | DJ-14: прилипание → сегмент по орто → установка даёт закрытый угол без вспомогательной стены | FAIL |
| DJ-15 | «Оси и длины не меняются»; INV-1 | src/wall-geometry-diagonal-corner.test.ts | DJ-15 / INV-1: данные стен не меняются отображением и выбором | PASS (guard) |
| IC-4 | ownership: hit-testing follows the owner | src/wall-geometry-diagonal-corner.test.ts | IC-4: клик в блоке выделяет владельца блока — позднюю стену; вне контура угла — рисует | FAIL |
| IC-5 | ownership: deletion via `deleteObjects` (**R1**: real deletion path; control that the corner is closed before deleting; both orders, both victims) | src/wall-geometry-diagonal-corner.test.ts | IC-5: удаление стены штатным путём — блок удаляется вместе с владельцем, форма другой стены прежняя | FAIL (control) |
| IC-6 | snap targets use the contour with the block | src/wall-geometry-diagonal-corner.test.ts | IC-6: цели прилипания считаются по контуру с блоком — наружная грань идёт до края блока | FAIL |
| DJ-16 | INV-8: rotations/mirrors; **R2**: also 30° and 60° (reference rotated polygons) | src/wall-geometry-diagonal-corner.test.ts | DJ-16: тот же угол, повёрнутый (в том числе на 30° и 60°) и отражённый, закрыт так же | FAIL |
| DJ-16b | **R3** joint tolerance in the wall frame: rot30/rot60, shifts 0.99 closed, 1.01 not | src/wall-geometry-diagonal-corner.test.ts | DJ-16b: допуск 1 см считается в системе стены, а не по осям мира — при повороте на 30° и 60° | FAIL (closed half) |
| DJ-17 | walls drawn in reverse (ends a/b swapped) | src/wall-geometry-diagonal-corner.test.ts | DJ-17: стены заданы в обратном направлении (концы a/b поменяны) — угол закрыт | FAIL |

## Coverage

### Happy paths

- DS-1…DS-5, DS-15, DS-16 (snap, both corners, both thickness orderings, orientation, end `a`); DJ-1, DJ-2, DJ-2b, DJ-3, DJ-14, DJ-16, DJ-17 (closed corner).

### Boundary cases

- DS-B1…DS-B6 (cap plane, face line, zone per axis, thickness- and zoom-dependent zone); DJ-6 (0.3° vs 1°), DJ-10/DJ-11 (0.18, 0.99 vs 1.5 cm).

### Negative cases

- DS-6, DS-7, DS-8, DS-9, DS-10, DS-11, DS-12, DS-14, DS-17, DS-18, DS-B4; DJ-6 (45°, 1°), DJ-7, DJ-8, DJ-9, DJ-11.

### Invariants

- INV-1 (frozen inputs: DS `INV-1`, DJ-15); INV-2/INV-3 (square overlap and distance in DS-1…4, DS-16); INV-4 closed-corner area equality and INV-5 no overlap (DJ-1, DJ-2, DJ-2b, DJ-3, DJ-16); INV-6 order independence (DJ-3); INV-7 preview = placed (DJ-13); INV-8 orientation (DS-15, DJ-16, DJ-17); INV-9 no throw for all array orders (DJ-9, DJ-11).

### Integration cases

- DS-13 and DJ-14 (`snapStartVertex` → `startRefOf` → `chainSegment` → displayed corner); DJ-12a, DJ-12c, DJ-12d (`moveWalls`, `resizeWallBounded`, `moveEndpointBounded`); IC-4 (`wallClickAction`), IC-5 (removal), IC-6 (snap on the new contour).

## Unexpected Passes

- 19 tests pass before implementation. They are regression guards or negative cases whose current behavior must be kept
  (DS-6, DS-7, DS-8, DS-11, DS-13b, DS-14, DS-17, INV-1, DS-B4, DS-B8, DJ-7, DJ-8, DJ-9, DJ-9c, DJ-9d, DJ-11, DJ-15, DJ-18) — expected, no new
  behavior is asserted by them alone — and DJ-13:
  - **DJ-13** passes because before the change both the preview and the placed wall omit the block, so they agree. It guards INV-7
    after implementation (preview must equal placed); the actual fill is asserted by DJ-1/DJ-14.
- DS-9, DS-12, DS-18 fail before implementation only through their control assertion (the corner is not offered even without the
  blocker); their negative half is only meaningful after the control passes.

## Tests That Could Not Run

- None. All 59 tests are discovered and run.

## Notes and gaps (for the validator)

- **Not covered / not derivable from spec without a baseline:** the plan's row «Joint ends too close» (end within the vertex
  tolerance, e.g. B at (3, 3)): the existing vertex-joint rules already change that area, so a correct expectation can't be derived from
  the new spec; the draft test (DJ-9b) was removed. Zero-length wall next to a joint pair is covered for the snap (DS-18) but not for
  `displayPolygons`.
- **Contract assumption beyond the spec text:** DS-13 / DJ-14 require `startRefOf(cornerSnap)` to be non-null and to yield the face
  normal as the ortho direction. Design D5 says «no new direction rule», but today `StartRef.kind` is `"face" | "cap"` and `startRefOf`
  returns `kind: snap.target`; a `"corner"` target must be mapped to the face behavior. This is implied by spec «Угол к стене
  примыкания» and the scenario «Установка стены по диагональному прилипанию» (perpendicular from the face).
- **Contract assumption:** the corner target applies to `snapStartVertex` (first click) only; the tests assert nothing about
  `snapVertex` called directly.
- **Moves:** DJ-12b (move A alone) was removed in round 3: `moveWalls` of one wall moves only the neighbour's joined end, which slants B (~8.5°) and so the pair is no longer a right angle — no fill is expected, and the spec scenario «Правка стены» is covered by DJ-12a (move both), DJ-12c (typed length) and DJ-12d (stretch). Whether a diagonal pair should follow a moved neighbour as a rigid corner is not specified by this change (see TODO.md).
- Zone shape and joint tolerance are now fixed in the spec (round 1): zone per axis, boundary inclusive (DS-B3, DS-B7, DS-B9); joint tolerance
  1 cm per distance E→I / S→I, both directions (DJ-10, DJ-11). A test point on the Euclidean-only boundary is not used.
- Mutation tooling is not configured in the project; mutants M1–M18 of `test-plan.md` are for hand probing by the validator.

## R5 — test change request 1 (diagonal zone narrowed, 2026-10-08)

Why: implementing the snap broke five existing approved tests (SNAP-END-3, CV-BAND-1, SNAP-SCALE-1/2/3: cursor 4 cm past the end plane and 4 cm
outside the face must keep the flush-face snap). The user decided to keep that behavior; the diagonal snap now takes only the far part of the
quadrant: both offsets from the corner at least half the zone and at most the zone (zone = max(snap radius, new half-thickness), boundaries
inclusive). Details and the list of changed tests: `test-change-request.md`. Spec: `specs/wall-drawing/spec.md`.

Changed (cursor moved into the far part, expected vertex/normal/square unchanged): DS-1, DS-2, DS-3 (14, 24), DS-4 (8, 28), DS-5, DS-8, DS-9, DS-10
(single-wall controls (−8, −18) / (−18, −8) and the L negatives), DS-12, DS-13, DS-13b, DS-14, DS-15 (+ half-zone and zone probes in every orientation),
DS-16, DS-18, INV-1, and DJ-14 in `src/wall-geometry-diagonal-corner.test.ts`.

Replaced boundary tests (`src/wall-snap-diagonal.test.ts`, describe «DS: границы зоны и квадранта»; they supersede the DS-B1…DS-B10 rows above):

| ID | Requirement | Test Name | Result vs implementation at request time |
|---|---|---|---|
| DS-B1 | near part keeps the flush face (4, 14), (4.99, 18), (8, 14.99), zoom 0.25 (4, 14) | ближняя часть квадранта — прежняя грань заподлицо с торцом (как SNAP-END-3: 4 см от угла по каждой оси) | FAIL |
| DS-B2 | half-zone boundary inclusive on each axis | половина зоны включительно по каждой оси: 5 см — диагональ, 4.99 см — грань | FAIL |
| DS-B3 | cap plane x = 0 / 0.01 → flush face | на плоскости торца x = 0 и чуть за ней — грань заподлицо (ближняя часть) | FAIL |
| DS-B4 | strip edge: (6, 10) cap; (6, 10.01) flush face | на линии грани y = 10 — полоса, продолжение; чуть за гранью — грань заподлицо | FAIL |
| DS-B5 | zone limit inclusive per axis | граница зоны по каждой оси: Z = max(радиус 6, полутолщина 10) = 10 включительно | PASS |
| DS-B6 | beyond the zone → grid | за границей зоны на каждой оси диагонали нет — сетка | PASS |
| DS-B7 | zone and half-zone depend on new thickness | зона зависит от толщины новой стены: Z = 20, половина зоны 10 … | FAIL |
| DS-B8 | zone and half-zone depend on zoom (Z = 24, half 12) | зона зависит от масштаба: при zoom 0.25 радиус 24 см — Z = 24, половина зоны 12 см | FAIL |
| DS-B9 | +0.5 cm outside the zone, all axes/thickness/zoom; inside the same boundary | DS-B7: сразу за границей зоны (+0.5 см) диагонали нет … | PASS |
| DS-B10 | touched-grid fallback outside the zone (4 variants + far-part variants) | DS-B8: курсор вне зоны, но квадрат по сетке касается стены … | PASS |
| DS-B11 | zone shape per axis (8, 18) | DS-B9: форма зоны — по каждой оси от угла … | PASS |

Also failing against that implementation: DS-15 (the new half-zone probes in every orientation).