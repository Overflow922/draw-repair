# Test Suite

Изменения тестов — в существующих файлах change `demolition-plan` (новых файлов нет). Прогон до реализации: `npx vitest run src/demolition src/export` — 12 тестов упали (RN-05, RN-14 ×2, RN-15 ×2, RN-16, RN-17, PG-21 ×2, PG-04, PG-22, PG-23), остальные прошли; после реализации — весь набор зелёный (112 файлов, 2518 тестов).

## Запросы на изменение approved-тестов (TCR)

| ID | Файл | Что изменено |
|---|---|---|
| TCR-1 | `src/demolition/mark-region.test.ts` | удалён блок «скрытие элементов стены» (RG-05 … RG-15) и импорты `Doorway`, `door_`, `window_`, `hiddenElements`, `visibleElements`; остальные тесты `markRegion` не тронуты |
| TCR-2 | `src/demolition/demolition-render.test.ts` | RN-05 «подписи элементов на подложке не рисуются» заменён на «подпись `H=210` рисуется один раз» |
| TCR-3 | `src/export/demolition-pdf.test.ts` | два теста PG-11 (скрытие в `pagesOf`) заменены тремя тестами PG-21: все элементы передаются на страницу демонтажа |
| TCR-4 | `src/export/demolition-pdf.test.ts` | PG-04 «нет подписей элементов» заменён: подписи площади нет, `H=210` есть на обеих страницах |

## Tests (новые и изменённые)

| ID | Test File | Test Name | Initial Result |
|---|---|---|---|
| RN-05 (TCR-2) | src/demolition/demolition-render.test.ts | подпись высоты проёма «H=210» рисуется на подложке один раз; других подписей нет | FAIL |
| RN-14 | src/demolition/demolition-render.test.ts | проём внутри снесённого участка отображается: подпись «H=210» нарисована | FAIL |
| RN-14 | src/demolition/demolition-render.test.ts | проём в целиком снесённой стене отображается | FAIL |
| RN-15 | src/demolition/demolition-render.test.ts | проём, частично пересекающийся с участком, и касающийся участка, отображаются (четыре участка) | FAIL |
| RN-15 | src/demolition/demolition-render.test.ts | проём вне участка тоже отображается | FAIL |
| RN-16 | src/demolition/demolition-render.test.ts | дверь и окно в целиком снесённой стене: полотно, дуга и подписи нарисованы | FAIL |
| RN-17 | src/demolition/demolition-render.test.ts | элементы рисуются поверх области сноса: подпись идёт после закраски бумагой | FAIL |
| RN-18 | src/demolition/demolition-render.test.ts | элементы серые: цвета ink нет, цвет muted есть | PASS (поведение уже есть) |
| RN-19 | src/demolition/demolition-render.test.ts | вырез элемента в стене рисуется и в снесённой зоне | PASS (поведение уже есть) |
| PG-21 (TCR-3) | src/export/demolition-pdf.test.ts | проём, пересекающийся с участком, передаётся на страницу демонтажа так же, как на обмерочную | FAIL |
| PG-21 | src/export/demolition-pdf.test.ts | проём внутри участка и проём, касающийся участка, тоже передаются | FAIL |
| PG-21 | src/export/demolition-pdf.test.ts | проём вне участка остаётся на странице демонтажа | PASS (поведение уже есть) |
| PG-04 (TCR-4) | src/export/demolition-pdf.test.ts | нет подписи площади, подпись «H=210» есть, как на первой | FAIL |
| PG-22 | src/export/demolition-pdf.test.ts | при целиком снесённой стене подпись «H=210» нарисована на странице демонтажа | FAIL |
| PG-23 | src/export/demolition-pdf.test.ts | габариты и форматы страницы демонтажа учитывают элементы (дверь с полотном 140 см исключает A4) | FAIL |

## Revision 1 — по результатам валидации (VERDICT: FAIL, раунд 1)

Реальные пробелы мутаций: позиции и шрифт подписей и толщины штрихов слоя элементов (M09, M13, M14, M15, M17, M20), вырез стены в снесённой зоне (M07), габариты с пометкой на стене с дверью (M24). Добавлены тесты (существующие не менялись):

| ID | Test File | Test Name | Initial Result |
|---|---|---|---|
| RN-20 | src/demolition/demolition-render.test.ts | экранные метрики и метрики PDF: штрихи, закраски и подписи (позиция, шрифт, выравнивание, базовая линия) такие же, как у обмерочного плана | PASS (реализация уже есть) |
| RN-20 | src/demolition/demolition-render.test.ts | подписи элементов не пусты: «H=210», 120 | PASS |
| RN-21 | src/demolition/demolition-render.test.ts | вырез стены по проёму рисуется на подложке (список элементов передан в подложку) | PASS |
| PG-23 | src/export/demolition-pdf.test.ts | пометка на стене с дверью габариты не меняет: полотно двери по-прежнему исключает A4 | PASS |

## Coverage

- Happy: элементы рисуются полностью на подложке и в PDF (RN-05, RN-14, PG-04, PG-22).
- Boundary: проём внутри / частично / касается / вне участка (RN-14, RN-15, PG-21).
- Negative: подписи площади и размеров на странице демонтажа по-прежнему нет (PG-04, RN-01).
- Invariants: все элементы передаются на страницу демонтажа (PG-21); элементы после закраски (RN-17); цвет серый (RN-18).
- Integration: `pagesOf` → `buildPdfPages` → страница 2 (PG-22), габариты (PG-23).

## Unexpected Passes

RN-18, RN-19, PG-21 (проём вне участка): проверяют уже существующее поведение; после реализации остаются зелёными.

## Tests That Could Not Run

Ручные проверки MAN-01 … MAN-03 (вид элементов в браузере и PDF).
