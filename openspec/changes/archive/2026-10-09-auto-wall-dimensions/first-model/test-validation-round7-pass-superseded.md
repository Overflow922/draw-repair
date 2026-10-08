# Test Validation

Round 7. Validator in a fresh context. Production code, tests, fixtures, specs, design.md and test-plan.md were not modified.
Scope agreed with the project owner: a surviving mutant fails the suite only if it changes user-visible behaviour reachable
through the public API in scenes that `placeWall` can produce (new wall appended last) AND violates a written spec scenario or
requirement sentence.

## Method

- Disposable copy outside the repo (`<scratchpad>\validation-copy7`: src/, package.json, tsconfig.json, vite.config.ts, index.html, node_modules junction).
- In the copy only, a reference `src/auto-dimensions.ts` (`autoWallDimensions`, `placeWall`) written from spec + design D1-D6 (not from the tests):
  per side face, the end point is the own corner unless the face runs inside the body of ANY other wall right after the corner, then the
  vertex where the face leaves that body (convex clip of the face by the neighbour contour from `wallShape`); thickness on a free end
  (`jointAt` / gap distance / `teeEndAttached` / contour containment), `b` first, then `a`; zero visible length skipped; `placeWall` = `violatesDoorways` + append last.
- Mutation harness: node script applying one textual mutation to the reference and running both new test files (JSON reporter).
- The first reference draft had a bug (side 1 contour edge runs b -> a); it was my reference's fault, fixed, not a test defect.

## Results against the reference

- New tests: `npx vitest run src/auto-dimensions` -> 2 files, 57 / 57 passed.
- Whole suite: `npx vitest run` -> 95 files, 1912 / 1912 passed (one earlier run showed a vitest worker crash "Worker exited unexpectedly" with 1911/1912; the repeat was clean - runner flake, not a test failure).
- `npx tsc --noEmit` in the copy (tests included): exit 0.
- Discovery: both test files are picked up by the runner (also in the repo: `src/auto-dimensions.test.ts`, `src/auto-dimensions-place.test.ts`); the helper `auto-dimensions.test-utils.ts` is imported, not collected.
- No spec conflict, bad oracle or unreachable scenario found: every expected number (490/510/390/410/290/90/40, 20*sqrt2 cases, 60 degree case) is reproduced by an independent implementation.

## Requirement Coverage

- PASS. Every scenario of `specs/dimension-tool/spec.md` has an executable test:

| Scenario | Test |
|---|---|
| Одиночная стена получает три размера | ADW-1, ADW-1f |
| Размеры длины лежат снаружи со своей стороны | ADW-2, ADW-3, ADW-1c, ADW-1d |
| Толщина на свободном торце b | ADW-4, ADW-1b |
| Толщина на единственном свободном торце | ADW-5, ADW-7c, ADW-28 |
| Торец, упирающийся в грань, не свободен | ADW-26 |
| Конец заглублён в тело вне оси | ADW-30 |
| Размер нулевой видимой длины не создаётся | ADW-31 |
| Торец, где сходятся две другие стены | ADW-27 |
| Нет свободных торцов | ADW-7 |
| Прямой угол - видимая часть | ADW-16, ADW-16b, ADW-32 |
| Зафиксированная позже стена заходит в угол | ADW-17 |
| Грань начинается снаружи тела соседа | ADW-24, ADW-24b, ADW-24c |
| Примыкающая перегородка | ADW-23 |
| Заход в угол с внутренней стороны | ADW-19 |
| Разная толщина | ADW-20 |
| Т-примыкание подрезано | ADW-18, ADW-32b |
| Наклонная стена | ADW-8 |
| Один шаг истории | ADW-9 |
| Размеры следуют за стеной | ADW-10, ADW-10b |
| Можно удалить | ADW-11, ADW-11b |
| Можно перетащить | no auto-specific behaviour exists (plain `Dimension`); mutant "extra field on the dimension" is killed by ADW-14b/ADW-1g/ADW-9 |
| Не фиксируемая стена | ADW-12, ADW-12b |
| Загрузка не добавляет размеры | ADW-13 (weak by agreement, out of scope for this round) |

Sentences "не создаются у стен, уже имеющихся" - ADW-1g; "один шаг истории" - ADW-9 (the `main.ts` wiring itself is not unit-testable, recorded in TODO.md).

## Boundary Coverage

- PASS. Thickness 1 and 100 (ADW-1e), wall shorter than thickness (ADW-15b), gap 8 cm at a joint (ADW-28), face coincident with the neighbour boundary (ADW-25/25b), face starting at the neighbour boundary and leaving into it (ADW-24*), zero visible length (ADW-31), end sunk off-axis (ADW-30), directions: leftward, vertical, 30 degrees, 60 degree joint.

## Negative Cases

- PASS. Zero-length wall (ADW-15), doorway-violating wall (ADW-12), no free end (ADW-7), degenerate zero visible dimension (ADW-31), existing walls get nothing (ADW-1g).

## Error Handling

- PASS. `placeWall` returns `null` without side effects (ADW-12, mutation M30/M38/M39 killed); input scene not mutated (M31, X6 killed).

## Invariants

- PASS. At most 3 dimensions, at most one per face and one thickness, none zero, determinism, input immutability.

## State Transitions

- PASS. Undo/redo through `record`/`undoEntry`/`redoEntry` (ADW-9); follow on move/stretch (ADW-10/10b); erase one / cascade (ADW-11/11b); store round trip (ADW-14b).

## Integration Behavior

- PASS. `placeWall` against the real doorway guard, history, wall-edit, delete and storage modules.

## Implementation Independence

- PASS. Tests import only `autoWallDimensions` / `placeWall` from `./auto-dimensions` (module and signatures fixed by design D1) and resolve dimensions to points via the existing public `dimPointPoint` / `dimGeometry`. Expected values are derived in the spec from contours, not from the implementation. An independent reference passes all of them.

## Assertion Strength

- PASS for in-scope behaviour. `expectLength` / `expectThickness` check both measure points, both line endpoints, offset distance and number. ADW-13 and ADW-14 are weak but out of scope by agreement (no incorrect implementation violating a spec scenario passes ADW-14: mutants with wrong refs/edges are killed elsewhere).

## Mutation Testing

- PASS. about 65 mutants of the reference, 8 distinct survivors, all equivalent / internal / out of scope (below).

Killed (selection; killing test in brackets, full list in the run): offsets swapped, 30 cm, both +40, thickness b -40, thickness a +40 (ADW-2, ADW-4, ADW-5, ADW-1c/1d/8); prefer a over b, no fallback to a, thickness even if both occupied, no thickness, only one length side, thickness skipped (ADW-1b, ADW-7, ADW-5, ADW-1); occupancy: tee ignored (ADW-26), containment ignored (ADW-30), gap/joint ignored (ADW-27/28/7/7c), tee args swapped (ADW-26), end b joint-only (ADW-31/7); visible part: never (ADW-16/17/27/30/31/32), only at a (ADW-27/30/21), only at b (ADW-16/17/23/32), per side per end (ADW-17/19/22, ADW-21b, ADW-20), touch without inside probe (ADW-25/25b), probe step 0.5 (ADW-16...), neighbours only with endpoint near the end (ADW-30), only walls after / before-restricted-wrong (ADW-16...), wrong neighbour edge first/farthest (ADW-16/23/27...), wrong wall id (ADW-27/29/30), equal-thickness-only (ADW-20/30), perpendicular-only (ADW-22), zero-length filter removed (ADW-31), filter too aggressive (ADW-15b), length < thickness dropped (ADW-15b); placeWall: ignores neighbours (ADW-32, ADW-32b), ignores guard (ADW-12), mutates input (ADW-1f, mutation test), drops dims / doorways (ADW-1g, ADW-1f), regenerates dims for all walls (ADW-1g), wall first (ADW-1f/1g/32), doubled dims (ADW-1), null on any doorway (ADW-12b), violating wall returns scene (ADW-12), extra field on dimension (ADW-14b).

## Surviving Mutations

| Mutation | Expected Failing Test | Result |
|---|---|---|
| M25b / X10: visible-part neighbours restricted to walls earlier in the array | none | Equivalent: `placeWall` appends the new wall last, so every other wall is earlier. Not reachable. |
| M22: nearest instead of farthest vertex when the face starts inside two bodies | none | Out of scope: requires two overlapping wall bodies (excluded by wall-collision rules); with disjoint bodies the face start lies in at most one body. Not a spec scenario. |
| M13: occupancy ignores `jointAt` | none | Equivalent / internal: gap/contour/tee clauses cover the same scenes; removing both `jointAt` and the gap clause (X1) is killed by ADW-27/28/7/7c. |
| M16b / M16c: gap clause checks only `c.a` / only exact coincidence | none | Equivalent / internal: `jointAt` and contour containment cover those scenes; X1 (all gap detection removed) is killed. |
| M21b: redundant interval-start check removed | none | Equivalent / internal: inside-probe performs the same test. |
| X2: contour containment excludes boundary | none | Internal: boundary-only end without tee/joint/gap not constructible from spec scenarios; ADW-29 (mitre zone) is covered by the tee clause. |
| X11: zero-length threshold 1 cm instead of EPS | none | Numeric micro-variation (rule c); the spec only states length equal to zero. |
| X17: internal clamp in a comparison variable | none | Internal structure, identical dimensions. |

No in-scope survivor.

## Findings

- All round-6 survivors are now killed: M1 (placeWall ignores scene neighbours) by ADW-32/ADW-32b; M2 (neighbours only near the end) by ADW-30; M3 (zero-length filter removed) by ADW-31.
- Spec sentences added in round 6 (zero visible length, end sunk off-axis) have scenario-level tests (ADW-31, ADW-30) with strong numeric oracles that the independent reference reproduces.
- Weak assertions ADW-13 / ADW-14 and the unit-untestable `main.ts` wiring (one `pushRecord`, calling `placeWall`) are known and excluded from this round by agreement; the wiring is a leftover in TODO.md.

## Required Changes

- None.

## Verdict

VERDICT: PASS
