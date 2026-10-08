# Test Validation (round 3)

Validator: fresh context, read-only. Earlier reports (round 1, round 2) were used as context only; everything below was re-verified against the real code.

## Method

- Disposable copy outside the repo (`<scratchpad>\validation-copy3`: `src/`, `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `node_modules` as a junction). The repo contains no `src/auto-dimensions.ts`.
- In the copy only: reference `src/auto-dimensions.ts` written from the SPEC and design D1-D3 (not from the tests). Edges 0/1 are side faces, 2/3 are the end faces a/b (`wallSegments`). Offset 40. Thickness goes on the free end b, else a, else none (free = `jointAt` returns null). A face end point is the face's own corner, unless the face, stepped 1e-3 from its own corner, lies strictly inside the body (`wallShape`) of the wall jointed at that end. In that case it is the crossing where the face leaves that body. The `Dimension` refs are (side, end cap) or (side, edge of the neighbour). Mutants are switched with the env variable `MUT`.
- The reference was derived independently of the tests and passed all of them on the first run, so no test is wrong or unreachable.

## Run results

| Command (in the copy) | Result |
|---|---|
| `npx vitest run src/auto-dimensions` against the reference | 2 files, **44 / 44 passed** (31 in `auto-dimensions.test.ts`, 13 in `auto-dimensions-place.test.ts`); both files are discovered by the runner |
| `npx vitest run` (whole suite, with the reference) | 95 files, **1899 / 1899 passed** (3 repeat runs). One earlier run showed `Worker exited unexpectedly` (94/95 files, 1898/1899). It did not reproduce in 3 runs and is unrelated to the change (runner worker crash). |
| `npx tsc --noEmit` | exit 0, no errors (the test files typecheck against the reference) |
| `git status` in the repo | only the existing untracked change files; no changes in tracked `src/`; no `src/auto-dimensions.ts` |

## Requirement Coverage

- PASS. Every scenario in `specs/dimension-tool/spec.md` has an executable test:
  - three dimensions on a single wall: ADW-1, 1b-1e, 8;
  - sides and offset: ADW-2, 3;
  - thickness end: ADW-4, 5, 6, 7, 7b, 7c;
  - right angle, 490/510 and 390/410: ADW-16, 17;
  - right angle from the inner side: ADW-19;
  - different thickness: ADW-20;
  - the new scenario "Грань начинается снаружи тела соседа": ADW-24;
  - partition: ADW-23;
  - T-joint: ADW-18;
  - tilted wall: ADW-8;
  - history step: ADW-9;
  - follows the wall: ADW-10, 10b;
  - erase: ADW-11, 11b;
  - guard: ADW-12;
  - load: ADW-13.
- Extra cases are also covered: end b (ADW-21), a 60-degree joint (ADW-22), a degenerate wall (ADW-15, 15b).
- "Автоматический размер можно перетащить" has no test of its own. The plan justifies this: the behaviour is the same as for a hand-placed dimension. Not blocking.

## Boundary Coverage

- PASS. Covered: thickness 1 and 100, a wall shorter than its thickness, zero length, drawing direction, vertical and 30-degree walls, 45 and 60 degrees, a face starting outside a neighbour's body (ADW-24), a face along a boundary (ADW-7b, 7c), a partition touching mid-face (ADW-23).
- Gap: the cell "minus face, end b, neighbour contains the face start" (see the table and Required Changes).

## Negative Cases

- PASS. Covered: no free end (ADW-7), guard violation returns null (ADW-12), no dimensions for old walls (ADW-1g), zero length (ADW-15).

## Error Handling

- PASS. A guard violation returns null and leaves the input unchanged (ADW-12, "не мутирует входную сцену").

## Invariants

- PASS. At most 3 dimensions, no zero dimensions, one thickness dimension, determinism, no mutation of input walls.

## State Transitions

- PASS. Undo/redo as a single step (ADW-9). Move and stretch (ADW-10, 10b). Delete a dimension or a wall (ADW-11, 11b). `main.ts` wiring is outside automated tests, as planned (manual check, recorded in TODO.md).

## Integration Behavior

- PASS. Real `history`, `deleteObjects`, `wall-edit` and `storage` are used without mocks.

## Implementation Independence

- PASS. Everything goes through the public API (`autoWallDimensions`, `placeWall`) and is resolved to points via the shared `dimPointPoint` and `dimGeometry`. Edge numbers are not asserted, except in ADW-14. The reference was written from the spec and passes. The oracles (490/510/390/410, 518.28/538.28) agree with the spec text and with the real `wallShape` contours.

## Assertion Strength

- PASS (with non-blocking notes).
  - The `if (!next) return` guards in `auto-dimensions-place.test.ts` are preceded by `expect(...).not.toBeNull()` or `throw`, so none of them can pass vacuously.
  - ADW-14 is weak. It only checks that the new wall's id appears among the refs, so a mutant referencing neighbour edges passes it. The numeric tests catch that class of mutant anyway (the `wrongEdge` mutant died on 6 tests). Not blocking.
  - ADW-13 only does a store round-trip through existing code, so any implementation passes it. It is a documentation-style test, and the property holds structurally because only `placeWall` creates dimensions. Not blocking.

## Mutation Testing

- FAIL. One non-equivalent, reachable mutant survives.

## Surviving Mutations

Mutants were run in the copy with `MUT=<name>` against the two new test files.

| Mutation | Expected Failing Test | Result |
|---|---|---|
| thickness offset sign flipped on end a | ADW-5, 7c, 21 | killed (3) |
| thickness offset sign flipped on end b | ADW-4, 1c, 1d, 8, 1e, 6, 7b, ... | killed (10) |
| same sign for both length offsets | ADW-2, 3, ... | killed (18) |
| always end a | ADW-1b, 4, ... | killed (14) |
| always end b | ADW-5, 7, 7c, 21 | killed (4) |
| a-first end choice | ADW-1b, 4, 1c, 1d, 8, 1e, 10b | killed (7) |
| inverted free test | ADW-1, 1g, 9, 10, 4, 5, 6, 7 ... | killed (23) |
| own corner always (`ownAlways`) | ADW-16, 16b, 17, 23, 19, 20, 21, 22 | killed (8) |
| **`exitAlways`** (take the neighbour crossing even when the face starts outside the body) | ADW-24 | **killed** (only ADW-24). Concrete failure: N t20 and E t40 at 45 degrees, `expected 38.284 to be close to -18.284`. The mutant measures from the touch point at t = 38.28 instead of the own corner at t = -18.28, so the numbers become 510 instead of 518.28 and 490 instead of 538.28 |
| nearest crossing instead of farthest | none | survives, **equivalent**: the neighbour's body is a convex quad and the face starts inside it, so there is exactly one exit crossing |
| farthest crossing instead of exit | none | survives, **equivalent** (same reason) |
| farthest touch among ALL neighbour segments of all walls | ADW-23, 16, 17, 24, 18, ... | killed (11) |
| offset 40 -> 4 | 22 tests | killed |
| offset 40 -> 400 | 22 tests | killed |
| swapped result order | ADW-1b | killed |
| `placeWall` mutates the input | ADW-1f, "не мутирует входную сцену", ADW-9 | killed (3) |
| `placeWall` ignores the doorway guard | ADW-12 | killed |
| `placeWall` adds no dimensions | ADW-1, 1f, 1g, 9, 10, 10b | killed |
| dimensions for old walls | ADW-1f, 1g | killed |
| thickness dropped when one end is free | ADW-5, 6, 7b, 7c, 16b, 17, 18, 21 | killed (8) |
| thickness always on one end | covered by the always-a / always-b rows | killed |
| wrong neighbour edge ref | ADW-16, 16b, 23, 20, 21, 22 | killed (6) |
| inside test at the corner instead of a step | ADW-21 | killed |
| no exit at (plus face, end a) | ADW-16, 16b, 23, 20, 22 | killed |
| no exit at (plus face, end b) | ADW-21 | killed |
| no exit at (minus face, end a) | ADW-17, 19, 22 | killed |
| **no exit at (minus face, end b)** | none | **SURVIVES (non-equivalent, reachable)**. Example: E `(500,-400)-(500,0)` drawn before N `(0,0)-(500,0)`. The reference gives minus 490 and plus 510; the mutant gives minus 510. I confirmed that a mirror of ADW-21 with this scene passes against the reference and fails against the mutant |
| exit only when the neighbour comes earlier in the array (`laterOnly`) | none | survives, equivalent in practice: `placeWall` always appends the new wall last, so the neighbour is always earlier |
| exit applied to any wall whose body contains the face start, even one not jointed at that end (`anyWall`) | none | survives. The spec does not define this case: "free end" and "neighbour" are tied to the joint, and the design derives the neighbour via `jointAt`. Noted, not required. |

## Findings

- Reference vs spec: no test contradicts a spec-consistent implementation. All 44 tests pass the independent reference, and the whole suite is green (1899 / 1899).
- Round 2 gap closed: `exitAlways` is now killed by ADW-24 (`src/auto-dimensions.test.ts:208-220`), with the concrete 45-degree numbers shown in the table. The oracles 490 + 20*sqrt(2) and 510 + 20*sqrt(2) agree with the spec scenario.
- Remaining gap: of the four cells "which face x which end gets the neighbour exit", three have a test. ADW-16 covers plus/a, ADW-21 covers plus/b, and ADW-17/19 cover minus/a. **minus/b is untested** (`src/auto-dimensions.test.ts`, no test with a neighbour entering from the minus side at end b). The rule is the core business logic of the change, and the cell is reachable by an ordinary drawing, so a bug such as a wrong direction or index for side 1 at end b would pass the whole suite.
- Non-blocking:
  - ADW-14 and ADW-13 are weak (see Assertion Strength).
  - There is no test for dragging the dimension line (justified in the plan).
  - A face starting inside a wall that is not jointed at that end is not covered by the spec.

## Required Changes

1. Add a test (for example ADW-21b) in `src/auto-dimensions.test.ts` for the missing cell, a mirror of ADW-21 on the minus side: walls `[E, N]` with E `(500,-400)-(500,0)` and N `(0,0)-(500,0)`, both t20. Expect:
   - `expectLength(plus, N, 1, 0, 510)`;
   - `expectLength(minus, N, -1, 0, 490)`;
   - one thickness dimension on end a (`expectThickness(..., N, 0, -1)`).

   This test must also appear in `test-plan.md` (Requirements Coverage and the "Прямой угол у конца b" row) and in `test-suite.md`. The spec text already covers the case through the general rule, so no spec change is needed. I checked this scene against the independent reference: it passes on the reference and fails on the `skip1b` mutant.

## Verdict

VERDICT: FAIL
