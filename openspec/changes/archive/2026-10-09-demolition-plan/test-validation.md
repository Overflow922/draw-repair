# Test Validation: demolition-plan (round 3)

Validator: fresh context, read-only on the repo (only this file written). Empirical work in a scratch copy outside the repo (`C:\Temp\validate-demolition-r3`): the round-2 reference implementation (follows design.md including corrected D4; the tool calls `redraw` on moves past the dead zone, on cancel, select, clearSelection, and `record` before / `changed` after `setMarks`), `node_modules` junction, own vitest cacheDir. All current `*.test.ts` / `*.test-utils.ts` were re-copied from the repo unchanged (no patching of tests in the scratch copy this round).

## Summary of rounds

- Round 1: FAIL. 5 test defects (DM-15, RG-01/RG-03, HI-05, PG-03, `hexToRgb01`), design problem D4 `alongNodes`, 4 real mutation gaps (FL-07, PDF bbox, tool projection, applyNumber no-op).
- Round 2: FAIL. 1 test defect (PG-18 width 32 -> 30 mm) and real gaps N03, N71, N44, N45, N49, N50, N18 (plus optional M68).
- Round 3 (this report): the Test Writer's Revision 2 is verified empirically. No test defect remains, all round-2 real survivors are killed, and a fresh sample of 64 mutations leaves only equivalent / unreachable / non-critical survivors.

## Empirical results against the reference implementation

- `npx tsc --noEmit`: clean (no output).
- Whole suite `npx vitest run`: 112 files, 2520 tests, **2520 passed, 0 failed**. No existing approved test fails (including the edited `plans.test.ts`, `pdf-pages.test.ts`). PG-18 now passes with the 30 mm width. No test defect found; no spec/test conflict.

## Requirement Coverage

All requirements of `demolition-plan` and the `drawing-plans` / `drawing-storage` / `drawing-history` / `pdf-export` deltas map to tests (PT, DM, RG, ND, NU, FL, ST, HI, RN, PG, TL). `main.ts` wiring (switcher, buttons, arrows, Delete/Escape routing, selection reset on undo, number editor parsing) is manual (MAN-xx) by design. The round-2 gaps are now covered: DM-10 (both anchors, start clamp), DM-28 (orphan mark does not abort `mergeAll`), PG-14 (page 2 without marks is grey underlay), TL-01 (order record / setMarks / changed), TL-10 / TL-07 / TL-16 (redraw contract), FL-07 (outward + sideways re-anchoring).

## Boundary Coverage

Strong: 0.01 tolerances in `effectiveMarks` / `markRegion` / `hiddenElements`, 1 cm minimum width (`<` vs `<=`), dead zone 4 px (`<=` vs `<`, P38), snap radius equality (P17), clamps of `snapAlong` on both sides (P19/P20), `fromCm >= 0` and `toCm > fromCm` (N64, P57), history limit (P60). Weak (non-critical): `addMark` left-side clamp for the width check (P05), right-side touch tolerance in `mergeInto` / `mergeAll` (N08/N16).

## Negative Cases

Strong: reinforced / missing / degenerate wall, NaN / Infinity (P29), negative gaps, width < 1, orphan marks, invalid storage marks and history entries, non-array `demolition`, other walls' jambs not used as nodes (P21), marks of other walls not merged (P09). Weak (non-critical): a wall near but outside the strip is not asserted to yield no snap node (P23); empty-string mark id on load (P58).

## Error Handling

Strong: invalid numbers, unknown plan id, corrupt history/storage entries, no-op operations return the same array and write no history step (P06, TL-19).

## Invariants

Strong: no overlap after add / edit / load, region unchanged by merge re-anchoring, history copy semantics (P61, P62, HI-10), result id and place of the first merged mark (P07, P08), selection after edit (P41).

## State Transitions

Strong: press / drag / dead zone / commit / cancel / select / clear (P39, P42-P44, P46, P47), `record` before `setMarks` and `changed` after it (N44), redraw on move / cancel / select / clearSelection (N45, N49, N50, P39). Weak (non-critical): `down` clearing a stale ghost (P45, unreachable) and `commit` redraw for Delete / number apply (P40, the design does not make `commit` responsible for redraw).

## Integration Behavior

Real `wall-edit`, `mergeContinuation`, jsPDF operators with colour, canvas recorder, storage round trip and history document. PDF page 2 with and without marks is checked for grey underlay (PG-14, N71 killed).

## Implementation Independence

Good: host mock for the tool, recorder for the canvas. Design-only properties (dashed ghost, hatch phase, text direction of vertical walls, tie rules) are intentionally unprotected and were not demanded.

## Assertion Strength

Good. Killing tests discriminate with value-level assertions (coordinates, ids, ordering, identities), not only truthiness.

## Mutation Testing

### Round-2 real survivors re-run (all KILLED)

| Mutation | Killing test |
|---|---|
| N03 `effectiveMarks` without `from` clamp (anchor b) | DM-10 |
| N71 PDF page 2 drawn only when marks exist | PG-14 |
| N44 `changed()` before `setMarks()` | TL-01 |
| N45 no `redraw` on move beyond the dead zone | TL-10 |
| N49 `clearSelection` without redraw | TL-16 |
| N50 `select` without redraw | TL-16 |
| N18 `mergeAll` aborts at orphan mark | DM-28 |
| M68 re-anchor also on outward + sideways move | FL-07 |

Re-run in the same batch and still surviving as in round 2 (non-critical): N08, N16 (tolerance fuzz on the right/touching side), N51 (`up` after a click: the commit already redraws).

### Fresh sample P01-P64 (64 single mutations, none repeats rounds 1-2)

Across marks (P01-P12), region (P13-P16), snap (P17-P24), numbers (P25-P33), follow (P34-P37), tool (P38-P47), render (P48-P51), pdf (P52-P54), storage (P55-P59), history (P60-P62), plans (P63-P64). Every mutation was applied. 54 killed, 10 survived.

Killed (id: killing test): P01 DM-10/11/12, P02 DM-12, P03 TL-01..DM-16 (11), P04 DM-19, P06 DM-25, P07 DM-16, P08 TL-01..DM-23 (12), P09 DM-23, P13 RN-04.. (18), P14 RG-12, P15 RG-07..13, P16 RG-07/08/09/PG-11, P17 ND-05, P18 TL-06/ND-04.., P19 ND-06, P20 ND-06, P21 ND-02, P22 ND-02/08/11.., P24 ND-09, P25 NU-05, P26 NU-05, P27 NU-04/TL-19, P28 NU-07/TL-17, P29 NU-06, P30 NU-10, P31 NU-09/10.., P32 NU-11, P33 NU-13/RN-03.., P35 FL-07, P36 FL-07, P38 TL-06, P39 TL-07, P41 TL-17, P42 TL-03.. (18), P43 TL-03/05/10, P44 TL-10/07, P46 TL-14, P47 TL-15, P48 RN-02/08/PG-03, P49 RN-01/05/PG-04, P50 RN-02/09, P51 RN-02, P52 PG-11, P53 PG-03, P54 PG-12/08, P55 ST-04, P56 ST-03, P57 HI-07/ST-03/09, P59 ST-07, P60 HI-09, P61 HI-01/10, P62 HI-01/08/10.., P63 PT-03, P64 PT-04/PL-05/HI-05/06.

Together with rounds 1 and 2 more than 290 distinct mutations were evaluated.

## Surviving Mutations

| Mutation | Expected Failing Test | Result |
|---|---|---|
| P05 `addMark` does not clamp `lo` at 0 before the width check | DM-19 (mirror of the right side) | SURVIVED. Non-critical: `mergeInto` clamps `lo` afterwards, only the `< 1 cm` rejection of a range like `-50..0.5` differs; the tool's `snapAlong` already clamps, so unreachable through the app. Optional: `addMark(.., -50, 0.5)` returns the same array |
| P10 `mergeAll` without restart (`i = -1`) | DM-24 | SURVIVED. Equivalent: `mergeIntoAt` already takes the transitive closure |
| P11 `mergeIntoAt` result id = id of the processed mark, not of the first hit | DM-16 | SURVIVED. Equivalent: scanning from index 0 with symmetric overlap means the processed mark is always the first hit |
| P12 `markAt` iterates first-to-last | TL-14 | SURVIVED. Non-critical: matters only for overlapping regions of different walls at a corner; the spec is silent on which mark is hit |
| P23 `alongNodes` strip uses full thickness instead of half | ND-09 | SURVIVED. Non-critical (narrow negative boundary): a wall ending between h and 2h from the axis would give a spurious node; spec's positive cases (shape entering the strip, N28/N29/N30) are killed. Optional ND test with a perpendicular wall ending 5 cm off the face |
| P34 `extendedEnd` sideways tolerance 1 cm instead of 1e-4 | FL-07 | SURVIVED. Non-critical (numeric tolerance; M68 covers the real off-axis case) |
| P37 `reanchorMarks` returns a copy when nothing moved | FL-xx | SURVIVED. Non-critical: spec/design require the same array for `addMark` / `removeMark` / `mergeAll`, not for `reanchorMarks`; `main.ts` wiring is manual |
| P40 `commit` without `redraw` | TL-15 / TL-17 | SURVIVED. Non-critical: design D10 does not make `commit` responsible for redraw (only `record` / `setMarks` / `changed` are specified for apply/delete); the click path redraws itself (also N51) |
| P45 `down` does not clear the ghost | TL-10 | SURVIVED. Unreachable: `up` and `cancel` always reset, so no ghost exists at `down` |
| P58 empty-string id accepted on load | ST-03 | SURVIVED. Non-critical: spec says "без идентификатора"; a missing / non-string id is rejected and tested, the empty string is a degenerate variant |
| N08 / N16 touching within 0.01 on the right side | DM-14 / DM-24 | SURVIVED (carried over). Non-critical tolerance fuzz |
| N51 `up` after click without redraw | TL-01 | SURVIVED (carried over). Non-critical, commit redraws |

No survivor leaves a spec requirement unprotected in a way an application user could observe.

## Findings

1. The Test Writer's Revision 2 is effective: all round-2 real gaps (N03, N71, N44, N45, N49, N50, N18, M68) are killed by DM-10, PG-14, TL-01, TL-10, TL-16, DM-28, FL-07 respectively.
2. The PG-18 defect is fixed; whole suite and `tsc` are green against the reference (2520 / 2520).
3. A fresh sample of 64 mutations across all new modules found no critical survivors. Survivors are equivalent (P10, P11), unreachable (P45), or non-critical boundary/tolerance/design-silent cases.
4. No approved test conflicts with the specification; no test needs weakening.

## Required Changes

None required. Optional hardening (not blocking): `addMark(.., -50, 0.5)` returns the same array (P05); an `alongNodes` negative test with a wall ending 5 cm off the strip face (P23); `loadStore` rejects a mark with `id: ""` (P58).

## Verdict

VERDICT: PASS
