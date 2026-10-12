# Test Validation

Round 2, independent. Read-only: production code, tests and specs are untouched. The reference implementation and all mutants live in the scratchpad (a copy of `src/`, `node_modules` linked), never in the repo.

## Method

- Re-read proposal, design, all three delta specs, test-plan, test-suite, the three executable test files and the production code (`wall-snap.ts`, `auto-dimensions.ts`, `geometry.ts` `wallEndOccupied`, `wall-geometry.ts` `diagonalCornerBlock` / `displayPolygons` / `partnerEndOf` / `faceCornerAt`).
- `specs/wall-joints/spec.md` was diffed line by line against `openspec/specs/wall-joints/spec.md` (requirement "Диагональный угловой стык"). Only the intended changes exist: the bullet "кроме концов продолжения", the new paragraph "Концом продолжения…", the qualifier "не являющийся концом продолжения" in the scenario "Другой конец в пороге", and the six new scenarios. Nothing else in the requirement was altered.
- Current repo: the three files give 50 tests, 27 fail and 23 pass (matches test-suite.md). The whole suite gives 27 failed and 3294 passed; the failures are only the 27 new tests. `tsc --noEmit` is clean.
- Reference implementation of D1-D5 (scratchpad copy):
  - D1: face zone measured from the open interval of the contour.
  - D3: thickness dimension skipped when the end plane is covered by the displayed bodies including the block.
  - D4: continuation end in `diagonalCornerBlock`: F = end of X + outward direction x thickness of the neighbor, 1 cm per axis, direction check, at most one per wall.
  - D5: a symmetric-pair tie-break (see Finding 1).
- Result on the reference: all 50 new tests pass, and the whole existing suite is green (3295 passed; 3 UI files failed to load only because the scratchpad copy lacks `index.html`; they pass in the repo). So a correct implementation of the specs passes all tests, and the tests do not conflict with the approved existing suite.

## Requirement Coverage

- PASS. Every requirement and scenario in the three delta specs has an executable test.
  - wall-drawing: BS-1, BS-1a-d, BS-2, BS-2a-c, BS-3, BS-4, BS-4a-c, BS-5, BS-5a-c.
  - dimension-tool: BD-1 to BD-7, IC-1, IC-2.
  - wall-joints: BJ-1, BJ-1a-d, BJ-2, BJ-3, BJ-4, BJ-5, BJ-5a-d, BJ-6.
- The previously missing cases are now present: BS-2a/BS-2c exercise the zone beyond the block edge, BS-1d checks wall order, and BJ-5c / BJ-1c / BJ-1d cover the foreign-end regression, order C, A, B and a thick C.
- The wall-joints delta is covered by its own tests: the continuation does not cancel the block (BJ-1, BJ-2), and the other cancel rules still hold (BJ-4, BJ-5, BJ-5a, BJ-5b, BJ-5c).

## Boundary Coverage

- PASS. Covered boundaries:
  - Block edge inclusive: BS-2 at x = 20.
  - Zone beyond the edge: 25 and 28 inside, 30.5 outside (window 8 < ext <= 10.5 is pinned).
  - Transverse boundary at t = 195, inclusive and exclusive: BS-4b and BS-4c.
  - Continuation tolerance 0.99 versus 1.01, along and across the B axis, both signs (BJ-3, BJ-4).
  - Half and mid positions of the block (BS-1, BS-1a, BS-1b).
- Minor gap, not blocking: exactly 30.0 and 1.00 are not tested; the neighbouring values are.

## Negative Cases

- PASS. Covered: far from the block (BS-3, BS-2b, BS-4c); a face without a block (BS-5 to BS-5c); parallel walls on the diagonal (BS-5b, BD-4); a free wall next to the block (BD-4a); perpendicular (BJ-5) and toward-block (BJ-5a) walls; two continuation ends (BJ-5b); a foreign end that is not at F (BJ-5c); a tolerance miss (BJ-4).

## Error Handling

- PASS / N/A. These are pure geometry functions; spec scenarios only require "no errors" for out-of-tolerance input, and BJ-4 runs those inputs.

## Invariants

- PASS.
  - Axes and lengths are unchanged (`deepFreeze`, BJ-1b).
  - No piece overlap (`worstOverlap`: BJ-1a, BJ-2, BJ-6).
  - Squares do not overlap bodies (`maxOverlap`).
  - Nothing is inside the block (BD-5, BD-6, BD-7, IC-2).
  - Wall order does not change the result (BS-1d, BD-6, BJ-1c).

## State Transitions

- PASS. The chain A, B, then C (BD-3, BD-7, IC-1) and the transition "block filled, then C added, still filled" (BJ-1, BJ-6) are tested.

## Integration Behavior

- PASS. BJ-6 joins `snapStartVertex` and `displayPolygons` (no gap, no overlap). BD-3, BD-7, IC-1 and IC-2 run `placeWall` with the real recalculation.

## Implementation Independence

- PASS.
  - Etalons are explicit coordinates from the specs.
  - Closed shape is checked by sampling 1 x 1 cm cells against rectangles computed in the test.
  - The tests do not call internal functions; they use only `snapStartVertex`, `displayPolygons` and `placeWall`.
  - Block ownership and the choice of the diagonal pair are not asserted (see Finding 1), so any correct tie-break passes.
- Assertions are defined by the specs. The only extras are inherited from the old rules: the transverse boundary (the spec says "по прежним правилам") and the nearest-target choice in the BS-2a/c points (noted in test-suite).

## Assertion Strength

- PASS. Vertex coordinates, `source`, `target`, `normal`, the placement square and its overlap are all asserted. Dimension tests check exact counts and the end/side (`expectThickness`) plus the absence of lines inside the block.

## Mutation Testing

- PASS. No mutation tool exists in the project (vitest only). Manual mutants were run on the reference implementation. All 50 tests pass on the unmutated reference ("none").

## Surviving Mutations

| Mutation | Expected Failing Test | Result |
|---|---|---|
| zone along the axis only (D1 not done) | BS-1, BS-2, BS-4 | killed (11 tests) |
| zone extension 0 cm beyond the block edge | BS-2a, BS-2c | killed |
| zone extension 5 cm | BS-2c | killed |
| zone extension 11 cm | BS-2b | killed |
| continuation tolerance 0 cm | BJ-3 | killed (4) |
| continuation tolerance 2 cm | BJ-4 | killed (4) |
| continuation direction not checked | BJ-5 | killed |
| continuation count not checked | BJ-5b | killed |
| only continuation of B handled | BJ-1, BJ-1d, BJ-3, BD-3, BD-7, IC-1, BJ-6 | killed (10) |
| only continuation of A handled | BJ-2, BJ-1c | killed |
| any end near F accepted (tolerance and direction ignored) | BJ-4, BJ-5, BJ-5c | killed (6) |
| continuation order vs the pair not enforced (C inside the block) | BJ-1a, BJ-6 | killed |
| thickness never removed under the block | BD-1, BD-2, BD-3, BD-5, BD-6, BD-7, IC-1, IC-2 | killed (8) |
| thickness removed on every end | BD-1, BD-2, BD-3, BD-4, BD-4a, BD-6, IC-1, IC-2 | killed (8) |
| tolerance as a circle of radius 1 cm instead of 1 cm per axis (by inspection) | none | SURVIVES: tests shift only along the axes. Non-blocking, see Finding 2 |
| `wallEndOccupied` changed instead of a separate check in `thicknessDimension` (design D3 forbids it) | none | not testable here: moving walls is Out of Scope in test-plan |

## Findings

1. Specification gap, not a test defect. A T made of three walls is symmetric: with A, B, C the pair (A, C) also looks like a diagonal pair, with B as the "continuation". The spec says only "block stays the block of the pair A and B (by order A, B, not D)" and gives no rule for choosing the pair when the array order is C, A, B. Without a tie-break two blocks appear at once (overlap 400 cm2, or no block at all via the "two neighbors" rule, as I saw while building the reference). The tests assert only the union of the pieces, no overlap, and a filled block, so they are independent of the tie-break and a correct implementation can satisfy them. The design should state the rule (my reference used "the continuation is the latest of the three walls"). This does not block the tests.
2. Tolerance is "1 cm on each of two axes" in the spec. Tests use shifts along the B axis or across it only. A circular tolerance would pass. Adding one diagonal shift, for example (+0.9, +0.9), accepted, would pin the per-axis form. Optional.
3. test-plan BS-3 says cursor (60, -15) while the test uses (60, -16); the result is the same and the assertion matches the spec outcome. Harmless.
4. Process: a bash crash left an untracked `bash.exe.stackdump` in the repo root while I worked; I deleted it. `git status` shows only the change artifacts and the three new test files plus the staged `img*.png` (pre-existing).

## Required Changes

- None required. Optional (non-blocking): add a diagonal-offset case to BJ-3; add the pair tie-break rule to design.md / wall-joints spec.

## Verdict

VERDICT: PASS
