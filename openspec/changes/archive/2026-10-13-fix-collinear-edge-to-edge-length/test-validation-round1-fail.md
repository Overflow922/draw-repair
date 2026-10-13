# Test Validation

Change: `fix-collinear-edge-to-edge-length`. Single validation round, fresh context. Files reviewed: `src/wall-length.test.ts`, `src/wall-length-chain.test.ts`, `src/wall-length.test-utils.ts` against the delta specs `length-input` and `ruler-tool`, design D1-D6 and the production geometry (`wall-geometry.ts` `endShape`/`pairEnd`, `wall-chain.ts`, `wall-merge.ts`, `ruler.ts`, `wall-edit.ts` `resizeWallBounded`, `wall-angle.ts` `StartRef`).

## Method and what was verified empirically

- Nothing in the repository was modified. Reference and mutant code lived only in the validator scratchpad; a temporary vitest config aliased `./wall-length`, `./wall-chain` and `./ruler` to scratchpad files (the chain and ruler files are copies of the production modules with the design D2/D6 change applied) and was deleted after the last run.
- Reference implementation of D1, D2, D5 (`endOverhangCm` reuses the exact `pairEnd` collinear predicate: one neighbour in `jointTol`, not near-collinear 0.5..15 degrees, early/late by array index, vertex inside the neighbour strip, `|dot| >= RIGHT_COS`), plus D2 in `chainSegment` and D6 in `rulerReading`: **all 43 tests pass**. So every expectation in the suite (OH-8, OH-9, OH-10, RS-1, BE-2, RL-1a ...) is consistent with the spec and with the existing `displayPolygons` geometry. No test expectation looked wrong.
- Not verifiable empirically: `main.ts` wiring (`previewLengthCm`, `liveLengthCm`, `resizeSelected`) and the real `mergeContinuation` against a changed `chainSegment` beyond what MG-1 runs (MG-1 does run the real, unmodified `mergeContinuation` on the reference `chainSegment` output and passes). The production edit of `wall-geometry.ts` (predicate extraction) was not reproduced; the predicate was re-implemented in the scratchpad.

## Requirement Coverage

- FAIL
- Covered with executable tests: overhang on late wall start/end (OH-1, OH-4, OH-8), early wall zero (OH-2), edge length (OH-3, OH-9 against an independent `displayPolygons` extent), corner/T/free/near-collinear/three ends/over-threshold gap (OH-5..OH-7, OH-11..OH-13), start overhang by cap reference (SO-1..SO-4), typed length from the end plane (TL-1..TL-6), merge by exactly the typed length (MG-1), body extent equal to the typed number (BE-1, BE-2), selected-wall input 450 -> b=(950,0) (RS-0, RS-0a, RS-1), ruler from/to/length for late wall, reversed wall, early wall, corner, plain wall (RL-1..RL-4).
- Not covered: the spec scenario "Живая длина превью - от плоскости торца" (field shows 4000 for a passive preview from (510,0) to (900,0)). The value is `dist(start, end) + startOverhangCm(ref, start, dir)` computed in `previewLengthCm` in `main.ts`. Design D3 and the test-plan assert that all logic is extracted to pure functions, but this composition is not extracted and no test asserts 400 for a passive preview segment (TL-6 only checks `end.y == 0` and `end.x > 610`). A wrong composition (forgetting the overhang, subtracting it, using the wrong direction, applying it when a typed length is set) passes the whole suite. See Required Changes 3.
- Covered only through `edgeLengthCm`, not through the wiring: "Выделенная стена с выступом торца" (OH-3 asserts 400; `liveLengthCm` wiring is declared out of scope). Acceptable because `liveLengthCm` is a one-line delegation to `edgeLengthCm`.
- "Угловой стык и T-примыкание не меняются": covered by OH-5/OH-6/RL-3, but only for joints with zero gap (see surviving mutations).

## Boundary Coverage

- PASS (with one gap)
- Covered: gap exactly `jointTol` (OH-10) and just beyond (OH-11, 10.5 cm); typed == overhang, below, just above (TL-3, TL-3a, TL-3b, RS-0a); direction tolerance 0.4 / 0.6 degrees (SO-1b, SO-1c); 195 mm thickness (SO-1a, TL-5, BE-2).
- Gap: every positive collinear fixture has gap exactly equal to half the new wall's thickness (10 with 20; 9.75 with 19.5). A gap smaller than the half-thickness, or mixed thicknesses (`jointTol` uses the larger one), is never exercised.
- The 0.4 / 0.6 degree tolerance is tested only on `startOverhangCm`; design Risks promise the same on the segment (`chainSegment` end), which is not tested.

## Negative Cases

- PASS (with one gap)
- Covered: early wall, free end, single wall, face reference, no reference, reference without anchor, perpendicular and backward direction, near-collinear 3 degrees, three ends at one vertex, gap beyond threshold, non-positive typed values (via the unchanged path).
- Gap: a perpendicular or oblique joint whose vertex is displaced from the early wall end (non-zero gap) is not tested; all corner/T fixtures have the vertex on the end (OH-5) or no neighbour within `jointTol` (OH-6), so "overhang is 0 outside the collinear branch" is verified only trivially.

## Error Handling

- PASS
- Typed value not larger than the overhang is rejected both for drawing (TL-3, TL-3a) and for the selected-wall field (RS-0a, null result). `resizeWallBounded` rejection paths are existing behaviour.

## Invariants

- PASS
- `edgeLengthCm >= axis` (OH-14), length equals the independently measured displayed body extent on both array orders (OH-9, BE-1, BE-2), round trip typed L -> edge length L for several L (TL-1a), merge adds exactly L (MG-1).

## State Transitions

- PASS
- Draw -> typed length -> segment -> wall -> body/ruler/merge chain is covered end to end (BE-1, BE-2, MG-1); select -> resize -> edge length (RS-1).

## Integration Behavior

- PASS / partial
- Pure-function integration is good (real `displayPolygons`, real `mergeContinuation`, real `resizeWallBounded`, real `rulerReading`). `main.ts` wiring is absent by decision (TODO.md, Tests).

## Implementation Independence

- PASS
- Expected numbers derive from spec scenarios (400, 390, 440, 450, 151.2, 9.75) and an independent body-extent oracle based on `displayPolygons`, not from `wall-length.ts`. Imports are limited to the API named in design D1/D2/D5. Minor risk: several negative assertions use `toBe(0)`, which fails for `-0` (`Object.is`); a correct implementation returning `-0` would be rejected. Low severity, not required.

## Assertion Strength

- PASS (with the gaps listed)
- Assertions are exact (`toBeCloseTo` with 4..6 digits, point equality), not ranges. TL-6 is intentionally loose. No mocks of the system under test.

## Mutation Testing

- FAIL
- No mutation tool is configured in the project. 22 hand-made mutants of the reference were run (single run each, against the full 43 tests). 17 were killed, 5 survived, of which 3 are equivalent or near-equivalent and 2 are real.

## Surviving Mutations

| Mutation | Expected Failing Test | Result |
|---|---|---|
| `endOverhangCm` returns `wall.thicknessCm / 2` instead of `dist(E, v)` | none exists (all positive fixtures have gap == half-thickness) | SURVIVED (real; design D1 and test-plan "Mutation Targets" name it). Verified with an extra scratch test that the correct value for gap 4 is 4 and for E=30 / N=10 / gap 12 is 12 (body extent 400 = edge length), and that this mutant fails it |
| `endOverhangCm` ignores the collinearity check (returns `dist(E, v)` for any single-neighbour joint inside the strip) | would need a perpendicular/oblique joint with non-zero gap | SURVIVED (real). Extra scratch test "perpendicular wall at (500, 6): overhang 0, length 294" kills it |
| `startOverhangCm` uses `dist(start, anchor)` instead of the projection on `dir` | would need a start laterally off the axis, or a 0.4 degree case with tight precision | SURVIVED (low, near-equivalent for fixtures with start on the axis) |
| `startOverhangCm` ignores `ref.kind === "cap"` | SO-2 | SURVIVED but equivalent in practice: `startRefOf` only sets `anchor` for caps, and SO-2 has no anchor |
| collinearity `>=` changed to `>` in `endOverhangCm` | none | SURVIVED, equivalent at floating point (exact 0.5 degrees is not constructible) |
| overhang sign inverted | OH-1, OH-3, OH-4, OH-8, OH-9, RS-1, TL-1a, BE-1, BE-2, RL-1 | killed |
| early wall also counts overhang | OH-2, OH-3, OH-8, OH-9, RL-2 | killed |
| `edgeLengthCm` counts only end a / only end b | OH-4, OH-9, RL-1a / OH-3, OH-9, BE-1, RL-1, RS-1 | killed |
| first-neighbour-only instead of "exactly one neighbour" | OH-13 | killed |
| gap threshold doubled | OH-11 | killed |
| direction tolerance 1 degree / 0.3 degree | SO-1c / SO-1b | killed |
| `chainSegment`: overhang not subtracted / added / subtracted twice | TL-1, TL-1a, TL-3b, TL-5, MG-1, BE-1, BE-2 | killed |
| `chainSegment`: `typed >= overhang` instead of `>` | TL-3 | killed |
| `axisLengthForEdgeCm`: no subtraction / `< 0` instead of `<= 0` | RS-0, RS-0a, RS-1 / RS-0a | killed |
| ruler: no shift of from/to / shift in wrong direction / axis length number | RL-1, RL-1a / RL-1, RL-1a / BE-2, RL-1, RL-1a | killed |

## Findings

- The suite is a strong, well-derived specification test for the core of the change: reference implementation passes all 43; 17 of 22 mutants die; the independent body-extent oracle makes OH-9 / BE-1 / BE-2 robust against self-consistent but wrong geometry.
- Two real survivors: the overhang magnitude is never distinguished from half the new wall's thickness, and the "overhang only in the collinear branch" rule is never exercised with a displaced (non-zero gap) corner or oblique joint. Both are named as mutation targets in the test-plan itself but have no killing test.
- The live-preview number (spec scenario "Живая длина превью - от плоскости торца", design D3) has no executable protection at all and no pure function to hang a test on; the design's justification for leaving `main.ts` untested ("all logic is extracted to pure functions") does not hold for this scenario.
- Spec/test discrepancy check: none found. Fixture comment "ось 390" in TL-1 is not asserted, harmless.
- Minor: the 0.4 / 0.6 degree tolerance promised in design Risks for the segment is only tested at the `startOverhangCm` level.

## Required Changes

1. Add a boundary test where the gap differs from half the new wall's thickness, with the body extent oracle: for example E (0,0)-(500,0) thickness 20 and N (504,0)-(900,0) thickness 20: `endOverhangCm(N, "a") == 4`, `edgeLengthCm(N) == 400`, `bodyExtentAlongAxis(N) == 400`; and a mixed-thickness case (E 30, N 10, N.a = (512, 0): overhang 12, edge length 400). Add the same gap-not-equal-half-thickness case at the chain level through `startOverhangCm` (start (504,0), anchor (500,0): 4).
2. Add a non-collinear joint with non-zero gap whose overhang must be 0: for example C (500,6)-(500,300) next to E: `endOverhangCm(C, "a") == 0`, `edgeLengthCm(C) == 294`; and an oblique (about 45 degrees) joint with the vertex inside the strip and a small gap.
3. Give the live preview an executable test. Preferably extract a pure function (for example `previewEdgeLengthCm(start, end, ref)` or equivalent in `src/wall-length.ts`, used by `previewLengthCm`) and test: start (510,0), cap reference, end (900,0) -> 400; cross-axis end -> axis length; free start / face reference -> axis length. If the writer instead keeps this as a composition in `main.ts`, the test-plan must say that the scenario is manual-only and the spec scenario must be accepted as uncovered by the user; as it stands the claim of full pure-function extraction is false.
4. Optional (not blocking): a `chainSegment`-level test at 0.4 and 0.6 degrees from the early axis (end of the segment), and a start laterally off the early axis to kill the `dist` mutant of `startOverhangCm`.

## Verdict

VERDICT: FAIL
