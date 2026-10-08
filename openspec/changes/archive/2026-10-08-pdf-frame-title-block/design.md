## Context

`src/export/pdf.ts` builds one jsPDF page. `PDF_MARGIN_MM = 10` is used in three places: `fitsFormat`
(format availability), `placeOnPage` (centering and orientation, `landscape = dw > dh`; the change makes it always landscape) and, indirectly,
`availableFormats`. `buildPdf` creates the document, then calls `drawScene` on `doc.context2d` with a zoom/pan
that maps cm to mm. `exportDrawing` saves the file. `src/main.ts` consumes `availableFormats` for the selector
and the "does not fit" popup.

The frame and title block are static page decoration, independent of the drawing content, so they sit beside
`drawScene`, not inside it (the canvas does not draw them).

## Goals / Non-Goals

**Goals:**
- Frame and title block are drawn in absolute millimetres, in vector form, on every page.
- The page model is a list of pages; the single page today is a one-element list.
- The format-fit check, centering and the popup all use one shared notion of "drawing area".

**Non-Goals:**
- Editable title block fields, the continuation-sheet form (185 x 15 mm), several pages, "Лист / Листов"
  numbering, cell 5 content (all go to `TODO.md` or are decided separately).
- Changes to how the drawing itself is rendered.

## Decisions

**D1. One geometry module for the sheet.** A new module under `src/export/` (working name `sheet-layout`) holds
pure functions: frame rectangle for a given page size, title block rectangle, drawing area rectangle, and the
cell grid as data (list of cell rectangles with their ids and header labels, in title-block-local mm). It has
no jsPDF dependency, so geometry is testable without rendering. Rationale: `fitsFormat`, `placeOnPage` and the
drawing code need the same numbers; today the margin is a single constant and would otherwise be duplicated.

**D2. Drawing of the frame and title block is a separate module** (working name `title-block-draw`) that takes
a jsPDF document, the page rectangle, and the cell texts; it draws lines with widths 0.8 mm (frame, title block
outline) and 0.25 mm (inner grid) and writes text with the PDF font already registered. Rationale: keeps
`buildPdf` thin and the geometry module pure.

**D3. Page list.** `buildPdf` is reshaped to produce its document from a list of page descriptions (today one
element: drawing + format + title block content). The drawing area depends on the page size and orientation
only, not on the page's index, so the single-page path is the general path. The continuation-sheet form would
later be a second title block variant selected by page index; not built now.

**D4. Fit uses the drawing area.** `fitsFormat` and `placeOnPage` replace `PDF_MARGIN_MM` with the drawing area
size and origin. The area is `(w - 25) x (h - 10 - 55)` in mm, with origin `(20, 5)`, for a sheet `w x h`.
The constant `PDF_MARGIN_MM` is removed.

**D5. Text fitting.** The cell texts (name, "Р", scale, date) are measured with the document's font and the
name is shrunk or truncated to stay inside cell 1 (spec: "Заполнение основной надписи").

**D6. Date source.** The date comes from the same `Date` the file name uses, passed in by `exportDrawing`, so
`buildPdf` stays deterministic for tests.

**D7. Module interfaces (the seams tests rely on).** New module `src/export/sheet-layout.ts`, pure, no jsPDF:

- `type Rect = { x: number; y: number; w: number; h: number }` (mm);
- `FRAME_LINE_MM = 0.8`, `GRID_LINE_MM = 0.25`;
- `sheetSizeMm(format: PageFormat): { w: number; h: number }` — landscape size (A4 -> 297 x 210);
- `frameRect(format): Rect`, `titleBlockRect(format): Rect`, `drawingArea(format): Rect` — page coordinates, mm,
  origin at the top-left of the page;
- `type TitleCell = { id: string; x: number; y: number; w: number; h: number; label?: string }` — rectangles in
  title-block-local mm (origin at its top-left corner). Ids: `"1"`, `"5"`, `"6"`, `"7"`, `"8"`, `"9"`, `"10"`,
  `"11"`, `"12"`, `"13"`, `"23"`, `"24"`, `"25"`; the caption cells carry `label` (`"Изм."`, `"Кол."`, `"Лист"`,
  `"№док."`, `"Подп."`, `"Дата"`, `"Стадия"`, `"Масса"`, `"Масштаб"`, `"Лист"`, `"Листов"`) and ids
  `"label:<text>"` with `"label:Лист"` for the signature header and `"label:Лист (7)"` for the sheet caption in
  the stage block;
- `titleBlockCells(): readonly TitleCell[]`;
- `type TitleBlockContent = { name: string; scale: number; date: Date }` and
  `titleBlockTexts(content): { cellId: string; text: string }[]` — the non-empty content cells only.

`src/export/pdf.ts` keeps `PageFormat`, `PAGE_FORMATS_MM`, `wallsBBox`, `fitsFormat(b, scale, format)`,
`availableFormats(...)`, `placeOnPage(b, scale, format)`, `buildPdf(...)`, `exportDrawing(...)`; `buildPdf` gains two
trailing optional parameters after `doorways`: `name: string = ""` (drawing name for cell 1) and
`date: Date = new Date()` (export moment for cell 13); `exportDrawing` already has the name and passes both. `PDF_MARGIN_MM` is removed. `Placement.landscape` stays
and is always `true`.

PDF-level checks parse the uncompressed content stream of the document returned by `buildPdf` (rectangle and
line operators in points; y axis is flipped by jsPDF).

## Risks / Trade-offs

- **Landscape only (decided with the user).** The page is always landscape; orientation is not derived from
  the drawing. With the title block taking 55 mm of height, a tall or near-square drawing moves to a larger
  format even when a portrait page would hold it (180 x 170 mm on paper needs A3). Portrait support is left for
  later; `PageFormat` dimensions stay as portrait base sizes and the landscape swap lives in one place
  (`sheetMm`).
- **Existing approved tests** in `src/export/pdf.test.ts` and the doorway/window/door PDF tests assume the 10 mm
  margin or A4-sized fits. They will fail on the new area; per project rules they are changed only through a
  test-change-request, with validation against the full suite.
- **Larger drawings move up a format.** An A4 landscape area is about 272 x 145 mm instead of 277 x 190 mm.
  Intended, but visible to users.
- **Font coverage.** Header words ("Изм.", "Подп.", "Стадия", ...) need Cyrillic and the digit/№ glyphs in the
  embedded PT Sans font; to be checked when writing tests.

## Migration

None: stored drawings are unaffected; only the generated PDF changes.
