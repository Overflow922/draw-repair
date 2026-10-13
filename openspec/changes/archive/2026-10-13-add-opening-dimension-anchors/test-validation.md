# Test Validation

Round 3 (final, narrow re-verification after the Test Writer fixed DA-47c and added DA-47f and DA-49c). Independent validator; earlier reports overwritten.

Method: a throwaway REFERENCE IMPLEMENTATION of design D8 was built in a scratchpad copy (production repo untouched):
`JambPoint`/`EdgePoint` union; `dimPointPoint(point, walls, elements?)`; `nearestDimAnchor` (nearest candidate, vertex wins
within 1e-9); `elements?` in `dimHitDistance`/`dimLevelSnap`; `erasePick`/`pressPick` pass `scene.doorways`; `deleteObjects`
cleans jamb dimensions (explicit, frame, wall cascade); `cloneScene`/`copyDimension`/`isDimension` handle both kinds (unknown
kind rejected even with valid `a`/`b`); `mountingScene` requires BOTH points resolvable; `drawScene` (ink, hover, selected,
marquee) and `wallsBBox`/`pagesOf`/`pageBounds` use the elements.

Results on the reference:
- All 147 new tests (`src/dimension-anchor*.test.ts`, 8 files) PASS; none is defective against the reference.
- Whole suite (new + existing): 175 files / 3873 tests PASS (reference rebuilt and re-run in round 3; the earlier INV-2 timeout under parallel load did not recur).
- `tsc --noEmit`: 0 errors on the reference (tests included).
- AD-30: with the ORIGINAL line tsc reports TS2339 (`Property 'b'/'a' does not exist on type 'JambPoint'`); with the added
  line `if (!("a" in target.from)) throw ...` tsc is clean and `auto-dimensions.test.ts` 59/59 pass. The diff is exactly one
  added line, a pure type narrowing: every expectation, datum and call is unchanged; at runtime the guard is a no-op for the
  edge-point automatic dimensions the test builds (and would fail loudly, not silently, on a jamb point). AD-30 is NOT
  weakened. Change is behavior-neutral.

## Requirement Coverage

- PASS (with the one assertion-strength defect below).
- dimension-tool «Точки замера на откосах»: all 9 scenarios covered (DA-1/1b/2/2b/2c position; DA-3/3b/3c jamb to corner;
  DA-4/4b/4c four points, anchors a/b; DA-5..5d, 6, 19, 49, 49b corner tie / nearer wins; DA-7/7b/7c/8/20 misses and radius;
  DA-9..16b follow element/wall incl. diagonal and compound wall; DA-17/17b/24 undo/redo).
- «Удаление элемента удаляет размеры на его откосах»: Delete/frame/cascade/foreign dimensions, one history record (DA-23..27, DA-24).
- «Инструмент «Размер»» modified: snap candidates (DA-4..8, 19, 40, 48*, 50), third-click level snap with jamb neighbours
  (DA-47*; see Finding 1), zero-length (DA-21 at geometry level), eraser/press picking (DA-45/46).
- «Привязка размеров к стенам»: old edge points unchanged (DA-22, DA-30, DA-19b).
- drawing-storage «Формат документа»: round trip, literal format, legacy without kind, 12 broken-point variants on `from` and
  on `to`, mounting plan, history, dangling element not validated (DA-28..33b).
- Render/PDF/Montage/pick wiring: DA-34*, DA-35*, DA-36, DA-37*, DA-38*, DA-43*, DA-44*.
- Not covered by any automated test (explicitly out of scope in test-plan, `main.ts` has no test harness): click routing that
  actually calls `nearestDimAnchor`, snap mark/rubber-band drawing from the snap result, Esc/double click, the three-click
  placement, and that `main.ts` passes `elements` to the readers. Everything the pure functions need is tested, but a `main.ts`
  that simply never uses the new API would pass the whole suite; this must be covered by the manual browser verification.

## Boundary Coverage

- PASS. Radius boundary exact and +0.01 (DA-7b; mutants `<`/`+1` killed). Vertex/jamb tie within 1e-9 (DA-49: 1e-12) and a
  clearly nearer jamb (DA-49b: 0.02; DA-6). Jamb on corner / whole-wall window (DA-5, 5b, 5c), jamb 10 cm from end with no
  vertex (DA-5d). Width 1 cm (DA-10b), thickness 40 (DA-2c), anchor a/b swap (DA-11, 11b), diagonal (DA-14, 14b), several
  candidates in any element order (DA-48..48c). Minor: a vertex tolerance between 1e-9 and 1e-6 and the dimLevelSnap radius
  edge (`<` vs `<=` exactly at the radius) are not distinguished (see Surviving Mutations).

## Negative Cases

- PASS. Missing element (DA-32, 32b, 35c, 35e, 36, 37d, 37f), missing host wall (DA-37b, 37e, 40b), degenerate host
  (DA-39, DA-50; the NaN mutants are killed), no elements passed (DA-34d, 38c, 40, 47d), miss-by-10 cm for pick (DA-45c),
  pressPick with dimensions disabled (DA-46b), 12 malformed-point variants on both points, mounting mixed jamb/edge pairs in
  both orders (DA-37f, 37g).

## Error Handling

- PASS. Dangling references never throw in render, PDF, mounting scene, hit test, snap; malformed stored points drop only
  their own dimension and keep walls/other dimensions/elements; history entry with a malformed point is rejected (DA-33b).

## Invariants

- PASS. Jamb a < jamb b for both anchors and faces (DA-11b); faces differ by thickness (DA-2b); no kind added to edge points
  by clone/copy (DA-30, AD-20/27 via existing tests); clone independent and lossless (DA-17, 17c); old signature unchanged
  (DA-22); after deleteObjects no dimension refers to a removed element/wall (DA-23..27).

## State Transitions

- PASS. Delete -> undo -> redo with jamb dimensions (DA-24, DA-17b, DA-17c), follow element move/width/anchor and wall
  move/extend/rotate (DA-9..16b), wall-by-wall room construction in 4 orders with every prefix (DA-41). Placement itself
  (draft -> dimension push) lives in `main.ts` and is not unit-testable here.

## Integration Behavior

- PASS with the `main.ts` caveat above. Storage -> history -> scene -> render -> PDF chain and the Montage plan (remnants after
  demolition DA-44, own elements DA-44b/37c, page bounds DA-44c) are exercised through public functions; auto-dimensions are
  confirmed untouched (DA-42, 42b).

## Implementation Independence

- PASS. Expectations are hand-derived coordinates (F2/FB/FD/FC/R2 tables in test-plan), no production helper is used to build
  expected values. Minor coupling: DA-35 wraps `drawScene` through `vi.mock("./render")` and inspects the argument order
  (it still calls the real `drawScene`, so the system under test is not mocked away); DA-31/DA-28b fix the literal storage
  shape `{kind, elementId, jamb, face}` which is the specified format. `jambPoint` casts `as unknown as DimPoint`, harmless.

## Assertion Strength

- PASS. DA-43..43d are strong: the colour tests assert a HORIZONTAL stroke segment of the exact palette colour
  passing through the dimension line at y = 40 (30 cm off the wall, so hatch/outline strokes cannot satisfy it; hatch is
  diagonal and filtered by `horizontal()`); mutants "hover/selected/marquee not drawn", "drawn without elements", "colour
  swapped to ink / selected" and "jamb dims never drawn" are all KILLED by exactly the matching DA-43 test, and DA-43d proves
  ink vs highlight colours are distinct. They cannot pass if no dimension is drawn.
- DA-47c (fixed in round 3: vertical axis, cursor {220,50} exactly at the non-parallel neighbour level, expects null) now fails on an implementation without the parallel-axis check. DA-47f pins the radius boundary (exactly 3 -> offset 30; 3.01 -> null). DA-49c pins the tie tolerance (a jamb 1e-7 closer than the vertex wins).
- DA-45/46/47/48/49/50, DA-31 (12 variants x 2 points) and DA-37f/g assert exact values and kill their targeted mutants.
- The 8 "Unexpected Passes" explanations in test-suite.md were verified and are TRUE: DA-26c (edge dims untouched by the old
  `refsWall`), DA-42/42b (auto dimensions are edge-only, pre-existing), DA-30 (legacy format), DA-22 (extra JS arg ignored
  by the old function), DA-31c/33b (old `isDimension` rejects any object lacking `.a`/`.b`, so they pass "for another
  reason" until implemented; the mutants "accept jamb without field check / unknown kind with valid a/b / face or jamb
  unchecked / `to` not validated" ARE killed by DA-31/31b/31c/33b/29b), DA-46b (negative).

## Mutation Testing

- 108 hand-made mutants on the reference (no Stryker in the project), run against the new tests + `auto-dimensions` tests, survivors re-run against the WHOLE suite. Round 3 result: KILLED 101, SURVIVED 7 (6 equivalent, 1 minor non-blocking). Round-3 re-runs: parallel check removed KILLED by DA-47c; vertex tie tolerance 1e-6 KILLED by DA-49c; dimLevelSnap radius `<` KILLED by DA-47f.
- All mutants round 1 reported as surviving are now KILLED:
  - nearest-vs-first candidate in snap: DA-48/48b (last-candidate variant also DA-48c);
  - strict `<` instead of the 1e-9 tolerance: DA-49, DA-5, DA-5b, DA-5c; `<=` without tolerance: DA-49;
  - degenerate host through `nearestDimAnchor` (raw host lookup + NaN-tolerant radius test): DA-50, DA-39;
  - `erasePick` not passing `scene.doorways`: DA-45; `pressPick`: DA-46;
  - hover / selected / marquee dimension drawn without elements: DA-43 / DA-43b / DA-43c; ink: DA-34, DA-35, DA-43d;
  - `isDimension` accepting unknown kind with valid `a`/`b`: DA-31, DA-31b, DA-31c;
  - `mountingScene` checking only `from` (DA-37f, 37g) / only `to` (DA-37d, 37f, 37g);
  - `dimLevelSnap` ignoring elements (from or to): DA-47, DA-47e.
- Also KILLED (id of first killer): swapped jamb a/b (DA-1/34/35/48), face flipped / ignored (DA-45../DA-1,DA-4), thickness
  not halved / zero (DA-2c.., DA-45), anchor ignored (DA-3c, DA-11, DA-13, DA-15), tie -> jamb (DA-5), vertex tolerance 0.5
  (DA-49b), jamb candidates ignored / only a / only face +1 (DA-4, DA-48*), radius exclusive / +1 (DA-7b), deleteObjects:
  no cleanup / only from (DA-23b) / only to (DA-23) / cascade not cleaning (DA-25*) / all elements (DA-26) / explicit not
  cleaning (DA-23*), cloneScene dropping elementId/face/jamb or sharing the reference or rebuilding `{a,b}` (DA-17*, DA-24),
  kind added to edge points by clone or copy (AD-20/27, DA-30), copyDimension dropping fields (DA-28*), `isDimension`
  field checks (DA-31*), loader dropping dimensions with missing elements incl. Montage (DA-32, DA-29b), mountingScene
  always-resolvable / always-dropped / only own / only old (DA-37*, DA-44c), render/pdf/pageBounds without elements
  (DA-34/35/35d/44c), dimPointPoint returning (0,0) for missing element/host (DA-32, DA-37b, DA-39), NaN for degenerate host
  (DA-39, DA-50), `pagesOf` measure page without doorways and mounting dims/doorways dropped (existing PG-*, MP-*, DA-44c).
- Killed only by the existing suite (not by new tests): edge refs of a point deleted with its wall considered only via `a`
  (DX-06), mountingScene edge point only `a`/`b`/either checked (MP-24, WS-02), pagesOf measure doorways empty (PG-01..).
  These are pre-existing behaviours the change merely re-expressed; acceptable.

## Surviving Mutations

| Mutation | Expected Failing Test | Result |
|---|---|---|
| `dimLevelSnap`: parallel-axis check removed (`>= EPS` -> `>= 2`) | DA-47c | KILLED in round 3 (DA-47c) |
| `dimLevelSnap`: radius exclusive (`<` instead of `<=`) | DA-47f | KILLED in round 3 (DA-47f) |
| vertex tie tolerance 1e-6 instead of 1e-9 | DA-49c | KILLED in round 3 (DA-49c) |
| `isDimension` rejects explicit `kind: "edges"` | none (D8 type allows `kind?: "edges"`, spec silent) | SURVIVED (minor, non-blocking; spec/design ambiguity) |
| `Math.min/max(ts)` replaced by `ts[0]/ts[1]` | n/a | SURVIVED (EQUIVALENT: `jambsT` is ascending) |
| raw host lookup in `nearestDimAnchor` only | n/a | SURVIVED (EQUIVALENT: `dimPointPoint` still returns null; combined variant killed by DA-50) |
| `!(d > radius)` in snap alone | n/a | SURVIVED (EQUIVALENT: NaN only arises with raw host; combined variant killed) |
| mountingScene: jamb element wall not checked in `ids` | n/a | SURVIVED (EQUIVALENT: visible elements always sit on a wall in `scene.walls`) |
| `hit distance` extra `el.id === ""` guard | n/a | SURVIVED (EQUIVALENT: ids are non-empty) |
| `deleteObjects`: `picked.doorways` ids dropped from the removed-id set | n/a | SURVIVED (EQUIVALENT: `gone` already includes picked doorways) |

## Findings

1. RESOLVED (was IMPORTANT): DA-47c is no longer vacuous; verified KILLED mutant "parallel check removed". DA-47f and DA-49c close the two minor boundary survivors (radius exactly at limit; tie tolerance 1e-9 vs 1e-6).
2. Minor, accepted: `main.ts` routing is untested by design (no harness); it must be covered by the manual browser verification (click near each of the four jamb corners; vertex wins at a corner; third click snaps to a neighbour's level; Esc; zero length; eraser on a jamb dimension; undo/redo; PDF; Montage).
3. Minor, non-blocking: explicit `kind: "edges"` acceptance is not pinned (spec silent; design D8 type allows it).
4. Minor: DA-35 depends on the argument order of `drawScene` (it wraps, and still calls, the real function).
5. No regression: whole suite 175 files / 3873 tests and `tsc --noEmit` clean on the reference; AD-30 narrowing remains behavior-neutral; all round-1/round-2 required mutants stay killed; no test is wrong on the reference; the 8 "Unexpected Passes" explanations remain true.

## Required Changes

- None blocking. Optional: one test for explicit `kind: "edges"`.
## Verdict

VERDICT: PASS