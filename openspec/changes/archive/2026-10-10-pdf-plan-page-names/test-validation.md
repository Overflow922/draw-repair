# Test Validation: pdf-plan-page-names

Validator: fresh context, read-only in the repo. Experiments in the scratch copy C:\Temp\ppn-val (src, package.json, tsconfig.json, vite.config.ts, index.html; node_modules by junction).

## Reference implementation (scratch only, design D1-D2)

- sheet-layout.ts: `TitleBlockContent.pageName?: string`; `titleBlockTexts` adds `{ cellId: "5", text: pageName }` when pageName is set and non-empty.
- pdf.ts: `PlanPage.title?: string`; `pagesOf` sets `title: plan.label` on both pages; `drawPage` passes `pageName: page.title` only when defined (compatible with exactOptionalPropertyTypes).
- `npx tsc --noEmit`: clean.

## Full suite on the reference

129 files, 2834 tests. All 12 new tests (PN-01..PN-06, PN-10..PN-12) pass on first run: no test defects, no oracle errors (graph 5 = x 65-135, y 15-40 from titleBlockRect("A4"); centre x checked within 0.01 mm).

Only existing tests that fail: 3 in `src/export/pdf-pages.test.ts` (see TCR). Everything else passes, including PG-06, sheet-layout FL-3, sheet-pdf FL-3, demolition-pdf and demolition-*-pdf tests.

## Spec Conflicts / TCR

TCR-1 (required, minimal). `src/export/pdf-pages.test.ts`, three `pagesOf(...)[0]` assertions with `toEqual` on the whole page object (describe "pagesOf", all titled PG-01), lines 134, 138, 142:

- `toEqual({ walls: [WA], dimensions: [dim], doorways: [DOOR_A] })`
- `toEqual({ walls: [WA], dimensions: [], doorways: [] })`
- `toEqual({ walls: [], dimensions: [], doorways: [] })`

The new spec requires a page of a plan to carry its plan name in graph 5 (design D2: `pagesOf` sets `title: plan.label`), so the first page object now has `title: "Обмерочный план"`. The tests need `title: "Обмерочный план"` added to each expected object, nothing else. The intent of PG-01 (page contents, order, number of pages) is unchanged. Verified in scratch: with this edit the whole suite is green (285/285 in src/export).

The test-plan says "no known TCR"; this one is found by the full-suite run and is added here. It has to go through the test-change-request process (Rule 5) before or during apply; approved test files stay untouched until then.

## Mutation results (scratch, run on `src/export` after TCR-1 applied in scratch; baseline 285/285)

| # | Mutation | Result |
|---|---|---|
| M01 | graph 5 text from drawing name | killed (plan-names) |
| M02 | same plan name on every page | killed |
| M03 | wrong cell id (24) | killed |
| M04 | pageName printed when empty | killed |
| M05 | measure page without title | killed (also pdf-pages) |
| M06 | demolition page without title | killed |
| M07 | titles swapped between pages | killed (also pdf-pages) |
| M08 | drawPage does not pass pageName | killed |
| M09 | drawing name dropped from graph 1 | killed (5 files) |
| M10 | pageName written to graph 1 | killed |
| M11 | pageName uppercased | killed |
| M12 | drawing name prefixed to pageName | killed |
| M13 | sheet-draw skips graph 5 | killed |
| M14 | graph 5 text not horizontally centred | killed (PN-02) |
| M15 | graph 5 text at the top edge of the cell (vertical) | SURVIVED |
| M16 | graph 5 never shrinks or shortens a long text | SURVIVED |
| M17 | graph 5 requested font 10 mm (fitText shrinks it) | SURVIVED |
| M18 | "pageName on first page only" | invalid mutation (no-op edit), disregarded |
| M19 | pageName cut to first word | killed |

## Surviving Mutations

- M15: vertical position inside graph 5 is checked only by "y within the cell (15-40)". Vertical centring is shared `drawCentered` code, not a behaviour specified for graph 5 in the delta spec (the spec requires only that the text lies within the cell). Not a blocker.
- M16: long-name fitting in graph 5 is NOT covered by any test. The spec sentence "название плана — внутри графы 5" is implemented by the shared `fitText`, which is covered for graph 1 by existing FL-3 tests. Plan names come from the fixed catalog PLANS ("Обмерочный план", "Демонтаж"); at 3.5 mm they are far narrower than the 69 mm usable width, so the fitting branch cannot be reached today. Recorded as a minor gap (candidate for TODO.md, Tests: a graph 5 fitting test via `titleBlockTexts`/`drawSheet` with a synthetic long pageName).
- M17: graph 5 content font size (3.5 mm) is a design detail, not in the spec; not asserted. Not a blocker.

No survivor concerns a specified behaviour that is reachable.

## Scenario coverage (delta spec)

- Заполненные графы: PN-04 (graph 1 name, "Р", "1:100", "09.26" by position on both pages), existing sheet tests.
- Графа 5 пуста / первая страница «Обмерочный план», вторая «Демонтаж», страница без плана пуста: PN-01, PN-05, PN-03; empty-without-plan: PN-11 (unit) plus existing PG-06 / FL-3 (full PDF, page without a plan; pass unchanged on the reference).
- Длинное имя чертежа: existing FL-3 tests (graph 1), PN-12 (pageName independent of a long name).
- Название плана в графе 5 на каждой странице: PN-01, PN-04 (name in graph 1 of both pages, not in graph 5), PN-06 (drawing named "Демонтаж" does not confuse the name sources).
- Long plan name inside graph 5 (spec clause): not covered (M16), see above.

## Vacuity check

- `inCell` uses closed cell bounds with no extra tolerance; CELL5 is 70x25 mm. Assertions on graph 5 use exact list equality (`toEqual(["Обмерочный план"])`) and a count check (PN-05), so duplicates or extra text in the cell fail. Centre check PN-02 has 0.01 mm tolerance. Text collisions (drawing named "Демонтаж") are handled by PN-06 and the cell-restricted lookups; PN-03 is partly subsumed by PN-01/PN-05 but harmless. PN-04's `some(...)` checks for "Р", scale and date are weak by design (those cells are covered by existing tests), but the cell positions restrict them.
- Mocking: jsPDF `text` is wrapped through a subclass that records page number and coordinates and then calls the original; the mock does not alter output. All calls with string text and numeric x, y are recorded (the `{ align: "center" }` option does not affect the recorded x, which is the centre point).

## Repository check

`git status --short` in the real repo after validation: `A  img_2.png` (user, ignored), `?? bash.exe.stackdump`, `?? img.png`, `?? img_1.png`, `?? openspec/changes/pdf-plan-page-names/`, `?? src/export/plan-names-pdf.test.ts`. No production code, tests or specs modified; only this file added to the change directory. (One scratch cleanup attempt hit the node_modules junction with "access denied"; the repo's node_modules was checked afterwards and is intact and used by the passing runs.)

## Verdict

The new tests are sound, kill all mutations on reachable specified behaviour, and the single conflict with approved tests (TCR-1) is listed with the minimal change. Surviving mutations concern an unreachable fitting branch and design-level details.

VERDICT: PASS
