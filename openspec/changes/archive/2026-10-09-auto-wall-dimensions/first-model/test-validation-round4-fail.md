# Test Validation (round 4)

Validator: fresh context, read-only. Earlier reports (rounds 1-3) were context only. This round enumerates the whole face-end-point rule cell by cell and every other decision point at once.

## Method

- Disposable copy outside the repo (`<scratchpad>\validation-copy4`: `src/`, `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `node_modules` as a junction). The repo has no `src/auto-dimensions.ts` (checked at the end with `git status`).
- In the copy only, a reference `src/auto-dimensions.ts` was written from the SPEC and design D1-D3, not from the tests. A face end point is the face's own corner, unless the face stepped 1e-3 from its own corner lies strictly inside the body (`wallShape`) of the wall jointed at that end (`jointAt`). In that case it is the first crossing where the face leaves that body. Thickness goes on free end b, else a, else none. The reference has a mutation switch (env `MUT`).
- A spec-vs-design note found while writing the reference: design D3 says the thickness offset is `+40` at b and `-40` at a. With `from=(e,0)`, `to=(e,1)` this matches the real `dimGeometry` and the tests (the tests assert positions, so the reference passed on the first corrected run). No test is wrong.
- Extra candidate tests (C1, C1b, C2, C3) were written in the copy only, to prove that the gaps below are real. They are not in the repo.

## Run results

| Command (in the copy) | Result |
|---|---|
| `npx vitest run src/auto-dimensions` vs the reference | 2 files, **45 / 45 passed** (both files are discovered) |
| `npx vitest run` (whole suite with the reference), run twice | 95 files, **1900 / 1900 passed** both times, no runner flake |
| `npx tsc --noEmit` | exit 0 |
| `git status` in the repo | no changes in tracked `src/`, no `src/auto-dimensions.ts` |

No new test is wrong, unreachable or in conflict with the spec. Oracles (490/510/390/410, 518.28/538.28, 60-degree values) agree with the spec text and the real contours.

## Requirement Coverage

- FAIL (one spec clause has no protection, see Required Changes 2 and 3). Scenario to test map:
  - three dimensions on a single wall: ADW-1, 1b-1e, 8; sides and offset: ADW-2, 3; thickness end: ADW-4, 5, 6, 7, 7b, 7c;
  - right angle 490/510, 390/410: ADW-16, 17; inner side: ADW-19; different thickness: ADW-20; face starts outside the neighbour: ADW-24; partition: ADW-23; T: ADW-18; tilted: ADW-8;
  - end b: ADW-21, 21b; 60 degrees: ADW-22; history: ADW-9; follows the wall: ADW-10, 10b; erase: ADW-11, 11b; guard: ADW-12, 12b; load: ADW-13; degenerate wall: ADW-15, 15b.
  - Dragging the dimension line has no test. The plan justifies it (same behaviour as a manual dimension). Not blocking.
- Spec clause "a face that runs from its corner ALONG the boundary of the neighbour body, not inside it, is measured from its own corner" has no scenario and no test (gap G2).
- Spec clause "a free end is one to which no other wall adjoins or joins" is tested for one neighbour only (gap G3, needs a decision).

## Boundary Coverage

- FAIL. Thickness 1 and 100, wall shorter than its thickness, zero length, direction right-to-left, vertical, 30/45/60 degrees, collinear joints, a mid-face partition are covered. Not covered: the face-starts-outside case at end b (G1) and the face-along-the-boundary case (G2).

## Negative Cases

- PASS. No free end (ADW-7), guard violation returns null (ADW-12), no dimensions for old walls (ADW-1g), zero length (ADW-15).

## Error Handling

- PASS. Guard violation returns null and the input scene is not changed.

## Invariants

- PASS. At most 3 dimensions, no zero dimensions, one thickness dimension, determinism, no mutation of input walls and of the input scene.

## State Transitions

- PASS. Undo/redo as one step (ADW-9), follow on move and stretch (ADW-10, 10b), erase one dimension or the wall (ADW-11, 11b). `main.ts` wiring is out of automated scope as planned.

## Integration Behavior

- PASS. Real `history`, `deleteObjects`, `wall-edit`, `storage`, `violatesDoorways` are used without mocks.

## Implementation Independence

- PASS. Only `autoWallDimensions` and `placeWall` are used. Points are resolved through the shared `dimPointPoint` and `dimGeometry`. Edge numbers are asserted nowhere except ADW-14. The independent reference passed all 45 on the first run.

## Assertion Strength

- PASS for the existing assertions, with these decisions:
  - ADW-14 is weak (it only checks that the wall id appears among the refs). **Non-blocking**: position tests kill 12 of 16 wrong-ref mutants; the 4 survivors (below) give the same position at creation. Optional strengthening: assert that the `a` ref of every point is `{ wallId: N.id, edge: 0 or 1 }` for length dimensions, and that both points of a thickness dimension have the same `a` edge (2 or 3) on N. This does not couple to the neighbour edge.
  - ADW-13 is not vacuous: it runs the real `parseStore`/`serializeStore`, so a production change that adds dimensions on load would fail it. Non-blocking.
  - The `if (!next) return` guards are preceded by `not.toBeNull()` or `throw`, so none can pass vacuously.

## Mutation Testing

- FAIL. Three non-equivalent reachable mutants survive (rows marked SURVIVES).

## Surviving Mutations

Cells of the face-end-point rule (side x end x {own corner, exit}), each with a test:

| Cell | Exit case test | Own-corner-with-neighbour test | "exit only when face starts inside" test |
|---|---|---|---|
| plus / a | ADW-16, 20, 22, 23 | ADW-17 | ADW-24 |
| minus / a | ADW-17, 19, 22 | ADW-16 | ADW-24 |
| plus / b | ADW-21 | ADW-21b | **none (G1)** |
| minus / b | ADW-21b | ADW-21 | **none (G1)** |

Mutants (run in the copy against the two new test files):

| Mutation | Expected Failing Test | Result |
|---|---|---|
| offset 40 -> 4 / 400 | 22 tests | killed (22 each) |
| same sign for both length offsets | ADW-2, 3 ... | killed (18) |
| length sign flipped on face 0 only / face 1 only | ADW-2, 3 ... | killed (18 / 18) |
| thickness sign flipped on end a / on end b | ADW-5, 7c, 21 / ADW-4, 1c ... | killed (4 / 9) |
| thickness: free-case x wrong sign: both / a only / b only | ADW-4 / ADW-5 / ADW-6 | killed (5 / 4 / 4) |
| thickness: wrong end: both free -> a / only a free -> b / only b free -> a / none -> b | ADW-4 / ADW-5 / ADW-6 / ADW-7 | killed (6 / 4 / 6 / 1) |
| thickness: wrong two corners: both / a only / b only | ADW-1 ... / ADW-5 / ADW-6 | killed (12 / 7 / 12) |
| thickness dropped: both free / only a free / only b free | ADW-1 / ADW-5 / ADW-6 | killed (8 / 5 / 4) |
| thickness dropped when exactly one end is free | ADW-5, 6, 7b ... | killed (9) |
| thickness added when none is free ("none" case wrong end) | ADW-7 | killed |
| always end a / always end b / a-first choice | ADW-1b ... / ADW-5, 7 / ADW-4 ... | killed (13 / 5 / 6) |
| inverted free test | ADW-1 ... | killed (16) |
| own corner always (no exit anywhere) | ADW-16, 17, 19, 20, 21, 21b, 22 | killed (9) |
| skip exit at plus/a, minus/a, plus/b, minus/b | ADW-16 / ADW-17 / ADW-21 / ADW-21b | killed (5 / 3 / 1 / 1) |
| exit uses the other face at plus/a, minus/a, plus/b, minus/b | ADW-16 ... / ADW-21 ... | killed (7 / 9 / 2 / 2) |
| wrong neighbour edge ref (+1) at plus/a, minus/a, minus/b | ADW-16 / ADW-17 / ADW-21b | killed (5 / 3 / 1) |
| wrong neighbour edge ref (+1, +2) at plus/b | none | survives, equivalent at creation: `segClamp` returns the same point for the wrong edge in ADW-21 (+3 is killed by ADW-21). Weakness of ADW-14, not blocking |
| wrong neighbour edge ref (+2, +3) at plus/a, minus/a, minus/b | ADW-16 / ADW-17 / ADW-21b | killed |
| step inside-test in the wrong direction (backwards) | ADW-16 ... | killed (9) |
| exitAlways (all cells) | ADW-24 | killed (1) |
| exitAlways at plus/a, minus/a | ADW-24 | killed (1 each) |
| **exitAlways at plus/b** (take the neighbour crossing although the face starts outside the body) | none | **SURVIVES (non-equivalent, reachable)**. Example C1: E `(500,0)-(500-283, 283)` t40, N `(0,0)-(500,0)` t20, `[E, N]`; reference gives plus 490+20*sqrt(2) and minus 510+20*sqrt(2), mutant gives other values. The candidate test C1 kills it |
| **exitAlways at minus/b** | none | **SURVIVES (non-equivalent, reachable)**; killed by candidates C1 and C1b |
| **nonStrict: a face that runs along the neighbour boundary counts as inside** | none | **SURVIVES (non-equivalent, reachable)**. Example C2: E `(0,0)-(300,0)` and N `(0,0)-(500,0)`, both t20, `[E, N]` (overlapping walls with equal start). Reference: 500 and 500; mutant measures from the end of E: 200. Candidate C2 kills it. This is an explicit clause of the spec |
| farthest crossing instead of exit crossing | none | survives, **equivalent**: the neighbour body is a convex quad and the face starts inside it, so the face leaves it exactly once |
| exit only when the neighbour is earlier in the array | none | survives, equivalent: `placeWall` appends the new wall last, so the neighbour is always earlier |
| exit applied to any wall whose body contains the face start, even one not jointed at that end | none | survives, not defined by the spec ("neighbour" is tied to the joint), not required |
| farthest touch among ALL neighbour segments of all walls | ADW-23, 16, 17, 24 ... | killed (11) |
| swapped result order | ADW-1b | killed |
| only two length dimensions returned | ADW-1 ... | killed (17) |
| `placeWall` mutates the input | ADW-1f, 9, "не мутирует входную сцену" | killed (3) |
| `placeWall` ignores the doorway guard | ADW-12 | killed |
| `placeWall` adds no dimensions | ADW-1, 1f, 1g, 9, 10, 10b | killed (6) |
| dimensions also for old walls | ADW-1f, 1g | killed (2) |

Rows "thickness sign/wrong end/wrong corners/dropped" for the case "none free" that only drop or alter a dimension which does not exist are no-ops and therefore equivalent (not listed as survivors).

## Findings

- All 45 tests agree with an independent reference; the whole suite is green (1900 / 1900) and typechecks.
- Gap G1 (blocking): the rule "use the neighbour exit ONLY when the face starts inside the neighbour body" is protected only at end a (ADW-24). At end b both faces are unprotected, so an implementation that applies exit unconditionally at end b passes all tests. The 45-degree joint at end b is an ordinary drawing.
- Gap G2 (blocking): the spec states explicitly that a face running along the neighbour boundary (not inside) is measured from its own corner, but no test pins the boundary decision. A "boundary counts as inside" implementation passes all tests and returns a wrong number for two walls drawn from the same start.
- Gap G3 (decision needed, see Required Changes 3): when two other walls end near the same end of the new wall (for example a straight wall split into two segments and a partition arriving at the split), `jointAt` returns `null` for `count > 1`. Design D3 says "free = jointAt is null", so a design-faithful implementation treats the end as FREE and places the thickness there. The spec says a free end is one to which no other wall adjoins or joins, so the end is NOT free. No test covers it. Candidate C3 fails against the reference, which follows D3.
- Open question (non-blocking, not required): a new wall whose end touches the FACE of another wall without being inside its axis (a face-adjoining end). `jointAt` returns null there, so it is "free". `teeEndAttached` elsewhere in the app calls it attached. The spec does not give a scenario. Recorded for a decision, no test required.
- Not applicable: dimension numbers in non-default units (formatting is elsewhere), a doorway on the new wall (it has a fresh id and no doorway; ADW-1f/12 cover doorways on other walls and the guard), thickness extremes (ADW-1e).

## Required Changes

1. (G1) Add tests for the 45-degree joint at end b, mirroring ADW-24. Both with `N = (0,0)-(500,0)` t20, `E` t40, `[E, N]`:
   - E `(500,0)-(500-400*cos45, 400*sin45)`: `expectLength(plus, N, 1, 0, 490 + 20*sqrt2, 2)`, `expectLength(minus, N, -1, 0, 510 + 20*sqrt2, 2)`, one thickness dimension on end a;
   - E `(500,0)-(500-400*cos45, -400*sin45)`: plus `510 + 20*sqrt2`, minus `490 + 20*sqrt2`.
   Both pass the reference and kill `exitAlways_0b` and `exitAlways_1b`. Add them to `test-plan.md` (Requirements Coverage row "Грань начинается снаружи тела соседа" and the mutation targets) and `test-suite.md`.
2. (G2) Add a test for the face-along-the-boundary clause: E `(0,0)-(300,0)` and N `(0,0)-(500,0)`, both t20, `[E, N]`; expect `expectLength(plus, N, 1, 0, 500)` and `expectLength(minus, N, -1, 0, 500)`. It passes the reference and kills `nonStrict`. Add it to `test-plan.md` / `test-suite.md`. If the owner finds this scenario unreachable or undesirable, the spec sentence must be reworded instead (Rule 1).
3. (G3) Resolve spec vs design D3 for an end with two adjoining walls. Preferred: add the test "two walls end at the end b of the new wall, end a is free": E1 `(500,0)-(500,200)`, E2 `(500,0)-(500,-200)`, N `(0,0)-(500,0)`, `[E1, E2, N]`; expect exactly one thickness dimension on end a (`expectThickness(..., N, 0, -1)`) and the two length dimensions as for a free wall. This is the spec-literal behaviour. It fails a design-literal implementation (`jointAt === null`), so the implementer must use another predicate, or the owner must change the spec sentence and design D3 to say "an end is free when `jointAt` finds no single joint". Whichever is chosen must be recorded in spec/design before tests are approved.

Not required (optional): strengthen ADW-14 as described under Assertion Strength.

## Verdict

VERDICT: FAIL
