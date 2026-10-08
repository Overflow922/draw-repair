# Test Validation

Change: `auto-wall-dimensions`. Validator: independent, read-only (only this file written in the repo).

## Method

- Disposable copy outside the repo: `C:\Users\Юрий\AppData\Local\Temp\claude\C--Projects-draw-repair\abd10fa0-b15c-484c-a2c5-399e15e1ed03\scratchpad\validation-copy` (src/, package.json, tsconfig.json, vite.config.ts, index.html, `node_modules` junction). Not inside the repo.
- Reference `src/auto-dimensions.ts` (`autoWallDimensions`, `placeWall`) written only in the copy, from spec + design D1-D3: edges 0/1 side faces, 2/3 end faces, offset 40, thickness on free end b else a else none, free end = `jointAt(...) === null`, length measured to the vertex where the face exits a neighbour body if the face starts strictly inside it, otherwise from its own corner. Mutants are switched with the `MUT` env var.
- Commands (in the copy): `npx vitest run` (whole suite), `npx vitest run src/auto-dimensions.test.ts src/auto-dimensions-place.test.ts` per mutant, `npx tsc --noEmit`, `npx vitest list`.
- Real `wallShape` contours for the spec's L scene were printed to check the oracles:
  - order `[E, N]` (E drawn first): E = `[-10,0] [-10,400] [10,400] [10,0]`, N = `[-10,10] [500,10] [500,-10] [-10,-10]`;
  - order `[N, E]` (N drawn first): N = `[0,10] [500,10] [500,-10] [0,-10]`, E = `[-10,-10] [-10,400] [10,400] [10,-10]`.

## Results against the reference implementation

- Discovery: 42 tests found (29 in `auto-dimensions.test.ts`, 13 in `auto-dimensions-place.test.ts`), all discovered and run.
- New tests: 39 passed, 3 FAILED. Whole suite: 1893 passed, 3 failed (1897 total); all existing 1855 tests still pass.
- `npx tsc --noEmit` in the copy: exit 0 (the tests typecheck against the reference signatures).
- Failures (all three are test or spec oracle problems, not reference bugs; checked by hand against the real `wallShape`):
  1. `ADW-16b` (`src/auto-dimensions.test.ts:183-190`): in the second loop pass, `walls = [N, E]` with N as the new wall, it expects `minus = 510`. In that order N is the earlier wall and its contour is flat from x = 0 (`[0,10] ... [0,-10]`), so no point (-10,-10) exists on N. The real value is 500. The array `[N, E]` with N as the new wall cannot arise from `placeWall`, which appends the new wall last.
  2. `ADW-17` (`:192-203`): `walls = [N, E]`, E is new. The test and the spec scenario "Прямой угол - стена, не заходящая в угол" expect the x = -10 face to be 400 long from `(-10, 0)`. The real contour of E in this order is `[-10,-10] ... [10,-10]` (E is the later wall, so E is the one extended over the corner). The x = -10 face starts at `(-10,-10)` and is 410 long. The x = 10 face is 390 long from `(10,10)`, which matches the spec. The point `(-10,0)` is not a vertex or touch point of any edge in the scene, so `dimPointPoint` cannot produce it and no implementation can pass. The spec numbers (400 from `(-10,0)`, boundary of the N end face x = -10) hold only for `[E, N]`, where the measured E is the older wall. That contradicts the spec's own wording "E зафиксирована после N". This is a spec conflict (spec scenario 2 versus the real geometry), not a test typo.
  3. `ADW-22` (`:246-259`, assertion at `:257`): it measures M, the older wall, and expects the left face to be `500 - 10/sqrt(3)` = 494.23. M's left face from its own corner `(-8.66, 5)` runs along the mitre edge of N's body (N's contour edge from `(-17.32,-10)` to `(-5.77,10)` lies on the same line). The spec rule says a face that runs along the boundary of a neighbour body, not inside it, is measured from its own corner, so the value is 500. The test applies the opposite rule here, and `ADW-17` applies it the usual way. A variant of the reference that exits on boundary contact (`boundaryExit` mutant) makes ADW-22 pass and ADW-17 fail, so the two tests contradict each other and the spec. The N half of ADW-22 (N new, 60 degrees: 17.32 and -17.32 starts) passes.

## Requirement Coverage

- FAIL. Covered with executable tests: three dimensions on a free wall (ADW-1), order, outside placement with 40 cm offset (ADW-2/3), thickness on b (ADW-4), on a only (ADW-5, 7c), no thickness when both ends are joined (ADW-7), L corner with N entering the corner (ADW-16), inner side (ADW-19), different thickness (ADW-20), right corner at end b (ADW-21), 60 degrees for the new wall (ADW-22, first half), T trim (ADW-18), inclined wall (ADW-8), one history step (ADW-9, via `record`/`undoEntry`/`redoEntry`), follows the wall (ADW-10/10b), delete one and delete with the wall (ADW-11/11b), guard violation gives `null` (ADW-12), load does not add dimensions (ADW-13, trivial: `parseStore` never adds dimensions), degenerate wall (ADW-15/15b).
- The scenario "стена, не заходящая в угол" has no valid executable test: ADW-17 is unsatisfiable (finding 2). The drag scenario has no test (accepted in test-plan, same as manual dimensions). `main.ts` wiring (one `pushRecord`, `placeWall` call) has no test (accepted in test-plan, manual check).

## Boundary Coverage

- PASS with a caveat. Thickness 1 and 100, wall shorter than thickness, zero length, both directions, vertical, 30 degrees, collinear X/Y neighbours, T trim at x = 490, 60 degree joint are present. The caveat is the unsatisfiable boundary-run case (ADW-17) and the contradictory ADW-22 second half.

## Negative Cases

- PASS. Guard violation gives `null` (ADW-12 and mutant `noGuard` killed); zero-length wall; old walls get no new dimensions (ADW-1g); input scene not mutated; load adds nothing.

## Error Handling

- PASS. The only error path (`null` when the wall violates a doorway) is covered by ADW-12/12b, and the unmodified input scene is asserted.

## Invariants

- PASS. At most 3 dimensions, at most one thickness, no zero-length dimension, determinism, no input wall mutation, every point refers to the new wall (ADW-14).

## State Transitions

- PASS with a caveat. Undo and redo one step are tested through the history module (ADW-9). The caveat: the test calls `record(history, before)` itself, so it does not prove the `main.ts` wiring (known, accepted).

## Integration Behavior

- PASS. Real `moveWallsBounded`, `moveEndpointBounded`, `deleteObjects`, `parseStore`/`serializeStore`, `isDimension`, history functions are used with no mocks.

## Implementation Independence

- PASS. Oracles come from a frame built on the wall (`frameOf`) and `dimPointPoint`/`dimGeometry`, not from the module under test. No mocks. Exception: the oracles of ADW-16b, ADW-17 and ADW-22 (second half) were not checked against the real contours and are wrong (see failures).

## Assertion Strength

- FAIL (only because of the three wrong oracles). The rest are exact (`toBeCloseTo` with 5 digits, exact point positions, exact line positions). The guard `if (!next) return` in the place tests follows an `expect(next).not.toBeNull()`, so it does not hide failures. ADW-13 and ADW-14b are weak by nature (a store round trip cannot create dimensions) but not wrong.

## Mutation Testing

- FAIL for the suite as it stands (cannot be completed cleanly because 3 tests fail on a correct reference). Mutants were killed by tests other than the three baseline failures (ADW-16b, ADW-17, ADW-22 fail in every run, including the unmutated one; they are not counted as kills).

## Surviving Mutations

| Mutation | Expected Failing Test | Result |
|---|---|---|
| thickness offset sign flipped on end a | ADW-5, ADW-7c, ADW-21 | killed (ADW-5, 7c, 21) |
| thickness offset sign flipped on end b | ADW-4, ADW-6, ADW-1c/1d/8/1e, ADW-10b | killed (11 tests) |
| same sign for both length faces | ADW-2, ADW-3, ADW-7, ADW-16... | killed (13 new tests beyond baseline) |
| thickness end always b | ADW-5, ADW-7c | killed (ADW-5, 7, 7c, 21) |
| thickness end always a | ADW-4, ADW-6 | killed (ADW-1b, 4, 6, 7, 7b, 10b ...) |
| free-end test inverted | ADW-4..7 | killed (19 tests beyond baseline) |
| own corner always (no visible exit) | ADW-16, ADW-19, ADW-20, ADW-21 | killed (ADW-16, 19, 20, 21) |
| exit always, even when the face runs along the neighbour boundary and when the face does not enter | ADW-7, ADW-16, ADW-19, ADW-20 | killed (ADW-7, 7b, 7c, 16, 19, 20, 21), but not by the boundary-specific test: |
| exit when the probe point is on the neighbour boundary (face along the boundary uses the exit vertex) | ADW-17 | survives the satisfiable tests: only ADW-17 (unsatisfiable) distinguishes it; with ADW-22 it even passes. The correct boundary-run behavior has no valid executable test. |
| farthest exit vertex instead of first exit (exit crossing) | ADW-16, ADW-22 | survived: all scenes have a single crossing, so the mutant is equivalent in every tested scene; no test with a neighbour that has two crossings along the face (e.g. a neighbour body the face crosses fully, or another neighbour behind the first) |
| offset 40 to 4 | ADW-2, ADW-4 | killed (20 tests) |
| offset 40 to 400 | ADW-2, ADW-4 | killed (20 tests) |
| swapped order of result | ADW-1b | killed (ADW-1b only) |
| `placeWall` mutates the input scene | "не мутирует входную сцену" | killed (also ADW-1f, ADW-9) |
| `placeWall` returns a scene with the wall although the doorway is violated | ADW-12 | killed (ADW-12) |
| `placeWall` does not add dimensions | ADW-1, ADW-1f, ADW-1g, ADW-9 | killed (6 tests) |
| dimensions created for old walls too | ADW-1g, ADW-1f | killed (ADW-1f, ADW-1g) |

Critical surviving mutants: the boundary-run rule (face along the neighbour boundary is measured from its own corner) is protected only by an unsatisfiable test. That is the one important rule that the spec adds on top of the exit rule, so it counts as a critical gap.

## Findings

- Finding 1 (critical, test oracle wrong): `src/auto-dimensions.test.ts:183-190` ADW-16b iterates over `[E, N]` and `[N, E]` with N as the new wall. For `[N, E]` the expected `minus = 510` is geometrically impossible (real value 500); the order `[N, E]` with N as the new wall never occurs in the app.
- Finding 2 (critical, spec versus geometry conflict, needs a spec decision): spec scenario "Прямой угол - стена, не заходящая в угол" and test ADW-17 (`src/auto-dimensions.test.ts:192-203`). The stated order "E after N" gives, with the real `wallShape`, E x = -10 face = 410 from `(-10,-10)` and x = 10 face = 390 from `(10,10)`. The spec's 400 from `(-10,0)` (N's end face x = -10 as boundary) is the picture for the older wall E drawn before N. The scenario that the spec text was meant to cover (a face that runs along the neighbour's boundary from its own corner) in the real app comes from other geometry (e.g. an older/later pair that really produces a boundary-run face), or the scenario must be restated.
- Finding 3 (critical, test contradicts spec and ADW-17): `src/auto-dimensions.test.ts:256-258` ADW-22 expects `500 - 10/sqrt(3)` for the older wall M, whose left face runs along the mitre edge of N. The spec rule gives 500. Also M is the older wall, which `placeWall` never measures.
- Finding 4 (gap): no test for the "nearest versus farthest exit vertex" rule with two crossings (mutant `farExit` survives); test-plan lists it as a mutation target.
- Finding 5 (gap, accepted by plan): drag of an automatic dimension and the `main.ts` wiring (one `pushRecord` per wall, `null` leaves history untouched) have no automated test; ADW-9 simulates `record` itself.
- Finding 6 (note): `ADW-13` and `ADW-14b` can never fail for the intended reason (no production code sits between a store with no dimensions and its load), so they give no regression protection for "load does not add dimensions"; acceptable only because the requirement is protected by there being no hook in the loader.

## Required Changes

For the Test Writer (and, for item 1, a decision outside the tests):

1. Decide the spec question first (Rule 1, do not silently change the spec): scenario "Прямой угол - стена, не заходящая в угол". With the real contours, a new wall E drawn after N has its x = -10 face from `(-10,-10)` (410), not from `(-10,0)` (400). Either the spec scenario is corrected to reachable numbers, or the behavior is intentionally changed together with the geometry. After the decision, replace ADW-17 with a satisfiable test that fixes the boundary-run rule: a face that runs along the boundary of a neighbour body (not inside it) is measured from its own corner. The scene must be reachable through `placeWall` order (new wall last) and the expected points must be real vertices or touch points of the contours.
2. Fix ADW-16b: remove the `[N, E]` iteration (N new and earlier in the array is unreachable and its 510 is wrong), or make the second iteration measure E as the new wall in `[N, E]` with the values of the real contour (E: x = -10 face 410, x = 10 face 390). Do not assert 510 for `[N, E]`.
3. Fix ADW-22: the M assertions (`:255-258`) measure an older wall and contradict the spec boundary rule. Remove them or restate them for a reachable scene where the new wall M is last and the expected values follow the spec (face along the neighbour boundary = own corner, face inside the neighbour body = exit vertex). Keep the N half.
4. Add a test where the exit rule has a choice (a face that leaves the neighbour body and the first exit differs from the farthest edge hit), so that the `farExit` mutant is killed.
5. Re-run the new tests together with the full existing suite against a reference implementation to confirm 0 failures before approval (the three tests above must pass on a correct implementation).

VERDICT: FAIL
