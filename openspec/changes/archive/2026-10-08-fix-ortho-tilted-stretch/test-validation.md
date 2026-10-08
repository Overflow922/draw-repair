# Test Validation

Revision 2. Validator: fresh context, read-only on the repository. The reference implementation and all mutants were built
in a scratch copy outside the repo (`src/ortho-stretch.ts`: dedicated `STRETCH_SIN = sin(5 deg)`, `<=` in `link`, `RIGHT_SIN`
untouched elsewhere; the scratch test files and `wall-edit.ts` were byte-identical to the repo, checked with `cmp`).

## Revision history

Revision 1 (VERDICT: FAIL) findings and how each was resolved:

| Rev-1 finding | Resolution in this revision |
|---|---|
| F1: approved `INV-3` conflicts with the 5 deg rule (raw tilted v fed to the primitive) | Test-change-request approved and executed. `INV-3` now feeds the primitive the vector projected on the dominant axis in ortho mode. Judged faithful, see Findings F1. |
| F2: mutant M22 (T-attachment branch keeps 0.5 deg) survived | New `TL-14` (3 deg T-leg stretches) and `TL-15` (6 deg T-leg moves whole). M22 is now killed by TL-14. |
| F3: `<=` vs `<` at exactly 5 deg not tested | Not added. Still survives; accepted as non-critical with a justification (F3 below). |
| F4: `TL-05b` cannot discriminate the tolerance, spec wording was misleading | Spec scenario corrected to "вверх (вдоль соседа)". `TL-05`, `TL-04`, `TL-06` discriminate; `TL-05b` is now a pin of "perpendicular neighbour moves whole". |
| Optional: joint at the neighbour's `b` end | New `TL-16`. |
| `ST-11` conflict | Test-change-request executed: 1 deg now expected to stretch. Judged faithful, see Findings F2. |

## Facts established by running the code

- Repo as-is, whole suite (`npx vitest run`, 93 files, 1855 tests): 11 failed, 1844 passed. Exactly the expected set:
  `TL-01, TL-02, TL-03, TL-04, TL-06, TL-14, TL-16` (`ortho-stretch-tilt.test.ts`), `TL-07, TL-11, TL-12`
  (`wall-edit-ortho-tilt.test.ts`), `ST-11` (`ortho-stretch.test.ts`). All for the right reason: the far end or the wall behind
  the neighbour moved by exactly v ("expected 260 to be close to 300", "expected 60 to be close to 100", "expected 30 to be close
  to +0", "expected 519.999 to be close to 500", ST-11 "y: 160 vs 200"). Passing pins: TL-05, 05b, 08, 09, 10, 13, 15. `INV-3` passes on
  the current code. Tests are discovered by the runner.
- Reference implementation, ENTIRE suite: 1855 passed, 0 failed (no worker crash). Therefore no remaining spec/test conflict
  with any approved test.

## Requirement Coverage

- PASS

Tilt 0.57 and 3 deg stretch with far end and the wall behind fixed (TL-01, 02), exact joint displacement / drilling offset
(TL-03), 4.999 / 5.001 boundary (TL-04), 6 deg moves whole and cascades (TL-05), sign and direction symmetry (TL-06), length input
(TL-07), perpendicular neighbour on length input (TL-08), ortho off (TL-09), RIGHT_SIN unchanged (TL-10), drag of an end and wall
move through `wall-edit` (TL-11, TL-12), 30 / 45 deg (TL-13), T-attachment branch both sides of the tolerance (TL-14, TL-15), joint at
the neighbour's `b` end (TL-16). "Допуск растяжения не меняет определение прямого угла": TL-10 plus the existing geometry, tee and
collision tests (raising `RIGHT_SIN` to 5 deg fails TL-10 and nine existing tests, revision 1).

## Boundary Coverage

- PASS (with F3)

4.999 / 5.001 kills the 4, 4.99, 5.01, 6, 45 deg tolerances. Only a drift of the constant below 0.001 deg and `<=` vs `<` at
exact equality survive.

## Negative Cases

- PASS

6 deg (TL-05, 05b, 06, 15), perpendicular neighbour (TL-08), 30 / 45 deg (TL-13), ortho off (TL-09).

## Error Handling

- PASS

No new error path. Zero vector and zero-length wall stay covered by existing tests, which pass on the reference.

## Invariants

- PASS

Far end fixed, wall behind the stretched one fixed (no cascade), joint exactly v, `RIGHT_SIN` constant. Bounded-edit invariants
`INV-1..INV-3` pass on the reference and `INV-3` still detects regressions (see Findings F1 and mutants P1..P3).

## State Transitions

- PASS

Stretched vs moved-whole classification and the cascade passing on through a moved-whole 6 deg wall (TL-05), T-leg either way (TL-14, 15).

## Integration Behavior

- PASS

`moveEndpointBounded` (TL-11), `moveWallsBounded` (TL-12), `resizeWallBounded` (TL-07, 08, 09) run the real `planEdit -> limit -> apply`
path with real collision and tee contexts, nothing mocked. Dropping the ortho flag from `planEdit` is killed in each wrapper
(see mutants E_move / E_end / E_resize).

## Implementation Independence

- PASS

Tests drive `planOrthoStretch` / `applyStretch` / public edit functions and compare coordinates. Only `TL-10` imports the public constant `RIGHT_SIN`.

## Assertion Strength

- PASS

Coordinates are compared with `toBeCloseTo(.., 9)` (unit) or 6 (wall-edit) against exact expected numbers, far ends and neighbours are
checked unchanged. `TL-05b` alone is non-discriminating by design (a pin).

## Mutation Testing

- PASS

Manual mutation in a scratch copy, each mutant run against the ENTIRE suite. 27 mutants, all critical ones killed.

## Surviving Mutations

| Mutation | Expected Failing Test | Result |
|---|---|---|
| constant 5 -> 0.5 deg (old behaviour) | TL-01,02,03,04,06,07,11,12,14,16, ST-11 | killed (all 11) |
| constant 5 -> 4 deg | TL-04 | killed |
| constant 5 -> 4.99 deg | TL-04 | killed |
| constant 5 -> 5.01 deg | TL-04 | killed |
| constant 5 -> 6 deg | TL-04, TL-05, TL-06 | killed |
| constant 5 -> 45 deg | TL-04, 05, 06, 13 | killed |
| remove `Math.abs` in `link` | TL-04, 05, 05b, 06, 08, 11, 13 +17 existing | killed |
| `markWhole` instead of `markEnd` for parallel | TL-01..04, 06, 07, 11, 12, 14, 16 +many existing | killed |
| reuse `RIGHT_SIN` (original code) | same 11 as the baseline | killed |
| `dot` instead of `cross` | 46 tests incl. TL-01..06, 07, 08, 11 | killed |
| old tolerance only on the seed-end path | TL-07 | killed |
| old tolerance only on the cascade-joint path | TL-01,02,03,04,06,11,12, 16, ST-11 | killed |
| old tolerance only on the T-attachment branch (M22) | TL-14 | killed (rev-1 survivor now killed) |
| T-attachment always moves whole | TL-14, ST-7, ST-7f + existing | killed |
| never stretch | 36 tests | killed |
| always stretch | 26 tests incl. TL-04, 05, 05b, 06, 08, 13 | killed |
| stretch always moves end `a` | TL-16 + 22 existing | killed |
| `ortho=false` into `planEdit` of `moveWallsBounded` | INV-3, ortho-gesture, wall-edit-ortho-axis | killed |
| `ortho=false` into `planEdit` of `moveEndpointBounded` | TL-11 + existing | killed |
| `ortho=false` into `planEdit` of `resizeWallBounded` | TL-08 + wall-edit-tee | killed |
| P1: `moveWallsBounded` without the ortho axis projection | INV-3 + 7 wall-edit-ortho-axis tests | killed |
| P2: `moveWallsBounded` applies 0.999 of the result | INV-3 + 74 others | killed |
| P3: ortho axis chosen by the MINOR component | INV-3 + ortho-gesture etc. (22) | killed |
| `<=` -> `<` at exactly 5 deg | none | SURVIVES, non-critical (F3) |
| constant 4.9995 / 5.0005 deg (rev 1) | none | survives, practically equivalent, accepted |
| `vDir === null` treated as parallel (rev 1) | none | equivalent (path unreachable) |

## Findings

- F1 (`INV-3` edit, faithful and not weakening). The ortho branch of `INV-3` now compares `moveWallsBounded` with the primitive applied
  to `onDominantAxis(v)`: `|x| >= |y|` gives the horizontal axis, otherwise the vertical. This is exactly the spec requirement
  "Орто без боковой составляющей" (axis is horizontal when the horizontal component is not smaller by modulus, ties go horizontal) and
  matches `orthoAxisOf` in production. The non-ortho branch is untouched. The admissibility filters, the length check, `admissibleCount > 50`
  and the per-wall comparison are unchanged. I checked that it still catches real regressions: dropping the ortho axis projection from
  `moveWallsBounded` (P1), choosing the minor axis (P3), scaling the applied vector (P2) and dropping ortho from `planEdit` in
  `moveWallsBounded` are all killed, and `INV-3` is among the failing tests each time. The comparison is partly tautological for the stretch
  rule itself (both sides call `planOrthoStretch`), as it always was; the stretch rule is protected by the TL tests.
- F2 (`ST-11` edit, faithful and not weakening). 0.3 deg part unchanged. The 1 deg part now expects `B.a = (200, -40)` and `B.b` deep-equal to
  the original, which is the spec scenario "Слегка наклонный сосед растягивается" (stricter than the old "moved whole" check) and the `run`
  helper's `stretched: ["B"]` only exempts `B` from the direction invariant, as for the 0.3 deg case. The title points to the 5 deg boundary
  tests in `ortho-stretch-tilt.test.ts`. Killed by the 0.5 deg mutant, so the edit protects the new behaviour.
- F3 (`<=` vs `<` at exactly 5 deg, non-critical). The spec says "ровно на 5°" stretches, but TL-04 checks 4.999 / 5.001 only. The input
  is measure-zero in floating point (a user drawing never produces an angle whose sine equals the constant bit-for-bit), the
  difference to 4.999 deg is a hair, and a bit-exact test would be coupled to how the constant is computed. Accepted. A test could
  be built (vertical v, neighbour `(sin 5deg, cos 5deg) * 300`) but would be brittle; optional.
- F4: `TL-05b` title still quotes the superseded "вправо вдоль себя" wording. It is a pin of "perpendicular neighbour moves whole" and is harmless.
- F5: spec scenario "Наклон больше допуска смещается целиком" now says A moves "вверх (вдоль соседа)", consistent with `TL-05` (v along the neighbour)
  which discriminates 6 deg (killed 6 and 45 deg constants).
- Nothing in the repo was changed by the validator except this file.

## Required Changes

- None blocking. Optional: an exact-5 deg boundary test (F3).

## Verdict

VERDICT: PASS
