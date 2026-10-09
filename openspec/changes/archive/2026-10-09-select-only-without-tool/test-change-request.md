# Test change request: select-only-without-tool

Rule 5: implementation stopped here. Approved tests of earlier changes describe behavior that this change replaces. They are listed with the reason; none was edited.

## Failing now

| Test | File | Why it no longer represents the specification |
|---|---|---|
| PB-INT-02 «нажатие вне ластика — правимое число, затем зона двери, затем выбор цели» | `src/doorway/popups-ui.test.ts` (line ~105) | Source-text check of `main.ts` that the `pressNumber` / `pressZone` branch sits inside a `tool !== "eraser"` guard. Under spec `canvas-app` «Выделение и правка только без инструмента» the branch runs only when `selectionAllowed(tool)` (no tool), so the guard `tool !== "eraser"` is gone. The order part of the test (number → zone → `pressPick`) is still true. Proposed change: replace the guard assertion with one for `selectionAllowed(tool)` (or drop the guard assertion and keep the order assertions). |

## Still passing only because the old code is kept

These tests import `afterElementPress` (`src/doorway/openings-group.ts`), which production no longer calls (task 2.5 deletes it). Deleting it fails them at import:

- `src/doorway/element-select-tool.test.ts` — all of it (DS-* tests of `afterElementPress`, `clearGhost` etc. for the removed «selecting an element leaves the placing tool» behavior; spec doorway «Выделение проёма кликом» is removed by this change).
- `src/doorway/popups-ui.test.ts` PB-GR-02 — asserts the exports of `openings-group.ts` include `afterElementPress`.
- Parts of `src/doorway/selection-editing.test.ts` that rely on a placing tool leaving the mode on a press (to be identified when the file is reviewed).

## Resolution (user chose: revise in a separate test-writing step, then re-validate)

- `src/doorway/element-select-tool.test.ts`: removed DS-1…DS-4b (they tested only `afterElementPress`, the removed «selecting leaves the tool» rule; the replacement rule `afterPlace` is covered by TM-PLACE-1…4 in `tool-mode.test.ts`). DS-5 rewritten over `afterPlace` (same assertions: input not mutated, group button inactive, click returns the current tool with the panel open). DS-6…DS-9, DS-3b, DS-7, DS-8* unchanged (they test `ElementTool` without a tool / ghost reset, still current); headings and comments updated.
- `src/doorway/popups-ui.test.ts`: PB-GR-02 export list no longer contains `afterElementPress`; PB-INT-02 asserts the guard `!selectionAllowed(tool)` before `pressNumber` (order assertions unchanged).
- `src/doorway/selection-editing.test.ts`: no test relies on the removed behavior; unchanged.
- Production: `afterElementPress` and `ElementPress` deleted from `src/doorway/openings-group.ts` (task 2.5).
- Result: `npx vitest run` — 97 files, 2036 tests pass; `tsc --noEmit` clean. Re-validation by a fresh validator is pending.

## Requested resolution

1. Review each listed test against the delta specs of this change.
2. Delete or rewrite the tests of the removed behavior; fix PB-INT-02 and PB-GR-02 as described.
3. Re-validate the changed tests (fresh-context validator), then resume task 2.5 (delete `afterElementPress`).
