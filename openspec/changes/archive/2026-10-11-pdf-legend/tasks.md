> Ревизия 2 (2026-10-11, референс `img_1.png`): из легенды убраны проём, дверь, окно; положение — отступ слева, крупные образцы 2:1 и шаг, перенос длинных подписей (spec «Легенда на странице PDF», design D1, D4, D6, D7). Задачи ревизии — группа 0; прежние задачи, на которые она влияет, снова открыты. Перед группой 0 нужно переписать тесты (`test-suite.md`) и пройти повторную валидацию (`test-validation.md`): текущие тесты и отчёт описывают прежнюю легенду.

## 0. Ревизия 2: тесты и повторная валидация

- [x] 0.1 Обновить тесты `legend.test.ts`, `legend-pdf.test.ts`, `legend-area.test.ts` по `test-plan.md` (LG-3, LG-9, LG-11, LG-14, LG-15); обновить `test-suite.md`
- [x] 0.2 Повторная независимая валидация тестов; `test-validation.md` должен закончиться `VERDICT: PASS`
- [x] 0.3 Тесты старых файлов, ссылающиеся на ширину колонки (`pdf-pages`, `sheet-pdf`, `demolition-pdf`, `mounting-pdf`, `demolition-dimensions-pdf`), считают её через `legendWidthMm` и новых правок не требуют; убедиться полным прогоном

## 1. Состав легенды и ширина колонки

- [x] 1.1 `src/export/legend.ts`: `LegendEntry` — материал / снос с `label`; `legendEntries(page)` — материалы по каталогу, затем «Демонтируемая стена»; элементы стены записей не дают (spec «Легенда на странице PDF»; design D1; тесты `legend.test.ts` LG-1…LG-9)
- [x] 1.2 В `legend.ts`: константы раскладки (design D6), `wrapLabel(label)` по пробелам с предельной шириной 28 мм (design D7) и `legendWidthMm(pages)`: 0 без стен, иначе по самой широкой строке после переноса среди всех страниц (spec «общая ширина колонки»; design D2; `legend.test.ts` LG-8, LG-9, LG-15, `legend-area.test.ts` FM-4)

## 2. Область чертежа и вместимость форматов

- [x] 2.1 `src/export/sheet-layout.ts`: `drawingArea(format, legendMm = 0)` и `legendArea(format, legendMm)` (spec MODIFIED «Область чертежа внутри рамки»; design D3; `legend-area.test.ts` AR-1…AR-6)
- [x] 2.2 `src/export/pdf.ts`: пробросить `legendMm` через `fitsFormat`, `placeOnPage`, `pageFormats`, `availableFormatsForPages`, `drawPage`; ширину считать один раз на документ (spec MODIFIED «Формат страницы выбирает пользователь»; `legend-area.test.ts` FM-1…FM-4)

## 3. Отрисовка легенды

- [x] 3.1 `src/render.ts`: `drawLegendSample` — только образец материала (контур и штриховка стены 16×8 мм); убрать образцы проёма, двери, окна и параметр `labels` у `drawDoorways`; `drawScene` и `drawDemolitionScene` не менять (design D4; `legend-pdf.test.ts`)
- [x] 3.2 `src/export/legend-draw.ts`: образец слева с отступом 8 мм, подпись справа в несколько строк с переносом, блок строк по центру образца, шаг записей 14 мм (не меньше блока), цвета по виду страницы, образец «Демонтируемая стена» 16×8 мм (design D5, D6, D7; `legend-pdf.test.ts` LG-10…LG-15)
- [x] 3.3 В `drawPage` вызывать `drawLegend` после `drawSheet`; на странице без стен легенды нет (spec «Легенда на странице PDF»)

## 4. Конфликтующие существующие тесты

- [x] 4.1 20 существующих тестов переведены на колонку легенды по `test-change-request.md` (TCR-4), правки провалидированы (`test-change-validation.md`: PASS)

## 5. Проверка

- [x] 5.1 Прогнать `legend.test.ts`, `legend-area.test.ts`, `legend-pdf.test.ts` — все зелёные
- [x] 5.2 Полный набор тестов зелёный; тесты счёта вызовов `drawScene` зелёные
- [x] 5.3 Форматтер, линтер и `tsc` без ошибок
- [x] 5.4 Мутанты валидатора (`test-validation.md`) против настоящей реализации; выжившие — только низкой важности
- [x] 5.5 LG-13 диффом и `grep`: `legend*` импортируется только из `src/export/pdf.ts`; `drawLegendSample` используется только PDF-легендой; в `main.ts` и `index.html` нет управления легендой; `drawDoorways` без изменений относительно HEAD
- [x] 5.6 `openspec validate pdf-legend`, затем `/opsx:verify`; ручная проверка выгруженного PDF (отступ, перенос «Демонтируемая стена», нет проёма/двери/окна)
- [x] 5.7 Обновить `TODO.md` (остатки легенды: LG-13 без автотеста, выжившие мутанты, курсив подписи)
