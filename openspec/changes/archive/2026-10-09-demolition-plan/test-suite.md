# Test Suite

Тесты написаны по `test-plan.md` до реализации. Продакшен-код, спецификации и `design.md` не менялись. Первый прогон: `npx vitest run src/plans.test.ts src/plan-tools.test.ts src/demolition src/export/pdf-pages.test.ts src/export/demolition-pdf.test.ts`.

Итог первого прогона: все новые файлы падают — одни целиком на `Cannot find module` (модули `src/demolition/*` ещё нет), другие по отсутствующим экспортам (`toolsOf`, `recordMarks`, `pagesOf` с двумя страницами и т. п.); тесты, проверяющие уже существующее поведение (формат хранилища и истории, каталог и `historyKey` прежней версии), проходят — см. «Unexpected Passes».

## Запросы на изменение approved-тестов (TCR)

Выполнены ровно те две правки, что разрешены `test-plan.md`; других правок существующих тестов нет.

| ID | Файл | Что изменено |
|---|---|---|
| TCR-1 | `src/plans.test.ts` | PL-01: ожидание каталога — два плана `measure` и `demolition` (было: единственный `measure`); помечено комментарием |
| TCR-2 | `src/export/pdf-pages.test.ts` | три теста `pagesOf` (PG-01): страниц по числу планов каталога (две), первая страница равна прежнему ожиданию; помечено комментарием |

## Новые тестовые утилиты

- `src/demolition/demolition.test-utils.ts` — сцены, `mk`, `idGen`, `deepFreeze`, габариты и площадь полигонов.
- `src/export/pdf-colors.test-utils.ts` — разбор цвета и толщины штрихов страницы jsPDF (`RG`/`G`), сегменты.

## Tests

ID теста — префикс названия (`PT`, `DM`, `RG`, `ND`, `NU`, `FL`, `ST`, `HI`, `RN`, `PG`, `TL`); соответствие требованиям — в `test-plan.md` («Requirements Coverage»); дополнительные номера, которых нет в плане (например, `DM-20 … DM-31`, `NU-12`, `TL-21`), уточняют те же сценарии граничными и негативными случаями. Параметризованные тесты (`it.each`) перечислены одной строкой с шаблонным названием.

| ID | Test File | Test Name | Initial Result |
|---|---|---|---|
| PT-02 | src/plan-tools.test.ts | обмерочный план — «Стена», «Проём», «Дверь», «Окно», «Размер», «Линейка», «Ластик» | FAIL |
| PT-02 | src/plan-tools.test.ts | план «Демонтаж» — только «Демонтаж» и «Линейка» | FAIL |
| PT-02 | src/plan-tools.test.ts | инструменты планов пересекаются только по «Линейке» | FAIL |
| PT-02 | src/plan-tools.test.ts | в наборе плана «Демонтаж» нет инструментов правки стен | FAIL |
| PT-02 | src/plan-tools.test.ts | в наборе обмерочного плана нет инструмента «Демонтаж» | FAIL |
| PT-02 | src/plan-tools.test.ts | набор без дублей и непуст у каждого плана каталога | FAIL |
| PT-03 | src/plan-tools.test.ts | «Стена» на обмерочном плане, «Демонтаж» на плане «Демонтаж» | FAIL |
| PT-03 | src/plan-tools.test.ts | инструмент по умолчанию входит в набор своего плана | FAIL |
| PT-01 | src/plan-tools.test.ts | каталог — «Обмерочный план», затем «Демонтаж» | FAIL |
| PT-04 | src/plan-tools.test.ts | isPlanId принимает demolition | FAIL |
| PT-04 | src/plan-tools.test.ts | activePlanOf читает сохранённый demolition; план по умолчанию остаётся measure | FAIL |
| PT-04 | src/plan-tools.test.ts | ключ истории плана «Демонтаж» — «<id>:demolition», обмерочного — «<id>» | PASS (поведение уже есть) |
| PT-04 | src/plan-tools.test.ts | ключи всех планов одного чертежа различны | PASS (поведение уже есть) |
| DM-26 | src/demolition/marks.test.ts | привязка a — границы от конца a без изменений | FAIL (модуль не найден) |
| DM-26 | src/demolition/marks.test.ts | привязка b — границы пересчитаны от конца a: [len − to, len − from] | FAIL (модуль не найден) |
| DM-26 | src/demolition/marks.test.ts | span не обрезает участок по стене | FAIL (модуль не найден) |
| DM-27 | src/demolition/marks.test.ts | стена из материала %s сносится | FAIL (модуль не найден) |
| DM-27 | src/demolition/marks.test.ts | железобетон не сносится | FAIL (модуль не найден) |
| DM-27 | src/demolition/marks.test.ts | вырожденная стена не сносится | FAIL (модуль не найден) |
| DM-01 | src/demolition/marks.test.ts | целая стена — участок от 0 до длины, одна пометка с новым идентификатором | FAIL (модуль не найден) |
| DM-02 | src/demolition/marks.test.ts | участок 300–450 — привязка b, from 50, to 200 | FAIL (модуль не найден) |
| DM-03 | src/demolition/marks.test.ts | середина участка ровно в середине стены — привязка a | FAIL (модуль не найден) |
| DM-04 | src/demolition/marks.test.ts | середина левее середины стены — a (0–240); правее — b (260–500 → b 0…240) | FAIL (модуль не найден) |
| DM-20 | src/demolition/marks.test.ts | участок за концом стены обрезается: 400–700 → 400–500 | FAIL (модуль не найден) |
| DM-20 | src/demolition/marks.test.ts | участок до начала стены обрезается: −50–120 → 0–120 | FAIL (модуль не найден) |
| DM-19 | src/demolition/marks.test.ts | ширина ровно 1 см принимается, 0,5 см — нет | FAIL (модуль не найден) |
| DM-19 | src/demolition/marks.test.ts | участок, обрезанный до ширины < 1 см, отклоняется | FAIL (модуль не найден) |
| DM-19 | src/demolition/marks.test.ts | не конечные границы отклоняются | FAIL (модуль не найден) |
| DM-01 | src/demolition/marks.test.ts | идентификатор по умолчанию уникален и непуст | FAIL (модуль не найден) |
| DM-01 | src/demolition/marks.test.ts | новая пометка добавляется в конец списка, существующие не меняются | FAIL (модуль не найден) |
| DM-06 | src/demolition/marks.test.ts | железобетон не помечается — возвращается тот же массив | FAIL (модуль не найден) |
| DM-18 | src/demolition/marks.test.ts | отсутствующая стена — тот же массив | FAIL (модуль не найден) |
| DM-18 | src/demolition/marks.test.ts | вырожденная стена — тот же массив | FAIL (модуль не найден) |
| DM-17 | src/demolition/marks.test.ts | пустые стены и пометки — тот же пустой массив | FAIL (модуль не найден) |
| DM-13 | src/demolition/marks.test.ts | пересечение 100–200 и 150–300 даёт один участок 100–300 с прежним идентификатором | FAIL (модуль не найден) |
| DM-14 | src/demolition/marks.test.ts | соприкосновение 100–200 и 200–300 даёт один участок 100–300 | FAIL (модуль не найден) |
| DM-14 | src/demolition/marks.test.ts | зазор 0,005 см (в пределах допуска 0,01) сливается | FAIL (модуль не найден) |
| DM-15 | src/demolition/marks.test.ts | участки 100–200 и 250–300 остаются отдельными, порядок: старый, новый | FAIL (модуль не найден) |
| DM-15 | src/demolition/marks.test.ts | зазор 0,02 см (больше допуска) не сливается | FAIL (модуль не найден) |
| DM-16 | src/demolition/marks.test.ts | вся стена поглощает участки 100–200 и 250–300 — остаётся одна пометка 0–500, идентификатор первой | FAIL (модуль не найден) |
| DM-16 | src/demolition/marks.test.ts | новый участок, соединяющий два существующих, сливает все три | FAIL (модуль не найден) |
| DM-16 | src/demolition/marks.test.ts | пометка b-привязки учитывается в слиянии (span от конца a) | FAIL (модуль не найден) |
| DM-22 | src/demolition/marks.test.ts | идемпотентность — участок уже целиком внутри существующей пометки не меняет список | FAIL (модуль не найден) |
| DM-23 | src/demolition/marks.test.ts | пометки другой стены не сливаются с пересекающимися числами | FAIL (модуль не найден) |
| DM-23 | src/demolition/marks.test.ts | слияние учитывает только свою стену при нескольких пометках в списке | FAIL (модуль не найден) |
| DM-05 | src/demolition/marks.test.ts | входные массивы и объекты не мутируются | FAIL (модуль не найден) |
| DM-24 | src/demolition/marks.test.ts | после серии пометок участки одной стены не пересекаются и не соприкасаются | FAIL (модуль не найден) |
| DM-24 | src/demolition/marks.test.ts | нормализованный якорь — ближний к середине участка конец | FAIL (модуль не найден) |
| DM-25 | src/demolition/marks.test.ts | удаляет пометку по идентификатору, остальные в прежнем порядке | FAIL (модуль не найден) |
| DM-25 | src/demolition/marks.test.ts | неизвестный идентификатор — тот же массив | FAIL (модуль не найден) |
| DM-25 | src/demolition/marks.test.ts | входной массив не мутируется | FAIL (модуль не найден) |
| DM-28 | src/demolition/marks.test.ts | сливает пересекающиеся пометки одной стены, прочие не трогает | FAIL (модуль не найден) |
| DM-28 | src/demolition/marks.test.ts | соприкасающиеся сливаются | FAIL (модуль не найден) |
| DM-28 | src/demolition/marks.test.ts | пометки на железобетоне сливаются так же (они хранятся) | FAIL (модуль не найден) |
| DM-28 | src/demolition/marks.test.ts | пометки на отсутствующие стены остаются без изменений и в прежнем порядке | FAIL (модуль не найден) |
| DM-28 | src/demolition/marks.test.ts | без пересечений — тот же массив | FAIL (модуль не найден) |
| DM-28 | src/demolition/marks.test.ts | вход не мутируется | FAIL (модуль не найден) |
| DM-29 | src/demolition/marks.test.ts | участок a-привязки — from/to от конца a, ссылка на пометку и стену | FAIL (модуль не найден) |
| DM-29 | src/demolition/marks.test.ts | участок b-привязки пересчитан от конца a | FAIL (модуль не найден) |
| DM-07 | src/demolition/marks.test.ts | пометка на железобетонной стене не действует, список не меняется | FAIL (модуль не найден) |
| DM-08 | src/demolition/marks.test.ts | после возврата материала пометка снова действует с прежним участком | FAIL (модуль не найден) |
| DM-09 | src/demolition/marks.test.ts | стены нет — пометка не действует; стена вернулась — действует | FAIL (модуль не найден) |
| DM-10 | src/demolition/marks.test.ts | стена укорочена до 300 — участок 100–450 действует как 100–300 | FAIL (модуль не найден) |
| DM-11 | src/demolition/marks.test.ts | участок целиком за концом укороченной стены не действует | FAIL (модуль не найден) |
| DM-12 | src/demolition/marks.test.ts | после обрезки ширина 0,005 см не действует, 0,02 см действует | FAIL (модуль не найден) |
| DM-12 | src/demolition/marks.test.ts | участок нулевой ширины в хранилище не действует | FAIL (модуль не найден) |
| DM-29 | src/demolition/marks.test.ts | порядок списка сохраняется, у стены несколько пометок | FAIL (модуль не найден) |
| DM-29 | src/demolition/marks.test.ts | недействующие пометки пропускаются, действующие остаются | FAIL (модуль не найден) |
| DM-17 | src/demolition/marks.test.ts | пустые списки | FAIL (модуль не найден) |
| DM-05 | src/demolition/marks.test.ts | вход не мутируется | FAIL (модуль не найден) |
| DM-30 | src/demolition/marks.test.ts | инвариант — эквивалентные записи a и b дают один и тот же участок | FAIL (модуль не найден) |
| DM-31 | src/demolition/marks.test.ts | точка в области сноса возвращает пометку | FAIL (модуль не найден) |
| DM-31 | src/demolition/marks.test.ts | точка на стене вне участка — нет пометки | FAIL (модуль не найден) |
| DM-31 | src/demolition/marks.test.ts | точка вне стены — нет пометки | FAIL (модуль не найден) |
| DM-31 | src/demolition/marks.test.ts | пустой список — нет пометки | FAIL (модуль не найден) |
| RG-01 | src/demolition/mark-region.test.ts | целая стена — область совпадает с формой стены: прямоугольник 500×20, площадь 10000 | FAIL (модуль не найден) |
| RG-02 | src/demolition/mark-region.test.ts | участок 100–190 — полоса x от 100 до 190 на всю толщину (y от −10 до 10), площадь 1800 | FAIL (модуль не найден) |
| RG-04 | src/demolition/mark-region.test.ts | запись с привязкой b даёт ту же область, что эквивалентная запись с привязкой a | FAIL (модуль не найден) |
| RG-03 | src/demolition/mark-region.test.ts | участок с from = 0 не обрезается по началу: левый край — левый край формы стены | FAIL (модуль не найден) |
| RG-03 | src/demolition/mark-region.test.ts | участок с to = длина не обрезается по концу: правый край — правый край формы | FAIL (модуль не найден) |
| RG-03 | src/demolition/mark-region.test.ts | to = len − 0,02 см (дальше допуска от конца) обрезается по плоскости | FAIL (модуль не найден) |
| RG-03 | src/demolition/mark-region.test.ts | to = len − 0,005 см (в пределах допуска) не обрезает торцевую часть | FAIL (модуль не найден) |
| RG-03 | src/demolition/mark-region.test.ts | from = 0,005 см не обрезает по началу, from = 0,02 см обрезает | FAIL (модуль не найден) |
| RG-05 | src/demolition/mark-region.test.ts | область не содержит пустых полигонов | FAIL (модуль не найден) |
| RG-05 | src/demolition/mark-region.test.ts | вход не мутируется | FAIL (модуль не найден) |
| RG-06 | src/demolition/mark-region.test.ts | целая стена в углу — область равна форме стены с учётом угла | FAIL (модуль не найден) |
| RG-06 | src/demolition/mark-region.test.ts | участок у угла (from = 0) сохраняет угловую часть формы, участок вдали — нет | FAIL (модуль не найден) |
| RG-05 | src/demolition/mark-region.test.ts | проём между откосами 200–290 внутри участка 100–400 скрыт | FAIL (модуль не найден) |
| RG-06 | src/demolition/mark-region.test.ts | проём, частично пересекающийся с участком 250–400, скрыт целиком | FAIL (модуль не найден) |
| RG-07 | src/demolition/mark-region.test.ts | проём, касающийся участка в точке (290–400 и 100–200), остаётся | FAIL (модуль не найден) |
| RG-08 | src/demolition/mark-region.test.ts | перекрытие 0,005 см (в пределах допуска) не скрывает, 0,02 см скрывает | FAIL (модуль не найден) |
| RG-09 | src/demolition/mark-region.test.ts | участок, не доходящий до проёма, его не скрывает | FAIL (модуль не найден) |
| RG-10 | src/demolition/mark-region.test.ts | элемент с привязкой b и теми же откосами скрыт так же | FAIL (модуль не найден) |
| RG-11 | src/demolition/mark-region.test.ts | окно и дверь скрываются по тому же правилу | FAIL (модуль не найден) |
| RG-12 | src/demolition/mark-region.test.ts | элемент другой стены не скрывается чужой пометкой с теми же числами | FAIL (модуль не найден) |
| RG-12 | src/demolition/mark-region.test.ts | пометка на железобетонной стене не действует, элементы остаются | FAIL (модуль не найден) |
| RG-13 | src/demolition/mark-region.test.ts | скрытые и видимые вместе дают все элементы без пересечений, порядок сохраняется | FAIL (модуль не найден) |
| RG-14 | src/demolition/mark-region.test.ts | пустые списки | FAIL (модуль не найден) |
| RG-14 | src/demolition/mark-region.test.ts | вход не мутируется | FAIL (модуль не найден) |
| RG-15 | src/demolition/mark-region.test.ts | несколько участков одной стены — элемент скрыт любым из них | FAIL (модуль не найден) |
| ND-01 | src/demolition/mark-snap.test.ts | свободная стена без элементов — только концы 0 и длина | FAIL (модуль не найден) |
| ND-02 | src/demolition/mark-snap.test.ts | откосы проёма добавляют узлы 200 и 290 | FAIL (модуль не найден) |
| ND-02 | src/demolition/mark-snap.test.ts | откосы окна и двери, привязка b — те же координаты от конца a | FAIL (модуль не найден) |
| ND-02 | src/demolition/mark-snap.test.ts | элементы других стен не добавляют узлов | FAIL (модуль не найден) |
| ND-03 | src/demolition/mark-snap.test.ts | примыкающая перпендикулярная стена шириной 20 с осью x = 300 даёт узлы 290 и 310 | FAIL (модуль не найден) |
| ND-03 | src/demolition/mark-snap.test.ts | пересекающая стена (сквозная) даёт те же узлы 290 и 310 | FAIL (модуль не найден) |
| ND-03 | src/demolition/mark-snap.test.ts | стена, не касающаяся W, узлов не даёт | FAIL (модуль не найден) |
| ND-09 | src/demolition/mark-snap.test.ts | узлы за пределами [0, длина] не попадают в результат | FAIL (модуль не найден) |
| ND-08 | src/demolition/mark-snap.test.ts | результат упорядочен по возрастанию и без дублей: откос в конце стены совпадает с концом | FAIL (модуль не найден) |
| ND-08 | src/demolition/mark-snap.test.ts | узлы разных источников в пределах 0,01 см сливаются в один | FAIL (модуль не найден) |
| ND-10 | src/demolition/mark-snap.test.ts | вход не мутируется | FAIL (модуль не найден) |
| ND-11 | src/demolition/mark-snap.test.ts | наклонная стена — узлы считаются вдоль её оси | FAIL (модуль не найден) |
| ND-04 | src/demolition/mark-snap.test.ts | нет узла в радиусе — округление до целого сантиметра | FAIL (модуль не найден) |
| ND-01 | src/demolition/mark-snap.test.ts | привязка к концу стены: 497 при радиусе 6 → 500 | FAIL (модуль не найден) |
| ND-02 | src/demolition/mark-snap.test.ts | привязка к откосу: 288 при радиусе 6 → 290 | FAIL (модуль не найден) |
| ND-05 | src/demolition/mark-snap.test.ts | расстояние ровно радиус — привязка; чуть больше — округление | FAIL (модуль не найден) |
| ND-05 | src/demolition/mark-snap.test.ts | радиус 0 — привязка только к узлу точно в точке | FAIL (модуль не найден) |
| ND-06 | src/demolition/mark-snap.test.ts | проекция за концами зажимается в [0, длина] | FAIL (модуль не найден) |
| ND-07 | src/demolition/mark-snap.test.ts | из двух узлов в радиусе выбирается ближайший | FAIL (модуль не найден) |
| ND-07 | src/demolition/mark-snap.test.ts | привязанная граница имеет ровно координату узла (без округления узла) | FAIL (модуль не найден) |
| ND-07 | src/demolition/mark-snap.test.ts | пустой список узлов — округление | FAIL (модуль не найден) |
| NU-12 | src/demolition/mark-numbers.test.ts | числа участка 100–190 стены 500: отступ от a 100, ширина 90, отступ до b 310 | FAIL (модуль не найден) |
| NU-12 | src/demolition/mark-numbers.test.ts | запись с привязкой b даёт те же числа (a-координаты 360–450) | FAIL (модуль не найден) |
| NU-12 | src/demolition/mark-numbers.test.ts | сумма трёх чисел равна длине стены | FAIL (модуль не найден) |
| NU-12 | src/demolition/mark-numbers.test.ts | целая стена — отступы 0 | FAIL (модуль не найден) |
| NU-01 | src/demolition/mark-numbers.test.ts | расстояние от a = 150 сдвигает участок с сохранением ширины: 150–240 | FAIL (модуль не найден) |
| NU-02 | src/demolition/mark-numbers.test.ts | расстояние до b = 50 сдвигает участок: 360–450 (привязка b, 50…140) | FAIL (модуль не найден) |
| NU-03 | src/demolition/mark-numbers.test.ts | ширина 200 сохраняет начало: 100–300 | FAIL (модуль не найден) |
| NU-04 | src/demolition/mark-numbers.test.ts | ширина 900 принимается как наибольшая допустимая: 100–500 (привязка b, 0…400) | FAIL (модуль не найден) |
| NU-05 | src/demolition/mark-numbers.test.ts | расстояние от a = 900 принимается как наибольшее допустимое: 410–500 | FAIL (модуль не найден) |
| NU-05 | src/demolition/mark-numbers.test.ts | расстояние до b = 900 принимается как наибольшее допустимое: 0–90 | FAIL (модуль не найден) |
| NU-05 | src/demolition/mark-numbers.test.ts | граничные допустимые: gapA = 0 → 0–90; gapA = L − W = 410 → 410–500 | FAIL (модуль не найден) |
| NU-05 | src/demolition/mark-numbers.test.ts | граничная ширина — ровно L − from принимается без зажима | FAIL (модуль не найден) |
| NU-03 | src/demolition/mark-numbers.test.ts | ширина ровно 1 см принимается: 100–101 | FAIL (модуль не найден) |
| NU-01 | src/demolition/mark-numbers.test.ts | правка не меняет другие пометки списка | FAIL (модуль не найден) |
| NU-06 | src/demolition/mark-numbers.test.ts | %s → null | FAIL (модуль не найден) |
| NU-06 | src/demolition/mark-numbers.test.ts | неизвестный идентификатор → null | FAIL (модуль не найден) |
| NU-06 | src/demolition/mark-numbers.test.ts | пометка на железобетонной стене (не действует) → null | FAIL (модуль не найден) |
| NU-06 | src/demolition/mark-numbers.test.ts | пометка на отсутствующую стену → null | FAIL (модуль не найден) |
| NU-06 | src/demolition/mark-numbers.test.ts | вход не мутируется ни при успехе, ни при отказе | FAIL (модуль не найден) |
| NU-07 | src/demolition/mark-numbers.test.ts | ширина первого становится 200 и перекрывает второй — остаётся один участок 100–300, идентификатор m | FAIL (модуль не найден) |
| NU-07 | src/demolition/mark-numbers.test.ts | сдвиг влево на соседа: слитая пометка (id — первой слитой по порядку списка) присутствует в результате под возвращённым id | FAIL (модуль не найден) |
| NU-07 | src/demolition/mark-numbers.test.ts | правка, не вызывающая пересечения, не сливает: остаётся два участка | FAIL (модуль не найден) |
| NU-07 | src/demolition/mark-numbers.test.ts | касание после правки сливает: 100–200 и 200–300 | FAIL (модуль не найден) |
| NU-07 | src/demolition/mark-numbers.test.ts | пометки других стен не затрагиваются | FAIL (модуль не найден) |
| NU-09 | src/demolition/mark-numbers.test.ts | три числа в порядке gapA, width, gapB с текстом в сантиметрах | FAIL (модуль не найден) |
| NU-08 | src/demolition/mark-numbers.test.ts | текст — в текущей единице: м (запятая) и мм | FAIL (модуль не найден) |
| NU-09 | src/demolition/mark-numbers.test.ts | центры — середины отрезков [0,100], [100,190], [190,500] на стороне нормали (y > 0) с подъёмом над линией | FAIL (модуль не найден) |
| NU-09 | src/demolition/mark-numbers.test.ts | размеры прямоугольника числа: ширина — длина текста × кегль × CHAR_WIDTH / k, высота — кегль / k | FAIL (модуль не найден) |
| NU-10 | src/demolition/mark-numbers.test.ts | стена вдоль оси y (a=(0,0), b=(0,500)): сторона нормали (−1, 0), числа левее стены | FAIL (модуль не найден) |
| NU-10 | src/demolition/mark-numbers.test.ts | текст направлен слева направо (dir.x ≥ 0) у стены, идущей справа налево | FAIL (модуль не найден) |
| NU-11 | src/demolition/mark-numbers.test.ts | нулевой отступ — число над точкой: dir = (1, 0), подъём половина кегля, текст «0» | FAIL (модуль не найден) |
| NU-13 | src/demolition/mark-numbers.test.ts | невыделенная пометка — подпись только ширины, совпадающая с числом width из раскладки | FAIL (модуль не найден) |
| NU-09 | src/demolition/mark-numbers.test.ts | вход не мутируется | FAIL (модуль не найден) |
| NU-10 | src/demolition/mark-numbers.test.ts | точка в центре попадает | FAIL (модуль не найден) |
| NU-10 | src/demolition/mark-numbers.test.ts | точка в пределах прямоугольника с допуском попадает, за допуском — нет | FAIL (модуль не найден) |
| NU-10 | src/demolition/mark-numbers.test.ts | из двух накладывающихся выбирается число с ближайшим центром | FAIL (модуль не найден) |
| NU-10 | src/demolition/mark-numbers.test.ts | пустой список — null | FAIL (модуль не найден) |
| NU-10 | src/demolition/mark-numbers.test.ts | прямоугольник учитывает направление текста (повёрнутый вдоль y) | FAIL (модуль не найден) |
| FL-01 | src/demolition/mark-follow.test.ts | перемещение стены на (0, 100) переносит участок: область x 100–190, y 90–110 | FAIL (модуль не найден) |
| FL-02 | src/demolition/mark-follow.test.ts | перемещение конца привязки a с (0,0) в (−50,0) смещает участок вместе с ним: x 50–140 | FAIL (модуль не найден) |
| FL-03 | src/demolition/mark-follow.test.ts | перемещение второго конца b с (500,0) в (600,0) не смещает участок: x 100–190 | FAIL (модуль не найден) |
| FL-03 | src/demolition/mark-follow.test.ts | участок с привязкой b следует за концом b и не следует за концом a | FAIL (модуль не найден) |
| FL-04 | src/demolition/mark-follow.test.ts | удлинение у конца a до (−400,0): пометка привязки a 100–190 → привязка b, from 310, to 400; область прежняя x 100–190 | FAIL (модуль не найден) |
| FL-04 | src/demolition/mark-follow.test.ts | пометка, уже привязанная к неподвижному концу b, не меняется | FAIL (модуль не найден) |
| FL-05 | src/demolition/mark-follow.test.ts | удлинение у конца b до (900,0): пометка привязки a остаётся, область прежняя | FAIL (модуль не найден) |
| FL-05 | src/demolition/mark-follow.test.ts | у конца b пометка привязки b переходит на a: 50…140 (360–450) → a 360…450; область прежняя | FAIL (модуль не найден) |
| FL-06 | src/demolition/mark-follow.test.ts | пометки других стен и пометки на отсутствующие стены не меняются, порядок сохраняется | FAIL (модуль не найден) |
| FL-06 | src/demolition/mark-follow.test.ts | несколько пометок одной стены переносятся все | FAIL (модуль не найден) |
| FL-07 | src/demolition/mark-follow.test.ts | стены без изменений — пометки без изменений (тот же массив допустим) | FAIL (модуль не найден) |
| FL-07 | src/demolition/mark-follow.test.ts | изменились обе вершины — пометки без изменений | FAIL (модуль не найден) |
| FL-07 | src/demolition/mark-follow.test.ts | конец сместился внутрь (стена укорочена) — пометки без изменений | FAIL (модуль не найден) |
| FL-07 | src/demolition/mark-follow.test.ts | конец сместился в сторону с поворотом — пометки без изменений | FAIL (модуль не найден) |
| FL-08 | src/demolition/mark-follow.test.ts | вход не мутируется | FAIL (модуль не найден) |
| FL-09 | src/demolition/mark-follow.test.ts | инвариант — область каждой пометки в мире не меняется при слиянии у любого конца и любой привязке | FAIL (модуль не найден) |
| ST-01 | src/demolition/mark-storage.test.ts | пометки переживают serialize → parse с теми же идентификатором, стеной, концом привязки и расстояниями | PASS (поведение уже есть) |
| ST-01 | src/demolition/mark-storage.test.ts | serialize записывает пометки в JSON чертежа в поле demolition | PASS (поведение уже есть) |
| ST-01 | src/demolition/mark-storage.test.ts | порядок пометок сохраняется | PASS (поведение уже есть) |
| ST-02 | src/demolition/mark-storage.test.ts | чертёж без списка пометок открывается без изменений, поле не появляется | PASS (поведение уже есть) |
| ST-02 | src/demolition/mark-storage.test.ts | пустой список пометок сохраняется как пустой список | PASS (поведение уже есть) |
| ST-08 | src/demolition/mark-storage.test.ts | поле demolition не массив (%s) читается как отсутствующее | FAIL |
| ST-03 | src/demolition/mark-storage.test.ts | некорректные пометки отбрасываются, корректная восстанавливается, остальные данные чертежа целы | FAIL |
| ST-03 | src/demolition/mark-storage.test.ts | каждый дефект по отдельности отбрасывает именно эту пометку | FAIL |
| ST-03 | src/demolition/mark-storage.test.ts | ссылка на стену другого чертежа отбрасывается | FAIL |
| ST-04 | src/demolition/mark-storage.test.ts | пересекающиеся пометки одной стены 100–200 и 150–300 сливаются при загрузке в одну 100–300 | FAIL |
| ST-04 | src/demolition/mark-storage.test.ts | соприкасающиеся пометки сливаются, непересекающиеся — нет | FAIL |
| ST-04 | src/demolition/mark-storage.test.ts | пометки разных стен не сливаются | PASS (поведение уже есть) |
| ST-05 | src/demolition/mark-storage.test.ts | пометка на стене из железобетона сохраняется (она не действует, но хранится) | PASS (поведение уже есть) |
| ST-05 | src/demolition/mark-storage.test.ts | пометки сохраняются и при последующей записи | PASS (поведение уже есть) |
| ST-06 | src/demolition/mark-storage.test.ts | стены, размеры, проёмы, вид, масштаб и имя читаются из прежних полей без изменений | PASS (поведение уже есть) |
| ST-06 | src/demolition/mark-storage.test.ts | версия документа остаётся 3 при чтении и записи | PASS (поведение уже есть) |
| ST-07 | src/demolition/mark-storage.test.ts | активный план demolition допустим и сохраняется | FAIL |
| ST-07 | src/demolition/mark-storage.test.ts | activePlan demolition переживает serialize → parse вместе с пометками | FAIL |
| ST-07 | src/demolition/mark-storage.test.ts | неизвестный activePlan по-прежнему отбрасывается | PASS (поведение уже есть) |
| ST-10 | src/demolition/mark-storage.test.ts | документ версии 2 открывается без пометок | PASS (поведение уже есть) |
| ST-11 | src/demolition/mark-storage.test.ts | документ будущей версии остаётся только для чтения и не читает пометки | PASS (поведение уже есть) |
| ST-09 | src/demolition/mark-storage.test.ts | корректная пометка принимается, включая from = 0 | FAIL |
| ST-09 | src/demolition/mark-storage.test.ts | отвергает %s | FAIL |
| HI-01 | src/demolition/mark-history.test.ts | запись → отмена возвращает снимок до операции, текущие пометки уходят в повтор | FAIL |
| HI-01 | src/demolition/mark-history.test.ts | повтор возвращает состояние после операции, текущие пометки уходят обратно в past | FAIL |
| HI-02 | src/demolition/mark-history.test.ts | снятие пометки — запись списка с пометкой, отмена возвращает её с прежним участком | FAIL |
| HI-03 | src/demolition/mark-history.test.ts | правка числа — отмена возвращает прежние границы | FAIL |
| HI-08 | src/demolition/mark-history.test.ts | новая запись срезает ветку повтора | FAIL |
| HI-09 | src/demolition/mark-history.test.ts | лимит истории: после HISTORY_LIMIT + 1 записей остаётся HISTORY_LIMIT, старейшая вытеснена | FAIL |
| HI-10 | src/demolition/mark-history.test.ts | снимок независим от живого массива: изменение исходного списка и объектов после записи не меняет историю | FAIL |
| HI-10 | src/demolition/mark-history.test.ts | текущие пометки, положенные в повтор при отмене, тоже копируются: правка живого списка после отмены не меняет повтор | FAIL |
| HI-10 | src/demolition/mark-history.test.ts | текущие пометки, положенные в past при повторе, тоже копируются | FAIL |
| HI-11 | src/demolition/mark-history.test.ts | пустые стеки — отмена и повтор возвращают null и ничего не меняют | FAIL |
| HI-12 | src/demolition/mark-history.test.ts | цепочка из трёх шагов отменяется и повторяется по порядку | FAIL |
| HI-04 | src/demolition/mark-history.test.ts | запись пометок идёт в историю плана «Демонтаж» под ключом «<id>:demolition», обмерочная не затронута | FAIL |
| HI-04 | src/demolition/mark-history.test.ts | правка обмерочного плана не попадает в историю демонтажа и наоборот | FAIL |
| HI-04 | src/demolition/mark-history.test.ts | истории демонтажа разных чертежей независимы | FAIL |
| HI-05 | src/demolition/mark-history.test.ts | serialize → parse возвращает тот же документ версии 2; ключи «a» и «a:demolition» | FAIL |
| HI-05 | src/demolition/mark-history.test.ts | после перезагрузки отмена и повтор доступны на тех же шагах | FAIL |
| HI-05 | src/demolition/mark-history.test.ts | пустой снимок пометок допустим | FAIL |
| HI-06 | src/demolition/mark-history.test.ts | история до введения плана «Демонтаж» читается: обмерочный план доступен, демонтаж пуст | PASS (поведение уже есть) |
| HI-07 | src/demolition/mark-history.test.ts | запись пометок с пометкой без идентификатора делает документ повреждённым (null) | PASS (поведение уже есть) |
| HI-07 | src/demolition/mark-history.test.ts | %s — документ повреждён | FAIL |
| HI-07 | src/demolition/mark-history.test.ts | некорректная запись в future тоже делает документ повреждённым | PASS (поведение уже есть) |
| HI-07 | src/demolition/mark-history.test.ts | версия документа истории больше 2 по-прежнему читается как пустая только для чтения | PASS (поведение уже есть) |
| RN-01 | src/demolition/demolition-render.test.ts | подложка серая: вся геометрия стен нарисована цветом muted, цвета ink нет нигде | FAIL (модуль не найден) |
| RN-01 | src/demolition/demolition-render.test.ts | у подложки есть контур (толщина contourPx) и штриховка материала (толщина hatchPx) | FAIL (модуль не найден) |
| RN-01 | src/demolition/demolition-render.test.ts | штриховка кирпича подложки идёт под 45° (в экранных координатах dx·dy < 0) | FAIL (модуль не найден) |
| RN-01 | src/demolition/demolition-render.test.ts | у подложки нет подписей: комната без подписи площади, размеров нет — текста нет вовсе | FAIL (модуль не найден) |
| RN-05 | src/demolition/demolition-render.test.ts | подписи элементов стены на подложке не рисуются (H=…), даже для переданных (видимых) проёмов | FAIL (модуль не найден) |
| RN-05 | src/demolition/demolition-render.test.ts | вырез видимого проёма остаётся в подложке: контур стены с проёмом отличается от контура сплошной стены | FAIL (модуль не найден) |
| RN-12 | src/demolition/demolition-render.test.ts | без пометок и превью красного нет | FAIL (модуль не найден) |
| RN-02 | src/demolition/demolition-render.test.ts | область закрашена цветом бумаги по контуру области, закраска идёт до красных линий | FAIL (модуль не найден) |
| RN-02 | src/demolition/demolition-render.test.ts | красный контур области толщиной contourPx идёт по сторонам области и не выходит за её габариты | FAIL (модуль не найден) |
| RN-02 | src/demolition/demolition-render.test.ts | красная штриховка идёт под 135° (dx·dy > 0, /dx/ = /dy/), толщиной hatchPx, внутри клипа по области | FAIL (модуль не найден) |
| RN-02 | src/demolition/demolition-render.test.ts | красный — только цвет из параметров: смена color меняет цвет всех красных линий | FAIL (модуль не найден) |
| RN-03 | src/demolition/demolition-render.test.ts | ширина участка числом: «90» в сантиметрах, «0,9» в метрах, «900» в миллиметрах | FAIL (модуль не найден) |
| RN-03 | src/demolition/demolition-render.test.ts | подпись ширины стоит у участка: x по центру участка, ниже верха стены на стороне нормали | FAIL (модуль не найден) |
| RN-04 | src/demolition/demolition-render.test.ts | остаток стены серый и без красного: красные контуры только в габаритах области сноса | FAIL (модуль не найден) |
| RN-06 | src/demolition/demolition-render.test.ts | у выделенной пометки три числа (100, 90, 310), у невыделенной — только ширина | FAIL (модуль не найден) |
| RN-06 | src/demolition/demolition-render.test.ts | несколько пометок — по подписи ширины у каждой | FAIL (модуль не найден) |
| RN-07 | src/demolition/demolition-render.test.ts | превью протяжки — красные линии и ширина «90» без закраски бумагой | FAIL (модуль не найден) |
| RN-07 | src/demolition/demolition-render.test.ts | превью без стены или с неизвестной стеной ничего не рисует | FAIL (модуль не найден) |
| RN-08 | src/demolition/demolition-render.test.ts | метрики PDF: красный контур и штриховка толщиной PDF_METRICS.contourPx и hatchPx | FAIL (модуль не найден) |
| RN-09 | src/demolition/demolition-render.test.ts | тёмная схема: бумага и серый подложки берутся из палитры | FAIL (модуль не найден) |
| RN-13 | src/demolition/demolition-render.test.ts | сетка включается параметром grid (по умолчанию как на обмерочном плане) | FAIL (модуль не найден) |
| RN-10 | src/demolition/demolition-render.test.ts | цвет схемы %s — шестизначный hex, преобладает красный | FAIL (модуль не найден) |
| RN-10 | src/demolition/demolition-render.test.ts | светлая и тёмная схемы различны и оба не совпадают с цветом бумаги своей палитры | FAIL (модуль не найден) |
| PG-12 | src/export/demolition-pdf.test.ts | вторая страница — подложка (стены обмерочного плана), без размеров, действующие пометки | FAIL (модуль не найден) |
| PG-12 | src/export/demolition-pdf.test.ts | первая страница — прежняя, без поля demolition; размеры обмерочного плана сохранены | FAIL (модуль не найден) |
| PG-12 | src/export/demolition-pdf.test.ts | чертёж без пометок — вторая страница с подложкой и пустым списком пометок | FAIL (модуль не найден) |
| PG-10 | src/export/demolition-pdf.test.ts | пометка на железобетоне и пометка на отсутствующую стену на странице не действуют | FAIL (модуль не найден) |
| PG-11 | src/export/demolition-pdf.test.ts | проём, пересекающийся с участком, на странице демонтажа не передаётся; на обмерочной странице остаётся | FAIL (модуль не найден) |
| PG-11 | src/export/demolition-pdf.test.ts | проём вне участка остаётся на странице демонтажа | FAIL (модуль не найден) |
| PG-13 | src/export/demolition-pdf.test.ts | результат не зависит от активного плана и выделения | FAIL (модуль не найден) |
| PG-12 | src/export/demolition-pdf.test.ts | pagesOf не мутирует чертёж | FAIL (модуль не найден) |
| PG-02 | src/export/demolition-pdf.test.ts | PDF содержит две страницы; красное и красная штриховка только на второй | FAIL (модуль не найден) |
| PG-03 | src/export/demolition-pdf.test.ts | красная штриховка на второй странице идёт под 135° (dx·dy > 0, /dx/ = /dy/) | FAIL (модуль не найден) |
| PG-03 | src/export/demolition-pdf.test.ts | красный контур участка 0,6 мм: участок 90 см при 1:100 — ширина 9 мм на листе, высота 2 мм | FAIL (модуль не найден) |
| PG-03 | src/export/demolition-pdf.test.ts | красный цвет страницы — светлый красный демонтажа (не зависит от экранной темы) | FAIL (модуль не найден) |
| PG-03 | src/export/demolition-pdf.test.ts | подложка на второй странице серая (muted светлой палитры), не цвет ink | FAIL (модуль не найден) |
| PG-04 | src/export/demolition-pdf.test.ts | на странице демонтажа нет размеров: на первой подпись размера есть, на второй её нет | FAIL (модуль не найден) |
| PG-04 | src/export/demolition-pdf.test.ts | на странице демонтажа нет подписей площади и подписей элементов (H=…) | FAIL (модуль не найден) |
| PG-05 | src/export/demolition-pdf.test.ts | ширина участка числом: «90» при единице «см» на второй странице, на первой этого числа нет | FAIL (модуль не найден) |
| PG-05 | src/export/demolition-pdf.test.ts | ширина в единице экспорта: «0,9» для метров | FAIL (модуль не найден) |
| PG-05 | src/export/demolition-pdf.test.ts | несколько участков — число у каждого | FAIL (модуль не найден) |
| PG-06 | src/export/demolition-pdf.test.ts | первая страница содержит обмерочный план так же, как до введения плана «Демонтаж»: те же операторы, что у buildPdf, и ни одной красной линии | FAIL (модуль не найден) |
| PG-14 | src/export/demolition-pdf.test.ts | без пометок вторая страница — только серая подложка, красного нет | FAIL (модуль не найден) |
| PG-15 | src/export/demolition-pdf.test.ts | на странице демонтажа нет сетки (цвета сетки #e0e0e0) | FAIL (модуль не найден) |
| PG-16 | src/export/demolition-pdf.test.ts | рамка листа, основная надпись и подпись (имя, масштаб, дата) есть и на странице демонтажа | FAIL (модуль не найден) |
| PG-17 | src/export/demolition-pdf.test.ts | страница демонтажа лежит в области чертежа и центрирована по габаритам подложки в масштабе чертежа (стена 5 м — 50 мм) | FAIL (модуль не найден) |
| PG-17 | src/export/demolition-pdf.test.ts | страница демонтажа размещается так же, как обмерочная страница без размеров: те же габариты подложки | FAIL (модуль не найден) |
| PG-07 | src/export/demolition-pdf.test.ts | габариты страницы демонтажа — по стенам подложки: стена 242 см при 1:10 помещается на A4, 243 — нет | FAIL (модуль не найден) |
| PG-07 | src/export/demolition-pdf.test.ts | список форматов по двум страницам равен списку по стенам (размеров нет) | FAIL (модуль не найден) |
| PG-08 | src/export/demolition-pdf.test.ts | размер на обмерочной странице ограничивает форматы, страница демонтажа его не добавляет | FAIL (модуль не найден) |
| PG-08 | src/export/demolition-pdf.test.ts | пометки не влияют на габариты: чертёж с пометкой и без неё допускает те же форматы | FAIL (модуль не найден) |
| PG-09 | src/export/demolition-pdf.test.ts | нет стен — обе страницы пусты, но остаются в документе | FAIL (модуль не найден) |
| TL-01 | src/demolition/demolition-tool.test.ts | клик по телу стены помечает её целиком: 0–500, одна запись истории, один шаг сохранения | FAIL (модуль не найден) |
| TL-01 | src/demolition/demolition-tool.test.ts | запись истории идёт до замены пометок | FAIL (модуль не найден) |
| TL-01 | src/demolition/demolition-tool.test.ts | клик рядом с телом стены (в радиусе привязки, 3 см от грани) тоже помечает | FAIL (модуль не найден) |
| TL-02 | src/demolition/demolition-tool.test.ts | повторный клик по снесённой области снимает пометку, которой принадлежит область: одна запись истории | FAIL (модуль не найден) |
| TL-02 | src/demolition/demolition-tool.test.ts | клик по неснесённой части стены с другими пометками помечает всю стену и поглощает их | FAIL (модуль не найден) |
| TL-08 | src/demolition/demolition-tool.test.ts | клик мимо стен и областей ничего не меняет и не пишет историю | FAIL (модуль не найден) |
| TL-08 | src/demolition/demolition-tool.test.ts | нажатие мимо стены и движение/отпускание не создают пометку | FAIL (модуль не найден) |
| TL-08 | src/demolition/demolition-tool.test.ts | отпускание без нажатия ничего не делает | FAIL (модуль не найден) |
| TL-09 | src/demolition/demolition-tool.test.ts | железобетонная стена не помечается кликом: ничего не меняется, шага нет | FAIL (модуль не найден) |
| TL-09 | src/demolition/demolition-tool.test.ts | железобетонная стена не помечается протяжкой | FAIL (модуль не найден) |
| TL-03 | src/demolition/demolition-tool.test.ts | нажатие в x = 100 и отпускание в x = 190 помечает участок 100–190 (ширина 90) | FAIL (модуль не найден) |
| TL-03 | src/demolition/demolition-tool.test.ts | протяжка справа налево даёт тот же участок | FAIL (модуль не найден) |
| TL-04 | src/demolition/demolition-tool.test.ts | протяжка вне оси проецируется на ось нажатой стены: (100, 5) → (190, 80) даёт 100–190 | FAIL (модуль не найден) |
| TL-05 | src/demolition/demolition-tool.test.ts | протяжка за конец стены обрезается: 400 → 700 даёт 400–500 | FAIL (модуль не найден) |
| TL-05 | src/demolition/demolition-tool.test.ts | протяжка за начало стены обрезается: 100 → −300 даёт 0–100 | FAIL (модуль не найден) |
| TL-10 | src/demolition/demolition-tool.test.ts | превью во время протяжки — участок от конца a по возрастанию, после отпускания превью нет | FAIL (модуль не найден) |
| TL-10 | src/demolition/demolition-tool.test.ts | превью обновляется при движении | FAIL (модуль не найден) |
| TL-10 | src/demolition/demolition-tool.test.ts | превью без изменения данных: пока протяжка не завершена, пометки и история не затронуты | FAIL (модуль не найден) |
| TL-07 | src/demolition/demolition-tool.test.ts | Escape во время протяжки отменяет её: превью нет, отпускание ничего не создаёт | FAIL (модуль не найден) |
| TL-07 | src/demolition/demolition-tool.test.ts | после Escape новый жест работает как обычно | FAIL (модуль не найден) |
| TL-07 | src/demolition/demolition-tool.test.ts | Escape без жеста безвреден | FAIL (модуль не найден) |
| TL-21 | src/demolition/demolition-tool.test.ts | протяжка, начатая внутри снесённой области, расширяет пометку, а не снимает её | FAIL (модуль не найден) |
| TL-11 | src/demolition/demolition-tool.test.ts | протяжка внутри уже снесённого участка ничего не меняет: ни записи истории, ни замены пометок | FAIL (модуль не найден) |
| TL-11 | src/demolition/demolition-tool.test.ts | каждая операция — ровно одна запись истории: пометка, протяжка, снятие | FAIL (модуль не найден) |
| TL-12 | src/demolition/demolition-tool.test.ts | стены и элементы обмерочного плана не меняются: заморожены, жесты не бросают | FAIL (модуль не найден) |
| TL-06 | src/demolition/demolition-tool.test.ts | нажатие в x = 100 и отпускание в 100,5 — клик: помечена вся стена | FAIL (модуль не найден) |
| TL-06 | src/demolition/demolition-tool.test.ts | экранный сдвиг ровно 4 px — ещё клик, превью нет | FAIL (модуль не найден) |
| TL-06 | src/demolition/demolition-tool.test.ts | экранный сдвиг больше 4 px — протяжка: превью есть | FAIL (модуль не найден) |
| TL-06 | src/demolition/demolition-tool.test.ts | широкий экранный сдвиг, но ширина после привязки 0 (100 → 100,4 округляются в 100) — клик: вся стена | FAIL (модуль не найден) |
| TL-06 | src/demolition/demolition-tool.test.ts | ширина после привязки ровно 1 см — участок: 100 → 101 и 100 → 100,6 (округляется в 101) | FAIL (модуль не найден) |
| TL-06 | src/demolition/demolition-tool.test.ts | ширина после привязки меньше 1 см (узлы 200 и 200,5 на стене; 200 → 200,5) — клик | FAIL (модуль не найден) |
| TL-13 | src/demolition/demolition-tool.test.ts | граница у конца стены привязывается: 100 → 497 даёт 100–500 | FAIL (модуль не найден) |
| TL-13 | src/demolition/demolition-tool.test.ts | граница у откоса проёма привязывается: 100 → 288 даёт 100–290 | FAIL (модуль не найден) |
| TL-13 | src/demolition/demolition-tool.test.ts | граница у грани примыкающей стены привязывается | FAIL (модуль не найден) |
| TL-13 | src/demolition/demolition-tool.test.ts | без узла в радиусе граница округляется до сантиметра: 100,4 → 123,4 даёт 100–123 | FAIL (модуль не найден) |
| TL-13 | src/demolition/demolition-tool.test.ts | превью использует привязанные границы | FAIL (модуль не найден) |
| TL-14 | src/demolition/demolition-tool.test.ts | клик по области сноса выделяет пометку | FAIL (модуль не найден) |
| TL-14 | src/demolition/demolition-tool.test.ts | клик по телу стены вне областей сноса не выделяет стену и снимает выделение | FAIL (модуль не найден) |
| TL-14 | src/demolition/demolition-tool.test.ts | клик мимо стен снимает выделение | FAIL (модуль не найден) |
| TL-14 | src/demolition/demolition-tool.test.ts | выделение ничего не меняет в данных и не пишет историю | FAIL (модуль не найден) |
| TL-16 | src/demolition/demolition-tool.test.ts | clearSelection снимает выделение | FAIL (модуль не найден) |
| TL-15 | src/demolition/demolition-tool.test.ts | Delete удаляет выделенную пометку одним шагом истории и снимает выделение | FAIL (модуль не найден) |
| TL-15 | src/demolition/demolition-tool.test.ts | Delete без выделения ничего не делает | FAIL (модуль не найден) |
| TL-14 | src/demolition/demolition-tool.test.ts | выделяется ровно одна пометка: клик по другой переносит выделение | FAIL (модуль не найден) |
| TL-14 | src/demolition/demolition-tool.test.ts | пометка на железобетоне (не действует) не выделяется | FAIL (модуль не найден) |
| TL-17 | src/demolition/demolition-tool.test.ts | числа выделенной пометки находятся по точке: число ширины под центром участка | FAIL (модуль не найден) |
| TL-17 | src/demolition/demolition-tool.test.ts | без выделения правимых чисел нет | FAIL (модуль не найден) |
| TL-17 | src/demolition/demolition-tool.test.ts | мимо чисел — null | FAIL (модуль не найден) |
| TL-17 | src/demolition/demolition-tool.test.ts | applyNumber меняет участок одним шагом истории и сохраняет выделение | FAIL (модуль не найден) |
| TL-17 | src/demolition/demolition-tool.test.ts | слияние при правке — выделение следует за слитой пометкой | FAIL (модуль не найден) |
| TL-18 | src/demolition/demolition-tool.test.ts | недопустимый ввод ничего не меняет: false, нет записи истории | FAIL (модуль не найден) |
| TL-18 | src/demolition/demolition-tool.test.ts | без выделения applyNumber возвращает false | FAIL (модуль не найден) |

## Revision 1 — по результатам валидации (VERDICT: FAIL, раунд 1)

Пять дефектов самих тестов, найденных на эталонной реализации (падали бы на любой корректной), и четыре пробела мутаций. Изменялись только новые тесты и тестовые утилиты этого change; существующие approved-тесты, кроме двух TCR, не затрагивались. Таблица «Tests» выше — прогон до ревизии; строки ревизии ниже.

Исправлено:

| ID | Файл | Дефект → исправление |
|---|---|---|
| DM-15 | `src/demolition/marks.test.ts` | ожидался якорь a у участка 250–300; по правилу «ближний к середине» (275 > 250) это привязка b: 200…250 |
| RG-01, RG-03 (×4) | `src/demolition/mark-region.test.ts` | эталон формы строился как `displayPolygons(W(), [W()])` — два разных экземпляра дают пустую форму; теперь один экземпляр (`shapeOfW`) |
| HI-05 | `src/demolition/mark-history.test.ts` | после отмены `redoMarks` возвращает `[m1]` (положенный по отмене), следующий повтор — `[m1, m2]` |
| PG-03 | `src/export/demolition-pdf.test.ts` | в области 9×2 мм при шаге 3 мм линий немного: `> 1` вместо `> 3` |
| PG-03 (серый) | `src/export/pdf-colors.test-utils.ts` | `hexToRgb01` не понимал `#rgb` (muted `#555`, ink `#333`); теперь понимает |

Добавлено (пробелы мутаций):

| ID | Файл | Тест |
|---|---|---|
| FL-07 (×4) | `src/demolition/mark-follow.test.ts` | пометки, привязанные к сдвинутому концу, не переносятся при укорочении, смещении в сторону, смещении конца a и при смещении обеих вершин |
| PG-18 (×4) | `src/export/demolition-pdf.test.ts` | подложка из двух стен: страница несёт обе стены; формат ограничен непомеченной стеной; габариты и центрирование по всем стенам; размещение как у обмерочной страницы |
| TL-19 (×2) | `src/demolition/demolition-tool.test.ts` | ввод, не меняющий участок (то же значение, зажим в прежнее состояние): `false`, без записи истории и замены |
| TL-22 (×5) | `src/demolition/demolition-tool.test.ts` | вертикальная и наклонная (3-4-5) стены: проекция точек нажатия/отпускания на ось, клик по вертикальной стене, ось определяет нажатая стена |

### Revision 2 — по результатам валидации (VERDICT: FAIL, раунд 2)

Один дефект теста и пять реальных пробелов мутаций. Изменялись только новые тесты.

| ID | Файл | Исправление / добавление |
|---|---|---|
| PG-18 | `src/export/demolition-pdf.test.ts` | ширина серого контура двух стен — 30 мм (торцы вровень), а не 32; название уточнено |
| PG-14 (новый) | `src/export/demolition-pdf.test.ts` | без пометок контур стены на странице демонтажа серый (muted), а не ink, как на обмерочной странице; размеров нет |
| DM-10 (новый) | `src/demolition/marks.test.ts` | привязка b у укороченной стены: участок обрезается по началу (0–200) |
| DM-28 (новый) | `src/demolition/marks.test.ts` | пометка на отсутствующую стену в начале списка не прерывает слияние остальных |
| TL-01 (×2), TL-10, TL-07, TL-16 | `src/demolition/demolition-tool.test.ts` | запись истории видит прежние пометки, `changed()` (сохранение) — уже новые; перерисовка при изменении, при движении за мёртвую зону, при Escape, при выделении и снятии выделения; хост-подставка запоминает снимки и число перерисовок |
| FL-07 (новый) | `src/demolition/mark-follow.test.ts` | конец b смещён наружу и в сторону — пометки без изменений |

Дизайн: `design.md` D4 исправлен (узлы от граней другой стены — по её форме, обрезанной полосой этой стены; одной оси недостаточно для T-примыкания); тесты ND-03, ND-09, TL-13 остаются в силе.

## Coverage

### Happy paths

- Пометка целой стены, участка, якорь по середине участка; слияние пересекающихся и соприкасающихся (DM-01 … DM-04, DM-13 … DM-16).
- Область сноса целой стены и участка, скрытие элементов (RG-01 … RG-15).
- Узлы и привязка границ (ND-01 … ND-11).
- Правка трёх чисел, раскладка и попадание в число (NU-01 … NU-13).
- Следование за перемещением стены/концов и перенос привязки при слиянии (FL-01 … FL-09).
- Хранение и история пометок, активный план demolition (ST-01 … ST-11, HI-01 … HI-12).
- Отрисовка: подложка, область сноса, красная штриховка 135°, подписи, превью (RN-01 … RN-13).
- Страница демонтажа в PDF: красное только на второй странице, 135°, подпись ширины, габариты (PG-02 … PG-17).
- Жесты инструмента: клик, протяжка, проекция, обрезка, привязка, выделение, Delete, правка чисел (TL-01 … TL-21).
- Наборы инструментов планов и каталог из двух планов (PT-01 … PT-04).

### Boundary cases

- Допуск `EPS_CM = 0,01`: ширина 0,005 / 0,02 после обрезки (DM-12), зазор слияния (DM-14, DM-15), перекрытие элемента (RG-08), обрезка области у концов (RG-03).
- Минимальная ширина 1 см: 0,5 / 1 (DM-19, NU-06, TL-06); значения на границе допустимого при правке (NU-05).
- Радиус привязки: ровно радиус / чуть больше (ND-05); округление до сантиметра; зажим в `[0, len]` (ND-06).
- Мёртвая зона 4 px: ровно 4 / больше (TL-06).
- Пустые списки, вырожденные и отсутствующие стены (DM-17, DM-18, RG-14).

### Negative cases

- Железобетон не помечается (DM-06, TL-09); отсутствующая и вырожденная стена (DM-18).
- Недопустимый ввод числа: NaN, бесконечность, отрицательные, ширина < 1 (NU-06, TL-18).
- Битые пометки и записи истории (ST-03, ST-08, ST-09, HI-07).
- Клик мимо стен; отпускание без нажатия; Escape (TL-07, TL-08).
- Стены обмера не выделяются без инструмента (TL-14).

### Invariants

- Входы не мутируются (`deepFreeze` в DM-05, RG-05, ND-10, NU-06, FL-08, TL-12 и др.).
- Участки одной стены не пересекаются и не соприкасаются (DM-24); якорь — ближний конец (DM-24).
- `addMark`/`removeMark`/`mergeAll` возвращают тот же массив при отсутствии изменений (DM-06, DM-22, DM-25, DM-28).
- Область сноса не зависит от конца привязки (RG-04, DM-30); область не меняется при слиянии стен (FL-09).
- Формат документа хранилища 3 и истории 2 не меняется (ST-06, HI-05).
- Каждая операция — ровно один шаг истории, `record` до `setMarks` (TL-11).

### Integration cases

- Реальные `moveWallsBounded`, `moveEndpointBounded`, `mergeContinuation` вместе с `effectiveMarks`/`markRegion`/`reanchorMarks` (FL-01 … FL-09).
- `pagesOf` → `buildPdfPages` → разбор операторов страницы 2 (PG-02 … PG-17); первая страница равна `buildPdf` (PG-06).
- `recordMarks` → `serializeHistory` → `parseHistory` → `undoMarks` (HI-05).
- Адаптер инструмента с подставным хостом (TL-01 … TL-21).

## Unexpected Passes

Проходят до реализации, потому что проверяют уже существующее поведение либо совпадают с ним случайно; после реализации обязаны остаться зелёными. Продакшен-код не менялся.

- Тесты прежних частей каталога и ключа истории: `PL-02 … PL-06` в `src/plans.test.ts`; `PT-04` (ключ `«<id>:demolition»` уже реализован в `historyKey`).
- `mark-storage.test.ts`: тесты, не затрагивающие фильтрацию пометок (ST-01, ST-02, ST-04 для разных стен, ST-05, ST-06, ST-07 «неизвестный activePlan», ST-10, ST-11): `parseStore` сохраняет неизвестное поле `demolition` как есть (оператор распространения), поэтому «сохранение» и «чтение без изменений» уже работают; фильтрация, слияние и отбрасывание битых (ST-03, ST-04 слияние, ST-08, ST-09) падают.
- `mark-history.test.ts`: HI-06 (старая история читается) и HI-07 (битые записи): `isHistoryEntry` сейчас отвергает неизвестный `kind: "demolition"`, поэтому документ с любой такой записью читается как повреждённый (`null`) — HI-07 проходят вхолостую; после реализации они защищают валидацию пометок (мутация «записи принимаются без проверки пометок» их ломает).
- `src/export/pdf-pages.test.ts` (тесты предыдущего change): проходят без изменений; TCR-2 тесты проходят «случайно» на первой странице.

## Tests That Could Not Run

- Ручные проверки интерфейса MAN-01 … MAN-16 из `test-plan.md` (переключатель с двумя сегментами, панель инструментов по плану, жесты и редактор числа в браузере, перезагрузка, PDF глазами, тёмная схема): в проекте нет DOM-стенда.
- Не покрыты автоматически: подключение адаптера в `main.ts` (делегирование обработчиков холста, `undo/redo` по плану, `reanchorMarks` после слияния в `commitPoint`, видимость кнопок инструментов), DOM-редактор числа (`openNumberEditor`), вёрстка `#tool-demolition`.
