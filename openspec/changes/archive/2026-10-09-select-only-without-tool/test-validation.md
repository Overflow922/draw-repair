# Test Validation: select-only-without-tool

Validator: fresh context, read-only (only this file was created). All experiments ran outside the repo (scratchpad `ref/`, node_modules junction).

## Summary

`src/tool-mode.test.ts` (36 tests) protects the pure-module rules of design D8: `selectionAllowed`, `escapeAction`, `afterPlace`. Against a reference implementation derived from the specs/design all 36 pass; all 24 behavioral mutants plus 6 `selectionAllowed` variants are killed. The `main.ts` wiring (pointerdown/click/marquee/Esc handler) is not unit-tested, which the test-plan accepts; it relies on the manual browser checklist.

## Baseline (repo, untouched)

- `npx vitest run`: 96 files passed, 1 failed (`src/tool-mode.test.ts`), 2005 tests passed. No worker crash this run.
- `npx vitest run src/tool-mode.test.ts`: fails on `Cannot find module './tool-mode'`, no tests collected (expected).

## Reference implementation results

Reference (scratchpad): `selectionAllowed = tool === "none"`; `escapeAction`: gestureActive -> end-gesture, dimensionDraft -> cancel-dimension-draft, tool none -> (hasSelection ? clear-selection : none), else deactivate-tool; `afterPlace`: for doorway/door/window -> `{tool:"none", group:{current, active:"other", panelOpen:false}}`, otherwise unchanged. Result: 36 passed / 36 (count matches test-suite.md: 9 SEL + 17 ESC + 10 PLACE).

## Mutants

| # | Mutant | Result |
|---|---|---|
| M1 | selectionAllowed also true for ruler | killed (SEL-1 ruler, SEL-3) |
| M2 | selectionAllowed = `!== "eraser"` | killed (7 tests) |
| M3 | also true for wall | killed |
| M4 | also true for dimension | killed |
| M5 | also true for door | killed |
| M5b | exceptions list (wall, dimension, eraser, ruler excluded; doorway/door/window allowed) | killed (4 tests) |
| M6 | escapeAction: wall -> "none" (old bug) | killed |
| M7 | escapeAction: ruler -> "none" | killed |
| M8 | selection cleared before tool (hasSelection first) | killed (TM-ESC-6) |
| M9 | draft before gesture | killed (TM-ESC-2c) |
| M10 | no gesture branch | killed |
| M11 | no draft branch | killed |
| M12 | tool none always clear-selection | killed (TM-ESC-4b) |
| M13 | tool none never clear-selection | killed (TM-ESC-4) |
| M14 | afterPlace keeps panelOpen = true | killed |
| M15 | afterPlace resets group.current | killed (TM-PLACE-2) |
| M16 | afterPlace keeps group.active | killed |
| M17 | afterPlace changes wall tool | killed (TM-PLACE-3) |
| M18 | afterPlace changes dimension tool | killed |
| M19 | afterPlace keeps tool | killed |
| M20 | window ignored | killed |
| M21 | doorway ignored | killed |
| M22 | non-idempotent afterPlace | killed (TM-PLACE-4) |
| M23 | eraser tool changed by afterPlace | killed |
| M24 | active tool + selection -> clear-selection | killed |

Survivors: none. (A first batch run of M1-M5 was invalid because the textual replacement also broke `escapeAction`; M1-M5 were re-run with the replacement limited to `selectionAllowed`, results above.)

## Spec scenario coverage

- canvas-app (selection only without tool, Esc deactivates tool, group panel): covered as far as a pure module allows. "Click/marquee/markers do not act under a tool" all collapse to `selectionAllowed(tool) === false` (design D1), tested per tool. Esc scenarios (wall, gesture then tool, dimension draft, door group, selection clear) covered by TM-ESC-*. Group panel closing on placement: TM-PLACE-1/2.
- wall-selection, dimension-selection, multi-selection, ruler-tool, doorway "selection only without tool", door/window click scenarios, wall-drawing "body click does not select": reduced to the same predicate; no per-object assertion is possible without DOM.
- doorway "placement deactivates the tool": TM-PLACE-1 (selection remaining on the placed element is NOT tested; it lives in `ElementTool.place`/`host.select`).
- Not testable at module level: real hit-testing, marker drag, dimension offset drag, in-place number editing, direction zones, history entries, `clearSelection` on click over existing element with placing tool (D3), that `setTool` actually clears the selection, that panels/ghost reset.

## Findings

1. API shape (`EscapeState { tool, gestureActive, dimensionDraft, hasSelection }`, `EscapeAction` union, `afterPlace(tool, group) -> {tool, group}`) is consistent with design D8, which names exactly these inputs ("идёт жест стены, есть черновик размера, есть выделение, активный инструмент") and outputs. The field names are the writer's choice but D8 allows them; reasonable. Suggest design.md D8 record the exact field names so the implementer and tests agree (non-blocking).
2. Test helper `applyEscape` in the test file models what main.ts does for each action (an action-effect model embedded in the tests). It is the only coupling beyond the API; it is minimal and matches the spec (gesture ends, draft resets, selection clears, tool becomes none). Acceptable.
3. TM-ESC-6 pins `deactivate-tool` for an "impossible" state (active tool + selection). Stricter than the spec but taken from the test-plan negative cases; it also kills M8/M24. Acceptable. Note the mapping `hasSelection = selectedDimensions || selectedWalls || selectedDoorways` and `dimensionDraft = dimDraft.a || dimDraft.b` must be done in main.ts (current Esc handler at main.ts:1455-1462 uses these).
4. `afterPlace` assertions on `current`/`active`/`panelOpen` use full-field checks and `toEqual` on the whole group for non-placing tools; not over-broad. TM-PLACE-1 loops over group states inside one test per tool (acceptable, label gives context).
5. `afterPlace(window, ...)` with `active: "other"` input is the realistic case (window is outside the group); covered. `afterPlace` has no "was an element placed" input, so main.ts must call it only after a successful placement (a click that places nothing, e.g. over an existing element, must not call it). This is a wiring risk that is not unit-testable.
6. No assertions are too weak or vacuous (all mutants killed).

## Gaps for the manual browser checklist (test-plan Integration Cases 1-7 plus)

- Esc handler order in main.ts: wall chain (`chainStart`) first, then dimension draft, then selection (tool none), then `setTool("none")` for ANY tool incl. "wall" (line 1461 currently lists only eraser/dimension/ruler/placing; must change).
- Under every tool: click on wall/dimension/door/window, marquee, marker drag (endpoint and midpoint), dimension offset drag, in-place number edit, door direction zone, group move: none act. Particularly the dimension and eraser tools (eraser keeps its own delete action).
- Placing tool click over an existing element: no selection, no tool change (D3); successful placement: tool none, element selected, group panel closed, `current` remembered.
- Rooms drawn wall by wall, then Esc, Esc: selection and wall moves work (memory check-multi-step-sequences).
- Re-activating a tool clears selection; Esc with no tool clears selection and Esc again does nothing.
- Existing deselect-tool-on-element-select tests (`element-select-tool.test.ts`, `popups-ui.test.ts`, part of `selection-editing.test.ts`) will contradict new behavior; they need test-change-requests at apply time (listed in test-plan Out of Scope). `afterElementPress` imports in those tests will break if the function is deleted per D2/D8 — resolve via test-change-request, not silently.

VERDICT: PASS


## Re-validation of revised legacy tests

Scope: revised tests of change `deselect-tool-on-element-select` per test-change-request.md (element-select-tool.test.ts, popups-ui.test.ts PB-GR-02 / PB-INT-02, removal of afterElementPress from openings-group.ts). Read-only review; full suite run: `npx vitest run` 97 files / 2036 tests passed (no worker crash this run); `npx tsc --noEmit` exit 0.

1. Removed DS-1..DS-4b tested only removed behavior. Each asserted `afterElementPress` leaving a placing tool on a press that selected an element. The delta specs (doorway «Выделение проёма без инструмента», «Установка проёма»; canvas-app «Выделение и правка только без инструмента») say the opposite: with a tool nothing is selected, and the tool is left only by placing. Nothing still required was lost.
2. Coverage mapping via `afterPlace` in src/tool-mode.test.ts:
   - DS-1/DS-2/DS-3 (placing tool becomes none; group closed, inactive, current kept) maps to TM-PLACE-1 (all three tools, all group states) and TM-PLACE-2.
   - DS-3 idempotence maps to TM-PLACE-4.
   - DS-4 (other tools unchanged) maps to TM-PLACE-3 (wall, dimension, eraser, ruler, none; all group states).
   - DS-4b (no selection, no change) has no unit equivalent, and cannot: `afterPlace` has no `selected` input. "Click without a ghost places nothing and keeps the tool" is wiring in main.ts (`doorways.length > placed`), outside unit tests (test-plan «Out of Scope»). Note only, not blocking.
3. DS-5 keeps all three assertions (input not mutated, `groupButtonActive` false, `groupButtonClick` returns current tool with panel open) over `afterPlace`; not weakened. PB-GR-02: export list reduced by exactly `afterElementPress` (the function is deleted), and the `groupSelect` absence check stays. PB-INT-02: number, zone, pick order assertions unchanged; the guard assertion changed from `tool !== "eraser"` to `!selectionAllowed(tool)` and is stricter in meaning. It remains a source-text check: `lastIndexOf("!selectionAllowed(tool)", num)` inside the pointerdown body. A wrong main.ts that keeps the text but neutralizes it (`if (!selectionAllowed(tool)) {}`, a comment, or a guard that does not `return`) would pass. The old guard was equally weak (same style), so this is parity, not a regression. Behavior is covered by TM-SEL-* on the pure function; the wiring has no behavioral test. Non-blocking suggestion: tighten the regex to `if (!selectionAllowed(tool)) return`.
4. DS-6..DS-9, DS-3b, DS-7, DS-8* are still accurate. They test `ElementTool` methods (`pressDoorway`, `pressZone`, `place`, `clearGhost`, `reset`), all still in production (`clearGhost` is used by `leavePlacing` in main.ts). Only titles and comments changed. DS-6 uses a "door" ElementTool object as a helper only; it does not assert that a press works while a tool is active, so it does not contradict the new spec. Door direction after placing (door «Направление выделенной двери») is still covered by DS-6/6b/6c.

No weakening of approved tests found. selection-editing.test.ts is unchanged and does not depend on the removed behavior (confirmed by passing suite).

VERDICT: PASS
