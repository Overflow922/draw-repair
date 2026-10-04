# Test Validation

Re-validation after FAIL #1. The validator ran independently, in a fresh context, and verified everything itself. It did not rely on the earlier validation or on test-suite.md.

Validated:
- `src/wall-seam.test.ts`: new, 81 tests.
- `src/wall-geometry-corner.test.ts`: CJ-13t replaced by SM-9. Per `git diff`, this is the only change in that file.

## Runs in the real repo

| Command | Result |
|---|---|
| `npx vitest run src/wall-seam.test.ts src/wall-geometry-corner.test.ts` | 29 failed / 106 passed (135) |
| `npx vitest run` (full suite) | 29 failed / 882 passed (911); 28 other files green |
| `npx tsc --noEmit` | passes |

- Every failure is a new-behaviour test:
  - SM-ORACLE same-material ×15;
  - SM-1…SM-6, SM-8, SM-9, SM-11, SM-12, SM-13, SM-14;
  - SM-17, SM-18.
- All other tests pass: negative, regression and invariant tests (SM-7 ×7, SM-8d, SM-10, SM-15, SM-16, SM-18d, SM-ORACLE diff ×16, SM-INV-*).
- SM-16 and SM-ORACLE P pass before implementation. test-suite.md explains this correctly: the current `onSameTypeFace` already hides a full-length face-to-face contact between walls of equal thickness.
- Test discovery: every test is collected (81 + 54).

## Reference implementation

The validator wrote its own reference `contourSegments` in the scratch copy `scratchpad/validator2`, with `src/` re-synced from the repo.
- What it does (design D1/D2): the outline minus the intervals, in the edge's own parametrization, that coincide with the outline of same-material neighbours.
  - Thickness is ignored.
  - Neighbours are filtered by the AABB of their display form.
  - Coincidence tolerance is 1e-4 cm.
  - Each coinciding piece must pass the opposite-sides check (δ = 1e-3).
  - Zero-length intervals are dropped.
  - `onSameTypeFace`, `seamLines`, `seamVisible`, `SeamLine` and `onLine` are removed.
- Result: **135/135** in the two files and **911/911** in the full suite.
- So a spec-conforming implementation can satisfy the suite, and it does not conflict with other approved tests (for example `geometry-cleanup.test.ts`).

## Requirement Coverage

| Requirement / scenario | Tests | Assessment |
|---|---|---|
| Слияние — criterion: material only, thickness ignored | SM-4, SM-5, SM-6, SM-9, SM-14, SM-ORACLE C/T/L-20/10, CJ-13t, V-20/10 | covered |
| Слияние — Прямой угол одного типа | SM-1 (both orders, exact lengths), SM-ORACLE L, L 30°, L 90.3° | covered |
| Слияние — Т-стык (hidden only over the contact width) | SM-2 (89.8 visible on each side, opposite face 199.8), SM-ORACLE T | covered |
| Слияние — Коллинеарные | SM-3, SM-ORACLE C | covered |
| Слияние — разная толщина, ступенька (C 20/10) | SM-4 (hidden [-4.9, 4.9]; visible 4.8 + 4.8) | covered exactly per the scenario |
| Слияние — разная толщина, Т-стык и угол | SM-5 (middle), SM-6 (at the end), SM-ORACLE | covered |
| Слияние — Разные типы | SM-7 ×7 (including C-20/10 over the full height), SM-8d, SM-ORACLE diff ×16, SM-9 concrete branch, CJ-13d | covered |
| Слияние — Клин одного материала | SM-8 (W60), SM-ORACLE W60/W45 in both orders | covered |
| Слияние — угловой стык на грани | SM-9, CJ-13, CJ-13c, SM-ORACLE R+/R−/CJ-13t | covered |
| Слияние — легаси-вершина | SM-14, SM-ORACLE V-20/10, V45 | covered |
| Слияние — «в превью цепочки» | SM-18 / SM-18d through `render.drawScene` and `strokeRecorder` | **now covered for real** (see Integration Behavior) |
| Слияние — Касание в точке | SM-10 (perimeter 240 for each wall, both orders) | covered |
| Слияние — Подсветка не зависит | SM-11 | covered |
| Слияние — Смена материала | SM-12 (brick → reinforced → brick) | covered |
| Слияние — rule affects only the contour line | SM-INV-1 (contour ⊂ outline), SM-11; existing shape and hit tests unchanged and green | covered |
| Примыкание на прямом угле — modified phrase (by material) | SM-1, SM-6, SM-7, SM-16 (face-to-face), SM-ORACLE L 90.3° | covered |
| Заливка клина — seam by material | SM-8, SM-8d, SM-ORACLE W45/W60 | covered |
| Легаси — seam by material, угол разной толщины | SM-14, SM-ORACLE V-20/10 | covered |
| design D3 (removal) | SM-17 (`onSameTypeFace`, `seamLines`, `seamVisible`, `SeamLine`) | covered, now consistent with D3 |

## Boundary Coverage

- A short edge on a long face: SM-1 (an end of 20 on a face of 200) and SM-6.
- Partial coverage: SM-2 and SM-5, with exact visible lengths.
- Different thickness: SM-4, SM-5, SM-6, SM-9, SM-14.
- Contact and gap cases:
  - point touch: SM-10;
  - 0.01 cm gap: SM-15;
  - contact along the full length: SM-16.
- Tilt within tolerance: SM-ORACLE L 90.3°.
- Rotated joint: SM-ORACLE L 30° was added, as recommended earlier.
- Blind zone (not blocking):
  - The coordinate tests leave a 0.1 cm margin, so they cannot see a hidden interval that overreaches by less than 0.1 cm.
  - The 0.05 cm overreach mutant is killed only by SM-INV-3.
  - At drawing resolution, with a square line cap, this is acceptable.

## Negative Cases

These are adequate:
- Different materials: SM-7 ×7, SM-8d, SM-ORACLE diff ×16, SM-18d, SM-9 (concrete), CJ-13d.
- Point touch: SM-10.
- Gap: SM-15.
- Highlight keeps the contact side: SM-11.

## Error Handling

Not applicable. This is pure geometry with no error paths. Degenerate walls are covered by existing tests.

## Invariants

- **SM-INV-1**: contour ⊂ outline, on 16 scenes × 2 materials × 2 orders.
- **SM-INV-2**: frozen inputs are not mutated. The existing CJ-15 also covers this.
- **SM-INV-3**: total contour length does not depend on wall order, on 7 scenes × 2 materials.
- **SM-ORACLE**: the outer boundary is always drawn, and boundaries between pieces of the same wall are never drawn.

## State Transitions

- SM-12 covers same → different → same material on one scene.
- D5 needs no other states: the contour is recomputed on every frame.

## Integration Behavior

- **SM-18 / SM-18d** now go through `drawScene(ctx, …, walls=[A], preview=B, …)`. They record strokes in ink colour and measure the length on the screen line y = 10 over x ∈ [180.5, 199.5].
- Mutation results:

  | ID | Mutation | Result |
  |---|---|---|
  | r1 | `render.ts:154`: fixed walls drawn with `walls` instead of `sceneWalls` | **killed by SM-18**; full suite 910/911, only SM-18 fails |
  | r4 | preview drawn with `[preview]` | killed by SM-18 |
  | r3 | r1 and r4 combined | killed by SM-18 |
  | r2 | preview drawn with `walls` | survives; equivalent (see below) |

- Why r2 is equivalent: the preview is treated as the latest wall when it is missing from the array (`iWall === -1`), and its neighbours come from `walls` anyway. The shape and the contour are therefore identical.
- Canvas and PDF go through `strokeContour` → `contourSegments`, whose signature does not change.
- Hatch lines are also drawn in ink, but at 45°, so they do not distort the horizontal measurement.

## Implementation Independence

- Expected values are scene coordinates.
- SM-ORACLE derives its expectations from `displayPolygons`, the canonical shape that this change does not touch, and from its own `inPoly`. It does not repeat the logic of `contourSegments`.
- No mocking. `strokeRecorder` is a recording context, not a stub of the logic under test.
- SM-17 is a structural check, required by design D3 and by Rule 10 (dead code). It scans every `.ts` file in `src/` except itself. Today the names appear only in `wall-geometry.ts`, so the check is consistent with D3 («geometry-cleanup.test.ts не меняется»).

## Assertion Strength

- Exact lengths (`toBeCloseTo(…, 6)`), `< 1e-6` for hidden parts, and both orders almost everywhere.
- SM-ORACLE guards against passing vacuously:
  - `sameSeam > 0` and `outer > 0` for one material;
  - `diffSeam > 0` for different materials.
- Soundness of SM-ORACLE:
  - The `s1.length > 1 || s2.length > 1` skip drops only points where shapes overlap, which the spec forbids.
  - Points near vertices are filtered (0.3 cm from any vertex in the scene, plus 0.5 cm from the edge's own ends), and samples are taken every 1 cm. Together these give the blind zone described above.
  - Deviation from the test-plan: the plan says δ = 0.05 and a 0.5 cm margin from the piece's vertices; the test uses δ = 0.002 and 0.3 cm from any vertex. This is no weaker in substance. Not blocking.
- SM-9 is not a weakening:
  - It reverses the assertion as the spec now requires.
  - It keeps the old "seam drawn" assertion for the different-material case.
  - It adds the visibility of U's outer face in both orders.
- Minor: the concrete check repeats inside the order loop. Harmless.

## Mutation Testing

There is no mutation tool, so mutations were applied manually as switches over the reference implementation. Each row is a run of the two files (135 tests).

| Mutation | Failed | Killed by (examples) |
|---|---|---|
| ignore material | 29 | SM-7 ×7, SM-ORACLE diff ×16, SM-8d, SM-12, SM-18, SM-9, CJ-13c, CJ-13d |
| keep thickness equality | 10 | SM-4, SM-5, SM-6, SM-14, SM-9, SM-ORACLE C/T/L-20/10, CJ-13t, V-20/10 |
| hide whole edge | 27 | SM-2, SM-4, SM-5, SM-6, SM-14, SM-ORACLE, SM-INV-3, CJ-13c |
| coverage in the neighbour's parametrization | 29 | SM-1, SM-2, SM-4…SM-6, SM-ORACLE, … |
| only the neighbour's long faces | 28 | SM-1…SM-6, SM-8, SM-12…SM-14, SM-18, SM-9, CJ-13, SM-ORACLE ×15 |
| point touch hides the edge | 32 | SM-10, SM-ORACLE, SM-INV-3, CJ-13c, … |
| large tolerance (0.05 cm, angle 1e-3) with the side check | 0 | equivalent: the side check (δ = 1e-3) rejects any gap larger than δ |
| large tolerance + no side check + neighbour filter padded by the thickness | 1 | SM-15 |
| all piece edges of the neighbour (with or without the side check) | 0 | equivalent while shapes do not overlap (declared in the test-plan) |
| no side check | 0 | equivalent while shapes do not overlap (declared in the test-plan) |
| neighbour's raw rectangle instead of its display outline | 12 | SM-8, SM-14, SM-9, CJ-13, SM-ORACLE W/R/V/L 90.3° |
| asymmetric: only the later wall hides | 30 | SM-ORACLE ×15, SM-1…, CJ-13, SM-9 |
| outer boundary dropped near joints (overreach 0.3 cm) | 13 | SM-1, SM-2, SM-4…SM-6, SM-14, SM-INV-3 ×5, CJ-13c ×2 |
| overreach 0.05 cm | 5 | SM-INV-3 ×5 only |
| no hiding at wedge, face-corner or legacy joints | 12 | SM-8, SM-14, SM-9, CJ-13, SM-ORACLE W45/W60/R±/CJ-13t/V-20/10/V45/L 90.3° |
| neighbour AABB from the raw rectangle with a 1e-3 tolerance | 4 | SM-ORACLE R−, CJ-13t, CJ-13, SM-9 |
| highlight (`outlineSegments`) also hides seams | 1 | SM-11 |
| r1: `drawScene` draws fixed walls with `walls` instead of `sceneWalls` | 1 (full suite: 1/911) | SM-18 |
| r4: preview drawn with `[preview]` | 1 | SM-18 |
| r2: preview drawn with `walls` | 0 | equivalent (see Integration Behavior) |

## Surviving Mutations

| Mutation | Expected Failing Test | Result |
|---|---|---|
| large coincidence tolerance (0.05 cm) with the side check | SM-15 | Survives. Equivalent in effect: the D2 side check rejects every gap larger than 1e-3 cm. Killed once combined with removal of the side check. |
| all piece edges of the neighbour | — (declared equivalent in the test-plan) | Survives. Equivalent while shapes do not overlap. |
| opposite-sides check removed | — (declared equivalent in the test-plan) | Survives. Equivalent while shapes do not overlap. |
| r2: preview drawn with `walls` (`render.ts:155`) | SM-18 | Survives. Equivalent: a preview missing from the array is already treated as the latest wall. |
| overreach < 0.1 cm | SM-1/2/4/5/6 | Killed only by SM-INV-3 (0.05 cm). This is the 0.1 cm blind zone of the precise tests. Not blocking. |

No critical non-equivalent mutation survives.

## Findings

1. **Previous Required Change 1 (SM-18 did not test the preview path): resolved.**
   - SM-18 now goes through `drawScene` with `strokeRecorder`.
   - The `render.ts:154` mutant and the `[preview]` mutant are killed.
   - SM-18d checks the measurement in the different-material case.
2. **Previous Required Change 2 (SM-17 vs design D3): resolved.**
   - D3 now says that SM-17 in `wall-seam.test.ts` is the only cleanup check and that `geometry-cleanup.test.ts` does not change.
   - `SeamLine` was added to the checked names.
   - The test-plan's «Integration Cases» matches D3.
3. **Recommended items: done.**
   - design D1 explains the display-form AABB, or padding by at least the thickness.
   - The test-plan's assessments of mutants h and g were corrected.
   - SM-ORACLE has a rotated scene (L 30°).
   - A tighter margin for SM-2 was not added. Not blocking.
4. (Minor) SM-ORACLE parameters differ from the test-plan text (δ, margin from vertices), as noted in Assertion Strength. Not blocking.
5. (Minor) Test-plan wording: the "large tolerance" mutant is killed by SM-15 only when the side check is removed **and** the neighbour filter is wider than the gap. With a display-form AABB padded by 1e-3, a 0.01 cm gap is cut off by the filter itself. This is correct behaviour, not a test defect.

## Required Changes

None (blocking).

Optional:
- Bring the SM-ORACLE parameters in test-plan.md in line with the test (δ = 0.002, 0.3 cm margin).
- Add a tighter (0.01 cm) end-of-interval check for SM-2.

## Verdict

- The suite covers every scenario of «Слияние стен одного материала» and the modified phrases in the right-angle, wedge and legacy requirements, including the preview chain through the real renderer.
- All critical logic and integration mutants are killed. The survivors are equivalent and documented.
- A spec-conforming reference implementation passes 911/911.
- The approved-test change (CJ-13t → SM-9) is justified by the spec and does not weaken anything.

VERDICT: PASS


---

## Amendment: near-coincident segments (ST-*)

Scope: the new file `src/wall-seam-tilt.test.ts` (ST-0..ST-6) together with the approved suite, checked against the amended requirement «Слияние стен одного материала» (near-coincidence paragraph and its five new scenarios) and the amended design D2. Production code is not yet changed.

Repo run (`npx vitest run src/wall-seam-tilt.test.ts src/wall-seam.test.ts src/wall-geometry-corner.test.ts`): 151 tests found, 5 failed, 146 passed. The failures are exactly ST-1 FC/Lm/Tm/Cm and ST-5, all new-behaviour tests. A full repo run gives the same 5 failures out of 927 tests. `tsc --noEmit` passes.

### Requirement Coverage

| Scenario / rule clause | Test(s) | Assessment |
|---|---|---|
| Стена слегка повёрнута — шов не отображается (FC, T, L, C; 0.01°–0.45°; both orders) | ST-1 ×4, ST-3 ×4 | Covered: 4 joint kinds × 4 angles × 2 signs × 2 orders, built with the production `moveWalls` / `moveEndpoint`. **Conflicts with approved SM-ORACLE L 90.3°** (see Findings F1). |
| Слегка повёрнутые стены разных материалов | ST-2 ×4 | Covered: the seam must be drawn over the whole shrunk span. |
| Почти параллельные, но не касающиеся | SM-15 (approved) | Covered. It kills the "no touch" mutant and touch tolerance ≥ 0.01 cm. |
| Расхождение больше 0.5 см | ST-4 | Covered: 0.3°, gap 1.047 cm (checked numerically), both faces drawn in full, both orders. |
| Угол больше допуска прямого угла | ST-6 | Covered only at exactly 1°. A 1° tolerance survives (F2). |
| clause "расхождение ≤ 0.5 см ⇒ hidden" (positive case of the cap) | ST-5 | Covered for A's face. B's face is not asserted in ST-5; ST-1 covers both walls. |
| clause "касаются или пересекаются" | SM-15, ST-1 FC | The negative side is covered. On the positive side, ST-1 FC 0.45° needs a touch tolerance ≥ 3.1e-4 cm, while D2 says «порядка 1e-4» (F3). |
| clause "формы обращены в противоположные стороны" (per-edge probes) | ST-1, ST-5 | The single-probe mutant is killed. |

### Boundary Coverage

- Angle: 0.01°, 0.1°, 0.25° and 0.45° inside the tolerance (ST-1/2/3); 1° outside (ST-6). Nothing between 0.5° and 1°, so the tolerance boundary is not pinned (F2).
- Divergence: 0.35 cm (ST-5, hide) against 1.05 cm (ST-4, show). Verified numerically: 200·sin 0.1° = 0.349 and 200·sin 0.3° = 1.047. The 2 cm cap mutant is killed. Caps between 0.5 and 1.04 cm are not distinguished, which is acceptable.
- Touch: the 0.01 cm parallel gap (SM-15) is the only negative. It is acceptable for the spec's "касаются" wording.
- FC 0.45° is a real geometric boundary for the touch tolerance: the face-corner shapes miss each other by h·(1−cos θ) = 3.08e-4 cm (h = 10). For h = 25 at 0.5° this would be 9.5e-4 cm.

### Negative Cases

ST-2 (different materials), ST-4 (gap > 0.5), ST-6 (angle > tolerance), SM-15 (non-touching parallel) and ST-3 (outer boundary outside the contact band always drawn). They are adequate apart from F2.

### Invariants

Approved SM-INV-1..3 still pass with the reference. ST-3 is an outer-boundary preservation invariant on the tilted scenes. ST-0 proves the fixtures are actually rotated: `angleOff(walls[1])` ≈ θ to 6 digits for every builder (sign +1 only; sign −1 is symmetric by construction). It does not prove contact. Contact is shown indirectly: ST-2 finds the drawn seam inside the 0.6 cm band, and ST-1 fails on the current code (stubs exist).

### Implementation Independence

The seam measurer (`seamLength`), `missingOuter` and `drawnOn` use only coordinates, `contourSegments` and `outlineSegments`. They do not use internal tolerances.

Measurer soundness:
- Band 0.6 cm vs the maximum lateral spread of a real seam edge over a 20 cm span at 0.45°: 0.157 cm. Every real seam edge falls in the band.
- The 1° parallel filter is above the 0.45° maximum.
- The 0.5 cm span shrink can only miss end stubs under 0.5 cm. The partial-hide mutant leaves stubs far from the touch point and is killed in all 4 builders.
- `inBand` exempts only a 1.2 cm-wide strip around the contact line. Outer faces cross it only near the span ends.

### Assertion Strength

The assertions are strong. ST-1 uses `seam > 1e-6`, so any stub fails. ST-2 requires the full span. ST-3 samples every 0.5 cm. ST-4/ST-6 use `toBeCloseTo(full length, 6)`. ST-5 uses `toBe(0)`. ST-5 does not check B's face (minor; ST-1 compensates).

### Mutation Testing

The reference implementation per amended D2 is in a scratch copy: angle ≤ sin 0.5°, segment–segment distance ≤ TOUCH, positive projected interval, max divergence of q's in-interval part ≤ 0.5 cm, and opposite inward normals from per-edge probes (δ = 1e-3).

- With TOUCH = 1e-4 (the literal D2 value): ST-1 FC (0.45° −, both orders, seam 19 cm) fails, and so does approved SM-ORACLE L 90.3°.
- With TOUCH = 5e-4 … 2e-3: everything passes except approved **SM-ORACLE L 90.3°** (927/928 including a debug file; 926/927 for the real suite).

Mutants were run against the full suite with the TOUCH = 1e-3 reference as baseline.

### Surviving Mutations

| Mutation | Expected Failing Test | Result |
|---|---|---|
| strict collinearity (current code) | ST-1, ST-5 | Killed (ST-1 ×4, ST-5) |
| no touch condition | ST-4 / SM-15 | Killed (SM-15) |
| no divergence cap | ST-4 | Killed (ST-4) |
| angle tolerance 1° | ST-6 | **SURVIVES**. Not equivalent: the spec says 0.5°, and ST-6 sits exactly on 1° |
| angle tolerance 2° | ST-6 | Killed (ST-6) |
| side check by single probe through seam midpoint | ST-1 | Killed (ST-1 ×4, ST-5) |
| divergence cap 2 cm | ST-4 | Killed (ST-4) |
| touch tolerance 0.05 cm | SM-15 | Killed (SM-15) |
| hide only where gap ≤ 1e-4 (partial) | ST-1 / ST-5 | Killed (ST-1 ×4, ST-5) |

### Findings

- **F1 (blocking): the approved test SM-ORACLE L 90.3° contradicts the amended spec, so no implementation can satisfy the suite.**
  - The scene: B is rotated 0.3° from the right angle at A's face. In `[A,B]`, B's piece has the edge (190,10)→(180.0001,10.0524). Between it and A's face y = 10 on x ∈ [180,190] there is an empty wedge up to 0.052 cm wide.
  - The oracle (δ = 0.002) classifies those points as "outer boundary" and requires them drawn. It reports 20 violations against a spec-conforming reference: s1 at (180.5..189.5, 10) and s2 along B's cap.
  - The amended rule (touching at (190,10), angle 0.3° ≤ 0.5°, gap 0.052 ≤ 0.5 cm, opposite sides) requires exactly these segments hidden. This is the user's stub defect, and the oracle currently enforces it. The same geometry is required hidden by ST-1 Lm.
  - test-suite.md claims «одобренные файлы не изменены», and test-plan.md («Boundary Cases: Наклон в пределах допуска … через SM-ORACLE») still relies on the oracle. Neither records the needed change.
- **F2 (non-equivalent survivor):** an angle tolerance of 1° (and presumably anything in (0.5°, 1°]) passes ST-6, because ST-6 tests exactly 1°. ST-6 does follow the spec's scenario literally. Still, the 0.5° tolerance itself is not pinned.
- **F3 (spec/design numeric inconsistency, not a test defect):** D2 specifies a touch tolerance «порядка 1e-4 см». The FC scenario at 0.45° (required by the spec scenario and by ST-1 FC) has a real gap of 3.08e-4 cm between the shapes, from the right-angle layout: h·(1−cos θ). At 50 cm and 0.5° the gap is 9.5e-4 cm. An implementation that follows D2 literally fails ST-1 FC. The tests are correct w.r.t. the scenario. D2 must state a tolerance that covers h·(1−cos 0.5°) for the maximum thickness (for example 1e-3 cm), or define "touch" differently.
- Fixtures verified: ST-0 rotation is real. ST-4 gap is 1.047 cm, ST-5 gap 0.349 cm, ST-6 gap 0.349 cm at 1°. In ST-4/5/6, B's lower face starts exactly at (0,10), as the comments say.

### Required Changes

1. **Test-change-request for approved SM-ORACLE L 90.3°** (`src/wall-seam.test.ts`). Under the amended spec, the wedge between near-coincident same-material edges is a hidden seam, not an outer boundary. Possible fixes:
   - teach the oracle the near-coincidence rule: points of an edge within 0.5 cm of a touching neighbour edge at ≤ 0.5° count as seam, not outer;
   - or move L 90.3° out of the same-material oracle into ST-style checks.

   Record it under «Changed Approved Tests» in test-plan.md and test-suite.md with the justification. Update the test-plan boundary row «Наклон в пределах допуска».
2. **Pin the angle tolerance:** add a case between 0.5° and 1° (for example 0.7°, B length 20 cm, gap 0.24 cm ≤ 0.5) where both faces must be drawn. Alternatively, add 0.6° next to ST-6. The case must kill the tolerance-1° mutant.
3. (Spec/design, for the change owner) Fix the D2 touch tolerance (F3) so that the design is consistent with the FC 0.45° scenario. Not a test change.
4. (Optional) In ST-5, also assert that B's lower face is not drawn on the common extent.

### Verdict

- The ST tests are well built. They use production move paths, implementation-independent measurers and correct geometry, and they kill 8 of the 9 requested mutants.
- The suite as a whole is unsatisfiable: approved SM-ORACLE L 90.3° demands the very stub the amendment forbids, and this conflict is not recorded as a test change.
- A non-equivalent angle-tolerance mutant (1°) survives.
- The work returns to Test Writing (with a test-change-request for SM-ORACLE L 90.3°).

VERDICT: FAIL

## Amendment re-validation: near-coincident segments

Scope: re-validation after the Test Writer's revision for the amendment FAIL above. It covers `src/wall-seam-tilt.test.ts` (ST-0..ST-7), the changed approved test SM-ORACLE L 90.3° in `src/wall-seam.test.ts`, the amended spec delta («Слияние стен одного материала»), design D2, test-plan.md («Слегка повёрнутые стыки», «Changed Approved Tests») and test-suite.md. This validation was done in a fresh context. Production code is not changed for this amendment: `contourSegments` still uses strict coincidence, with `PARALLEL_SIN = 1e-6` and `COINCIDE_CM = 1e-4`.

What changed since the previous validation. I compared byte-for-byte against the scratch copy of the previous validator (`validator3`), because `wall-seam.test.ts` is untracked:
- `wall-seam.test.ts`: the only change is `SAME_ORACLE_SCENES = ORACLE_SCENES.filter(name !== "L 90.3°")`, a comment that points to the test-change-request, and the same-material `it.each` now using `SAME_ORACLE_SCENES`. The oracle body (δ = 0.002, 1 cm step, 0.3 cm vertex skip, 1e-6 on-contour tolerance) is unchanged. The different-material oracle and SM-INV-1 still iterate over `ORACLE_SCENES` (including L 90.3°).
- `wall-seam-tilt.test.ts`: ST-5 now also asserts that B's lower face (shrunk 0.5 cm at each end) is not drawn, and ST-7 (0.7°) was added. ST-0..ST-4 and ST-6 are unchanged.
- All other `*.test.ts` and test utilities are identical to the previous validation's copy, including `wall-geometry-corner.test.ts`.

Repo runs:
- Three files (`npx vitest run src/wall-seam-tilt.test.ts src/wall-seam.test.ts src/wall-geometry-corner.test.ts`): 151 tests, **5 failed / 146 passed**.
- Full suite: 927 tests, **5 failed / 922 passed**.
- In both runs the failures are exactly ST-1 FC/Lm/Tm/Cm and ST-5, all new-behaviour tests.
- `tsc --noEmit` passes. The project has no lint or format script.

Status of the previous Required Changes:
1. **SM-ORACLE L 90.3° test-change-request: addressed.**
   - test-plan.md «Changed Approved Tests» records the request with a spec-driven justification: under the amended rule the near-coincident wedge is a hidden seam. It also names the replacing coverage (ST-1 Lm) and links back to the validator finding (F1).
   - The boundary row «Наклон в пределах допуска» was updated.
   - This is not a weakening:
     - the removed same-material expectation demanded exactly the stub that the amended spec forbids;
     - the seam side is covered by ST-1 Lm (L tilted 0.01°–0.45°, both signs, both orders);
     - the outer-boundary side is covered by ST-3 Lm;
     - the different-material oracle and SM-INV-1 keep the 90.3° scene.
   - test-suite.md records it only in the subsection «Revision after test-validation FAIL (amendment)». Its own «## Changed Approved Tests» section still says «Остальные существующие тесты не изменены», and the SM-ORACLE (same) row still lists L 90.3° as one of ×16 scenes (F2 below).
2. **Angle case between 0.5° and 1°: addressed.** ST-7 uses 0.7° with B of length 20. Divergence was checked numerically: 20·sin 0.7° = 0.2443 cm ≤ 0.5. B's lower face starts exactly at (0, 10), so the shapes touch. All other near-coincidence conditions hold, so only the angle decides. ST-7 kills tolerances ≥ 0.71°.
3. **D2 touch tolerance: addressed.**
   - D2 now sets `TOUCH_CM = 1e-3` cm and justifies it by h·(1−cos 0.5°) ≤ 9.5e-4 cm for h ≤ 25 cm, where h is the half-thickness, i.e. walls up to 50 cm.
   - I verified it numerically on FC at 0.45°, sign −. v's piece edge runs (188.50740, −10)→(188.35094, 9.92146), and h's cap is at x = 188.35063. The gap is 3.08e-4 cm = 10·(1−cos 0.45°).
   - The SM-15 gap (0.01 cm) is still outside the tolerance.
4. **ST-5 checks B's face: addressed.** `drawnOn(segs, inner) === 0` holds in both orders.

### Requirement Coverage

| Scenario / clause | Test(s) | Assessment |
|---|---|---|
| Стена слегка повёрнута — шов не отображается (FC, T, L, C; 0.01°–0.45°; any order) | ST-1 ×4 (seam), ST-3 ×4 (outer faces) | Covered: 4 joint kinds × {0.01, 0.1, 0.25, 0.45}° × ±, both orders, built with the production `moveWalls` / `moveEndpoint`, which is how the user got the rotations |
| Слегка повёрнутые стены разных материалов | ST-2 ×4, SM-ORACLE L 90.3° (diff) | Covered: the seam is drawn over the whole shrunk span |
| Почти параллельные, но не касающиеся | SM-15 | Covered |
| Расхождение больше 0.5 см | ST-4 (0.3°, 1.047 cm) | Covered |
| Угол больше допуска прямого угла | ST-6 (1°, spec literal), ST-7 (0.7°) | Covered. Tolerance pinned to [0.45°, 0.7°) |
| Clause: divergence ≤ 0.5 ⇒ hidden (positive) | ST-5 (0.1°, 0.349 cm; A's and B's faces) | Covered |
| Clause: «касаются или пересекаются» | SM-15 (negative); ST-1 FC 0.45° (positive, real gap 3.08e-4) | Covered. Touch tolerance pinned to [3.1e-4, 0.01) cm |
| Clause: shapes face away in opposite directions | ST-1, ST-5 (kill the single-probe check) | Covered as far as testable (see noside below) |
| Clause: remaining part of the edge stays visible | ST-3, ST-4, ST-6, ST-7 | Covered |

### Boundary Coverage

- **Angle.** 0.45° (hide) vs 0.7° (show) and 1° (show). A tolerance anywhere in [0.45°, 0.7°) passes. Above 0.5° the right-angle classification (`RIGHT_SIN`) switches to wedge-fill rendering. Over a 0.5°–0.7° band the gap is capped at 0.5 cm and is under a pixel at normal zoom. **I judge this residual band negligible.**
- **Divergence.** 0.349 cm (hide) vs 1.047 cm (show). Caps in [0.35, 1.04) cm are not distinguished. This is acceptable: ST-4 kills the 2 cm cap and the no-cap mutant.
- **Touch.** 3.08e-4 cm (FC 0.45°, must touch) vs 0.01 cm (SM-15, must not). 1e-4 and 0.05 cm are both killed.
- **Fixture geometry**, verified via `displayPolygons` in the scratch copy:
  - ST-4: B's face runs (0,10)→(199.997, 11.047).
  - ST-5: (0,10)→(199.9997, 10.349).
  - ST-6: (0,10)→(19.997, 10.349).
  - ST-7: (0,10)→(19.9985, 10.2443).
  - In all four, A stays a single rectangular piece.

### Negative Cases

- ST-2 ×4: different materials. Also kills "ignore material in the near-coincidence branch".
- ST-4: gap > 0.5 cm.
- ST-6 and ST-7: angle above the tolerance.
- SM-15: a parallel gap with no touch.
- SM-ORACLE L 90.3° (different materials).

These are adequate.

### Invariants

- SM-INV-1..3 pass with the reference implementation. INV-SUB still covers L 90.3°.
- ST-3 preserves the outer boundary on every tilted scene for both materials.
- ST-0 confirms the fixtures are actually rotated by θ to 6 decimal places.

### Implementation Independence

`seamLength`, `inBand`, `missingOuter` and `drawnOn` use only scene coordinates and the public `contourSegments` / `outlineSegments`. They use no internal tolerances.

Soundness of the measurer:
- The real seam edges spread laterally by at most 20·sin 0.45° = 0.157 cm, well inside the 0.6 cm band.
- The 1° parallel filter is above 0.45°.
- The 0.5 cm span shrink can miss only stubs shorter than 0.5 cm at the span ends. The partial-hide mutant leaves stubs far from the touch point and is killed in all 4 builders.
- The ST-3 exemption is a 1.2 cm strip around the contact line, extended by 1 cm past the span ends. A mutant that hides real outer edges cannot hide behind it except within about 0.6 cm of the span ends, and that is negligible.

The contact lines are defined from the post-move scene: h's cap for FC, A's face for Lm/Tm, A's cap for Cm. They match the geometry I dumped.

### Assertion Strength

- ST-1 fails on any seam > 1e-6 cm.
- ST-2 requires the full shrunk span.
- ST-3 samples every 0.5 cm.
- ST-4, ST-6 and ST-7 use `toBeCloseTo(full, 6)`.
- ST-5 uses `toBe(0)` for both faces.

The assertions are strong.

### Mutation Testing

Reference implementation per amended D2, in the scratch copy `validator4`:
- angle: `|sin| ≤ sin 0.5°`;
- touch: segment–segment distance ≤ 1e-3 cm;
- a positive projected interval;
- divergence: the maximum distance from the ends of q's in-interval part to the line p1p2 is ≤ 0.5 cm;
- sides: inward normals found by per-edge probes (δ = 1e-3) must be opposite.

With this reference the **full suite passes: 927/927**. Mutants were selected by an environment flag and run against the full suite.

### Surviving Mutations

| Mutation | Expected failing test | Result |
|---|---|---|
| strict collinearity (= current repo code) | ST-1, ST-5 | Killed (ST-1 ×4, ST-5) |
| no touch condition | SM-15 / ST-4 | Killed (SM-15) |
| no divergence cap | ST-4 | Killed (ST-4) |
| angle tolerance 0.6° | ST-7 | **Survives** (any tolerance in [0.45°, 0.7°) survives). Not strictly equivalent, but judged negligible (see Boundary Coverage) |
| angle tolerance 0.4° | ST-1 | Killed (ST-1 ×4) |
| angle tolerance 1° | ST-7 | Killed (ST-7) |
| angle tolerance 2° | ST-6, ST-7 | Killed (ST-6, ST-7) |
| side check by one probe through the seam midpoint | ST-1 | Killed (ST-1 ×4, ST-5) |
| divergence cap 2 cm | ST-4 | Killed (ST-4) |
| touch tolerance 0.05 cm | SM-15 | Killed (SM-15) |
| touch tolerance 1e-4 cm | ST-1 FC | Killed (ST-1 FC) |
| partial hiding only where gap ≤ 1e-4 | ST-1, ST-5 | Killed (ST-1 ×4, ST-5) |
| ignore material in the near-coincidence branch | ST-2 | Killed (ST-2 ×4, SM-ORACLE L 90.3° diff) |
| side check removed entirely (extra) | — | Survives. Already listed in test-plan as an acceptable survivor: equivalent while shapes do not overlap |

### Findings

- **F1: the previous blocking finding is resolved.** The SM-ORACLE L 90.3° change is a justified, spec-driven test change, recorded in test-plan.md «Changed Approved Tests» and in test-suite.md. The removed coverage is replaced by ST-1 Lm and ST-3 Lm. The change is minimal: one filter.
- **F2 (documentation, non-blocking): test-suite.md is internally inconsistent.**
  - Its «## Changed Approved Tests» section lists only CJ-13t and says «Остальные существующие тесты не изменены».
  - The SM-ORACLE (same) row still names L 90.3° among ×16 scenes; it is now ×15.
  - «Boundary cases» still says «SM-ORACLE L 90.3°: наклон в пределах допуска».
  - The change itself is recorded in the revision subsection. These lines should be aligned.
- **F3 (accepted residual):** the angle tolerance is pinned only to [0.45°, 0.7°). I judge this negligible: the spec's scenarios stop at 0.45°, gaps stay ≤ 0.5 cm, and walls beyond 0.5° switch to wedge rendering.
- **F4 (accepted residual):** the divergence cap is pinned only to [0.35, 1.04) cm, and the touch tolerance to [3.1e-4, 0.01) cm. Both ranges are acceptable for the spec wording.

### Required Changes

None blocking. Recommended (documentation only, test-suite.md):
- add the SM-ORACLE L 90.3° entry to the «## Changed Approved Tests» section and remove «Остальные существующие тесты не изменены»;
- change the SM-ORACLE (same) row to ×15 without L 90.3°;
- update the «Boundary cases» line that still refers to SM-ORACLE L 90.3°.

### Verdict

- All four previous required changes are addressed.
- The suite is satisfiable: a reference implementation per amended D2 passes 927/927.
- The suite fails on the current code only in the new-behaviour tests (ST-1 ×4, ST-5).
- It kills every requested mutant except the 0.6° angle tolerance, which I judge a negligible residual band.
- Only documentation inconsistencies in test-suite.md remain.

VERDICT: PASS
