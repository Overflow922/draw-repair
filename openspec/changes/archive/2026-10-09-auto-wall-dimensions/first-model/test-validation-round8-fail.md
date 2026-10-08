# Test Validation

Round 8 (new cycle, dynamic point kind «конец грани»). Validator: independent, fresh context, read-only for the repository.

## Method and evidence

- Disposable copy OUTSIDE the repo (`%TEMP%\...\scratchpad\validation-copy8`: `src/`, configs, `node_modules` through a junction). In the copy only, the NEW design was implemented strictly from spec + design D2/D6: `EdgesPoint | FaceEndPoint` union in `types.ts`; `dimPointPoint` resolves `FaceEndPoint` by rules 1-3 (rule 1 inner exit with a 0.001 cm probe and deepest touch, rule 2 outer extension along the boundary edge of a non-parallel wall when the extension does not pass through any wall interior, rule 3 own corner); `isDimension`/`parseStore`/`cloneScene`/`refsWall` handle both kinds; `autoWallDimensions`/`placeWall` build `FaceEndPoint` length dimensions (+40 / -40, dropped when the projected length is not positive) and edges-based thickness dimensions. Mutant switches were added to the copy through an env variable (`MUT`).
- Repository, old implementation: `npx vitest run src/auto-dimensions` -> 14 failed, 60 passed (ADW-14, 33, 33b, 34, 35, 36, 37, 38, 39, 40, 40d, 42, 42c, 43), as announced.
- Reference implementation (new design), `node node_modules/vitest/vitest.mjs run src/auto-dimensions`: 4 files, **74 passed, 0 failed** (auto-dimensions.test.ts 42, auto-dimensions-place.test.ts 15, auto-dimensions-sequence.test.ts 8, auto-dimensions-point.test.ts 9). All new and changed tests pass, including ADW-35 (all 24 orders), ADW-33b, ADW-36..39, ADW-40..43, ADW-14 and ADW-1g.
- Whole suite against the reference, run twice: **97 files, 1929 tests, all passed** both times (no runner flake). `tsc --noEmit` in the copy: no errors.
- Tests are discovered by the runner (74 tests in the 4 `src/auto-dimensions*.test.ts` files; the helper `auto-dimensions.test-utils.ts` is not a test file and is imported correctly).
- No oracle was wrong: no test needed a deviation from spec/design; every failure while building the reference was a reference deviation and was fixed in the copy.
- Mutation tooling: none in the project (no Stryker); manual mutants through env switches plus a random-scene fuzz (5871 scenes of 3-4 walls on a 100 cm grid, reference vs mutant) to decide equivalence.
- `git status` in the repo after validation is the same as before: no `src/` changes by the validator; the only file created is this report.

## Requirement Coverage

- FAIL. Every scenario of both requirements has a test (map: single wall ADW-1..4; free end ADW-5, 6, 7, 7b, 7c, 26..30; zero length ADW-31, 15; corners ADW-16..25b, 21b, 22; placeWall ADW-32, 32b, 1f, 1g, 12; history ADW-9; follow/erase ADW-10, 10b, 11, 11b; load ADW-13; room inner/outer ADW-33/34; order ADW-35; later neighbour ADW-36; delete neighbour ADW-37; collinear ADW-38; abutting partition ADW-39; store/restore ADW-40..40d; cascade ADW-41; format ADW-42..42c; missing wall ADW-43). «Автоматический размер можно перетащить» has no automated test (plain `Dimension`, accepted since round 1).
- But several SENTENCES of the rules 1-3 in the requirement «Точка замера „конец грани“» have no protection (see Findings F1..F6): rule 2 «лежит на границе» (contiguity, begins at Q, non-perpendicular walls), rule 2 «не проходит через внутренность», rule 1 «самая глубокая при нескольких», and the «видимая длина не положительна» dropping.

## Boundary Coverage

- FAIL for the same reasons. Covered: zero visible length (ADW-31), stub shorter than thickness (ADW-15b), thickness 1 / 100 (ADW-1e), collinear and equal-face walls (ADW-25, 25b, 38), edge-on-edge flush at the room corners (ADW-33..36). Not covered: rule 2 when the edge on the face line begins exactly at Q (F3), when it is disconnected from Q (F1), non-perpendicular corners (F2), negative visible length (F6).

## Negative Cases

- PASS. Guard violation returns `null` (ADW-12), no thickness when no free end (ADW-7), no dimensions for old walls (ADW-1g), nothing on load (ADW-13), bad `face`/`end`/`wallId`/`kind` rejected (ADW-42, 42b, 42c), missing wall resolves to `null` (ADW-43), cascade keeps other walls' dimensions (ADW-41, ADW-37).

## Error Handling

- PASS. `dimPointPoint` on a missing wall returns `null` without throwing (ADW-43; mutant that throws is killed); invalid stored points are dropped while the rest of the drawing loads (ADW-42c). Consumers `render.ts`, `export/pdf.ts`, `dimHitDistance` already skip `null`/degenerate geometry (read, not executed).

## Invariants

- PASS for what is claimed: ADW-33b and ADW-35 assert independently (by `wallShape` sampling, not by the code under test) that neither the measured segment nor the dimension line of any room dimension enters a wall body, for all 24 orders. The invariant is not asserted in the scenes listed in F1..F6.

## State Transitions

- PASS. Add a later neighbour (ADW-36), delete it (ADW-37, no recompute, no new dimensions), undo/redo as one step (ADW-9), store round trip (ADW-40, 14b), history snapshots deep (ADW-40c, 40d).

## Integration Behavior

- PASS. Real `placeWall`, `deleteObjects`, `wall-edit` move/stretch, `history` record/undo/redo, `serializeStore`/`parseStore` are used without mocks. The `main.ts` wiring is not unit-testable (known, TODO.md).

## Implementation Independence

- PASS. Oracles are numbers and positions derived from the spec (480/380, 520/420, 490/510, 518.28/538.28 ...) and from independent `wallShape` sampling; `measure()` goes through the public `dimPointPoint`/`dimGeometry`. The tests accept both point kinds only through the public type. The reference written only from spec + design passes all 74 tests without adaptation.

## Assertion Strength

- PASS except the listed gaps. Test-change-request check: old ADW-14 was a weak `toContain(N.id)`; the new ADW-14 is stronger (point kind, same face, `end` a at `from` and b at `to`, both walls = N, two distinct faces; thickness points owned by N). New ADW-1g uses `ownedBy` (either `wallId` of an edges point), a hair looser than checking both refs of an edges point, but a mixed-reference mutant (`th-mixed-ref`) is killed by 25 other tests, so no protection is lost. The change does not weaken any assertion. Minor note: ADW-40d's «повтор» branch only checks that redo returns the pushed empty scene (`[]`), the face-end data round trip through redo itself is covered by ADW-9.

## Mutation Testing

- FAIL. About 65 mutants were run (tables below); 9 survived: 3 equivalent/internal and 6 in scope (F1..F6).

## Surviving Mutations

In scope (violate a written spec sentence / design D2 behaviour, reachable through `placeWall` in ordinary scenes):

| Mutation | Expected failing test | Result |
|---|---|---|
| `r2-nocontain`: rule 2 accepts a non-parallel wall whose edge lies on the face line but is DISCONNECTED from Q | none exists | SURVIVED. Scene: V `(-100,-10)-(-100,300)` t20, W `(0,0)-(500,0)` t20 (any order). Reference: outer W dimension 500 from `(0,-10)`. Mutant: 610 from `(-110,-10)` (dimension ends at a far unrelated wall). Fuzz: 13 non-overlapping scenes differ. |
| `r2-perp-only`: rule 2 only for perpendicular walls | none exists | SURVIVED. Scene: W `(0,0)-(500,0)` t20, then C `(0,0)-(150,260)` (60 deg), t20. Reference: outer 517.32 from `(-17.32,-10)`, inner 482.68 from `(17.32,10)`; mutant: outer 500 from `(0,-10)`. Same for 45 deg (504.1 vs 500) and 120 deg. Spec says «не параллельной», no perpendicularity. Fuzz: 37 non-overlapping scenes differ. |
| `r2-interior-only`: rule 2 only if Q is strictly inside the edge (edge must extend both ways), not when the edge BEGINS at Q | none exists | SURVIVED. Scene: W `(0,0)-(500,0)` t20, then C `(-10,400)-(-10,0)` t20 (C's right face flush with W's end). Reference: outer 520 from `(-20,-10)`, inner 500; mutant: outer 500 from `(0,-10)`. Design D2: «начинающееся в Q или содержащее Q». (Earlier order W after C is not distinguishing.) |
| `r1-shallow`: rule 1 takes the SHALLOWEST exit instead of «самая глубокая при нескольких» | none exists | SURVIVED. Scene: E1 `(0,0)-(0,400)` t20, E2 `(0,0)-(0,400)` t40, then N `(0,0)-(500,0)` t20. Reference: N inner 480 from `(20,10)`. Mutant: 490 from `(10,10)` (end inside E2's body). ADW-27 has two bodies with the SAME exit, so it does not discriminate. |
| `r2-throughbody`: rule 2 ignores «не проходит через внутренность тела какой-либо стены» | none exists (ADW-39 has no edge on the face line, so the clause is never exercised) | SURVIVED. Scene: W `(0,0)-(500,0)` t20, L `(0,400)-(0,0)` t20, D `(-200,-12)-(0,-12)` t20 (D's body covers the extension of W's outer face to the left of Q, any order). Reference: outer 500 from `(0,-10)`; mutant: 510 from `(-10,-10)` inside D. |
| `zero-only`: length dimension dropped only when projected length equals zero, not when it is negative | none exists (ADW-31 is exactly zero) | SURVIVED. Scene: E `(0,0)-(0,400)` t20, F `(14,0)-(14,400)` t20, then A `(0,0)-(14,0)` t20. Reference: only the face `y = -10` dimension (34 cm, `(-10,-10)-(24,-10)`); mutant also creates a face `y = 10` dimension from `(10,10)` to `(4,10)` (6 cm, the measured segment lies inside bodies). Design D2 and the owner's brief: «не создаётся, если длина не положительна». |

Equivalent / internal (no user-visible difference):

| Mutation | Why equivalent |
|---|---|
| `r2-selfok`: rule 2 also considers W itself | W is parallel to itself and is skipped by the non-parallel condition. |
| `r2-after-only`: rule 2 considers only walls that stand LATER than W | 0 differences in 5871 random scenes; a wall standing earlier gets its corner mitered by W itself, so Q is already the outer vertex. |
| `refs-from-only`: cascade checks only the `from` point | both points of every automatic dimension belong to the same wall; manual cross-wall dimensions are an older capability, the whole existing suite (1929 tests) does not distinguish it either. Not in the scope of this change. |

Killed (killing tests in brackets, selection of the first ones):

| Group | Mutants and killers |
|---|---|
| Anchoring | `static` (anchor to own corner): ADW-32, 33, 33b, 35, 36, 27, 30, 16, 17, 23, ... ; `r1-last-only` (rule 1 only at creation): ADW-33, 33b, 35, 36; `r2-last-only`: ADW-34, 35, 36 |
| Rule 1 | `no-rule1` (many); `r1-noprobe` (touch without inside probe): ADW-26..30, 38, 39, 16, 24...; `r1-bound` (boundary counts inside): ADW-25, 25b, 34, 35, 36; `r1-after-only`: ADW-27, 30, 31, 33..; `r1-before-only`: ADW-33, 35, 36 |
| Rule 2 | `no-rule2`: ADW-34, 35, 36; `r2-parallel` (parallel walls included): ADW-38; `r2-near` (nearest vertex): ADW-34, 35, 36; `r2-dir` (inward): ADW-34, 35, 36; `r2-before-only`: ADW-34, 35, 36 |
| Rule 3 | `r3-axis` (axis end instead of own corner): ADW-1, 2, 3, 8, 16..; `res-face-swap`: ADW-2, 16, 33b, 35...; `res-end-swap`: ADW-1, 14, 40 ... |
| Dimension construction | `swapends`: ADW-14, 1, 40...; offsets `off4`/`off30`/`off400`: ADW-2, 4, 5, 16...; `len-sign-same`/`len-sign-flip`: ADW-2, 3, 33b, 35; `only-face0`: ADW-1, 33..; `order-th-first`: ADW-1b; `nozerodrop`: ADW-31 |
| Thickness | `th-sign-same`/`th-sign-flip`: ADW-4, 5, 26, 27, 28, 29; `th-always-b`/`th-always-a`/`th-prefer-a`/`th-no-fallback`/`th-even-occupied`/`th-none`: ADW-5, 6, 7, 7c, 26, 27, 31; occupied-end parts `occ-no-joint` (ADW-28), `occ-no-tee` (ADW-29), `occ-no-contain` (ADW-27, 30); `th-mixed-ref`: ADW-32, 32b, 5, 6, 16, 22... |
| Storage / history / cascade | `st-nokind`, `st-nowall`, `st-badface`, `st-badend`: ADW-42b/42c; `st-dropkind`, `st-dropend`: ADW-40, 40c, 40d, 9, 1g, 14b, 42c; `st-only-edges`: ADW-14b, 40, 42, 42c; `clone-shallow`: ADW-40c; `refs-ignore-faceend`: ADW-11b, 41; `refs-all-faceend` (deleting any wall deletes all face-end dimensions): ADW-41, 37; `throw-missing`: ADW-43 |
| placeWall | `pw-ignoreguard`: ADW-12; `pw-mutate`: ADW-1f, 9, input-immutability; `pw-dropold`: ADW-1g, 36, 37...; `pw-regen-all`: ADW-1f, 32; `pw-noneighbours`: ADW-32b; `pw-wall-first`: ADW-1f, 1g, 32, 41; `pw-doubled`: ADW-1, 9...; `pw-nulldoorways`: ADW-1f |

## Findings

All survivors are in `rule 2` / `rule 1` / dropping of the face-end resolution (spec «Точка замера „конец грани“», design D2); none is in storage, history, cascade or placeWall.

- F1 (natural scene, strongest): rule 2 contiguity. Nothing stops an implementation from jumping the outer dimension to a DISCONNECTED corner of an unrelated wall whose cap edge lies on the same line (610 instead of 500 for V + W). Needed test: W `(0,0)-(500,0)` t20 plus V `(-100,-10)-(-100,300)` t20; the outer dimension of W must stay 500 from `(0,-10)` (both orders), the inner stays 500.
- F2 (natural scene): oblique corners. Rule 2 is specified for a «не параллельной» wall; only perpendicular corners are tested (ADW-34..36). Needed test: W `(0,0)-(500,0)` t20 then C `(0,0)-(150,260)` t20: W outer = 517.32 from `(-17.32,-10)`, W inner = 482.68 from `(17.32,10)` (60 deg); add a second angle (45 deg: 504.12 from `(-4.14,-10)` / 495.86 from `(4.14,10)` is the same construction with C to `(-300,300)`; derive the oracle from the C contour).
- F3 (natural scene): the edge BEGINS at Q. Needed test: W `(0,0)-(500,0)` t20, then C `(-10,400)-(-10,0)` t20 (flush faces): W outer = 520 from `(-20,-10)`, inner = 500 from `(0,10)`.
- F4 (overlapping walls): rule 1 «самая глубокая при нескольких». Needed test: E1 `(0,0)-(0,400)` t20, E2 `(0,0)-(0,400)` t40, then N `(0,0)-(500,0)` t20: N inner = 480 from `(20,10)`, outer = 500 from `(0,-10)`.
- F5 (overlapping walls): rule 2 «не проходит через внутренность». Needed test: W `(0,0)-(500,0)` t20, L `(0,400)-(0,0)` t20, D `(-200,-12)-(0,-12)` t20 (any order): W outer = 500 from `(0,-10)`, W inner = 490 from `(10,10)`.
- F6 (overlapping walls): negative visible length. Needed test: E `(0,0)-(0,400)` t20, F `(14,0)-(14,400)` t20, then A `(0,0)-(14,0)` t20 via `placeWall`: exactly ONE length dimension, 34 cm on the face `y = -10`, none on `y = 10`.
- Observation O1 (spec ambiguity, NOT required): when a partition's face lies exactly on the seam between two collinear walls (N1 `(0,0)-(255,0)`, N2 `(255,0)-(500,0)`, T `(255,300)-(255,10)` with its face on `x = 255`... i.e. T axis 250, t10), rule 2 as written applies (the line lies on the boundary of both walls, in the interior of neither) and the reference yields a 310 cm dimension through the merged wall body. This conflicts with the sentence «размер не заходил в тела стен»; the spec should state whether collinear seams count as interior. No test is asked for until the spec is clarified.
- Observation O2 (doc drift, not blocking): `test-plan.md` «Integration Cases» mentions `src/auto-dimensions-storage.test.ts`, which does not exist (the storage round trip is ADW-14b in `auto-dimensions-place.test.ts` and ADW-40 in `auto-dimensions-point.test.ts`).
- Consistency check spec / design D2, D6 / test-plan / tests: no contradiction found. Spec, design and tests agree on all numbers (480/380, 520/420, 490/510, 390/410, 518.28/538.28, 290, 90, 40); the reference derived from spec + design passes everything. The mutation-target list in test-plan names «правило 2 всегда» as killed by ADW-39, but ADW-39 does not exercise the «не проходит через внутренность» clause (F5): the plan's claim is inaccurate for that clause.

## Required Changes

Test Writer (tests only, via test-plan/test-suite update; production code and the approved tests stay unchanged) must add, in `src/auto-dimensions-sequence.test.ts` or a new test file, tests with spec-derived oracles for:

1. F1: disconnected cap edge on the face line must not move the dimension end (V + W).
2. F2: oblique corner(s) for rule 2, at least 60 deg and one more angle, both faces, inner and outer numbers.
3. F3: edge beginning at Q (flush side-by-side wall C at x = -10 after W).
4. F4: two overlapping bodies with different exits for rule 1: deepest exit wins.
5. F5: extension through another wall's interior (W, L, D): outer stays 500.
6. F6: negative visible length dimension is not created (E, F at x = 14, A).

Add the matching rows to `test-plan.md` (Requirements Coverage, Mutation Targets) and `test-suite.md`; re-run the whole suite against the implementation or reference, then request a new validation. Optional: clarify O1 in the spec.

## Verdict

VERDICT: FAIL
