# Test Validation

Change `add-callout`, round 4 (narrowed scope), independent validator in a fresh context. Read-only for repository content: production code, tests, specs, design and test-plan were not touched; only this file was written. Reference implementation: the previous validator's scratch implementation (`callout-{text,store,actions,layout,pick,render}.ts` plus edits to types.ts, storage.ts, history.ts, render.ts, demolition-render.ts, plans.ts, tool-mode.ts, openings-group.ts, export/pdf.ts, index.html), re-read against the specs and the "Контракт для тестов"; it needed no change to be correct. The test files in the worktree are byte-identical to those in the real checkout. After the mutation runs the worktree was verified byte-identical to the reference again.

Results against the reference:

- `vitest run src/callout`: 11 files, 189/189 pass.
- Whole suite (`--exclude "**/.claude/**"`): 208 files, 13 existing approved tests fail, all caused by the new tool in `toolsOf` (list under Integration Behavior). One extra transient failure was seen in the very first whole-suite run (14 failed); it did not reproduce in two further runs (13) and is attributed to load-related flakiness of an existing test, not to the new tests.
- `tsc --noEmit`: one error, `src/tool-mode.test.ts(21,61)` TS2366 (exhaustive switch over `EscapeAction` lacks the new `"cancel-callout-draft"`). Expected. The new tests type-check.
- No new test fails against the correct reference (no test defect). D-1 is fixed: the mutation that draws `fillText("")` for blank lines passes all 189 tests.
- Mutation run: 373 single textual mutations (scripted, one at a time, `vitest run src/callout`); 317 killed (one of them, L37, was an invalid mutant that only broke the module), 55 survived, 1 no-op (R66, pattern did not match). Every survivor is classified below.

## Requirement Coverage

All eight spec files are covered at the level the contract allows (no DOM, no `main.ts` wiring):

- callout / Данные выноски: C-ACT-1, 7, C-INV-1, C-PLN-1..4, C-STORE-*, C-STO-*. The scenario "Точки без привязок" is only half covered for the text point (see F-1).
- callout / Инструмент и размещение: C-TOOL-4, 5, 5b, 5c, 8. Preview, double click, coincident points, click-outside-confirms are `main.ts` wiring (declared out of scope, TODO).
- callout / Ввод текста: C-TXT-1..7, C-ACT-1c..6, C-HIS-1.
- callout / Отображение: C-RND-1..6b, C-LAY-1..14.
- callout / Выделение, перенос, ластик: C-PICK-*, C-RND-7..10, C-ACT-7..9, C-TOOL-6.
- callout / не участвует в расчётах: C-INV-2, C-INV-3, C-PLN-4.
- canvas-app: C-TOOL-1..3, 3b, 7, 9..9c.
- drawing-plans, demolition-plan, mounting-plan: C-PLN-*, C-STORE-*, C-RND-11..11g, C-PDF-1, 2b.
- drawing-storage: C-STO-1..8b.
- drawing-history: C-HIS-1..12, now including multi-step sequences (C-HIS-4i, 4j).
- pdf-export: C-PDF-1..8.

Gaps (declared, not mutation-visible): DOM text editor, `main.ts` wiring, real `measureText` widths.

## Boundary Coverage

Covered and mutation-verified: alignment boundary `target.x == at.x` and +0.01 (L1..L6 killed); pick radius exactly on and just outside, at zoom 0.5/1/2 (P1, P7, P8 killed); the four box sides of the pick neighbourhood (P14..P17, P20, P21 killed); segment clamping (P11, P12, P13 killed); history limit `HISTORY_LIMIT + 1` (H3..H3e killed); one-line / 2 / 5 lines with blank line; one-axis point move (A22, A23, A24 killed); text edges and tabs (T1..T7, T10..T14 killed); PDF bounds left/up/right/down and box edges (PD5, PD6, PD12, PD13, PD15..PD18, PD20..PD24 killed). Not covered: a fractional text point in `commitCallout` kind "new" (F-1); two or more consecutive blank lines inside a text (T16); moves smaller than 0.5 cm (A30); arrow tip vertical extent in PDF bounds (PD9); arrow pointing below the text and right-aligned diagonal arrowhead axis (R28, R27).

## Negative Cases

Covered: empty, whitespace-only and `\r\n`-only text, unknown id for edit/move/remove (A9, A32, A33 killed), same text, same point, missing id / non-string id / NaN / Infinity / null point / empty or whitespace or non-string text in the document and in a history entry (every callout checked: ST1..ST10, H20..H24, X1, X2 killed), foreign entry on top of past/future (H4, H4b, H10*, killed), selection with another id (R49..R56 killed), empty list pick, other plan's callouts in bounds (PD1..PD4 killed). Blank-line drawing: C-RND-2b now filters empty strings and no longer forbids `fillText("")` (D-1 closed). Not covered: single-item edit-to-empty (A20, implausible guard), `\r\n` more than once in one text (T9) or in an edit (A16), both unobservable from a browser textarea.

## Error Handling

Invalid persisted data (storage and history) is covered and killed for every validator clause. A broken callout entry resets the history (C-HIS-8, 8b, 8c, 8d). A non-array list in a document reads as absent (C-STO-7d). Pure operations never throw on frozen input (C-INV-4 with `deepFreeze`; A31, S8, S10 killed). No error path exists in the production contract beyond this.

## Invariants

- Inputs are never mutated: C-INV-4 kills A31, S8, S10; aliasing of `target`/`at` of a new callout (A42) is not observable by values and unspecified.
- No callout with empty text after any commit: C-INV-5 (A1, A10 killed).
- Callouts of one plan never leak into another list, page, history or document slot (S1..S12, PD1..PD4, ST15..ST19 killed).
- Font size equals `labelPx` at every zoom and equals the dimension number's (R3..R7 killed). Line width is `hatchPx` (R14..R17 killed).
- Callouts are not read by rooms/collisions (C-INV-2/3).
- Points of a callout are exactly the clicks (spec "Точки без привязок"): enforced for the arrow point on creation (A4 killed), for both points on move (A25..A28 killed), but NOT for the text point on creation (A5, X5, X6, X7 survive, F-1).

## State Transitions

Single-step transitions and, new in this round, multi-step sequences are covered: C-HIS-4i (three records, two undos, two redos, one more undo, all the way back to empty; stack lengths after each step) and C-HIS-4j (undo, undo, redo then the rest of the redo branch is still available). The round-3 survivors H11 (`future.shift()`), H9d (`past.unshift`), H25 (undo keeps only the top of `future`), H26 (redo clears the rest of `future`) are all killed, as are twelve further stack-discipline variants (H25b, H9e, H7e..H7h, H4, H4b, H5, H6, H7, H9, H9b, H9c). The existing six undo/redo functions never take a `"callouts"` entry (H10*, killed).

## Integration Behavior

- Storage round trip of three plans with mounting content preserved; history round trip including trash drawings; `pagesOf` + `pageBounds` + `buildPdfPages` with the real jsPDF context; `drawScene`/`drawDemolitionScene` with the recorder; `index.html` order and icon (IDX1..IDX7 killed).
- Dark theme on the demolition plan (round-3 F-2): C-RND-11g kills DR3 (LIGHT_PALETTE) and DR4 (grey palette) in `drawDemolitionScene`, and C-RND-6/6b kill the same mistake in `drawScene` (RN3).
- Existing approved tests that fail against the reference, all caused by the new tool in `toolsOf` (expected; they need a test-change-request, not a repair here):
  - `src/plan-tools.test.ts`: PT-02 (measure plan), PT-02 (demolition plan), PT-02 (plans intersect), SZ-70, SZ-71 (5).
  - `src/mounting-plans.test.ts`: MP-51, MP-52 (2).
  - `src/communications/plans.test.ts`: DP-01, DP-02, DP-03 (3).
  - `src/battery/battery-tool.test.ts`: B-TOOL-7, 7b, 7c (3).
  - plus the type error in `src/tool-mode.test.ts` (exhaustive switch, 1 tsc error).
  No other existing test fails.

## Implementation Independence

The new tests tolerate legitimate variations (any `textAlign`/`textBaseline`, marker drawn as arc or rect, line start within half a font height, line spacing between 1 and 2 font heights, drawing or skipping empty lines). D-1 is resolved: C-RND-2b filters empty strings (mutation R9 passes). Mild over-specification, not defects: C-STO-1b (empty list round-trips as `[]`), C-PICK-1c/1e (padding of the backing box at most about 8 px), C-PDF-7h, C-RND-9 (highlight colour `palette.erase`, project convention). No test fails against a correct implementation.

## Assertion Strength

Mostly exact values (`toEqual` of lists, `toBeCloseTo` to 6..9 digits on layout coordinates, exact fonts, exact colours, exact stroke widths, exact stack lengths in the new history tests). Weak points: (1) C-ACT-1 is exact but its input has an integer text point, so it cannot distinguish a snapped/rounded text point from an exact one (F-1); (2) the marker tests look at positions with a 12 px tolerance, not at size or colour (R62..R65, X3, X4 survive, cosmetic); (3) C-PDF-7e/7g/7f lower bounds on the text width estimate are lenient (PD19 survives; the generic page margin absorbs it); (4) bounds tests never vary the vertical position of the arrow tip (PD9); (5) the arrowhead axis tests cover a level arrow and a left-aligned upward diagonal only (R27, R28).

## Mutation Testing

Method: a Node script applied one textual mutation at a time to the reference (restoring the file afterwards) and ran `vitest run src/callout`. 373 mutants: text (16), store (12), actions (42), layout (44), pick (25), render (78 + 5 render.ts + 8 demolition-render.ts), history (about 60 including the round-3 stack-discipline family), storage (24), plans/tool-mode/index.html (27), pdf (34), extras (9). Regression families from earlier rounds all stay killed: alignment, spacing, lineStart, box, pan/zoom, fonts, arrow shape and size, backing before text, markers, eraser highlight, colours, pick radius/zoom/ties/box sides, actions, text normalisation, store plan routing, storage validation, history copy/limit/future/kind peek, pdf pages and bounds, toolsOf/Esc/html.

Round-3 findings re-verified as mutations:

- D-1: `fillText` for blank lines (R9): survives, i.e. all 189 tests pass: fixed.
- F-1: H11, H9d, H25, H26 killed by C-HIS-4i and/or C-HIS-4j; fixed.
- F-2: DR3 killed by C-RND-11g; fixed.

## Surviving Mutations

| Mutation | Expected Failing Test | Result |
|---|---|---|
| A5 `commitCallout` new: text point `at` rounded to integers | C-ACT-1 with a fractional `at` | SURVIVED, REAL (F-1) |
| X5 new: `at` via `toFixed(0)` | same | SURVIVED, REAL (F-1) |
| X6 new: only `at.x` rounded | same | SURVIVED, REAL (F-1) |
| X7 new: `at` snapped to a 5 cm grid | same | SURVIVED, REAL (F-1) |
| R9 draw `fillText("")` for blank lines | none (conforming) | passes, D-1 fixed |
| R3-F2-RN4 `opts.palette ?? LIGHT_PALETTE` | - | equivalent |
| T8 lone `\r` to `\n` | none | unspecified (only `\r\n` is named) |
| T9 `\r\n` replaced only once (no `g`) | none | unspecified-minor: a textarea never returns `\r\n`; the spec names no multi-`\r\n` case |
| T16 collapse 3+ consecutive newlines inside the text | none (two consecutive blank lines inside a text) | minor gap; spec says inner blank lines are kept, no test with two in a row |
| A16 edit stores `rawText.trim()` | none | unspecified: differs only for `\r\n` |
| A20 edit-to-empty deletes only if `list.length > 1` | none (single-item list) | implausible, minor gap; `removeCallout` single item covered |
| A29 move equality with 0.01 cm epsilon | none | unspecified-cosmetic (sub-0.01 cm) |
| A30 move equality with 0.5 cm epsilon | none | minor: moves under 0.5 cm count as no move; spec silent about a tolerance, unspecified |
| A39, A40, A41 ids matched by prefix | none | implausible, unspecified |
| A42 new callout keeps `edit.target`/`edit.at` by reference | none | unobservable by value |
| L21 box padding zero | none | unspecified-cosmetic |
| L41 box width minus 1 px | none | unspecified-cosmetic |
| P10 box distance Chebyshev instead of Euclidean | none | unspecified (corner shape of the radius) |
| P19 `bestD = radius` initially | - | equivalent |
| R27 arrow axis taken from the box left edge instead of the line start | C-RND-4d covers only the left-aligned diagonal | minor gap: wrong by about 1 degree for right-aligned diagonals only (optional, round 3) |
| R28 arrow direction uses `abs(dy)` | none (target below the text never tested) | minor gap, implausible (optional, round 3) |
| R34 arrowhead path not closed | - | equivalent (fill closes the path) |
| R39 baseline `alphabetic` | - | equivalent by contract |
| R48 `fillText` with `maxWidth` 5 | none | unobservable in the recorder, implausible |
| R52, R53, R65, R78 erase highlight width / box only / handle stroke and fill colours | none | unspecified-cosmetic |
| R62 text handle at `lineStart` (3.5 px off) | none | within the position tolerance, cosmetic |
| R63, R64 handle radius 30 / 1 px, X3, X4 handle without fill / stroke | none | unspecified-cosmetic |
| R67 `globalAlpha = 0.5`, R68 `setLineDash` | none | unspecified; canvas state restored, recorder does not record dashes |
| R69 callouts drawn in reverse order | none | unspecified (draw order) |
| R72 no `|| 1` guard when line start equals arrow tip | none | degenerate, canvas ignores NaN path; unspecified |
| RN5 `drawScene` callouts skipped when `underlay` | - | equivalent (underlay scene is called without callouts) |
| H8, H8b `undoCallouts`/`redoCallouts` return the stored array without copy | - | equivalent (entry already removed from the stack) |
| H24b history entry validates only the last callout | none (bad callout in the middle) | implausible; first-only (H23) and `some` (H20) are killed |
| ST23 loader trims callout text, ST24 `id + ""` | - | equivalent for valid data |
| TM5 `calloutDraft && tool === "callout"` | - | equivalent (draft exists only with that tool) |
| TM6, TM7 draft combined with a selection | none | unspecified: with the tool active there is no selection |
| PD7 bounds omit `lineStart` | - | equivalent (inside the box edge) |
| PD9 bounds take the arrow tip y from the line start | none (every bounds test has `target.y == at.y`) | minor gap, optional (round 3); tip x is covered (PD10 killed) |
| PD11 bounds omit the top edge of the box | - | equivalent in effect (generic margin `0.5 * scale` exceeds font height plus padding) |
| PD14 clamp of the left edge (mine), PD33 `callouts: []` always on pages | - | equivalent |
| PD19 text width estimate halved | C-PDF-7e/7g | weak tolerance, unspecified accuracy of the estimate |
| PD25 layout pan 5 px | none | cosmetic, absorbed by the margin |
| L37 lines trimmed | - | invalid mutant (module did not load) |
| R66 handle fill removal | - | no-op (pattern did not match); X3 covers it |

## Findings

F-1 (REAL, spec "Точки без привязок" for the text point on creation). The spec requires: "положение обеих точек — ровно там, где пользователь кликнул"; scenario "Точки без привязок": a callout placed next to a grid node keeps both points exactly at the clicks. C-ACT-1 builds the new callout from `NEW = { target: (100.37, 20.5), at: (10, 20) }`: the arrow point is fractional, the text point is integer. Therefore four plausible mistakes survive: rounding `at`, rounding only `at.x`, `toFixed(0)`, snapping `at` to a grid (A5, X5, X6, X7). Snapping the text point to the grid is exactly the mistake the spec scenario is about (the text point is the second click, the one most likely to be routed through the grid snapper). Arrow point rounding (A4) and both points on move (A25..A28) are killed. Needs a test: `commitCallout(list, { kind: "new", id, target: <fractional>, at: <fractional, e.g. (10.37, 20.5)> }, "т")` and `toEqual` the exact points.

Round-3 findings: D-1 closed (C-RND-2b filters empty strings; R9 passes), F-1 closed (C-HIS-4i, 4j kill H11, H9d, H25, H26 and twelve variants), F-2 closed (C-RND-11g kills DR3, DR4).

Optional gaps, not blocking (unchanged from round 3): R27/R28 (arrowhead axis for a right-aligned diagonal and for a target below the text; no test with the target below the text exists), PD9 (arrow tip y in PDF bounds), A20 (single-item edit-to-empty), A16/T9 (`\r\n`), plus the new minor observations T16 (two consecutive inner blank lines) and A30 (sub-0.5 cm move treated as no move). The "Ограничения тестов отрисовки" paragraph in test-suite.md stating the horizontal text position is not observable is stale (it is observable, C-RND-2c..2e).

## Required Changes

1. Test Writer: extend C-ACT-1 (or add C-ACT-1d) so the new callout's text point is fractional and not on any grid, for example `at: { x: 10.37, y: 20.5 }`, and assert both points `toEqual` exactly. Must kill A5, X5, X6, X7. (F-1)
2. Optional (do not block): a target-below-text and a right-aligned diagonal case for the arrowhead axis (R27, R28); an arrow tip `y` case for `pageBounds` (PD9); two consecutive blank lines inside a text (T16); `commitCallout` edit-to-empty on a single-item list (A20).
3. Out of this change: the four approved test files and `src/tool-mode.test.ts` need a test-change-request (unchanged from the test plan).

## Verdict

FAIL. The suite is green against a correct reference (189/189), all three round-3 findings (D-1, F-1, F-2) are fixed and verified by mutation, and no new test is defective. One REAL gap remains: the spec requirement that both callout points are exactly the clicks is not enforced for the text point on creation (a rounded or grid-snapped `at` passes every test). The fix is a one-line change to a test input; production code is not at fault.

VERDICT: FAIL
