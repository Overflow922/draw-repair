# Test Plan

## Scope

Observable behavior of the sheet frame, the title block, the drawing area and landscape-only pages in PDF export
(`pdf-export` delta spec). Two levels:

- pure geometry (`src/export/sheet-layout.ts`, interfaces in design D7) and the fit/placement functions in
  `src/export/pdf.ts` (`fitsFormat`, `availableFormats`, `placeOnPage`);
- the generated document (`buildPdf`): page count, page size, and the vector operators of the frame and title block
  parsed from the uncompressed content stream (rectangle/line operators and line widths, in points, y flipped), and
  text placement observed by spying on `jsPDF.prototype.text` (the library is not the system under test).

Test files go in `src/export/`: `sheet-layout.test.ts`, `sheet-fit.test.ts`, `sheet-pdf.test.ts`, plus a helper
`pdf-ops.test-utils.ts` for stream parsing. Unit: geometry and fit. Integration: `buildPdf` with real jsPDF and
the embedded font. No e2e (the selector/popup wiring in `src/main.ts` is unchanged apart from the format list).

## Requirements Coverage

| Requirement | Scenario | Test ID |
|---|---|---|
| Экспорт — упорядоченный список страниц | Одна страница | PG-1 |
| Рамка листа | Отступы рамки на A4 альбомной | FR-1 |
| Рамка листа | Отступы не зависят от формата | FR-2, FR-3 |
| Рамка листа (в PDF, толщина) | — (requirement text: 0,8 мм, абсолютные размеры) | FR-4, FR-5 |
| Основная надпись | Размеры основной надписи | TB-1, TB-2 |
| Основная надпись | Размеры не зависят от формата и масштаба | TB-3, TB-4 |
| Основная надпись | Сетка граф | TB-5, TB-6, TB-7, TB-8 |
| Основная надпись (линии) | — (requirement text: 0,8 мм контур, 0,25 мм сетка) | TB-9, TB-10 |
| Заполнение основной надписи | Заполненные графы | FL-1, FL-2 |
| Заполнение основной надписи | Графа 5 пуста | FL-3 |
| Заполнение основной надписи | Длинное имя чертежа | FL-4, FL-5 |
| Заполнение основной надписи (текст в PDF) | — (requirement text) | FL-6 |
| Область чертежа внутри рамки | Область на A4 альбомной | DA-1, DA-2 |
| Область чертежа внутри рамки | Чертёж не пересекает рамку и основную надпись | DA-3, DA-4 |
| Область чертежа внутри рамки | Граница области | DA-5, DA-6, DA-7 |
| Формат страницы выбирает пользователь | Выбор формата | OR-1 |
| Формат страницы выбирает пользователь | Автоориентация (всегда альбомная) | OR-2, OR-3, OR-4 |
| Формат страницы выбирает пользователь | Габариты учитывают размеры | FM-1 |
| Формат страницы выбирает пользователь | Непомещающиеся форматы убираются из списка | FM-2 |
| Формат страницы выбирает пользователь | Текущий формат стал недоступен | FM-3 |
| Формат страницы выбирает пользователь | Дефолтный формат не вмещает новый чертёж | FM-4 |
| Формат страницы выбирает пользователь | Основная надпись уменьшает вместимость | FM-5 |
| Формат страницы выбирает пользователь | Высокий чертёж проверяется по альбомной области | FM-6 |
| Размещение в масштабе чертежа | Точное соотношение | PL-1 |
| Размещение в масштабе чертежа | Центрирование в полях | PL-2, PL-3 |
| Размещение в масштабе чертежа | Подписи не масштабируются | PL-4 |
| Размещение в масштабе чертежа (положение в PDF) | — (requirement text) | PL-5 |

## Test cases

| ID | Level | What is checked |
|---|---|---|
| PG-1 | integration | `buildPdf(...)` document has exactly 1 page |
| FR-1 | unit | `frameRect("A4")` = `{x:20, y:5, w:272, h:200}` |
| FR-2 | unit | for A3, A2, A1, A0: `frameRect` = `{x:20, y:5, w:W-25, h:H-10}` with landscape W,H |
| FR-3 | integration | the frame rectangle drawn in the PDF is the same (in mm) at scale 1:50 and 1:200, on A4 |
| FR-4 | integration | the stream contains the frame rectangle at `frameRect` position, converted to points, for A4 and A1 |
| FR-5 | integration | the line width used for that rectangle is 0.8 mm (in points: 0.8 x 72/25.4) |
| TB-1 | unit | `titleBlockRect("A4")` = `{x:107, y:150, w:185, h:55}` |
| TB-2 | unit | for every format: w = 185, h = 55, right edge = frame right edge, bottom edge = frame bottom edge |
| TB-3 | integration | the PDF title block outline is 185 x 55 mm on A4 at 1:100 and on A1 at 1:20 |
| TB-4 | integration | same set of title-block line segments (relative to the block's top-left) on both exports |
| TB-5 | unit | `titleBlockCells()` has cell `"1"` = `{x:65, y:0, w:120, h:15}` |
| TB-6 | unit | cells 5, 23, 9: 5 = `{65,15,70,25}`, 23 = `{65,40,70,15}`, 9 = `{135,40,50,15}` |
| TB-7 | unit | stage block: 6 = `{135,20,15,15}`, 24 = `{150,20,15,15}`, 25 = `{165,20,20,15}`, 7 = `{135,35,20,5}`, 8 = `{155,35,30,5}`; captions at y 15–20 and the "Лист"/"Листов" captions |
| TB-8 | unit | signature part: 10 = `{0,20,20,35}`, 11 = `{20,20,20,35}`, 12 = `{40,20,15,35}`, 13 = `{55,20,10,35}`; caption row y 15–20 with "Изм." x0–10, "Кол." 10–20, "Лист" 20–30, "№док." 30–40, "Подп." 40–55, "Дата" 55–65 |
| TB-9 | integration | the title block outline rectangle is drawn with line width 0.8 mm |
| TB-10 | integration | inner grid lines (e.g. the vertical at block-x 65 and the horizontal at block-y 15) are drawn with width 0.25 mm; no inner line is drawn with 0.8 |
| FL-1 | unit | `titleBlockTexts({name:"Чертёж 1", scale:100, date: 2026-09-05})` is exactly `[{1,"Чертёж 1"},{6,"Р"},{25,"1:100"},{13,"09.26"}]` (any order) |
| FL-2 | unit | scale 50 gives `"1:50"`; January 2027 gives `"01.27"` (zero padding, two-digit year); December gives `"12.xx"` |
| FL-3 | unit + integration | no entry for cell `"5"`, and no text call is placed inside cell 5's rectangle in the PDF |
| FL-4 | integration | name of 300 characters: every text drawn for cell 1 stays within x 65–185 and y 0–15 of the block (measured with the document's text width and font size at call time) |
| FL-5 | integration | the same bound holds for a medium-length name; a short name ("Ч") keeps the standard font size (not shrunk below the font size used for a normal name) |
| FL-6 | integration | the text calls for «Чертёж 1», «Р», «1:100», «09.26» are positioned inside their cell rectangles (cells 1, 6, 25, 13) on the page |
| DA-1 | unit | `drawingArea("A4")` = `{x:20, y:5, w:272, h:145}` |
| DA-2 | unit | for A3..A0: `{x:20, y:5, w:W-25, h:H-65}`; area bottom edge = title block top edge, area right = frame right |
| DA-3 | integration | drawing bbox equal to the area: `placeOnPage` offsets put the bbox exactly on the area (min corner at (20, 5)) |
| DA-4 | integration | for a nonsquare drawing the placed bbox lies inside the area on all four sides, for A4 and A3, and the title-block top edge is never crossed |
| DA-5 | unit | `fitsFormat` for A4: 2720 x 1450 cm at 1:100 (272 x 145 mm) fits |
| DA-6 | unit | 2721 x 1450 cm (272.1 mm wide) does not fit A4 |
| DA-7 | unit | 2720 x 1451 cm (145.1 mm high) does not fit A4; 2770 x 1900 cm (old 10 mm margin fit) no longer fits A4 and fits A3 |
| OR-1 | integration | `buildPdf(..., "A3", ...)` page is 420 x 297 mm (landscape A3) |
| OR-2 | integration | wide drawing: page 297 x 210 mm, A4 |
| OR-3 | integration | tall drawing (wall 0..2000 cm, 1:100) on A2: page 594 x 420 mm, never 420 x 594 |
| OR-4 | unit | `placeOnPage` returns `landscape: true` for wide, tall and square bboxes |
| FM-1 | unit | a wall plus a dimension far outside it removes A4 from `availableFormats` while the same wall without the dimension keeps A4 |
| FM-2 | unit | wall 20 m at 1:50 -> `["A2","A1","A0"]` (A3 area 395 mm is less than 400 + padding) |
| FM-3 | unit | a growing drawing: `availableFormats` shrinks monotonically as the wall gets longer (A4 first removed, then A3, ...) |
| FM-4 | unit | wall 28 m at 1:100 (about 290 mm on paper with thickness and padding, over the 272 mm width) -> `availableFormats` starts with A3, which is the default selection |
| FM-5 | unit | drawing 180 x 170 mm on paper (plus padding handled) has no A4, first format is A3 |
| FM-6 | unit | a 100 x 200 mm drawing: A4 absent, A3 present |
| PL-1 | unit | `placeOnPage` bbox 500 cm wide at 1:100: `mmPerCm * 500 === 50` |
| PL-2 | unit | centered in the drawing area (not in the page): bbox 500 x 250 cm at 1:100 on A4: left = 20 + (272 - 50)/2, top = 5 + (145 - 25)/2 |
| PL-3 | unit | centering invariant to coordinate shift (translated bbox gives the same margins to the area edges) |
| PL-4 | integration | the same wall at 1:100 and 1:50: length-label text has identical font size and the same string |
| PL-5 | integration | the drawn wall in the PDF stays inside the drawing area rectangle (check wall outline coordinates from the stream) |

## Boundary Cases

| Case | Input | Expected |
|---|---|---|
| Exact fit, width | 272.0 x 145.0 mm on A4 | A4 available |
| Width exceeded by 0.1 mm | 272.1 x 145.0 mm | A4 absent |
| Height exceeded by 0.1 mm | 272.0 x 145.1 mm | A4 absent |
| Old margin geometry | 277 x 190 mm | A4 absent (the 10 mm margin no longer applies) |
| Square drawing | 150 x 150 mm | A4 absent (145 high), landscape chosen anyway |
| Smallest/largest format | A4 and A0 frame and title block | same absolute sizes |
| Empty drawing | no walls | all formats listed (unchanged), export button logic unchanged |
| Overflow of A0 | wall 60 m at 1:50 | empty list |
| Date padding | January and December | `01.yy`, `12.yy` |
| Year rollover | 2099 / 2100 | `99`, `00` (two-digit year) |
| Name length | "", 1 char, 300 chars | text always inside cell 1 |

## Negative Cases

| Case | Expected behavior |
|---|---|
| Portrait never produced | no page of an exported PDF is portrait, for any drawing proportions |
| Cell 5 stays empty | no text in cell 5 under any input |
| No text in unfilled cells | texts only in cells 1, 6, 13, 25 and the static captions |
| Title block does not scale | no title-block dimension changes with scale or format |
| Frame does not scale with format | offsets 20/5/5/5 on every format |
| Drawing outside frame | no placed point of the drawing bbox outside the area |
| Screen-only elements | existing exclusions (grid, selection, preview) remain: frame/title block add no extra elements the canvas would show |
| Name with forbidden file characters | cell 1 shows the name as given; sanitising stays file-name-only |

## Invariants

- Frame, title block and cell rectangles are independent of drawing scale and drawing content.
- Title block right edge = frame right edge; bottom edge = frame bottom edge; width 185, height 55.
- The cells of the title block do not overlap and all lie inside `{0, 0, 185, 55}`.
- Drawing area is the frame interior above the title block: its bottom = title block top.
- Placed drawing bbox is inside the drawing area for every format and any bbox for which `fitsFormat` is true.
- `availableFormats` is monotone: if a format fits, every larger format fits.
- `fitsFormat` agrees with `placeOnPage` (fits <=> placed bbox within the area).

## Integration Cases

- `buildPdf` of a drawing with walls, a dimension, a doorway, a window and a door: one page, frame and title block
  drawn, drawing inside the area, existing door/window/doorway labels still drawn (existing tests keep their
  expectations except those listed in the conflict table below).
- Drawing a title block does not change the drawing's own scale: a 5 m wall is still 50 mm at 1:100.
- `exportDrawing` passes the drawing name and one `Date` that also forms the file name (checked by observing text
  placement and `pdfFileName` for the same `Date`).

## Existing approved tests that will conflict (test-change-request needed)

These encode the old behavior and must change through a separate test-change-request, not by the implementer:

| Existing test | Why it conflicts |
|---|---|
| `pdf.test.ts` `placeOnPage` "альбом для широкого чертежа, портрет для высокого" | portrait no longer exists |
| `pdf.test.ts` `placeOnPage` "центрирует содержимое в полях…", "центрирование инвариантно к сдвигу координат" | centering is in the drawing area (offsets 20/5), not the page minus 10 mm |
| `pdf.test.ts` `buildPdf` "высокий чертёж даёт портретную страницу формата" | always landscape |
| `pdf.test.ts` `availableFormats` cases near format limits | area is smaller; each needs re-checking (listed A3 case: 20 m at 1:50 stays A2+; others recomputed) |
| `src/doorway/*-pdf.test.ts`, `label-orientation.test.ts` | rely on `buildPdf([W], [], unit, 100, "A4", font, [d])`; the signature stays compatible; these should keep passing, and must be re-run, not edited |

## Mutation Targets

- Frame margins: 20 -> 10/5, 5 -> 10 on any side (FR-1/2 each side separately).
- Title block height 55 -> 50/40; width 185 -> 180; flush to the wrong corner.
- Cell boundaries off by 5 mm in any column or row (TB-5..TB-8 check each rectangle).
- `<=` -> `<` in `fitsFormat` (DA-5) and `>`/`>=` variants (DA-6/7).
- Drawing area uses the page height instead of subtracting the title block (DA-2, DA-7).
- Centering in the page instead of the area (PL-2).
- `landscape` still derived from `dw > dh` (OR-3, OR-4).
- Line width of frame and grid swapped (FR-5, TB-9, TB-10).
- Scale text `1:X` using the format or the wrong scale; date `ММ.ГГ` swapped to `ГГ.ММ`; month not 1-based
  (FL-1, FL-2).
- Text shrinking removed, text drawn outside cell 1 (FL-4).
- Cell 5 filled with the drawing name (FL-3).
- Frame drawn only on the first page / not drawn when the drawing is empty (PG-1, FR-4).

## Superficially correct but broken implementations to catch

- Frame and title block scaled by `mmPerCm` or by format size (looks right on A4 only): TB-3, TB-4, FR-2.
- Hard-coded A4 geometry: caught by A3/A1/A0 variants.
- Title block drawn but the drawing area unchanged (drawing runs under the block): DA-2, DA-4, DA-7.
- Rectangle approximated by four lines with wrong joins: assertions accept either a `re` operator or four
  line segments forming the same rectangle.
- Text drawn at (0,0) or off-cell: FL-6 checks positions inside each cell.

## Out of Scope

- Portrait orientation, several pages, continuation-sheet form, cell 5 content, left-margin graphs (see `TODO.md`).
- Behavior of the format selector and popup wiring in `src/main.ts` (unchanged code path; format list comes from
  `availableFormats`, which is covered).
- Visual appearance (fonts of captions, text size); only positions, containment and line widths are asserted.
- Behavior for an empty drawing name in cell 1 (not specified).
