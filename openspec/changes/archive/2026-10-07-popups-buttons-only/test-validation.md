# Test Validation (revision 2)

Change: `popups-buttons-only`. Validator: independent, read-only (CLAUDE.md Rule 4). Date: 2026-10-07.
Revision 1 verdict was FAIL (F-1…F-9). This revision re-checks each finding against the actual test files and
re-validates the whole suite.

## Summary

The three blocking findings of revision 1 (F-1 arcs, F-2 app wiring of `inherit`, F-7 window parameters) are resolved by
real, discriminating assertions. The remaining items are low-severity and none allows a critical mutation to survive.
The suite derives expected values from the spec formulas and design D1/D2 (independent reference `expectedInherit`,
`ZONE_BOX`, normal `(d.y, -d.x)`, label offsets checked against the drawn text), not from production modules.

Test run (`npx vitest run src/doorway`, vitest 4): 35 files discovered, 8 failed / 27 passed; 78 tests failed, 337
passed. Failing files: `door-direction` (15 of 15), `door-tool` (1), `editable-render` (5 of 10), `new-element-params` (7),
`popups-ui` (7), `selection-editing` (35), `window-tool` (8), and `editable-numbers` (suite cannot load: missing module
`./editable-numbers`; judged by reading). All failures come from missing D9 exports, the old
`createElementTool(kind, host, panel)` signature and the old markup, which is expected before implementation. The 5
passing `editable-render` tests are the negative tests (PB-RN-02, 03, 03b, 04, 05c), each paired with a failing positive
test. The 27 passing files are the pre-existing regression suite (including `openings-group`, `door-kind`, `door-edit`
after adaptation).

No mutation-testing tool exists in `package.json`; the mutation analysis below is done by hand.

## Status of revision-1 findings

| Finding | Status | Evidence |
|---|---|---|
| F-1 (HIGH) alternative-direction arcs unchecked | **Resolved** | `editable-render.test.ts` now has `dashedArc`: points at 20°, 47.5°, 80° of the arc (radius 90, from `arcPointAt`) must lie on a dashed segment. PB-RN-05 and 05b assert `dashedArc === alt` for all four directions (true for the three alternatives, false for the current one). PB-RN-05c asserts both leaf and arc are absent when unselected, under multi-selection and in PDF. A missing or solid arc fails. |
| F-2 (HIGH) app-level `inherit` wiring unprotected | **Resolved** (static) | New PB-INT-03 in `popups-ui.test.ts`: requires `let <v> = initialParams()`, exactly one `inheritFrom(` call, the assignment `<v> = inheritFrom(<v>, ...`, in `ElementToolHost = {` `params` returns `<v>` and `inherit` contains `<v> = inheritFrom(`. Comments are stripped first. An empty `inherit`, a `params` returning another value, or a second parameter value fails. The test is a source-text check, which is acceptable since `main.ts` is DOM-bound and there is no e2e harness. |
| F-3 (MEDIUM) undo / tab invariants and plan mismatch | **Partly resolved** | PB-INT-01 (single `initialParams()`, nothing in `storage.ts`) plus PB-INT-03 (single `inheritFrom`) now pin that parameters change only through the host `inherit`. `Scene` has no params. A hand-written "undo restores a params snapshot" in `main.ts` is still not detected (M-25). Accepted as residual, see N-1. test-plan was updated at 20:02. |
| F-4 (LOW) PB-INT-02 source-text fragility | Open (accepted) | Still uses first textual occurrence after `addEventListener("pointerdown"` and a preceding `tool !== "eraser"`. Comments are now stripped, which removes the comment false-positive. |
| F-5 (LOW) underline colour / zoom / PDF chain numbers | **Partly resolved** | PB-RN-06 now filters strokes by `strokeStyle`: «150» underline is `ink`, «85» is `sill`, and not `ink`. Zoom independence of the underline and absence of chain-number underlines in PDF are still unchecked (M-23 low). |
| F-6 (LOW) PB-ED-08 weak | **Resolved** | PB-ED-08 now clicks the doorway through `tool.pressDoorway`, ends the drag, asserts selection, zero records, no `inherit`, and that the next placed doorway is 90×210 (defaults, not the 120×250 selected one). |
| F-7 (MEDIUM) window width/height from params | **Resolved** | New PB-TL-08: host params `window = {100, 140, 30}`; ghost `widthCm` 100 with jambs `[200, 300]`; placed window 100×140×30, selected, one record. Defaults (120×150×85) would fail. |
| F-8 (LOW) dimension number not editable | **Resolved** | New PB-ED-20: a dimension is selected (`othersSelected`, no elements selected): `pressNumber` returns false for the height number and both chain numbers, and no editor opens. There is still no render check for the dimension; element-only underlines make that low risk. |
| F-9 (INFO) retired/adapted tests | Resolved | Retirements and adaptations match test-plan; unchanged assertions in adapted tests (`git diff` reviewed). |

## New findings

- **N-1 (LOW)**: M-25. The spec scenario "Отмена не возвращает параметры новых" and "параметры общие для вкладок" have no
  executable test; only static guards (single `initialParams()`, single `inheritFrom`, no params in `storage.ts` /
  `Scene`). A mutation adding `<v> = saved` to the undo path in `main.ts` would survive. Optional hardening: a static
  check that `<v>` is assigned exactly twice (declaration and `inherit`). Not blocking: needs the DOM-bound `main.ts`,
  and the invariant is structurally protected by the `Scene` type having no params.
- **N-2 (LOW)**: PB-INT-03 regexes are written against a prescribed shape (`let v = initialParams()`,
  `ElementToolHost = {`). A legitimate refactor (for example a different declaration form) would fail the test, but the
  failure is loud and not a false pass. The current `main.ts` already contains `ElementToolHost = {`.
- **N-3 (INFO)**: PB-TL-08 and similar tests use the fake host's `params`; that is correct, since the adapter contract is
  `host.params()`.

## Requirement Coverage

- PASS (all scenarios have executable or, for `main.ts` wiring, static coverage; residual N-1).

| Requirement / Scenario | Tests | Status |
|---|---|---|
| canvas-app: panels contain no fields | PB-UI-01, PB-GR-01 | covered (markup) |
| canvas-app: tools without panel (Окно, Размер, Линейка, Ластик) | PB-UI-02 | covered (markup) |
| canvas-app: selection does not open a panel | PB-GR-02, PB-UI-02 | covered (static) |
| canvas-app: group panel buttons and order; group-button memory | PB-GR-01, GR-01…04, 07, 09, 09b | covered |
| doorway: defaults of new doorways | PB-PAR-01, PB-TL-01, WTL-07 | covered |
| doorway: inheritance of an edit | PB-PAR-02, PB-ED-07, PB-INT-03 | covered (adapter + wiring) |
| doorway: selection does not change parameters | PB-ED-08, PB-ED-10 | covered |
| doorway: clamped width inherited as actual | PB-ED-09 | covered |
| doorway: undo does not restore parameters; shared across tabs | PB-INT-01, PB-INT-03 (static) | covered statically (N-1) |
| doorway: door edit does not change doorways | PB-PAR-03, PB-ED-12 | covered |
| doorway: invalid value not applied | PB-ED-03, PB-ED-11 | covered |
| doorway: ghost width from params | PB-TL-02 | covered |
| doorway: number input (distance, width, clamp, Esc) | WTL-09, 10, 10b, PB-ED-17 | covered |
| doorway: height in label, mm, non-positive | PB-ED-01, 02, 03, 19 | covered |
| doorway: editable numbers underlined (6 + H) | PB-EN-01, 01b, 01c, PB-RN-01, 01b | covered |
| doorway: no underline without selection / multi-selection / PDF label | PB-RN-02, 03, 03b, 04; PB-ED-04, 04b | covered (PDF chain numbers: low) |
| door: defaults, side by cursor, dead zone, initial `left` | PB-TL-03, 04, 05, 05b, PB-SW-01…03c | covered |
| door: inherit hinge, side by cursor | PB-PAR-04, PB-ZN-06 | covered |
| door: click places door; click on window selects window | PB-TL-06, DT-03 | covered |
| door: direction zones, borders, outside, number priority | PB-ZN-00…05, 07, 08, PB-ED-05, PB-INT-02 | covered |
| door: undo step of direction change | PB-ZN-04 (`calls` = record, replace) | covered |
| door: alternative directions leaf and arc, dashed, single door only | PB-RN-05, 05b, 05c, PB-ZN-07 | covered |
| window: defaults, params, inheritance | PB-TL-07, PB-TL-08, PB-ED-13, PB-PAR-03 | covered |
| window: label edit (sill, height mm, 0, negative) | PB-ED-06, 14, 15, 16 | covered |
| window: both numbers underlined, no prefix, sill colour | PB-EN-02, PB-RN-06 | covered |
| dimension-selection: no panel, number not editable | PB-UI-02, PB-ED-04, PB-ED-20 | covered |
| drawing-history: in-place edits and zones are steps; params not in history | PB-ED-01, ZN-04, ED-18, ZN-05; `Scene` type | covered (N-1) |

## Boundary Coverage

- PASS: dead zone inclusive and just beyond (PB-SW-03) and with zoom (PB-TL-05); zone edges on all four sides, zone
  depth equal to door width, reversed axis (PB-ZN-02, 02c, 02d); number hit-test rectangle plus tolerance inside and
  outside on both axes and on a rotated wall (PB-EN-03, 03b, 03d); nearest centre (PB-EN-03c); sill 0 and zero chain
  distance; clamped width; decimal comma.

## Negative Cases

- PASS: 0, negative and non-numeric values for height, width and sill; Esc and blur; same value; multi-selection,
  mixed selection, dimension selected, unselected element, no selection; zones for doorway/window and multi-selection;
  click in the current-direction zone; no underline for ghost, multi-selection, wall selected, or PDF; no `inherit` on
  drag, nudge, place or selection.

## Error Handling

- PASS: input rejection only (covered above).

## Invariants

- PASS: other kinds' params unchanged (PB-PAR-03); swing never part of door params (PB-PAR-01, 04); history recorded
  once and before `replace`; inputs not mutated (PB-PAR-06, ZN-08); number layout matches drawn text (PB-EN-04, 04b);
  single application-level parameter value changed only through `inheritFrom` (PB-INT-01, 03).

## State Transitions

- PASS: ghost swing memory, direction change and unchanged direction, group transitions.

## Integration Behavior

- PASS: adapter-level tool plus selection editing on one host (PB-ED-07, 09, 12, 13; PB-ZN-06; PB-TL-08). `main.ts`
  wiring is protected by source-text checks (PB-INT-01…03) given the absence of a DOM harness. Residual: N-1, F-4.

## Implementation Independence

- PASS: reference values written in the tests from spec and design. The fake host's `inherit` uses a test-side
  reference (`expectedInherit`), not production `inheritFrom`, which is tested on its own (new-element-params).

## Assertion Strength

- PASS: exact `toEqual` on whole elements, exact call order, exact `inherited` lists, strict `toBe(alt)` on leaf and arc
  for all four directions. Remaining weak spot: PB-UI-01 forbids only `input`, `select`, `textarea`, `label`, partly
  compensated by PB-GR-01's exact button count.

## Mutation Testing

- N/A (no tool in `package.json`). Manual analysis below. No critical mutation survives.

## Surviving Mutations

| # | Mutation | Expected Failing Test | Result |
|---|---|---|---|
| M-1 | `ghostSwing` `abs(s) <= dead` to `<` | PB-SW-03 | killed |
| M-2 | inverted normal sign | PB-SW-01, 01b | killed |
| M-3 | screen y instead of axis normal | PB-SW-01b | killed |
| M-4 | dead zone without zoom | PB-TL-05 | killed |
| M-5 | ghost swing ignores previous side | PB-SW-02, PB-TL-05 | killed |
| M-6 | `place` takes swing from stored value, not cursor | PB-TL-06, PB-TL-03 | killed |
| M-7 | `doorZoneAt` half swapped / hinge a and b swapped | PB-ZN-01, 02, 02c | killed |
| M-8 | zone side left and right swapped | PB-ZN-01, 02 | killed |
| M-9 | zone depth = wall thickness / from axis | PB-ZN-02d, 02, 00 | killed |
| M-10 | `inheritFrom` wrong kind / copies swing / drops sill | PB-PAR-02…05 | killed |
| M-11 | `inherit` before clamp | PB-ED-09 | killed |
| M-12 | `inherit` on unchanged / rejected / Esc | PB-ED-18, 03, 11, 16, 17; PB-ZN-05 | killed |
| M-13 | `record` missing, twice, after `replace`, or on unchanged | PB-ED-01, PB-ZN-04, PB-ED-18, PB-ZN-05 | killed |
| M-14 | window «H под.» part targets height | PB-EN-02, PB-ED-06 | killed |
| M-15 | zero distance omitted | PB-EN-01b, PB-RN-01b | killed |
| M-16 | underline for ghost / multi-selection / wall selected / PDF label | PB-RN-02, 03, 03b, 04 | killed |
| M-17 | alternative directions: leaf only, or solid arc, or arc for current direction | PB-RN-05, 05b, 05c (`dashedArc`) | **killed (was surviving in rev 1)** |
| M-18 | `main.ts` host `inherit` empty, or `params` returns another value | PB-INT-03 | **killed (was surviving in rev 1)** |
| M-19 | window tool takes width/height from defaults, not params | PB-TL-08 | **killed (was surviving in rev 1)** |
| M-20 | zone checked before number in `pointerdown` | PB-INT-02 (static) | killed |
| M-21 | `pressNumber` opens editor for unselected element | PB-ED-04b | killed |
| M-22 | editor prefilled with `H=210` | PB-ED-02 | killed |
| M-23 | underline for chain numbers in PDF | none (PB-RN-04 checks only near the label) | survives (low; chains not drawn in a real export) |
| M-24 | «H под.» underline in `ink` instead of `sill` | PB-RN-06 (`strokeStyle` filter) | **killed (was surviving in rev 1)** |
| M-25 | `main.ts` undo restores a params snapshot | none executable | survives (low-medium, see N-1; structurally guarded by `Scene` having no params and by single `inheritFrom`) |
| M-26 | dimension number made editable (selected dimension opens editor) | PB-ED-20 | killed |
| M-27 | selecting a doorway by click inherits its parameters | PB-ED-08, PB-ED-10 | killed |

## Findings

- F-1, F-2, F-6, F-7, F-8: resolved.
- F-3, F-5: partly resolved (N-1, M-23).
- F-4: open, low, accepted.
- N-1 (LOW), N-2 (LOW), N-3 (INFO) as above.
- No open HIGH or MEDIUM finding.

## Required Changes

None blocking. Optional hardening: (a) static check that the app-level parameter variable is assigned only in its
declaration and in `inherit` (closes M-25); (b) a PDF check that chain numbers are not underlined (M-23).

## Verdict

VERDICT: PASS
