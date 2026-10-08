## 0. Precondition (not an implementation task)

Four approved tests in `src/export/pdf.test.ts` conflict with the intended behavior; they are listed in
`test-change-request.md` and are resolved separately (approval, edit, re-validation against the full suite).
Implementation never edits them. Tasks 2.x make them fail by design until the request is resolved.

## 1. Sheet geometry module

Spec: «Рамка листа», «Основная надпись», «Область чертежа внутри рамки». Approved tests: `src/export/sheet-layout.test.ts` (FR-1, FR-2, TB-1, TB-2, TB-5..TB-8, DA-1, DA-2, OR, invariants).

- [x] 1.1 Create `src/export/sheet-layout.ts` (pure, no jsPDF): `Rect`, `FRAME_LINE_MM`, `GRID_LINE_MM`, `sheetSizeMm`, `frameRect`, `titleBlockRect`, `drawingArea` per design D1/D7; run `sheet-layout.test.ts` geometry tests (frame, block, area)
- [x] 1.2 Add `TitleCell`, `titleBlockCells()` with the spec cell and caption rectangles (cells 1, 5, 6, 7, 8, 9, 10-13, 23, 24, 25 and the 11 captions); run the cell and caption tests (TB-5..TB-8, non-overlap and tiling invariants)

## 2. Fit and placement over the drawing area

Spec: «Формат страницы выбирает пользователь», «Размещение в масштабе чертежа». Approved tests: `src/export/sheet-fit.test.ts` (DA-3..DA-7, OR-4, FM-1..FM-6, PL-1..PL-3, invariants).

- [x] 2.1 In `src/export/pdf.ts` replace `PDF_MARGIN_MM` in `fitsFormat` with the drawing area of the landscape sheet; run the DA-5..DA-7 and FM tests
- [x] 2.2 Make `placeOnPage` always landscape and centre the drawing in the drawing area (origin x 20, y 5); remove `PDF_MARGIN_MM`; run OR-4, DA-3, DA-4, PL-1..PL-3 and the fit/placement invariants
- [x] 2.3 Check the callers of the removed constant and of the orientation (`src/main.ts` format selector and popup) still compile and behave; no new behavior there

## 3. Title block content

Spec: «Заполнение основной надписи». Approved tests: `src/export/sheet-layout.test.ts` (FL-1, FL-2, FL-3, FL-6 text part).

- [x] 3.1 Add `TitleBlockContent` and `titleBlockTexts(content)` to `sheet-layout.ts`: name in cell 1, «Р» in cell 6, `1:<scale>` in cell 25, `ММ.ГГ` in cell 13, nothing in cell 5; run FL tests

## 4. PDF drawing and export wiring

Spec: «Экспорт — упорядоченный список страниц», «Рамка листа», «Основная надпись», «Заполнение основной надписи». Approved tests: `src/export/sheet-pdf.test.ts` (PG-1, OR-1..OR-3, FR-3..FR-5, TB-3, TB-4, TB-5 captions, TB-9, TB-10, FL-3..FL-6, PL-2, PL-4, PL-5, IN-1, IN-3).

- [x] 4.1 Add a module under `src/export/` that draws the frame (0.8 mm) and the title block (outline 0.8 mm, inner grid 0.25 mm, captions, content texts) on a jsPDF page from the layout geometry (design D2); text is fitted into its cell, the name shrinks or is shortened to stay in cell 1 (design D5)
- [x] 4.2 Reshape `buildPdf` (design D3): the document is built from a list of pages, today one; add trailing optional `name = ""` and `date = new Date()` after `doorways`; always landscape; draw frame and title block, then the scene; run PG-1, OR-1..OR-3, FR-*, TB-*, FL-*, PL-* tests
- [x] 4.3 Make `exportDrawing` pass the drawing name and one `Date` that also forms the file name; run IN-1, IN-3
- [x] 4.4 Re-run the existing doorway, door, window and label PDF tests (`src/doorway/*pdf*.test.ts`, `label-orientation.test.ts`) unchanged: they must still pass

## 5. Docs and leftovers

- [x] 5.1 Update `TODO.md`: keep the entries added for this change (continuation-sheet form, portrait, cell 5, left-margin graphs); add the advisory gaps from `test-validation.md` that were not fixed (padding `0.5 * scale` in `availableFormats` not pinned by a test; `exportDrawing` does not pass doorways, pre-existing)

## 6. Final verification

- [x] 6.1 Run the approved tests of this change (`sheet-layout`, `sheet-fit`, `sheet-pdf`) and the focused existing PDF tests; all pass
- [x] 6.2 Run the full suite `npx vitest run`; the only allowed failures are the four tests of `test-change-request.md`, and only until that request is resolved; after it is resolved and re-validated, the whole suite is green
- [x] 6.3 Run `npx tsc --noEmit` (typecheck) and the project formatter/lint if configured (none is configured in `package.json`; state this in the report)
- [x] 6.4 Run `openspec validate pdf-frame-title-block` and `/opsx:verify` for this change; mutation testing is not configured (the validator used hand-written mutants), state this in the report
- [x] 6.5 Review the final `git diff`: no changes under approved tests, no debug or dead code, `PDF_MARGIN_MM` fully removed
