# Test Validation

Round 2 (round 1: `test-validation-round1-fail.md`, not relied upon). Fresh context, read-only for the repository.

Method: disposable copy outside the repo (`<scratchpad>\validation-copy2`: `src/`, package.json, tsconfig.json, vite.config.ts, index.html, `node_modules` junction). In the copy only, a reference `src/auto-dimensions.ts` (`autoWallDimensions`, `placeWall`) was written from spec + design (edges 0/1 side faces, 2/3 end faces; offsets 40; thickness on free end b else a else none; free = `jointAt` null; length point = own corner unless the face runs inside the body of the wall jointed at that end, then the first boundary crossing of the face with that neighbour's real `wallShape`). The reference was NOT derived from the tests. Mutants were switched by an env var in that copy.

## Requirement Coverage

- PASS. Every scenario of `specs/dimension-tool/spec.md` has an executable test: single wall (ADW-1/1b), outside/40 cm (ADW-2/3), free end b (ADW-4), single free end (ADW-5/6/7b/7c), no free ends (ADW-7), L-corner 490/510 (ADW-16), E after N 390/410 (ADW-17), partition Q (ADW-23), inner-side corner (ADW-19), different thickness (ADW-20), end-b corner (ADW-21), 60 degrees (ADW-22), T-trim (ADW-18), tilted (ADW-8), one history step (ADW-9), follow wall (ADW-10/10b), erase (ADW-11/11b), guard (ADW-12), load (ADW-13). Dragging a dimension line is intentionally untested (identical to manual dimension, test-plan says so). The `main.ts` wiring (one `pushRecord`, `placeWall` instead of `walls.push`) is not auto-tested; manual check is recorded in TODO.md per test-plan.
- All spec scenarios checked against the real contours (reference computed from real `wallShape`, all 43 new tests green): L 490/510, E-after-N 390/410, E upward 510/490, different thickness 490/510, end b, T-trim 490, 60 degrees, and ADW-23 premise confirmed: a partition Q butting the face does not change N's contour (jointAt at N's ends does not see Q), so 490/510 holds. No contradictions between spec, tests and real geometry were found.

## Boundary Coverage

- PASS. Zero-length wall, wall shorter than thickness (10/10/20), thickness 1 and 100, horizontal both directions, vertical, 30 degrees, collinear continuation at a and at b, T at b, both ends jointed.

## Negative Cases

- PASS. Guard violation returns null (ADW-12) and aside-wall succeeds (ADW-12b); no dimensions for old walls (ADW-1g); no dimensions on load (ADW-13, weak by nature: parseStore does not touch dimensions, acceptable); no thickness dim without free end (ADW-7).

## Error Handling

- PASS. Only error path is the doorway guard (ADW-12/12b) and zero-length wall (ADW-15).

## Invariants

- PASS. At most 3 dimensions, one thickness, one per face, no zero-length, determinism, no mutation of input walls and input scene (JSON before/after).

## State Transitions

- PASS. Undo/redo through real `history.ts` (`record`, `undoEntry`, `redoEntry`), move/stretch via `wall-edit`, delete via `deleteObjects`, storage round trip via `serializeStore`/`parseStore`.

## Integration Behavior

- PASS. Real geometry (`dimPointPoint`, `dimGeometry`), history, wall-edit, doorway scene, storage are used unmocked. Only the `main.ts` wiring is outside automation (documented).

## Implementation Independence

- PASS. Oracles are built from wall frames (`frameOf`, t/s coordinates) and spec numbers, resolved through `dimPointPoint`/`dimGeometry` only; nothing imported from the module under test except the two public functions. ADW-1f compares `placeWall` to `autoWallDimensions` (self-consistency, but other tests pin the actual values).

## Assertion Strength

- FAIL (one gap, see Findings). Otherwise strong: exact positions of both measuring points, exact dimension-line offsets (40 from face / end), exact numbers. The `if (!next) return` / `if (undone?.kind !== "walls") return` guards are preceded by `expect(...)` so they do not hide failures. ADW-14 (`toContain(N.id)`) is weak by itself but is not relied upon.

## Mutation Testing

- FAIL. Manual probes, no mutation tool in the project. 22 mutants run against the 43 new tests (`npx vitest run src/auto-dimensions`); one reachable, spec-relevant mutant survives.

Commands and counts (in the copy):
- `npx vitest run src/auto-dimensions` with reference: 2 files, 43/43 passed (both files discovered by runner).
- `npx vitest run` (whole suite, new + existing): 95 files, 1898/1898 passed.
- `npx tsc --noEmit`: no errors.

## Surviving Mutations

| Mutation | Expected Failing Test | Result |
|---|---|---|
| thickness offset sign wrong on end a | ADW-5, ADW-7c, ADW-21 | killed |
| thickness offset sign wrong on end b | ADW-4, 1c, 1d, 6, 7b, 10b, 17 ... | killed |
| same-sign length offsets | ADW-2, 3, 16 ... (17 tests) | killed |
| always end a (when free) | ADW-1b, 4, 6, 7b ... (11) | killed |
| always end b (when free) | ADW-5, 7c, 18, 21 | killed |
| a-first instead of b-first | ADW-1b, 4, 1c, 1d, 8 ... (7) | killed |
| inverted free-end test | ADW-1, 4, 5, 6, 7 ... (22) | killed |
| own corner always (never exit) | ADW-16, 17, 19, 20, 21, 22, 23 | killed |
| farthest touch among ALL walls' edges, no inside check (`allTouch`) | ADW-16..23 and others (15) | killed |
| farthest vs nearest crossing of the jointed neighbour (`farExit`) | none | equivalent: after starting inside a convex neighbour there is exactly one exit; probe over 1800 placeWall-order configs (angles 10-353, thickness 6/20/40, both ends) gave byte-identical output |
| 40 -> 4 | ADW-2, 4, 5, ... (21) | killed |
| 40 -> 400 | ADW-2, 4, 5, ... (21) | killed |
| swapped result order | ADW-1b | killed |
| placeWall mutates input scene | ADW-1f, "не мутирует входную сцену", ADW-9 | killed |
| placeWall ignores doorway guard | ADW-12 | killed |
| placeWall adds no dimensions | ADW-1, 1f, 1g, 9, 10, 10b | killed |
| dimensions created for old walls too | ADW-1f, ADW-1g | killed |
| thickness dim dropped when only one end free | ADW-5, 6, 7b, 7c, 18, 21 ... | killed |
| thickness always on b even if jointed | ADW-5, 7, 7c, 21 | killed |
| thickness always on a | ADW-4, 6, 7, 7b ... | killed |
| exit applied always, i.e. first crossing of the neighbour body taken even when the face does NOT start inside it (`exitAlways`) | none | **SURVIVED, NOT equivalent** |
| (mutant `allNeighbours` = jointed-only reference variant with farthest touch) | none | equivalent to reference (Q is not jointed and the inside check skips it) |

## Findings

1. **Surviving non-equivalent mutant `exitAlways` (FAIL).** Spec requirement: the measuring point at a face end is the face's own corner, and only if the face runs from its own corner inside the body of the jointed neighbour is it the exit vertex ("грань, идущая от угла вдоль границы тела соседней стены, а не внутри него, измеряется от своего угла"; design D2 "проверка внутренности коротким шагом от угла"). Test-plan.md:102 claims this mutant "may be equivalent" for orders placeWall produces. It is not: with `[E, N]` (N last, as placeWall always produces) the outputs differ in 252 of 1800 probed configurations (angles 10-80, 178, 283-353 degrees, N/E thickness combinations), for example:
   - E: `(0,0)-(400cos45, 400sin45)`, thickness 40; N: `(0,0)-(500,0)`, thickness 20 (45 degrees). N's face `y = 10` starts at its mitre corner `(-18.284, 10)`, which lies behind E's flat cap (x+y < 0, outside E), then crosses E's cap at `(-10, 10)`. Spec-correct: measure from the own corner, length 518.284. Mutant `exitAlways`: from `(-10, 10)`, length 510. Same face for `y = -10`: own corner `(-38.284, -10)` vs mutant `(10, -10)`.
   - Also N t6 / E t20 at 45 degrees (own `-11.14` vs mutant `-3`) and at 10 degrees (own `-40.57` vs mutant `-0.53`).
   No test uses a joint where the face starts outside the neighbour and later crosses it (ADW-16, 19, 20, 21, 22 and 23 all have faces that either start inside the neighbour or never touch it), so the "not inside -> own corner" half of the rule is only tested by the no-touch case.
2. Everything else checked is consistent: ADW-23's premise holds (Q does not alter N's contour); wallShape-derived numbers in ADW-16/17/19/20/21/22 match what an independent spec-derived implementation produces.
3. Minor, not blocking: ADW-13 cannot fail for any implementation that leaves `parseStore` untouched (it only confirms the storage code does not invent dimensions); ADW-14 weak assertion.

## Required Changes

- Add a test to `src/auto-dimensions.test.ts` (new ID, e.g. ADW-24) for a joint where N is placed last and its face starts outside the jointed neighbour but its line then crosses the neighbour's body: e.g. E `(0,0)-(400cos45, 400sin45)` thickness 40, N `(0,0)-(500,0)` thickness 20, walls `[E, N]`. Assert (using `expectLength` through the real contour) that the face `y = 10` is measured from its own corner as given by the real `wallShape` of N (about `x = -18.284`, length about 518.284) and face `y = -10` from about `-38.284` (length about 538.284), i.e. NOT from the points where the face enters E (`x = -10` and `x = 10`). Verify the numbers against `wallShape` before adding. Add the matching scenario to `specs/dimension-tool/spec.md` (the spec currently only says "not inside -> own corner") or a note in test-plan that this case is the guard for the "exit only when the face starts inside" half. Update test-plan.md:102 (the mutant is not equivalent; it is killed by the new test).
- Re-run validation after the new test lands (against the reference: test must pass; `exitAlways` must fail).

## Verdict

VERDICT: FAIL
