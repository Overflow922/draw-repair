# Test Validation

Change: `fix-collinear-edge-to-edge-length`. Round 2, fresh context. Reviewed: `src/wall-length.test.ts`, `src/wall-length-chain.test.ts`, `src/wall-length.test-utils.ts` against the delta specs `length-input` and `ruler-tool`, design D1-D6, test-plan, test-suite and the round-1 report (`test-validation-round1-fail.md`), plus the production geometry (`wall-geometry.ts` `pairEnd`, `wall-angle.ts` `StartRef`, `wall-chain.ts`, `ruler.ts`).

## Method

- Nothing in the repository was modified except this file. The reference implementation (D1, D2, D5 and now `previewEdgeLengthCm` of D3) and all mutants lived only in the validator scratchpad. `chainSegment` and `rulerReading` were scratchpad copies of the production modules with D2/D6 applied. A temporary `vitest.validate.tmp.config.ts` aliased `./wall-length`, `./wall-chain`, `./ruler` and included only `src/wall-length*.test.ts`; it was deleted after the last run.
- Reference run: **56 / 56 tests pass** (2 files). Every expectation is therefore consistent with the specification, the design and the existing `displayPolygons` geometry; no test expectation conflicts with the spec.
- Mutants: 30 single-fault mutants, each run against the full 56 tests (same count of tests as the suite file claims; the tests are discovered by the runner).

## Requirement Coverage

- PASS
- Every scenario of the delta specs has an executable test:

| Spec scenario | Tests |
|---|---|
| length-input: Введённая длина отсчитывается от плоскости торца (end (900,0), body x in [500,900], size between corners) | TL-1, TL-1a, BE-1 (independent `displayPolygons` extent) |
| Живая длина превью - от плоскости торца | PV-1, PV-7 (+ PV-2..PV-6 negatives) |
| Слияние удлиняет на введённую длину | MG-1 (real, unmodified `mergeContinuation`) |
| Поперёк оси - длина по оси | TL-2, PV-2 |
| Угловой стык и T-примыкание не меняются | OH-5, OH-6, OH-17, OH-18, RL-3 |
| Выделенная стена с выступом торца (4000) | OH-3, OH-9 |
| Ввод длины выделенной стены 4500 -> b=(950,0) | RS-0, RS-0a, RS-1 (real `resizeWallBounded`) |
| Значение не больше выступа | TL-3, TL-3a, TL-3b, RS-0a |
| Сцена из обращения (195 мм, 1512 мм) | SO-1a, PV-7, TL-5, BE-2 |
| ruler-tool: Замер стены по оси (from/to on the edge, length edge-to-edge) | RL-1, RL-1a, RL-2, RL-3, RL-4, BE-2 |
| Живое значение / длина выделенной стены 50 см без выступов | OH-7, RL-4 |

- "Размер между углами тела" is checked through the independent `bodyExtentAlongAxis` oracle instead of the Dimension tool (documented reason: no auto length dimension for flush collinear walls, TODO.md line 562). Acceptable.
- Out-of-scope `main.ts` wiring (`previewLengthCm` -> `previewEdgeLengthCm`, `liveLengthCm` -> `edgeLengthCm`, `resizeSelected` -> `axisLengthForEdgeCm` + `resizeWallBounded`): after round 2 each of these lines is a one-call delegation to a pure function that is fully tested (PV-1..PV-7, OH-3, RS-0, RS-0a, RS-1). A wiring mistake is possible (wrong argument) but cannot hide any branching logic. The hand check is recorded in TODO.md (line 566, Tests). I judge this acceptable and not blocking.

## Boundary Coverage

- PASS
- Gap at `jointTol` (OH-10) and beyond (OH-11); gap smaller than half-thickness (OH-15, SO-5) and mixed thickness 30/10 with gap 12 (OH-16); typed == overhang, below, just above (TL-3, TL-3a, TL-3b, RS-0a); direction tolerance 0.4 / 0.6 degrees on `startOverhangCm` (SO-1b, SO-1c); lateral offset of the start (SO-6); 195 mm thickness (SO-1a, PV-7, TL-5, BE-2).
- Not tested (optional, round-1 item 4): 0.4 / 0.6 degrees at the `chainSegment` end level. The mutants of the tolerance (`tol1`, `tol03`) are killed at `startOverhangCm` level, and `chainSegment` takes its overhang from that same function, so the residual risk is low.

## Negative Cases

- PASS
- Early wall (OH-2), free end (OH-7), face reference / no reference / reference without anchor (SO-2..SO-4, PV-3, PV-4, TL-4, TL-4a), cross-axis and backward direction (SO-1d, PV-2, PV-6, TL-2), near-collinear 3 degrees (OH-12), three ends at a vertex (OH-13), over-threshold gap (OH-11), perpendicular and oblique joints with non-zero gap (OH-17, OH-18), zero segment (PV-5), non-positive typed values (unchanged existing path).

## Error Handling, Invariants, State Transitions, Integration

- PASS. Typed value not above the overhang is rejected for drawing (TL-3, TL-3a) and for the selected-wall field (RS-0a). Invariants: edge length >= axis (OH-14), edge length == independent body extent for both array orders (OH-9, BE-1, BE-2, OH-15, OH-16), round trip typed L -> edge length L (TL-1a), merge adds exactly L (MG-1). Integration chain draw -> typed length -> wall -> body / ruler / merge / resize runs on real `displayPolygons`, `mergeContinuation`, `resizeWallBounded`, `rulerReading`; no mocks of the system under test.

## Implementation Independence and Assertion Strength

- PASS
- Expected numbers come from the spec scenarios and geometry (400, 390, 440, 450, 4, 12, 294, 9.75, 151.2), not from `wall-length.ts`; the body-extent oracle uses `displayPolygons`. Assertions are exact (`toBeCloseTo` 4..6 digits, point equality). Imports are limited to the API named in design D1/D2/D3/D5. Minor: negative assertions use `toBe(0)`, which would reject `-0` (`Object.is`); a correct implementation is unlikely to produce `-0` for these inputs. Not blocking.

## Mutation Testing

No mutation tool is configured in the project; hand-made mutants were run against the reference (30 total, all round-1 mutants re-run plus the new ones).

| Mutant | Killed by | Result |
|---|---|---|
| overhang sign inverted | 17 tests (OH-1, OH-3, OH-4, TL-1a, BE-1, RL-1, RS-1 ...) | killed |
| overhang = half new-wall thickness (round-1 survivor) | OH-15, OH-16 | killed |
| collinearity check removed in `endOverhangCm` (round-1 survivor) | OH-17, OH-18 | killed |
| overhang counted for the early wall / ignoring array order | RL-2, OH-2, OH-3, OH-8, OH-9, RS-0 | killed |
| `edgeLengthCm` end a only / end b only | RL-1a, OH-4, OH-8, OH-9 / 9 tests | killed |
| overhang with three or more neighbours | OH-13 | killed |
| gap threshold doubled / collinearity tolerance 1 degree / 0.3 degree | OH-11 + TL-1a / SO-1c / SO-1b | killed |
| `startOverhangCm` uses `dist(start, anchor)` instead of the projection (round-1 survivor) | SO-6 | killed |
| `startOverhangCm` without collinearity check | SO-1c | killed |
| preview: overhang not added / subtracted | PV-1, PV-7 | killed |
| preview: overhang added for any direction (projection on normal) | PV-2, PV-6 | killed |
| preview: constant half-thickness overhang | PV-6, PV-7 | killed |
| `chainSegment`: overhang not subtracted / added / subtracted twice | TL-1, TL-1a, TL-3b, TL-5, MG-1, BE-1, BE-2 | killed |
| `typed >= overhang` instead of `>` (`typed <= overhang` boundary) | TL-3 | killed |
| `axisLengthForEdgeCm`: no subtraction / `< 0` instead of `<= 0` | RS-0, RS-0a, RS-1 / RS-0a | killed |
| ruler: no shift / wrong direction / swapped ends for reversed walls / axis length number | RL-1, RL-1a (and BE-2 for the number) | killed |
| overhang applied at corner / oblique joint (collinearity removed) | OH-17, OH-18 | killed |

## Surviving Mutations

| Mutation | Result |
|---|---|
| `>=` changed to `>` in the collinearity test of `endOverhangCm` | SURVIVED, equivalent: the boundary is exactly 0.5 degrees, not constructible in floating point. Not a defect |
| `startOverhangCm` ignores `ref.kind === "cap"` | SURVIVED, equivalent in the product: `anchor` is set only for a cap snap (`wall-angle.ts` line 41), and SO-2 carries no anchor. Not a defect |
| `startOverhangCm` ignores `dot(dir, normal) > 0` | SURVIVED, equivalent: the `d > 0` clamp on the projection already returns 0 for the backward direction from a start outside the early body (SO-1d). Only differs for a start inside the early wall body, which cannot be a snapped cap start |
| `endOverhangCm` skips the "vertex inside the early wall's strip" check (collinear parallel walls offset sideways by more than half the early wall's thickness, within `jointTol`, e.g. E thickness 10, N thickness 30) | SURVIVED, real but low severity: such a joint is outside the pairEnd collinear branch, so the body does not extend and the overhang must be 0 (design D1). No delta-spec scenario describes laterally offset parallel walls, and the geometry cannot occur from a cap snap. Recommended optional test, not blocking |

No surviving critical mutant.

## Findings

- All round-1 required changes (1-3) are met: gap != half-thickness and mixed thickness (OH-15, OH-16, SO-5), displaced corner/oblique joints (OH-17, OH-18), lateral offset of the start (SO-6), and the live preview now has a pure function with seven tests (PV-1..PV-7). The two real round-1 survivors and the `dist` survivor are killed.
- The reference passes all 56 tests, so there is no spec/test conflict; the test-suite.md claims about the initial results are plausible and not contradicted.
- `src/wall-length.ts` does not exist yet; the tests will fail on import until implementation. This is expected for the test-first phase. Implementation must export exactly `endOverhangCm(wall, end, walls)`, `edgeLengthCm(wall, walls)`, `startOverhangCm(ref, start, dir)`, `previewEdgeLengthCm(ref, start, end)`, `axisLengthForEdgeCm(wall, walls, edgeCm)` with the signatures used by the tests, and `previewLengthCm` in `main.ts` must call `previewEdgeLengthCm`.
- Optional improvements (non-blocking): a test with laterally offset collinear parallel walls (overhang 0); a `chainSegment`-level 0.4 / 0.6 degree test; `toBeCloseTo(0)` instead of `toBe(0)` in negative assertions.

## Verdict

PASS - requirements, boundaries and negative cases have meaningful executable protection; every non-equivalent critical mutant is killed; the only real survivor is a low-severity geometry corner outside the spec scenarios.

VERDICT: PASS
