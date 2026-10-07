# Test Validation: deselect-tool-on-element-select (revision 2)

Run: `npx vitest run src/doorway/element-select-tool.test.ts` gives 10 failed, 6 passed (16). The 10 failures are the expected
ones: `afterElementPress` and the `Tool` export are missing from `openings-group.ts`, and `ElementTool.clearGhost` is missing.
No mutation tooling was run. Mutations were analysed by hand against the design D2a rule and `ElementTool`.

The six passing tests (DS-6, DS-6b, DS-6c, DS-6d, DS-7, DS-8c) are regressions of existing domain behaviour. That is intended.

## Fixes since the previous FAIL

The previous verdict required the transition logic to move out of `main.ts` into a pure unit. design.md D2a now does this:
`afterElementPress({tool, group, selected}) -> {tool, group}`. DS-1..DS-5 test it directly, and DS-5 feeds the function's
output into `groupButtonActive` and `groupButtonClick`. Previously "panel closed", "`current` kept" and "no deactivation
without selection" were untestable. Now they are asserted.

## Mutations against afterElementPress (all rejected)

| Mutant | Rejected by |
|---|---|
| `window` or `doorway` missing from the placing set | DS-1, DS-2, DS-3 |
| rule also applies to `wall`, `dimension`, `ruler`, `eraser` or `none` | DS-4 (tool and group compared for every group state) |
| constant `"none"` | DS-4, DS-4b |
| deactivates when `selected: false` | DS-4b (all 8 tools, active and inactive groups) |
| `panelOpen` left as is | DS-3 (both open and closed inputs) |
| `current` reset to a constant or replaced by `active` | DS-3 (both `current` values) |
| `group.active` left as the tool instead of `"other"` | DS-3 and DS-5 |
| mutates its input | DS-5 (`toEqual` against a copy) |
| not idempotent | DS-3 (repeat on the result) |
| returns a different group for `none` or `wall` (for example closes the panel) | DS-4 |

## Mutations against clearGhost (all rejected)

- `clearGhost = reset`: DS-8 fails, because `dragging()` and the drag record are lost. DS-8b stays green only for no-shift.
- No-op `clearGhost`: DS-3b fails, for each of the three kinds.
- `clearGhost` calls `inherit` or writes history: DS-9 fails. Note that pressDoorway might not call `inherit` anyway, so DS-9
  mainly protects against future drift. It is a weak but harmless guard. It is not the only protection for `clearGhost`.
- `reset` weakened: DS-8c.

## Domain chain

DS-6 checks the chain "press selects -> zone click -> direction change, single history record, still selected, `inherit`".
DS-6b, DS-6c and DS-6d cover the boundary and negative cases (current direction, outside zones, window has no zones). DS-7
covers the "empty place places an element" scenario.

## Accepted gap: main.ts wiring

These mutants are NOT detected by any test:

- `main.ts` never calls `afterElementPress` or `clearGhost`.
- `main.ts` uses `setTool("none")`, which drops the selection.
- `main.ts` calls the transition without checking the result of `pressDoorway`.
- `main.ts` does not copy `group` back into `openingsCurrent` and `openingsPanelOpen`.

Decision: acceptable, so it does not make the verdict FAIL.

- The repository has no tests of `main.ts` (a DOM entry point), no e2e setup, and `.claude/rules/testing.md` asks for
  behaviour-driven unit, integration and e2e tests where such a harness exists. The project cannot test a DOM file today.
- The change did what Rule 7 and Rule 8 ask: all decision logic was extracted to a pure, directly tested function. What
  remains in `main.ts` is a thin application of its result, which is a few lines in one branch of `case "doorway"`.
- The gap is documented in test-plan.md "Out of Scope" and "Mutation Targets", in test-suite.md and in TODO.md (Tests section,
  tagged deselect-tool-on-element-select), as `.claude/rules/leftovers.md` requires. A manual browser check is listed in the
  test plan's Integration Cases.
- Residual risk: the user-visible fix depends on one call being present. The verifier and the implementation review must
  check the diff of `main.ts` by hand (and run the manual browser check) before archive.

## Minor remarks (not blocking)

- DS-9 is weak, see above.
- DS-3 uses a window with `group.active` "other" only. It does not feed `active: "door"` with a window tool, but that input
  cannot occur from the application and the rule's output does not depend on it.

## Re-validation after test-change-request (PB-GR-02)

Scope: the user resolved test-change-request.md with Option A; production code is now implemented.

- `git diff` of `src/doorway/popups-ui.test.ts` contains exactly one hunk, in PB-GR-02: the title was reworded and the
  expected export list became `["afterElementPress", "groupButtonActive", "groupButtonClick", "groupPick"]`. No other test in the file changed.
- The invariant is still protected. The `Object.keys(group).sort()` check is an exact match, so any further export (for example a
  `groupSelect` selection-reaction transition) still fails it. `expect(main.includes("groupSelect")).toBe(false)` is kept unchanged. The
  new export is a pure function with no state, which matches the change's design (D1).
- `src/doorway/element-select-tool.test.ts` (untracked) was last written at 22:31:51, before the first validation report (22:32:49), so
  it is unchanged since validation. It has 16 test cases and its imports match what test-suite.md claims (afterElementPress,
  groupButtonActive, groupButtonClick, Tool, GroupState). These tests were not weakened.
- Production code matches the tests: `afterElementPress` is pure, returns the input unchanged unless `selected` and the tool is
  doorway, door or window, and otherwise gives tool "none" and a group with `active: "other"`, `panelOpen: false` and `current` kept. `main.ts`
  applies it after a successful `pressDoorway` through `leavePlacing` (no `setTool`, so the selection is kept; `clearGhost` keeps
  the drag going).
- `npx vitest run`: 84 test files passed, 1627 tests passed, 0 failed.
- The earlier residual risk is unchanged. The `main.ts` wiring has no unit test and needs the manual browser check and a hand review of the diff
  before archive.

## Re-validation revision 3 (shadow zones, edit presses)

Scope: specs/door (zone = rectangle plus swing-sector shadow, nearest hinge wins), specs/doorway (edit presses leave the placing tool), design D2b/D6, DZ-* tests, test-change-request 2.

- `git diff` of `src/doorway/door-direction.test.ts`: one hunk, PB-ZN-02 only; exactly two outside points changed, (99.5,50) to (85,50) and (190.5,50) to (205,50), plus an explanatory comment. The other outside points and all assertions are untouched. The invariant stays protected: the new points are outside both rectangle and shadow, and DZ-3 independently covers (85,-50).
- `npx vitest run`: 85 files, 1637 tests passed, 0 failed.
- Hand-built wrong `doorZoneAt`/`inShadow` variants, checked against door-shadow-zone.test.ts and the rest of the suite:
  - radius compared to a smaller or larger bound: rejected by DZ-3b (89 cm in, 91 cm out) and DZ-3 (97,101).
  - leaf rectangle missing: rejected by DZ-1 (197,50), which is outside every sector (about 100 degrees).
  - 95 degree bound dropped, or raised to 180: rejected by DZ-3 (85,-50, about 110 degrees) and (195,15). Lowered to 90: rejected by DZ-2 (97,-70, about 93 degrees) and DZ-3b.
  - `across >= 0` dropped (mirror sector on the wrong side): rejected by DZ-3 (85,-50 would yield a/right).
  - sector on the wrong side or swing sign inverted: rejected by DZ-2 (both sides) and DZ-7.
  - first-match or last-match instead of nearest hinge, or distance measured to the door centre: rejected by the DZ-4 pair (150,40) and (140,40).
  - wall direction ignored: rejected by DZ-5 (vertical wall); mirror for the b hinge by DZ-7.
  - old rectangles broken: rejected by DZ-6/6b and the unchanged PB-ZN-* tests.
- Surviving mutants, minor and not blocking: (a) the 95 degree bound raised to about 105 degrees survives, because no test point lies between 95 and 110 degrees outside the leaf; (b) the exact-tie rule (hinge at a wins) is not pinned, since `<` versus `<=` is not distinguished. Both are edge precision that the spec scenarios do not exercise; suggest adding a point at about 100 degrees and a symmetric tie point later (see TODO).
- Earlier verdict criteria still hold: element-select-tool.test.ts and PB-GR-02 are unchanged since the previous re-validation. The known gap stays as before: the main.ts DOM wiring (including number and zone presses calling `afterElementPress`) has no unit test and relies on the manual browser check and a hand review of the diff before archive. It is judged as before, as an accepted documented residual risk.

## Validation revision 4 (hover highlight)

Scope: src/doorway/door-hover.test.ts (HV-1 to HV-7b), test-plan.md and test-suite.md "Ревизия 4". Run: 7 failed, 2 passed. The 7 failures are the expected ones (`hoverDirection is not a function`, `hoverDoorDirection` not rendered); HV-7 and HV-7b pass because they pin existing behaviour (no highlight, nothing drawn for unselected/multi/PDF) and stay as regression guards.

Adversarial review:
- Highlighting the current direction: HV-2 (97,-70) and (120,-60) must be null.
- Number priority ignored: HV-3 asserts, inside the test, that the width number centre lies in a zone (`doorZoneAt` not null) and that `hoverDirection` is null there, so the precondition is checked, not assumed.
- Highlighting all alternatives, or the wrong one: HV-6 checks all three alternatives solid vs dashed for leaf and arc; HV-6b repeats it for each of the three directions.
- Solid stroke plus a dashed duplicate: HV-6/6b assert the hovered leaf and arc are absent from the dashed set.
- Wrong direction for rectangle, sector, leaf points: HV-1 covers four points (rectangle, both sectors, leaf rectangle, other swing side).
- Leak into PDF, multi-selection, unselected door: HV-7b (no dashed ops and no solid foreign leaf).
- `othersSelected`, none selected, multi-selection, window: HV-4, one case each.
- State mutation: HV-5 (elements, selection, records, inherited).
- Outside zones: HV-2 (170,120).
- Surviving gaps, minor: (a) render with `hoverDoorDirection` equal to the current direction (no extra dashed segments, plan HV-7 clause) is not asserted; (b) the arc check on solid strokes uses 1 px tolerance, adequate.
- Known gap, judged as before: main.ts wiring (raw `hoverWorld`, calling `hoverDirection`, skipping it for the eraser) has no unit test; it relies on the manual browser check and diff review before archive. Accepted as a documented residual risk.

The tests would reject the listed wrong implementations once the production code exists; verdict applies to the test suite, not to the not-yet-written implementation.

VERDICT: PASS
