# Test Validation (round 5, fresh context, after test change request 1)

Validated: `src/wall-snap-diagonal.test.ts`, `src/wall-geometry-diagonal-corner.test.ts` against the delta specs after the zone change
(diagonal snap only in the far part of the quadrant: both offsets from the corner within [Z/2, Z], Z = max(snap radius, new half-thickness), boundaries inclusive).
The previous (round 4) report was stale and is replaced. Nothing in the repository was modified except this file; all experiments ran in a
copy of the working tree under the scratchpad (node_modules junctioned).

## 1. Full suite against a reference implementation of the NEW spec

Reference = working tree plus, in `wallCandidates`, the corner candidate only when `beyond >= Z/2`, `beyond <= Z`, `across >= Z/2`, `across <= Z`
(everything else as in the working tree: `corners` flag, `startRefOf`, `chainSegment`, `diagonalCornerAt`).

| Reference variant | Result of `npx vitest run` (88 files) |
|---|---|
| strict float comparisons | 87 files pass, 1 test fails: `DS-15` (see finding F1) |
| same with a 1e-9 tolerance on the four comparisons | 88 files / 1706 tests all pass |

So all existing approved tests (SNAP-END-3, CV-BAND-1, SNAP-SCALE-1/2/3, the GS-09/GS-10/GS-15 sweeps of wall-snap-start, ortho-gesture, tracking, ...) are
consistent with the new spec: no existing test pins behaviour in the far part of the quadrant. The five previously broken tests pass.
No flake or timeout occurred in these runs.

## 2. Findings

F1 (informational, does not fail the verdict, but the implementer must know). `DS-15` checks the half-zone boundary `(5, 15)` in the wall frame
under rotations by 30°, 60° and 135°. After the rotation the offsets are 4.999999999999999 instead of 5 in floating point, so an implementation with a
plain `>=` returns the flush face (observed: rot30, rot60, rot135 at `(5,15)`; rot180 at `(8,15)`/`(10,20)` too). The test is mathematically right
(the spec says both boundaries are inclusive) and a correct implementation passes it with any tolerance of the size of the existing `EPS`/`SLICE`
constants. The tolerance is not mentioned in design.md. Implementation must compare the zone limits with a small tolerance
(e.g. `>= Z/2 - EPS`, `<= Z + EPS`); the test must not be weakened for this (Rule 5). The tolerance cannot make a wrong implementation pass:
the nearest negative probes are 0.01 cm away.

F2 (minor). Fallback `snapStartVertex` (touched-grid) with the half-zone dropped only there survives: it needs a cursor in the near part whose flush face
candidate is rejected by the acceptor while the corner square is accepted and the grid square touches the wall. Not reachable by a plausible slip,
the half-zone lives in `wallCandidates`, shared by both paths. Not required.

F3 (minor, equivalent mutants). Removing the "priority over face" (`return` after an accepted corner) survives, because in the far part the corner base is always
nearer to the cursor than the flush face base (`nearest` decides the same). Corner-in-fallback removed also survives (`snapVertex` already offers the same corner
for the same cursor). A degenerate wall passed to `wallCandidates` survives (harmless, `unit` of a zero vector yields no candidate). None changes observable behaviour.

## 3. Adversarial pass (mutants applied to the reference with tolerance; run: the two new test files)

| Mutant | Result |
|---|---|
| M19 half-zone dropped (corner from offset > 0) | killed (7 failing) |
| M20 threshold on one axis only (along / across) | killed (6 / 6) |
| M21 half threshold exclusive (both axes / only along / only across) | killed (5 / 5 / 4) |
| M22 fixed 5 cm instead of Z/2; fixed 3 cm (radius-only half) | killed (2 / 5) |
| zone/2 from radius only, from half-thickness only (`cornerZone = radius` / `= newHalf`) | killed (19 / 2) |
| upper limit exclusive (both / along / across) | killed (3 / 3 / 3) |
| upper limit removed (along / across); Euclidean distance instead of per axis | killed (4 / 4 / 17) |
| touched-grid fallback with unlimited upper bound (both axes / across / along) | killed (3 / 3 / 3) |
| `freeCap` check removed (M8) | killed (1: DS-8) |
| acceptor overlap bypass for corner / doorway bypass for corner | killed / killed (DS-9 / DS-12) |
| diagonal applied to the second vertex (`chainSegment` passes `corners = true`) | killed (DS-14) |
| vertex at square centre (M1); `hN` replaced by `hW` (M2); only the `b` end (M4); `target: "face"` (M3-like) | killed (20 / 4 / 2 / 17) |
| priority over face dropped; corner removed from fallback; degenerate wall allowed; half-zone dropped only in fallback | survived, equivalent or unreachable (F2, F3) |

Joint-side mutants M10-M18 are unchanged by round 5 (the joint tests keep the same geometry; only the cursor in DJ-14 and IC-6 changed) and were killed in earlier rounds;
`DJ-14` was re-read: its cursor `(8,18)` is in the far part, so the snap gives `S = (10,10)`, `startRefOf` gives `kind "face"` (asserted), `chainSegment` with ortho
yields the segment `(10,10)→(10,110)`, and the closed L is checked through `mismatches` on the placed wall chain: it still exercises snap → ortho → placed wall.

## 4. Checks of values and negative tests

- Arithmetic re-derived: K = (0,10); t20, zoom 1: Z = 10, half 5; `(8,18)`: 8/8 in [5,10]. t40: Z = 20, half 10; `(14,24)` 14/14, `(10,25)`/`(15,25)`/`(20,30)` on the
  boundaries, `(9.9,25)` and `(15,19.9)` just outside the half. zoom 0.25: radius 24, Z = 24, half 12; `(12,30)`, `(20,22)`, `(24,30)`, `(20,34)` are inside, `(11.9,30)`,
  `(20,21.9)`, `(24.5,30)`, `(20,34.5)` outside. All expected vertices (10,10), (-10,-10), (20,10), (10,20) and squares agree with the spec.
- DS-4 (wall t40, K = (0,20)), cursor `(8,28)`: 8/8 offsets, correct. DS-10 controls: the same cursors `(-8,-18)`, `(-18,-8)` give the corner next to a single wall and none at the
  L joint (the cap is not free there), so the negative is not vacuous. `(-14,-14)` and `(14,14)` in DS-10 are not in the zone anyway (kept from the old scenario); the meaningful part is the controlled pair.
- Negatives not vacuous (verified by mutants): DS-8 (`freeCap` removal killed), DS-9 (overlap bypass killed; control without blocker asserts the corner), DS-12 (doorway bypass killed; control without opening),
  DS-14 (second vertex mutant killed), DS-18 (control with the degenerate wall plus A asserts the corner; the lone degenerate wall gives no corner, but the lone-degenerate mutant is equivalent, F3).
- DS-B8 grid-touching claims: `(10.5,18)` and `(8,20.5)` have grid squares `[0,20]x[10,30]` that touch A, are in the far part on both axes and outside the zone on one; the unlimited-bound fallback mutants die on them.
  `(14,14)`, `(4,24)`, `(14,-14)`, reversed wall are additional controls (they would also fail for a wrong implementation of the zone only in the along/across upper bound, which the first two cursors cover).
- Boundary probes: plane/face line (0, 0.01, 6;10, 6;10.01), near part (4/4.99), half-zone both sides on both axes, zone limit both sides on both axes, three thicknesses/zooms, nine orientations.
- Requirement coverage unchanged and complete for wall-drawing (snap, start-only, both ends, any orientation, MODIFIED scenarios) and wall-joints (DJ-1...DJ-18). Mocks: none. Assertions check point, target, normal and square, not internals.

## 5. Verdict

The tests protect the changed spec: no surviving critical mutant, every full-suite run against a correct implementation passes (88 files, 1706 tests), no test contradicts an existing approved test.
The implementation must use a small tolerance at the four zone comparisons (F1); the current working-tree implementation (old zone, no half-zone) is expected to fail the 7 near-part/half-zone tests until updated.

VERDICT: PASS
