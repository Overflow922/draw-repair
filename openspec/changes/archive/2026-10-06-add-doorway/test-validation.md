# Test Validation

Revision 3. This is an independent validation of the executable tests in `src/doorway/`: 7 files and 146 `it` blocks
(faces 23, edit 37, guard 30, scene 19, render 23, pdf 3, storage 11). They were checked against `proposal.md`, all
delta specs (including the reworded doorway «Отображение проёма»), `design.md` (D2, D5, D10), `test-plan.md`,
`test-suite.md`, and the production code (`render.ts`, `theme.ts`, `room-area.ts`, `wall-geometry.ts`,
`wall-chain.ts`, `wall-snap.ts`, `wall-edit.ts`, `storage.ts`, `history.ts`, `export/pdf.ts`, `types.ts`).
`test-suite.md` was not taken on trust: every claim below was checked in the test code.

Runs on 2026-10-06:

- `npx vitest run src/doorway`: 7 files, 37 tests discovered in the 3 files that load (27 fail, 10 pass).
  - The other 4 files fail with `Cannot find module` (`doorway-faces`, `doorway-edit`, `doorway-guard`,
    `doorway-scene`). This is expected before the implementation exists.
  - The `it` counts per file were counted by hand and match `test-suite.md` (23 / 37 / 30 / 19 unloaded,
    23 + 3 + 11 loaded, 146 total).
- `npx vitest run`: 27 failed / 1191 passed. Every failure is in `src/doorway/`, so no approved test regressed. The
  approved `storage.test.ts` roundtrip still passes.
- `openspec validate add-doorway`: valid. The only warnings are about RFC 2119 keywords, because the specs are in
  Russian.
- The new tests fail on the doorway-dependent assertion, not on a control:
  - DL-13 fails at the cut check, line 94. Its "nothing drawn past x = 500" checks already pass on the current code,
    so they do not report spuriously.
  - DL-03f passes its `findRooms` control and fails at the label assertion.
- Controls for the new guard tests were checked against the current code from a scratch test outside the
  repository:
  - DD-06, no doorways: snapping from (200, 200) to raw (200, 14) on free W gives `source: "wall"`, end (200, 10).
  - DD-06b: with corner wall n `(500,0)-(500,300)` t20, n's inner face starts at x = 490 and the corner block covers
    500…510. Under D3 this gives plus.b = 490 − 540 = −50 (before: −40) and minus.b = −30. So the violation gets
    deeper.
  - DG-07c: R with t10 / t20 / t30 puts R's inner face at x = 495 / 490 / 485 and the outer corner at 505 / 510 / 515.
    The worst distance is −45 / −50 / −55, so 30 deepens the violation and 10 reduces it, as the test expects.
  - DL-03e: `findRooms(sceneRT)` returns 2 rooms. DL-03f: the reversed W still closes one room.

Previous required changes, checked in the code rather than taken from the Notes:

| Previous finding (rev. 2) | Now | Verified by |
|---|---|---|
| 1. H label room rule indistinguishable from a fixed side | Fixed. The spec fallback is now (d.y, −d.x), the visual left. In DL-03 (W) and DL-03b (B) the room lies on the side opposite the fallback, so "always fallback" fails. "Always (−d.y, d.x)" fails DL-03c and DL-03f. "Room on plus, else fallback" fails DL-03e. | DL-03, DL-03b, DL-03c, DL-03e, DL-03f |
| 2. A broken doorway blocks drawing and thickness changes | Fixed. The contract is now `violatesDoorways(before, after, doorways)`. Unrelated drawing and a wall snap next to a broken doorway pass; a corner that deepens it is rejected. Thickness: an unrelated wall is allowed, deepening is rejected, reducing is allowed. | DD-06, DD-06b, DG-07c |
| 3. Dimension-chain order not asserted (sorted sets) | Fixed. `expectChain` sorts by screen x, asserts the exact text sequence a, width, b, and places each number inside its own world interval on both faces. | DL-04, DL-04b, DL-07, DL-08 |
| 4. Broken-doorway rendering untested | Fixed for the free-end case. Nothing (contour or non-ink stroke) is drawn past x = 500, the cut inside the wall is present (475), the body before it is kept (440), and the jamb at 450 is drawn. | DL-13 |
| 5. Spec and tests disagree on "слева от a → b" | Resolved at spec level by the user's decision. The spec now says "на экране слева … сторона нормали `(d.y, −d.x)`", with the scenario «Подпись без помещения — слева на экране». The tests and design D10 agree. **But** the wrong sentence in `test-plan.md` «Сцены» (line 46) was not fixed (see Findings). | DL-03c, DL-03e |
| Recommended DE-14b | Added. A slide to an admissible offset of 400 beyond P still stops at 205. | DE-14b |

## Requirement Coverage

- PASS. Every spec requirement of `doorway` and of the modified capabilities has executable coverage, or a manual
  check (M-01…M-16) for DOM-only behaviour.
- The three clauses that were uncovered in revision 2 are now covered:
  - the room-side H label (DL-03 / 03b / 03f against 03c / 03e);
  - "a broken doorway does not block edits, but the violation must not grow" for wall edits (DG-12), drawing
    (DD-06 / 06b) and thickness (DG-07c);
  - the broken part outside the face is neither cut nor drawn (DL-13).

## Boundary Coverage

- PASS. The boundaries from revision 2 are unchanged:
  - distance 0;
  - width equal to the run, and run + 0.01;
  - touching versus a 0.01 overlap;
  - rounding at 203.5 / 203.49 and 50.4 / 50.6;
  - the 0.5° tolerance;
  - the hit radius;
  - the marquee edge.
- New "not deeper" boundaries:
  - "Equal violation" is allowed (DD-06 T-wall at x = 100, DG-07c L), so a `<=` versus `<` flip is killed.
  - Better (DG-07c R10, DG-12) and deeper (DD-06b, DG-07c R30, DG-12) are both checked.

## Negative Cases

- PASS. New negatives:
  - Unrelated drawing next to a broken doorway (DD-06).
  - An unrelated thickness change with a broken doorway (DG-07c L).
  - Nothing is rendered past the wall end (DL-13).
  - A label never on the fallback side when exactly one room exists (DL-03, DL-03b).

## Error Handling

- PASS, unchanged. Covered:
  - corrupt or orphaned storage items (DS-03, DS-04, DS-06);
  - a history snapshot without `doorways` (DH-04);
  - rejected edits checked with exact `{kind:"rejected", reason}`.

## Invariants

- PASS.
  - The invariant holds after every applied doorway edit (`applied()`) and after bounded wall edits (`allHold`).
  - The face sum (DF-SUM) and purity (DE-PURE, DX-06b) are covered.
  - The anchor changes only through distance input.
  - Wall edits move continuously, with no jump-over (DG-15); doorway slides do not jump either (DE-14 / DE-14b).
  - The "do not deepen" rule for broken doorways is covered on all three paths: bounded edits, drawing and thickness.

## State Transitions

- PASS, unchanged. Covered:
  - anchor transitions (DE-06, DE-11b against DE-07, DE-12, DE-13, DE-16b);
  - contact and back-off (DG-09);
  - history undo/redo and snapshot isolation (DH-01 / 01b / 01c, DH-02/03).
- DOM transitions are manual checks M-01…M-16.

## Integration Behavior

- PASS. Each path runs through real production code:
  - the bounded editor (`EditMode.doorways`), including the ortho stretch;
  - `chainSegment` on the free and the ortho path, including a broken doorway (DD-06);
  - `snapStartVertex`;
  - `drawScene` with a recording context;
  - `buildPdf` through a pass-through wrapper;
  - storage and history serialization.

## Implementation Independence

- PASS.
  - Expected values come from the spec numbers and the scene geometry. `doorway.test-utils.ts` imports only types and
    `PX_PER_CM`.
  - `clippedIn` treats each clip subpath as a separate region. This matches design D2: the cut is made as convex pieces
    split by half-planes, not as an even-odd hole.
  - DL-13 filters out hatch strokes (ink, `hatchPx`). So a correct implementation whose hatch bounds include the
    opening rectangle still passes.
  - The only mock is the pass-through `drawScene` wrapper in DP-*, and the system under test is not mocked.

## Assertion Strength

- PASS.
  - The sorted-set weakness is gone: `expectChain` asserts the exact order and the interval of every number.
  - The label tests assert a strict side (outside the wall body) and, where it matters, the position along the
    opening.
  - The remaining sorted comparisons are on H-label sets (DL-03d), the `above` / `below` helpers that duplicate
    `expectChain` in DL-07, and room areas (DR-*). Order has no meaning in any of these.

## Mutation Testing

- PASS. The project has no mutation tool. For each mutation below I wrote a concrete incorrect implementation and
  traced it against the actual assertions. Controls of the unloaded files were checked against the current code (top
  section).

## Surviving Mutations

| Mutation | Expected Failing Test | Result |
|---|---|---|
| H label always on the fallback side (d.y, −d.x), rooms ignored | DL-03 (expects y > 10, gets y < −10), DL-03b | killed |
| H label always on (−d.y, d.x) | DL-03c, DL-03e, DL-03f | killed |
| "Room on the plus side → plus, otherwise fallback" (two-room case wrong) | DL-03e (gets x < 245, expects x > 255) | killed |
| H label room test only on one side, fallback otherwise ("room on minus → minus, otherwise plus") | DL-03c | killed |
| `violatesDoorways` = "some doorway does not hold in `after`" (no baseline) | DD-06 (both asserts and the snap) | killed |
| Broken doorways skipped entirely (allow all) | DD-06b, DG-07c R30, DG-12 | killed |
| "Do not deepen" measured as the sum of negative distances (before −80, after −80) | DD-06b, DG-07c R30 | killed |
| Equal violation treated as deeper (`>=` instead of `>`) | DD-06 (T at x = 100), DG-07c L | killed |
| `thicknessAllowed` = "all doorways hold after the change" | DG-07c L30 | killed |
| Chain with a- and b-distances swapped along the face | DL-04, DL-04b, DL-08 (sequence 300, 90, 90) | killed |
| Chain faces swapped (inner numbers on the outer side) | DL-04, DL-07 | killed |
| "0" distance drawn mid-run instead of at the jamb | DL-07 (interval −5…25) | killed |
| Broken doorway: jamb at x = 540 and grey continuation past the wall end | DL-13 | killed |
| Broken doorway: no cut at all, or the whole doorway ignored | DL-13 (`clippedIn(475)`, jamb at 450) | killed |
| Slide reaches an admissible position beyond a partition | DE-14b | killed |
| All revision-2 kills (`jambsT` branch, face sign, `≥ 0` → `> 0`, T-junction, anchor rules, clamp per face or per run, tie rule, rounding, arrow tolerance, jump-over, guard scope, ortho paths, snap filter, marquee, cascade, eraser priority, outlines, canonical form, history clone) | as listed in revision 2; the tests are unchanged | killed |
| "Do not deepen" compared on the **global** worst violation over all doorways instead of per doorway: with one broken doorway at −40, an edit may break a *valid* doorway down to −40 | none: no test combines a broken doorway with a valid one | survives (minor, see Findings 2) |
| Broken doorway next to a **corner**: cut, grey lines or jamb clamped to the axis `[0, L]` instead of the face run, so they are drawn inside the corner wall's body (490…500 on the plus face) | none: DL-13 uses a free wall, where the face run equals the axis | survives (minor) |
| Snap filter does not apply "do not deepen": a wall snap onto the face inside a broken doorway's on-wall part is offered | none: DD-06b checks only `violatesDoorways`; the commit uses the same check (M-14) | survives (minor) |
| A selected doorway also outlines its host wall; cut on a non-20 cm host; hit tolerance along the axis; PDF placement bbox through `buildPdf`; trash undo keeps doorways; no dimension line at "0" | none (carried over from revision 2) | survives (minor) |

## Findings

1. **`test-plan.md` still contradicts the spec on the label side** (`test-plan.md` «Сцены», line 46).
   - It says the face `y = +10` (`side = +1`) is "она же «слева от a → b» в экранных координатах с осью y вниз".
   - Under the reworded spec, design D10, the contract line 16 of `test-plan.md` itself, and DL-03c / DL-03e, that
     face is the **right** side on screen. The visual left is `(d.y, −d.x)`, which is y < 0 for W.
   - Revision 2 asked for this fix and it was not made.
   - It does not weaken any test: DL-03c and DL-03e would reject an implementation built from the wrong sentence. It
     is a documentation defect that may mislead the implementer, so fix it before implementation starts.
2. **"Do not deepen" is only tested with a single doorway.**
   - The spec says "НЕ ДОЛЖНА приводить к нарушению инварианта ни для одного проёма", and design D5 says "каждого
     проёма". So the baseline must be kept per doorway.
   - An implementation that compares one global worst violation passes every test. The damage is limited to
     documents that already hold a broken doorway, which can only come from a loaded file because the feature is new.
     I therefore rate it minor.
3. **Broken doorway at a corner is not rendered in any test.** DL-13 covers only the free end. Clamping to the axis
   instead of the face run is invisible there, but at a corner it draws into the neighbour's body. This is minor for
   the same reason as Finding 2.
4. **Doc drift in `test-suite.md`.** The table row for DL-03c (line 126) still reads "со стороны нормали (−d.y, d.x)".
   The test name and the rule are now "(d.y, −d.x)".
5. Minor gaps carried over from revision 2 (not blocking):
   - host wall not highlighted when its doorway is selected;
   - cut and jambs on a t10 host;
   - hit tolerance along the axis;
   - PDF placement bbox through `buildPdf` / `availableFormats`;
   - undo of a closed tab restores its doorways;
   - "0" drawn without a dimension line;
   - DL-03c does not assert the label's x position.

## Required Changes

None for the executable tests: no critical mutation survives.

Documentation fixes, not blocking for tests. Record them in TODO.md if they are not fixed now:

- `test-plan.md` line 46: replace "(она же «слева от `a → b`» в экранных координатах с осью y вниз)" with "(на экране
  справа от `a → b`; «слева» — сторона `(d.y, −d.x)`, `side = −1`)".
- `test-suite.md` line 126: update the DL-03c name to the actual test name ("без помещения — слева на экране от a → b
  (нормаль (d.y, −d.x))").

Recommended tests, not blocking:

- **DD-06c / DG-12b, per-doorway baseline.** In sceneF, use the broken `door("W","a",450)` together with a valid
  `door("W","a",100)`. A T-wall on W's face at x = 150 must still violate (`violatesDoorways` → true), and
  `thicknessAllowed` or a bounded edit that breaks the valid doorway must be rejected.
- **DL-13b, broken doorway at a corner.** In sceneR, use `door("W","a",450)`:
  - no contour or grey stroke on the plus face beyond x = 490;
  - no jamb at x = 540;
  - R's hatch is still clipped in at (500, 100).
- **DD-06d.** With the broken doorway, a wall snap onto W's face at x = 495 (inside the on-wall part, deeper on plus)
  is not offered by `chainSegment`.
- The revision-2 recommendations still open: DL-12 host not highlighted, t10 host, DX-01b along the axis, DP-03b,
  history trash, DP-01 no hatch clip.

## Verdict

Revision 3 addresses every critical item from revision 2:

- The room-side label rule is now distinguishable from the fallback, which the user fixed as the visual left
  (d.y, −d.x) and recorded in the spec.
- Broken doorways no longer block drawing or thickness changes, yet cannot be made deeper (new three-argument contract).
- The chain order is asserted exactly.
- Rendering of a broken doorway is tested.
- DE-14b was added.

All hand-built critical mutations are killed. Discovery and the baseline are as expected, and no approved test
regressed. The remaining issues are minor coverage gaps and two documentation sentences, the main one being the
unfixed `test-plan.md` line. None of them lets an incorrect implementation of a critical requirement pass.

VERDICT: PASS

## Re-validation (DP-03)

Fresh-context re-validation of the single approved test changed through `test-change-request.md`
(CLAUDE.md Rule 5, step 5), 2026-10-06.

**Spec conformance.** Spec doorway «Отображение проёма»: without a room on exactly one side, the label is on the
face to the screen-left of `a → b`, normal `(d.y, −d.x)`; scenario «Подпись без помещения — слева на экране» fixes
this for wall `(0,0)-(500,0)`: label at `y < −10`. Spec pdf-export «Проёмы в PDF»: label placement is the same as on
the canvas and the page bbox must include height labels (design D10: `wallsBBox` receives doorways). For W
(thickness 20, extent x −10…510, y −10…10, opening t 100…190) the only correct effect of the label is
`minY < −10` with `maxY`, `minX`, `maxX` unchanged — exactly what DP-03 now asserts. It agrees with DL-03c
(render: `at.y < S(0, −10).y`; flipped wall → `y > 10`).

**Adversarial check** (bbox for W with doorway d; plain bbox = (−10, −10, 510, 10)):

| Wrong implementation | Result | DP-03 |
|---|---|---|
| bbox ignores doorways | minY = −10 | killed (`minY <`) |
| label on the wrong side, normal `(−d.y, d.x)` (old convention) | maxY = 11, minY = −10 | killed (both `minY <` and `maxY` exact) |
| label point inside the wall (gap ≤ 0, on the axis or on the face y = −10) | minY = −10 | killed (strict `<`) |
| label added on both sides | maxY grows | killed (`maxY` exact) |
| label point displaced along the wall past the ends (e.g. wrong t / wrong anchor beyond extent) | minX or maxX changes | killed (`minX`/`maxX` exact) |
| label side chosen from room detection with inverted default | same as wrong side | killed |

Compared with the old assertion (`withLabel.maxY > plain.maxY` only), the new test is strictly stronger: same
growth check on the correct side plus three exact checks on the other edges. Known residual weakness (also present
before, not introduced by this change): the test does not check by how much the bbox grows, so an implementation
that adds a tiny epsilon above the face — or only a point instead of the label rectangle mentioned in design D10 —
passes. The current implementation (`src/export/pdf.ts` `wallsBBox`) adds just one point at 1 cm beyond the face
(`heightLabelAt(d, walls, side, 1)`), not the text rectangle; this matches the spec wording «учитывать подписи
высоты» only loosely and is worth a look in verification, but it is not a defect of the re-validated test.

**No other test changed.** `git diff --stat` lists only production files and `TODO.md` (no tracked test files);
`src/doorway/` and `openspec/changes/add-doorway/` are untracked (whole change is new). Read the full
`src/doorway/doorway-pdf.test.ts`: DP-01 and DP-02 are untouched relative to the approved suite; in DP-03 the
`plain` / `withLabel` lines are identical to the "Current assertion" in the request, the old
`expect(withLabel.maxY).toBeGreaterThan(plain.maxY)` was replaced by exactly the four proposed assertions, and
one comment line citing the spec and the request was added (allowed by the resolution). DL-03c / DL-03e in
`src/doorway/doorway-render.test.ts` already use the screen-left convention and are consistent with DP-03.

**Run.** `npx vitest run src/doorway/doorway-pdf.test.ts src/doorway/doorway-render.test.ts` — 2 files, 26 tests
passed.

The modified DP-03 follows from the spec, is not weaker than before, and kills all constructed wrong
implementations of the label side and of bbox inclusion.

VERDICT: PASS
