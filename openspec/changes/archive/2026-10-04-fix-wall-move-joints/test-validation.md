# Test Validation

Change: `fix-wall-move-joints`, validation iteration 4. I ran this from a fresh context. No production code, tests, fixtures, specs, design or test plan were modified. All mutation work was done in a new scratch copy outside the repository (`scratchpad/v4`), with a reference implementation of D1–D3 written from scratch for this iteration and mutants switched by an environment variable.

Suites reviewed:
- new tests:
  - `src/move-tee-stretch.test.ts` (35 tests, including the new TS-1e, TS-14, TS-15 and TS-N4);
  - `src/wall-geometry-near-collinear.test.ts` (17 tests);
  - `src/face-corner-margin.test.ts` (6 tests);
  - helpers in `src/move-joints.test-utils.ts`.
- updated approved tests: CJ-16, MV-B2, FJ-B2 and CJ-B2b (`git diff`).
- existing approved test: CV-GEO-SWEEP in `src/wall-snap-cap-vertex.test.ts`.

Current (pre-implementation) code:
- `npx vitest run`: 40 failed, 983 passed (1023 tests, 37 files). All new files are discovered.
- Every failure is in a new or updated test, and each one fails for the intended reason:
  - TS-1e: `V.b` = (100,130), expected (100,150), so the stem moved whole;
  - TS-14 (order XV): `V.b` = (100,130), expected (100,150);
  - TS-15: `V1.b` = (150,80), expected (150,100);
  - the other 37 failures are the same as in iteration 3 (stem moved whole, old threshold, 358 cm spike, and so on).
- These pass before implementation, as intended:
  - TS-N4, a negative case where the current code already moves the stem whole;
  - FJ-B2 and CJ-B2b, whose boundary probes are past both the old and the new threshold.
- No pre-existing test fails.
- `npx tsc --noEmit` is clean.

Reference implementation in the scratch copy:
- D1: `FACE_CORNER_MARGIN_CM = 1`, added only to the diagonal term of `faceCornerTol`.
- D2:
  - a snapshot of all walls is taken before the move;
  - each end is classified as follow, then tee (axis or face, `teeEndAttached`), then none;
  - a wall with a tee end moves whole once if its other end is linked to the group or is free;
  - otherwise only the tee end moves;
  - `endOccupied` uses the pre-move snapshot. It counts both ends of any other non-degenerate wall within `faceCornerTol`, and axis/face tees, including walls that themselves follow the group.
- D3:
  - the branch sits before `isEarlier`;
  - the bound is sign-based, `-RIGHT_COS < cosT < -COS15 - EPS`;
  - the vertex is the earlier wall's end;
  - each corner moves along `uIn` with the wall's own `hW`;
  - the partner is exempted.
- **Full suite: 1023/1023 pass, including CV-GEO-SWEEP.** The suite is satisfiable by a design-conformant implementation.

## Requirement Coverage

| Requirement / scenario | Tests | Status |
|---|---|---|
| wall-selection: stem with an occupied far end stretches (corner joint / face tee / exact joint / axis tee) | TS-1, TS-1b, TS-1c, TS-1d, TS-2, TS-6 | covered |
| wall-selection: far end in a joint with the occupant's **`b`** end | TS-1e | covered (F11 resolved) |
| wall-selection: the occupant itself moves (it follows the group, or is another stem) | TS-14 (both array orders), TS-15 | covered (F12 resolved) |
| wall-selection: stem attached by its `b` end | TS-13 | covered |
| wall-selection: stem on the moved wall's axis | TS-11 | covered |
| wall-selection: partition between two walls | TS-3 | covered |
| wall-selection: both ends linked to the moved wall, moved once | TS-4, TS-4b | covered |
| wall-selection: free far end, so the stem moves whole | TS-5, TS-7b, TS-N1, TS-N2, TS-N4, FJ-5* | covered |
| wall-selection: tee "within the wall's length" (end on a face line beyond the wall is free) | TS-N4 | covered (F13 resolved) |
| wall-selection: occupancy uses pre-move positions (a wall arriving does not occupy) | TS-7, TS-7c | covered |
| wall-selection: stretching is stable during a drag | TS-6, FM-3b | covered |
| wall-selection: drift within the margin, and the corner boundary | FM-2, FM-3, FM-4, FM-5, MV-B2, FJ-B2, REG-1 | covered |
| wall-selection: the same threshold for ortho / ruler | FM-9 / via `faceCornerTol` (FM-1, CJ-16) | covered / indirect, acceptable |
| wall-selection: second-end links are preserved | REG-2, TS-1e, TS-14, TS-15 | covered |
| multi-selection: occupied far end / moved once / link to another group wall / group corner within the margin | TS-8, TS-9, TS-10, FJ-10, FM-6 | covered |
| wall-joints: threshold value / drift / beyond the margin | FM-1, CJ-16, FM-7, FM-8, CJ-B2b | covered |
| wall-joints: near-collinear 2.4°: bisector, no spike, no gap or overlap, both orders | NC-1, NC-2, NC-3, REG-3 | covered |
| wall-joints: own half-thickness with different thicknesses | NC-15 | covered |
| wall-joints: 0.3° / 0.7°; 14.9° / 15° / 15.1° / 20° | NC-4, NC-4b, NC-5, CV-GEO-SWEEP | covered |
| wall-joints: hairpin; no common end; third end; vertex = earlier end when the ends diverge | NC-13, NC-14, NC-11, NC-6 | covered |
| wall-joints: seam for the same / different materials; ownership; hit testing; order; purity | NC-7, NC-8, NC-9, NC-10, NC-12 | covered |

## Boundary Coverage

**Threshold:**
- diagonal + 0.99 / + 1.01 (FM-2);
- diagonal + 0.5 for a group (FM-6);
- a 14.27 drift on the follow side (FM-3, FM-7, FM-9);
- 15.24–15.5 just past the threshold (FJ-B2, FM-4, FM-5, FM-8, CJ-B2b, MV-B2);
- every branch of the max, in both argument orders (FM-1, CJ-16).

**Angle:**
- 0.3° / 0.7°;
- 14.9° / exactly 15° / 15.1° / 20°.
- Exactly 15° relies on the EPS guard from D3. The no-EPS mutant is killed.

**Other:**
- zero vector (TS-N3);
- stretch to zero length (TS-12);
- vertex offset of exactly h (NC-6);
- 12 cm offset, so no common end (NC-14);
- face line beyond the wall's end (TS-N4).

**Gap (minor):** no boundary for a drifted joint on the *occupancy* side, where the far end is 14.14–15.14 cm from the occupant's end. See F14.

## Negative Cases

- far end 1 cm from a face (TS-N1);
- degenerate neighbour (TS-N2);
- end on a face line beyond the wall (TS-N4);
- a wall far away (TS-7b);
- past the threshold (FM-4, FM-5, FM-8);
- third end (NC-11);
- hairpin (NC-13);
- no common end (NC-14);
- 15° and above (NC-5).

All are present.

## Error Handling

Not applicable: these are pure geometry functions without error paths.
- Degenerate inputs are covered (TS-N2, TS-12, TS-N3).
- NC-12 checks that the input is not mutated.

## Invariants

- Move once, never 2v: TS-4, TS-4b, TS-9, TS-10.
- `faceCornerTol` is symmetric: FM-1, CJ-16.
- Protrusion stays within the wall's own h: NC-1, NC-2, NC-15, REG-3.
- Purity: NC-12.
- An attached end stays on the face: TS-2.
- Links are not broken: REG-2, and now also the heterogeneous occupancy fixtures (TS-1e, TS-14, TS-15).

## State Transitions

TS-6 (stretching stem) and FM-3b (drifted joint) compare 10 incremental steps with one step at 1e-9. Together they cover the incremental `pointermove` application of D1 and D2.

## Integration Behavior

- REG-1, REG-2 and REG-3 use the real 21-wall user fixture.
- FM-9 covers the ortho path (`planOrthoStretch` / `applyStretch`).
- `hitWall` and `contourSegments` are covered through NC-7, NC-8, NC-9 and FM-7.
- The ruler and room areas are covered indirectly through the shared `faceCornerTol` and `displayPolygons`, which is acceptable.

## Implementation Independence

- The tests assert observable coordinates, threshold values and shape properties derived from the spec.
- They do not reference internal helpers. `endOccupied` is not imported.
- My independently written reference passes all 1023 tests.

## Assertion Strength

**Strong:**
- coordinates use exact `toEqual` or `toBeCloseTo(…, 9)`;
- the protrusion is checked as exactly `h·tan(θ/2)` for each wall's own h;
- the seam probes at 0.06–0.15 cm catch a missing `exempt`;
- NC-15's lateral bounds catch wrong half-thickness choices;
- TS-14 runs both array orders.

**The occupancy fixtures are now heterogeneous:**
- the occupant joins with its `a` end and its `b` end;
- the occupant is fixed, follows the group, or is another stem;
- the occupancy is an exact joint, a corner joint, a face tee or an axis tee.

**Remaining weakness (minor):**
- every occupancy fixture uses walls of equal thickness, 20 cm;
- no occupancy fixture has a drifted joint (F14).

## Mutation Testing

**Method:**
- a fresh copy of `src/`, the package, tsconfig and vite config was made in the scratchpad, with `node_modules` as a junction;
- the reference implementation was written there, with mutants switched by the `MUT` environment variable;
- the full 1023-test suite was run for each mutant, with the JSON reporter;
- the reference is green: 0 failures.

| Mutant | Killed by |
|---|---|
| margin 0 | CJ-16, FM-1, FM-2, FM-6, FM-7, FM-9, MV-B2 |
| margin 0.5 | CJ-16, FM-1, FM-2 |
| margin 2 | CJ-16, CJ-B2b, FJ-B2, FM-1, FM-2, FM-4, FM-5, FM-8, FM-9, MV-B2 |
| margin added to 1.25·h | CJ-16, CJ-B2, FJ-B4, FM-1, FM-2, FM-6, FM-7, FM-9, MV-B2 |
| margin added to both terms | CJ-16, CJ-B2, FJ-B4, FM-1 |
| margin only in `moveWalls` (not in the shared function) | CJ-16, FJ-B4, FM-1, FM-7, FM-9 |
| occupancy ignores tees | TS-1b, TS-1d, TS-3 |
| occupancy ignores axis tees (face only) | TS-1d |
| occupancy ignores joints | TS-1, TS-1c, TS-1e, TS-2, TS-6, TS-8, TS-11, TS-12, TS-13, TS-14, TS-15, REG-1, REG-2 |
| occupancy joint check with 1.25·h | TS-1, TS-1e, TS-2, TS-6, TS-8, TS-11, TS-12, TS-13, REG-1, REG-2 |
| occupancy counts degenerate walls | TS-N2 |
| occupancy on post-move geometry (all walls) | TS-7, TS-7c |
| occupancy on post-move geometry (group walls shifted) | TS-7, TS-7c |
| occupancy checked on the tee end instead of the far end | TS-5, TS-7*, TS-N1, TS-N2, TS-N4, FM-4, FJ-5*, MV-4 … (16 tests) |
| occupancy always true | the same 16 tests |
| **occupancy checks only the occupant's `a` end** | **TS-1e, TS-14, TS-15** (F11 resolved) |
| **occupancy ignores walls linked to the group (followers and stems)** | **TS-14, TS-15** (F12 resolved) |
| occupancy ignores only follower walls | TS-14 |
| occupancy ignores only other stems | TS-15 |
| occupancy treats a face line beyond the wall's length as a tee | TS-N4 (F13 resolved) |
| tee link detected against post-move group walls | 33 tests |
| tee link only for face tees (not the axis) | TS-11, MV-4, multi-selection "ровно один вектор" |
| tee checked before follow (classification order) | CJ-16, FJ-1, FJ-1b, FJ-1c, FJ-8, FJ-T1, FM-6, ST-0 |
| "far end linked to group → whole" branch removed | FJ-10, TS-4, TS-4b, TS-9, TS-10, multi-selection "ровно один вектор" |
| stem moved twice (whole + follow) | TS-4, TS-10 |
| old rule: tee only when no follow end | TS-4, TS-10 |
| stretch only when the tee end is `a` | TS-13 |
| axis-attached stem always moves whole | TS-11 |
| D3 disabled | NC-1, NC-2, NC-3, NC-4b, NC-5, NC-6, NC-8, NC-9, NC-15, REG-3 |
| COS15 ↔ SIN15 | NC-5, CV-GEO-SWEEP, CV-JOINT-SWEEP, CJ-9e/m/n/p |
| 15° → 14° / 15° → 16° | NC-5 / NC-5, CV-GEO-SWEEP |
| inclusive 15° / no EPS guard | NC-5, CV-GEO-SWEEP |
| 0.5° tolerance removed | NC-4 |
| vertex from the later wall / midpoint / always own end / always the partner's end | NC-6 (each) |
| earlier wall not cut | NC-2, NC-3, NC-4b, NC-5, NC-6, NC-7, NC-9, NC-10, NC-15 |
| partner not exempted | NC-3, NC-6, NC-7, NC-10 |
| rule applied with a third end | NC-11 |
| `abs(cos)` (hairpin) | NC-13 |
| neighbour's half-thickness / max half-thickness | NC-15 |
| corners projected perpendicular to the bisector | NC-2, NC-4b, NC-5, NC-6, NC-15 |
| corners only extended / only cut | NC-2…NC-9 / NC-2…NC-8, NC-15, ANG-BEND-2 |
| wrong bisector (`uIn + uInC`) | 15 tests, including NC-1, REG-3 |
| occupancy excludes group walls | survives; **equivalent**, because those links are handled by the link-to-group branch with identical predicates |
| occupancy joint tolerance taken from the wrong pair (`faceCornerTol(c, c)`) | survives; minor: equal thickness everywhere |
| occupancy joint tolerance re-implemented without the 1 cm margin (`max(1.25·h, √(h₁²+h₂²))`) | survives; minor (F14) |

Every mutant from iterations 1–3 is killed, and so are the new variants (wrong bisector, no EPS guard, tee-before-follow order, follower-only and stem-only exclusions).

## Surviving Mutations
| Mutation | Expected Failing Test | Result |
|---|---|---|
| `endOccupied` excludes group walls | none possible | SURVIVED. Equivalent: a far end linked to a group wall takes the "linked to the group → whole" branch, which uses the same predicates, before occupancy is evaluated |
| `endOccupied` joint tolerance from the wrong pair (`faceCornerTol(c, c)` or `(g, c)` instead of `(w, c)`) | an occupancy test with mixed thicknesses | SURVIVED. Minor: an exotic argument mix-up, and every fixture uses 20 cm walls |
| `endOccupied` joint tolerance re-implemented without the margin (old diagonal) | a stem whose far end is in a corner joint drifted to 14.27 cm | SURVIVED. Minor, see F14. Probe below: it passes the reference and fails this mutant and margin 0 |

## Findings

**Previous findings resolved:**
- **F1–F10:** still resolved; every associated mutant remains killed.
- **F11:** TS-1e (the occupant joins with its `b` end) kills "occupancy checks only `c.a`", and so do TS-14 and TS-15.
- **F12:**
  - TS-14 covers an occupant that follows the group, in both array orders;
  - TS-15 covers two stems that occupy each other's far ends;
  - between them they kill every variant of "occupancy ignores walls that move", including the follower-only and stem-only variants.
- **F13:** TS-N4 kills "a face line beyond the wall counts as a tee".

**New tests are well formed:**
- The geometry of every new scene was checked by hand:
  - TS-1e: corner joint distance 14.14;
  - TS-14: `X.a` is exactly `g.b`, and `X.b` coincides with `V.b`;
  - TS-15: both stems sit on the lower face of g at y = 10;
  - TS-N4: lateral offset is h, but along = −20, beyond the wall's length.
- Expected values follow from the spec, not from code.

**Updated approved tests:** CJ-16, MV-B2, FJ-B2 and CJ-B2b remain justified and are not weakened.
- Each boundary moved just past the new threshold (15.24–15.5 against 15.14).
- MV-B2 gained an inside-the-margin probe.
- The change was requested in design.md (Risks), before approval.

**New findings:**
- **F14 (minor, non-blocking): no occupancy fixture has a drifted far-end joint (14.14 < d ≤ 15.14).**
  - **Survivor:** an `endOccupied` that hand-writes the old tolerance instead of calling `faceCornerTol`.
  - **Exposure:** that implementation would break a drifted joint at a stem's far end.
  - **Why it is not critical:**
    - it requires duplicating the shared threshold formula, against design D2 ("в `faceCornerTol` от него") and CLAUDE.md Rule 10;
    - the margin itself is pinned by FM-1 and CJ-16;
    - the size of the occupancy joint tolerance is pinned by TS-1, which kills the 1.25·h variant.
  - **Probe** (run in the scratchpad, not in the repository):
    - scene: `g (0,0)-(200,0)`, `V (100,10)-(100,150)`, `H (89.82,160)-(0,160)`;
    - action: move g by (0,−20);
    - expected: `V.a = (100,−10)`, `V.b = (100,150)`;
    - result: passes the reference, fails the no-margin occupancy mutant and the margin-0 mutant.
- **F15 (minor, non-blocking): every occupancy fixture uses equal thickness.** A mixed-thickness occupancy case would pin which pair `faceCornerTol` is taken from.

## Required Changes

None are required for approval. Recommended, optional hardening, which can be added before implementation as an ordinary test addition:
1. (F14) Add a TS-1 variant with a drifted far-end joint, using the scene from the probe above.
2. (F15) Optionally, add an occupancy case with mixed thicknesses: a stem and an occupant of different thickness, whose far-end joint lies just inside `faceCornerTol(stem, occupant)`.

## Verdict

Iteration 4 resolves F11, F12 and F13:
- TS-1e, TS-14 and TS-15 kill both critical occupancy mutants from iteration 3, plus the follower-only and stem-only variants;
- TS-N4 kills the face-line-beyond-length mutant.

The suite is consistent:
- 40 intended pre-implementation failures, with no pre-existing test failing;
- tsc is clean;
- an independently written reference passes all 1023 tests.

Fresh mutation analysis covered 52 mutants across D1, D2 and D3, including every prior mutant and new variants:
- wrong bisector;
- no EPS guard;
- tee-before-follow order;
- follower-only and stem-only exclusions;
- margin only in `moveWalls`.

All important mutants are killed. Three survive:
- one is equivalent (group walls excluded from occupancy);
- two are minor and need implementations that bypass or misuse the shared `faceCornerTol`.

Every important requirement in the delta specs is meaningfully protected.

VERDICT: PASS
