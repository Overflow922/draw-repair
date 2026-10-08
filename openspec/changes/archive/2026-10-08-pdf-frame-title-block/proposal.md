## Why

An exported PDF is a bare drawing on a white sheet. Construction drawings in Russia (СПДС, ГОСТ Р 21.1101) carry
a sheet frame and a title block ("основная надпись") in the bottom-right corner; without them the PDF cannot be
filed or handed over as a drawing sheet. Multi-sheet export is planned later, so the page structure has to be
ready for it now.

## What Changes

- Every exported page gets a sheet frame: a thick line inset 20 mm from the left edge and 5 mm from the other
  three edges.
- Every exported page gets a title block in the bottom-right corner of the frame, copied from the
  "Основная надпись на чертежах строительных изделий (первый лист)" form: 185 x 55 mm, with all cells and
  cell sizes as in the source (cells 1, 5, 6, 7, 8, 9, 10-19, 23, 24, 25).
- All frame and title block sizes are absolute millimetres, equal on every format A4-A0: printed at 100 % on
  A4 they measure exactly as specified. Nothing scales with the page format or the drawing scale.
- Cell content for now: drawing name in cell 1, "Р" in cell 6, the drawing scale "1:X" in cell 25, the export
  date in the "Дата" cell of the signature rows; every other cell is empty. Cell 5 (page name) is left empty
  until it is defined separately.
- The drawing area becomes the interior of the frame above the title block (the full width of the frame, down
  to the top edge of the title block). The drawing must fit it entirely and touch neither the frame nor the
  title block. This area replaces the current 10 mm page margin in the format-fit check, the centering and the
  "formats that do not fit" popup.
- Page orientation is always landscape; it is no longer derived from the drawing's proportions. Portrait is
  not supported for now.
- The export is specified as an ordered list of pages, each with its own frame and title block. Today the list
  has exactly one page. The form for the following sheets (185 x 15 mm) is out of scope and goes to `TODO.md`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `pdf-export`: new requirements for the sheet frame and the title block; the page-format and placement
  requirements now use the frame's drawing area instead of a 10 mm margin; export is specified per page.

## Impact

- `src/export/pdf.ts` (margin constant, `fitsFormat`, placement, page drawing), a new title-block drawing
  module under `src/export/`.
- Existing approved tests in `src/export/pdf.test.ts` that assume a 10 mm margin will conflict with the new area
  and must be reviewed through the test-change-request flow, not edited by the implementation.
- Some drawings that fit A4 today will need A3 (A4 landscape drawing area is about 272 x 145 mm).
- No new dependencies.
