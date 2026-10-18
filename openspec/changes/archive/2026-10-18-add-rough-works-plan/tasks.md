## 1. Tests from the specs (before code)

- [x] 1.1 `rough-works-plan` «Пометка штукатурки», «Участки … не пересекаются», «Участок … следует за стеной»: unit tests for strip geometry (face ±1, section, thickness), clipping by demolished parts, merge with new thickness, follow-the-wall; verify they fail for the right reason (module missing).
- [x] 1.2 `rough-works-plan` «Помещение со стяжкой» + «Параметры инструментов»: tests for active-screed derivation (in room, outside, split, merged — earlier wins, vanished and returned) and thickness validation (5–100 / 10–200, integer only).
- [x] 1.3 `room-explication` «Экспликация плана «Черновые работы»»: tests for net area (all four faces 30 mm → 19,4636 м², outer face, shared corner counted once, no plaster = gross, 1 м² threshold on gross); run against a reference implementation together with the whole existing suite (spec conflicts with approved tests surface here, not at apply).
- [x] 1.4 `drawing-plans` (catalog order, switcher, tool sets, tool reset), `drawing-storage` (optional lists, bad items dropped, merge on load, missing wall kept), `drawing-history` (own history, snapshots validated, old history readable): tests from the scenarios.
- [x] 1.5 `pdf-export` (page 4, plaster width on paper, screed label, legend entries/order/“до N”, grey samples on the page, bottom strip with two tables) and `room-explication` PDF table/blocks on page 4: tests from the scenarios.
- [x] 1.6 Check the multi-step case: a room drawn wall by wall on «Монтаж» with plaster and screed set up afterwards; later walls change earlier contours and active screeds/net areas follow.

## 2. Plan scaffolding

- [x] 2.1 `src/plans.ts`: add `rough` to `PLANS` (4th), `PLAN_TOOLS.rough` (`plaster`, `screed`, `callout`, `ruler`, `notes`, `eraser`), `Tool` union; verify catalog/tool tests (1.4) pass.
- [x] 2.2 `src/types.ts`: domain types for plaster marks and screeds (discriminated by kind where needed), thickness limits and defaults as named constants; no `any`.

## 3. Domain: plaster, screeds, areas

- [x] 3.1 Share with `src/demolition/` only what plaster needs: node snapping, face chains and numbers already work on a structural `MarkSpan` and are reused as is; the number arithmetic is extracted as `editedSpan` (`mark-numbers.ts`); demolition tests pass unchanged.
- [x] 3.2 `src/rough/` plaster model: strip rectangle, clipping by remnants, merge, validation; verify 1.1 tests pass.
- [x] 3.3 `src/rough/` screed model: `activeScreeds` over rooms of the explication, validation; verify 1.2 tests pass.
- [x] 3.4 Net area: `netAreaCm2` via `polygon-union`; wire into the explication model with an area function parameter; verify 1.3 tests pass.

## 4. Storage and history

- [x] 4.1 `src/storage.ts`: optional lists, per-item validation, merge on load, no writes on load; verify storage tests.
- [x] 4.2 `src/history.ts`: key `${id}:rough`, snapshot of both lists, validation on read; verify history tests.

## 5. Canvas and tools

- [x] 5.1 Plan view: grey underlay from `mountingScene`, no sizes, plaster fill, screed hatch under plaster, blocks on top, theme token for the plaster colour (light and dark); render tests.
- [x] 5.2 «Штукатурка» tool: press-and-drag on a face, preview, dead zone, Escape, tool hand-off like «Демонтаж»; panel with thickness; selected mark shows its values; tests from the scenarios.
- [x] 5.3 «Стяжка» tool: click in a room, panel with thickness, repeated clicks, label «h = 65мм» with in-place thickness field and Delete; tests from the scenarios.
- [x] 5.4 Eraser, ruler, callouts and notes for the plan; hotkeys of other plans inert; tests from the scenarios.
- [x] 5.5 Room blocks read-only on the plan (no select, no fields); test.

## 6. PDF

- [x] 6.1 Page 4 («Черновые работы»): underlay grey, plaster, screed hatch and label, blocks, bounds including plaster; scale shared with other pages.
- [x] 6.2 Explication table on page 4 with net areas; bottom strip height from the tallest table among pages.
- [x] 6.3 Legend: `plaster` and `screed` entries (max thickness), order, samples, grey samples on the page; width/fit checks (A4 up to nine entries, A3–A0 any).

## 7. Verification

- [x] 7.1 Typecheck, full test suite (242 files, 5185 tests) and build pass. The project has no formatter, lint or mutation-testing tooling (package.json), so those gates do not apply.
- [x] 7.2 Browser check (backup `drawing`/history in localStorage first): draw a room on «Монтаж», plaster two faces, screed, undo/redo on each plan, change walls on «Монтаж» and see screed/areas follow, export PDF and inspect the 4th page and legend; remove snap-debug leftovers if present (see memory).
- [x] 7.3 `openspec validate add-rough-works-plan --strict`, `/opsx:verify`, final git diff review.
