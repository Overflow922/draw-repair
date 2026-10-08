# Test Change Request

Four approved tests in `src/export/pdf.test.ts` encode behavior that this change intentionally replaces (spec
`pdf-export`, delta in `specs/pdf-export/spec.md`). Found by test validation against a reference implementation
(`test-validation.md`); every other existing test (1838 in the reference run) passes unchanged.

The implementation agent MUST NOT edit these tests (CLAUDE.md Rule 5). They are changed in a separate step, after
the user approves this request, followed by a re-validation of the modified tests against the full suite.

| # | Test | Why it no longer represents the specification | Proposed replacement |
|---|---|---|---|
| 1 | `placeOnPage` > "альбом для широкого чертежа, портрет для высокого" | Spec «Формат страницы выбирает пользователь»: the page is always landscape | Assert `landscape === true` for wide, tall and square bboxes (the same check exists as OR-4 in `sheet-fit.test.ts`, so the old test can be removed instead) |
| 2 | `placeOnPage` > "центрирует содержимое в полях при положительных координатах" | Spec «Размещение в масштабе чертежа»: centering is in the drawing area (x 20, y 5, 272×145 mm on A4), not in the page minus a 10 mm margin | Expect `offsetX = 20 + (272 − 50)/2`, `offsetY = 5 + (145 − 25)/2` for a 500×250 cm drawing at 1:100 on A4 (covered by PL-2 in `sheet-fit.test.ts`; remove or align) |
| 3 | `placeOnPage` > "центрирование инвариантно к сдвигу координат" | Hard-coded 123.5 mm margin from the old centering | Expect the same left/right margin of 131 mm to the area edges at shifted and unshifted coordinates (PL-3 in `sheet-fit.test.ts` covers the invariance; remove or align) |
| 4 | `buildPdf` > "высокий чертёж даёт портретную страницу формата" | Spec: the page is always landscape | Expect 594 × 420 mm for a tall drawing on A2 (OR-3 in `sheet-pdf.test.ts` covers it; remove or align) |

## Resolution

Approved by the user on 2026-10-08. The four tests were aligned in `src/export/pdf.test.ts` (not removed): always
landscape for wide and tall bboxes; centering in the drawing area (offsets 131 and 65 mm for a 500×250 cm drawing
at 1:100 on A4; left edge of the drawing at x = 131 mm and a 111 mm gap to the right edge of the area, equal at
shifted coordinates; the first draft of this resolution wrote 131 for the right gap by mistake, corrected during
apply when the arithmetic failed: 292 − (131 + 50) = 111); tall drawing on A2 gives a 594×420 mm
page. Re-validation: the modified tests run against the implementation together with the full suite during apply
(task 6.2); they are the same expectations the validator derived against its reference implementation.
