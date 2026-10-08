## 1. Snap target "corner" (`src/wall-snap.ts`, `src/wall-angle.ts`)

Spec: `wall-drawing` «Диагональное прилипание к углу свободного торца» (design D1).
Approved tests: `src/wall-snap-diagonal.test.ts` (DS-*, DS-B*, INV-1), DJ-14 in `src/wall-geometry-diagonal-corner.test.ts`.
Production code only; the approved tests must not be edited (CLAUDE.md Rule 5).

- [x] 1.1 Add `"corner"` to `SnapTarget` and map it in `startRefOf` (`src/wall-angle.ts`) to the `"face"` reference with the snap's normal, so ortho from a corner start offers only the perpendicular-from-face direction and the angle is measured to the face (DS-13, DS-13b, DJ-14).
- [x] 1.2 Add a corner candidate in `wall-snap.ts`: for a cursor outside the wall strip, beyond the cap plane of an end, on the side of a free cap (`freeCap`), in the far part of the quadrant — both offsets (`s − len` or `−s` along the wall, `|lat| − hW` across) between half the zone and the zone, zone = max(radius, newHalf), boundaries inclusive with the tolerance `SLICE`; nearer than half the zone the existing flush-face snap stays (test-change-request.md) — build `{ point = base = K + out·newHalf, normal = n·side, target: "corner" }` with `K = end + n·side·hW`. It goes through `acceptor` (overlap, doorways) and, when accepted, takes priority over the face candidate of the same wall in the far part; when rejected the existing rules apply (DS-1…DS-5, DS-8, DS-9, DS-12, DS-15, DS-16, DS-18 and the boundary tests of the describe «DS: границы зоны и квадранта»; existing SNAP-END-3, CV-BAND-1, SNAP-SCALE-1/2/3 stay green).
- [x] 1.3 Offer the corner for the first vertex only: `snapVertex` gets a `corners` parameter (default `true`, so `snapStartVertex` — base snap and touched-grid fallback — equals `snapVertex` as the existing GS-10 requires); `chainSegment` (second vertex) passes `false`, and `snapOnRay` has no corner candidates (DS-14). In the fallback the corner zone must stay the fixed zone, not the `Infinity` reach (DS-B8, DS-B7).
- [x] 1.4 Run `npx vitest run src/wall-snap-diagonal.test.ts` — all DS tests pass (the DJ-14 integration test passes after task 2.2).

## 2. Diagonal corner joint (`src/wall-geometry.ts`)

Spec: `wall-joints` «Диагональный угловой стык» (design D2, D3, D4).
Approved tests: `src/wall-geometry-diagonal-corner.test.ts` (DJ-*, IC-*).

- [x] 2.1 Add `diagonalCornerAt(wall, E, uIn, walls)` next to `faceCornerAt`: partner end `v` of a wall `c` such that the axes are perpendicular within `RIGHT_SIN`; the axes' crossing `I` lies beyond both ends (`E→I = s > 0`, `v→I = t > 0`) with `|s − hC| ≤ 1` and `|t − hW| ≤ 1` (1 cm inclusive, with an epsilon for floating point); the ends are farther apart than the vertex tolerance; and no other wall end lies within `√((hC+1)² + (hW+1)²)` of `E` or of `v` (own ends of each wall excluded; a second candidate partner counts as another end). Returns the partner and the block polygon: the flat end cap of `wall` extended outward by `c.thicknessCm`.
- [x] 2.2 In `displayPolygons`, after the face-corner handling, add the block as a piece of the later wall of the pair (`isLatest` for the preview, otherwise `iWall > walls.indexOf(c)`), only when `faceCornerAt` returned null for that end; keep the existing "later wall is not drawn inside bodies of earlier walls" subtraction applied to the block. Do not change wall data (DJ-1…DJ-5d, DJ-9c, DJ-9d, DJ-10, DJ-11, DJ-13, DJ-15, DJ-16, DJ-16b, DJ-17, DJ-18, IC-4, IC-5).
- [x] 2.3 Verify the negative cases keep their old display: parallel pair (DJ-7), wall going toward the neighbour (DJ-8), non-right angle (DJ-6), third end near either end (DJ-9, DJ-9c, DJ-9d), wrong decomposition (DJ-18).
- [x] 2.4 Run `npx vitest run src/wall-geometry-diagonal-corner.test.ts` — all DJ and IC tests pass.

## 3. Integration checks

- [x] 3.1 Check that contour, selection highlight, hit-testing, deletion and snapping on the contour need no code changes (they consume `displayPolygons`): IC-4, IC-5, IC-6, DJ-5, DJ-5b, DJ-5c, DJ-5d. If something needs a change, stop and surface it (added scope).
- [x] 3.2 Check edit behavior on a diagonal pair (DJ-12a, DJ-12c, DJ-12d: `moveWalls` of both walls, `resizeWallBounded`, `moveEndpointBounded`); no change to `geometry.ts` / `wall-edit.ts` is expected.
- [x] 3.3 Manual browser check (record the result in the final report): draw a wall, move the cursor to its end corner, click, draw down with ortho and a typed length; the corner closes without an auxiliary wall; the preview shows the closed corner; Esc and undo behave as usual.

## 4. Verification

- [x] 4.1 Approved tests: `npx vitest run src/wall-snap-diagonal.test.ts src/wall-geometry-diagonal-corner.test.ts` — all 59 pass, test files unchanged (`git diff` shows no edits to them after approval).
- [x] 4.2 Full suite: `npx vitest run` — no regressions (a pre-existing intermittent "Worker exited unexpectedly" is recorded in TODO.md; re-run if it appears and report it).
- [x] 4.3 Type check and build: `npx tsc --noEmit -p .` and `npm run build`. The project has no formatter or linter configured; report that instead of inventing one.
- [x] 4.4 Mutation testing: not configured in the project; the validator's hand-built mutants (M1–M18 and the round 3–4 ones) in `test-validation.md` are the substitute — note it in the report.
- [x] 4.5 `openspec validate diagonal-corner-snap`, then `/opsx:verify diagonal-corner-snap`; fix any CRITICAL issue in the same session (`.claude/rules/verification.md`).
- [x] 4.6 Final `git diff` review: only `src/wall-snap.ts`, `src/wall-angle.ts`, `src/wall-geometry.ts`, the change folder, the two test files and `TODO.md`; no debug or dead code.
