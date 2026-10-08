# Test Suite

Run on 2026-10-08 before any production change. Tests import `./sheet-layout` and call `buildPdf(..., name, date)`,
which do not exist yet, so the three new files fail to load ("Cannot find module './sheet-layout'") and report no
individual results. Initial result for every new test below is therefore **FAIL (suite does not load)**.
The 88 existing test files (1706 tests) still pass, no existing test or production file was touched.

Files added (all under `src/export/`):

- `pdf-ops.test-utils.ts` — helper: parses the uncompressed content stream of a jsPDF page into paths with line
  width (mm, page coordinates, y down), `covers`/`rectEdgesDrawn` checks for axis-aligned segments.
- `sheet-layout.test.ts` — pure geometry and cell content (design D7).
- `sheet-fit.test.ts` — `fitsFormat`, `availableFormats`, `placeOnPage` against the drawing area.
- `sheet-pdf.test.ts` — `buildPdf` / `exportDrawing` output: pages, frame, title block lines, text placement.

## Tests

| ID | Requirement | Test File | Test Name | Initial Result |
|---|---|---|---|---|
| PG-1 | Экспорт — упорядоченный список страниц | sheet-pdf.test.ts | PG-1: экспорт даёт ровно одну страницу; PG-1: одна страница и на большом формате | FAIL (suite does not load) |
| OR-1 | Формат страницы выбирает пользователь | sheet-pdf.test.ts | OR-1: формат A3 — страница 420×297 мм | FAIL (suite does not load) |
| OR-2 | Формат страницы (Автоориентация) | sheet-pdf.test.ts | OR-2: широкий чертёж на A4 — 297×210 мм | FAIL (suite does not load) |
| OR-3 | Формат страницы (Автоориентация, высокий чертёж) | sheet-pdf.test.ts | OR-3: высокий чертёж на A2 — страница 594×420 мм, не портретная | FAIL (suite does not load) |
| OR | Формат страницы (всегда альбомная) | sheet-layout.test.ts | OR: %s — ширина больше высоты, размеры ISO (5 форматов) | FAIL (suite does not load) |
| OR-4 | Формат страницы (всегда альбомная) | sheet-fit.test.ts | OR-4: placeOnPage даёт landscape для широкого, высокого и квадратного чертежа | FAIL (suite does not load) |
| FR-1 | Рамка листа | sheet-layout.test.ts | FR-1: A4 альбомная — x 20, y 5, 272×200 мм | FAIL (suite does not load) |
| FR-2 | Рамка листа | sheet-layout.test.ts | FR-2: %s — отступы 20 слева и 5 с остальных сторон (A3, A2, A1, A0, A4) | FAIL (suite does not load) |
| FR-3 | Рамка листа | sheet-pdf.test.ts | FR-3: рамка на A4 одинакова при масштабах 1:50 и 1:200 | FAIL (suite does not load) |
| FR-4 | Рамка листа | sheet-pdf.test.ts | FR-4/FR-5: %s — прямоугольник рамки нарисован линией 0,8 мм (A4, A3, A1); FR-4: A4 — стороны рамки лежат на x=20, x=292, y=5, y=205 мм; FR-4: толстой линией 0,8 мм нарисованы только рамка и контур основной надписи | FAIL (suite does not load) |
| FR-5 | Рамка листа (толщина) | sheet-pdf.test.ts | FR-5: толщина линии рамки равна 0,8 мм | FAIL (suite does not load) |
| TB-1 | Основная надпись | sheet-layout.test.ts | TB-1: A4 — x 107, y 150, 185×55 мм | FAIL (suite does not load) |
| TB-2 | Основная надпись | sheet-layout.test.ts | TB-2: %s — 185×55, правый и нижний края совпадают с рамкой (5 форматов) | FAIL (suite does not load) |
| TB-3 | Основная надпись | sheet-pdf.test.ts | TB-3: размеры 185×55 мм одинаковы на A4 при 1:100 и на A1 при 1:20, примыкают к рамке | FAIL (suite does not load) |
| TB-4 | Основная надпись | sheet-pdf.test.ts | TB-4: внутренняя сетка (в координатах надписи) на A4 при 1:100 и на A1 при 1:20 одна и та же | FAIL (suite does not load) |
| TB-5 | Основная надпись (сетка граф) | sheet-layout.test.ts | TB-5: графа 1 — x 65–185, y 0–15; TB-5: набор подписей граф — ровно 11 заголовков; TB-5: присутствуют все номерные графы | FAIL (suite does not load) |
| TB-6 | Основная надпись (сетка граф) | sheet-layout.test.ts | TB-6: графы 5, 23 и 9 | FAIL (suite does not load) |
| TB-7 | Основная надпись (сетка граф) | sheet-layout.test.ts | TB-7: блок стадии — графы 6, 24, 25, 7 и 8; TB-7: заголовки «Стадия», «Масса», «Масштаб» | FAIL (suite does not load) |
| TB-8 | Основная надпись (сетка граф) | sheet-layout.test.ts | TB-8: подписная часть — графы 10, 11, 12, 13; TB-8: заголовки «Изм.», «Кол.», «Лист», «№док.», «Подп.», «Дата» | FAIL (suite does not load) |
| TB-9 | Основная надпись (контур 0,8 мм) | sheet-pdf.test.ts | TB-9: %s — контур 185×55 нарисован линией 0,8 мм (A4, A1) | FAIL (suite does not load) |
| TB-10 | Основная надпись (сетка 0,25 мм) | sheet-pdf.test.ts | TB-10: толщина внутренних линий — 0,25 мм; TB-10: A4 — внутренняя линия %s нарисована тонкой линией 0,25 мм (24 линии); TB-10: внутри основной надписи нет толстых линий 0,8 мм | FAIL (suite does not load) |
| TB-inv | Основная надпись (инварианты) | sheet-layout.test.ts | инвариант: номерные графы не пересекаются и лежат внутри 185×55; инвариант: графы правой части вместе с заголовками блока стадии без зазоров покрывают 120×55 | FAIL (suite does not load) |
| FL-1 | Заполнение основной надписи | sheet-layout.test.ts | FL-1: имя, «Р», масштаб и месяц-год экспорта — и ничего больше | FAIL (suite does not load) |
| FL-2 | Заполнение основной надписи | sheet-layout.test.ts | FL-2: масштаб 1:50 пишется как «1:50»; FL-2: дата %s — «%s» (4 даты: 01.27, 12.26, 05.99, 06.00) | FAIL (suite does not load) |
| FL-3 | Заполнение основной надписи (графа 5 пуста) | sheet-layout.test.ts; sheet-pdf.test.ts | FL-3: графа 5 никогда не заполняется; FL-3: заполняются только графы 1, 6, 13, 25; FL-3: в графе 5 нет текста; FL-3: имя чертежа не попадает в графу 5 даже при совпадении с её названием | FAIL (suite does not load) |
| FL-4 | Заполнение основной надписи (длинное имя) | sheet-pdf.test.ts | FL-4: очень длинное имя целиком остаётся в пределах графы 1; FL-4: длинное имя на A1 тоже в пределах графы 1 | FAIL (suite does not load) |
| FL-5 | Заполнение основной надписи (длинное имя) | sheet-pdf.test.ts | FL-5: имя средней длины в пределах графы 1; FL-5: короткое имя не уменьшается — кегль как у обычного имени, длинное не крупнее | FAIL (suite does not load) |
| FL-6 | Заполнение основной надписи (положение текста) | sheet-pdf.test.ts; sheet-layout.test.ts | FL-6: имя, «Р», масштаб и месяц-год стоят каждый в своей графе (A4); FL-6: на A1 при 1:20 надпись заполнена теми же текстами в тех же графах; FL-6: имя передаётся как есть, без санитизации имени файла | FAIL (suite does not load) |
| DA-1 | Область чертежа внутри рамки | sheet-layout.test.ts | DA-1: A4 — x 20, y 5, 272×145 мм | FAIL (suite does not load) |
| DA-2 | Область чертежа внутри рамки | sheet-layout.test.ts | DA-2: %s — ширина W−25, высота H−65, низ области = верх надписи (A3, A2, A1, A0) | FAIL (suite does not load) |
| DA-3 | Область чертежа (чертёж не пересекает рамку) | sheet-fit.test.ts | DA-3: чертёж, равный области, встаёт в левый верхний угол (20; 5) | FAIL (suite does not load) |
| DA-4 | Область чертежа (чертёж не пересекает рамку) | sheet-fit.test.ts | DA-4: высокий чертёж 100×140 мм не заходит на основную надпись и центрирован; инвариант: fitsFormat согласован с размещением | FAIL (suite does not load) |
| DA-5 | Область чертежа (граница области) | sheet-fit.test.ts | DA-5: чертёж ровно 272×145 мм помещается на A4; DA-5: %s — граница включительно (A3, A2, A1, A0) | FAIL (suite does not load) |
| DA-6 | Область чертежа (граница области) | sheet-fit.test.ts | DA-6: шире области на 0,1 мм — A4 не подходит | FAIL (suite does not load) |
| DA-7 | Область чертежа (граница области) | sheet-fit.test.ts | DA-7: выше области на 0,1 мм; DA-7: чертёж 277×190 мм больше не помещается на A4, помещается на A3 | FAIL (suite does not load) |
| FM-1 | Формат страницы (габариты учитывают размеры) | sheet-fit.test.ts | FM-1: размер, вынесенный за габарит, убирает A4 из списка | FAIL (suite does not load) |
| FM-2 | Формат страницы (непомещающиеся убираются) | sheet-fit.test.ts | FM-2: стена 20 м при 1:50 … список A2, A1, A0; переполнение A0 — пустой список | FAIL (suite does not load) |
| FM-3 | Формат страницы (текущий формат стал недоступен) | sheet-fit.test.ts | FM-3: список только сужается по мере роста стены; инвариант: если формат вмещает чертёж, вмещает и каждый больший | FAIL (suite does not load) |
| FM-4 | Формат страницы (дефолтный не вмещает) | sheet-fit.test.ts | FM-4: стена 28 м при 1:100 — первым идёт A3 | FAIL (suite does not load) |
| FM-5 | Формат страницы (основная надпись уменьшает вместимость) | sheet-fit.test.ts | FM-5: чертёж 180×170 мм не помещается на A4 | FAIL (suite does not load) |
| FM-6 | Формат страницы (высокий чертёж по альбомной области) | sheet-fit.test.ts | FM-6: чертёж 100×200 мм: A4 нет, A3 есть; высокая стена 12 м при 1:50 | FAIL (suite does not load) |
| PL-1 | Размещение в масштабе | sheet-fit.test.ts | PL-1: 5 м при 1:100 — ровно 50 мм на листе | FAIL (suite does not load) |
| PL-2 | Размещение в масштабе (центрирование) | sheet-fit.test.ts; sheet-pdf.test.ts | PL-2: чертёж 500×250 см при 1:100 на A4 центрирован в области (и на A3); PL-2: чертёж центрирован в области чертежа, а не на странице | FAIL (suite does not load) |
| PL-3 | Размещение в масштабе (центрирование) | sheet-fit.test.ts | PL-3: центрирование инвариантно к сдвигу координат мира | FAIL (suite does not load) |
| PL-4 | Размещение в масштабе (подписи не масштабируются) | sheet-pdf.test.ts | PL-4: подписи длины — одинаковые строки и кегль при 1:100 и 1:50 | FAIL (suite does not load) |
| PL-5 | Размещение в масштабе (положение в PDF) | sheet-pdf.test.ts | PL-5: стена 5 м … 50 мм и внутри области; PL-5: чертёж на A3 …; PL-5: крупный чертёж 25×12 м … | FAIL (suite does not load) |
| IN-1 | Интеграция (проём + рамка) | sheet-pdf.test.ts | IN-1: чертёж с проёмом — рамка и надпись на месте, подпись «H=210» вне основной надписи | FAIL (suite does not load) |
| IN-3 | Интеграция (exportDrawing) | sheet-pdf.test.ts | IN-3: exportDrawing передаёт имя чертежа и один момент времени и в надпись, и в имя файла | FAIL (suite does not load) |
| BND | Область чертежа (граница не зависит от положения) | sheet-fit.test.ts | граница не зависит от положения чертежа в мировых координатах | FAIL (suite does not load) |

## Coverage

### Happy paths

- One landscape page with frame and title block, correct cell texts, drawing centered in the drawing area.

### Boundary cases

- Fit at exactly 272×145 mm on A4 and the same boundary on A3, A2, A1, A0 (+0.1 mm each axis), scale 1:10 to avoid
  floating-point noise; the old 10 mm margin geometry (277×190 mm); coordinate-shift independence of the boundary.
- Dates: January (zero padded month), December, year 2099 and 2100 (two-digit year).
- Names of length 1, 8, ~50 and 300 characters.

### Negative cases

- No portrait page for tall drawings; tall/near-square drawings checked against the landscape area.
- Cell 5 never filled; texts only in cells 1, 6, 13, 25; no thick (0.8 mm) lines inside the title block; thick
  lines only on the frame and the title block outline.

### Invariants

- Title block flush to the frame's right and bottom edges, 185×55 on every format.
- Numbered cells do not overlap and lie inside the block; right part is fully tiled.
- Larger formats always fit what smaller ones fit; `fitsFormat` agrees with `placeOnPage`.
- Frame and title block geometry independent of scale (A4 1:50 vs 1:200; A4 1:100 vs A1 1:20).

### Integration cases

- `buildPdf` with a doorway (label «H=210» still drawn above the title block).
- `exportDrawing` passes the name and one `Date` to both the title block text and the file name.

## Unexpected Passes

- None: no new test could load before the implementation.

## Tests That Could Not Run

- All new tests (3 files): `Cannot find module './sheet-layout'`; `buildPdf` has no `name`/`date` parameters
  (TS2554 at `sheet-pdf.test.ts:80`). They are discovered once `src/export/sheet-layout.ts` exists.

## Revision 2 (after test-validation VERDICT: FAIL, 2026-10-08)

Changes in the new test files only (no production code, spec, design or existing test touched):

| Validator finding | Change |
|---|---|
| PL-4 fixture had no dimension, so no digit labels | `build(...)` takes `dimensions`; PL-4 now draws a dimension on the wall (`dim("w", 60)`), the `length > 0` guard stays |
| FL-4/FL-5 selected the name by `startsWith("Д")` (matches caption «Дата») | long-name calls selected by `/^Д{5,}[….]*$/` (`longNameCalls`) |
| No PDF-level caption test | new `TB-5: %s — все 11 заголовков граф нарисованы внутри своих граф, и в надписи нет другого текста` (A4 1:100, A1 1:20): each caption inside its cell, and the multiset of texts inside the block equals the 11 captions plus the four contents |
| Stage-block captions «Лист»/«Листов» not asserted | `sheet-layout.test.ts` new test `TB-7: заголовки «Лист» (x 135–155) и «Листов» (x 155–185) — строка y 35–40 блока стадии` |
| Outline extent not exact (`covers` accepts overshoot, FR-4 used OR) | new `TB-9/FR-4: %s — толстые линии 0,8 мм лежат только на рамке и контуре надписи, габарит — ровно рамка` (A4, A1): every 0.8 mm segment lies fully on a frame edge or on the block's left/top edge; bbox of thick segments equals `frameRect`; the old OR-heuristic test is removed |
| Exact set of inner grid lines not asserted | `INNER` is now the full merged list of 22 lines (adds `h y=5, 10, 25, 30, 45, 50`, `v x=150 [15,35]`, y=20/35 split into left and stage-block parts); new `TB-10: %s — внутренняя сетка состоит ровно из ожидаемых линий` (A4, A1) compares the merged set; TB-4 compares the merged sets for A4 1:100 and A1 1:20 |
| Stray thin stubs / lines sticking out of the block | new `TB-10: %s — тонкие горизонтальные и вертикальные линии у надписи не выходят за её границы` (axis-aligned 0.25 mm segments within 1 mm of the block must lie inside it; diagonal hatch is excluded because the stream does not apply the clip) |

Initial result of every added or changed test is unchanged: FAIL (suite does not load, `./sheet-layout` missing).
Full-suite run after the changes: 88 existing files / 1706 tests pass; the 3 new files fail to load. One earlier
run showed 87 passing files, which was the known intermittent worker crash (see `TODO.md`), not reproducible.

The existing-test change-request list from the validator (four `pdf.test.ts` tests) is unchanged and still open.

## Notes for the validator

- Not covered by an executable test (judged out of reach without the implementation or not observable):
  the plan's "frame drawn when the drawing is empty" (export of an empty drawing is disabled by another
  requirement) and "Screen-only elements" (unchanged behavior, covered by existing tests).
- `PL-5` measures the drawing by the 0.6 mm wall contour lines (`PDF_METRICS.contourPx`): hatch lines in the stream
  are not clipped in the parser and run outside the wall, the frame and the grid use 0.8 / 0.25 mm.
- Text containment checks approximate glyph height (alphabetic baseline: 0.75 em above, 0.25 em below) and use
  `getTextWidth` at call time; tolerance 0.05 mm.
- Existing approved tests that will conflict with the new behavior and need a test-change-request (not edited by
  the Test Writer): `pdf.test.ts` — `placeOnPage` "альбом для широкого чертежа, портрет для высокого",
  "центрирует содержимое в полях…", "центрирование инвариантно к сдвигу координат"; `buildPdf`
  "высокий чертёж даёт портретную страницу формата"; some `availableFormats` expectations may need re-checking.
- Ambiguities settled by the test author and to be checked by the validator against the spec: the date goes to
  cell 13 first row (x 55–65, y 20–25); header cells carry `label` and the ids `"7"`/`"8"` are the number cells at
  y 35–40; inner vertical lines at x = 10 and 30 exist only in rows 0–20 of the signature part.
- Reference-implementation validation (project memory: validate against the full suite) is still required: the
  validator should implement `sheet-layout` in a scratch copy and run the new tests together with the whole existing
  suite.
