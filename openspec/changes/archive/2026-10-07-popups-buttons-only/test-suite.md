# Test Suite

Запуск: `npx vitest run src/doorway` (vitest 4). Начальный прогон — до реализации: новые и адаптированные тесты
падают на отсутствующих экспортах (D9) или на старой разметке; остальные 75 файлов проекта зелёные
(1520 тестов). Ревизия 2 — по test-validation.md ревизии 1 (FAIL: F-1, F-2, F-3, F-7 и рекомендации F-4…F-9). Общие помощники — `src/doorway/selection-editing.test-utils.ts`: фейковый хост с независимым
эталоном наследования (`expectedInherit`), поле ввода на месте числа, записывающий контекст со штриховкой
(`dashRecorder`), эталоны положения чисел по design D1 (`chainOffsetCm`, `chainTextLiftCm`, `labelGapCm`,
`numberOffsetPx`).

## Tests

| ID | Requirement | Test File | Test Name | Initial Result |
|---|---|---|---|---|
| PB-UI-01 | canvas-app «Вспомогательная панель инструмента» | `src/doorway/popups-ui.test.ts` | PB-UI-01: панель группы «Проёмы» — только кнопки; панель «Стена» — кнопки образцов и поле толщины | FAIL (в панели есть `<input`) |
| PB-UI-02 | canvas-app «Вспомогательная панель инструмента»; window «Инструмент «Окно» и параметры новых окон»; dimension-selection REMOVED «Панель свойств размера» | `src/doorway/popups-ui.test.ts` | PB-UI-02: панели есть только у «Стена» и группы «Проёмы»; удалённых полей и панелей нет | FAIL (4 панели) |
| PB-GR-01 | canvas-app «Панель группы «Проёмы»» | `src/doorway/popups-ui.test.ts` | PB-GR-01: в панели группы ровно две кнопки — «Проём», затем «Дверь» | FAIL (3 кнопки) |
| PB-GR-02 | canvas-app «Панель группы «Проёмы»»; doorway «Выделение проёма кликом» | `src/doorway/popups-ui.test.ts` | PB-GR-02: переходы группы — только кнопка группы и выбор в панели; реакции на выделение нет | FAIL (`groupSelect`) |
| PB-INT-01 | doorway/door/window «… параметры новых …» (общие для вкладок, не сохраняются) | `src/doorway/popups-ui.test.ts` | PB-INT-01: параметры новых элементов — одно значение приложения из initialParams(), вне вкладок | FAIL |
| PB-INT-02 | door «Направление выделенной двери» (приоритет чисел над зонами); doorway «Ввод чисел размеров проёма» | `src/doorway/popups-ui.test.ts` | PB-INT-02: нажатие вне ластика — правимое число, затем зона двери, затем выбор цели | FAIL |
| PB-INT-03 | doorway/door/window «… параметры новых …» (хост читает и наследует одно значение приложения) | `src/doorway/popups-ui.test.ts` | PB-INT-03: хост элементов читает и наследует одно значение параметров приложения | FAIL |
| PB-PAR-01, 01b | doorway/door/window «… параметры новых …» (начальные) | `src/doorway/new-element-params.test.ts` | PB-PAR-01…01b | FAIL (нет `initialParams`) |
| PB-PAR-02…06 | то же (наследование, независимость видов, сторона открывания не входит, вход не мутируется) | `src/doorway/new-element-params.test.ts` | PB-PAR-02…PB-PAR-06 | FAIL (нет `inheritFrom`) |
| PB-SW-01…03c | door «Инструмент «Дверь» и параметры новых дверей» (сторона по курсору, мёртвая зона) | `src/doorway/door-direction.test.ts` | PB-SW-01, 01b, 02, 03, 03b, 03c | FAIL (нет `ghostSwing`) |
| PB-ZN-00…02d | door «Направление выделенной двери» (геометрия зон) | `src/doorway/door-direction.test.ts` | PB-ZN-00, 01, 02, 02b, 02c, 02d | FAIL (нет `doorZones`, `doorZoneAt`) |
| PB-ZN-08…08c | door «Направление выделенной двери» (смена направления, без изменения) | `src/doorway/door-direction.test.ts` | PB-ZN-08, 08b, 08c | FAIL (нет `setDirection`) |
| PB-EN-01…01e | doorway «Ввод чисел размеров проёма» (правимые числа, тексты, положения, «0», соседи) | `src/doorway/editable-numbers.test.ts` | PB-EN-01, 01b, 01c, 01d, 01e | NOT RUN (модуля нет — файл не загружается) |
| PB-EN-02, 02b | window «Правка подписи окна» (два числа подписи) | `src/doorway/editable-numbers.test.ts` | PB-EN-02, 02b | NOT RUN (то же) |
| PB-EN-03…03d | doorway «Ввод чисел размеров проёма» (попадание) | `src/doorway/editable-numbers.test.ts` | PB-EN-03, 03b, 03c, 03d | NOT RUN (то же) |
| PB-EN-04, 04b | инвариант: раскладка чисел совпадает с отрисовкой | `src/doorway/editable-numbers.test.ts` | PB-EN-04, 04b | NOT RUN (то же) |
| PB-RN-01, 01b | doorway «Ввод чисел размеров проёма» (подчёркивание) | `src/doorway/editable-render.test.ts` | PB-RN-01, 01b | FAIL |
| PB-RN-02, 03, 03b, 04 | то же (нет подчёркивания у призрака, при мультивыделении, со стеной, в PDF) | `src/doorway/editable-render.test.ts` | PB-RN-02, 03, 03b, 04 | PASS (негативные — см. ниже) |
| PB-RN-06 | window «Правка подписи окна» (оба числа подчёркнуты цветом числа, префиксы — нет) | `src/doorway/editable-render.test.ts` | PB-RN-06 | FAIL |
| PB-RN-05, 05b | door «Направление выделенной двери» (штриховые полотно и дуга трёх других направлений, у текущего — нет) | `src/doorway/editable-render.test.ts` | PB-RN-05, 05b | FAIL |
| PB-RN-05c | то же (нет альтернатив без одиночного выделения и в PDF) | `src/doorway/editable-render.test.ts` | PB-RN-05c | PASS (негативный) |
| PB-ED-20 | dimension-selection «Выделение размера» (число размера не правится) | `src/doorway/selection-editing.test.ts` | PB-ED-20 | FAIL |
| PB-ED-01…04b, 06, 14…19 | doorway «Ввод чисел размеров проёма» (подпись H); window «Правка подписи окна»; drawing-history «Отменяемые действия» | `src/doorway/selection-editing.test.ts` | PB-ED-01, 02, 03, 04, 04b, 06, 14, 15, 16, 17, 18, 19 | FAIL (нет `createSelectionEditing`) |
| PB-ED-05, 09, 11 | doorway «Ввод чисел размеров проёма» (цепочка, приоритет числа над зоной, ограничение) | `src/doorway/selection-editing.test.ts` | PB-ED-05, 09, 11 | FAIL |
| PB-ED-07, 08, 10, 12, 13 | doorway/door/window «… параметры новых …» (наследование правки, что не наследует) | `src/doorway/selection-editing.test.ts` | PB-ED-07, 08, 10, 12, 13 | FAIL |
| PB-ZN-03…07 | door «Направление выделенной двери»; drawing-history «Отменяемые действия» | `src/doorway/selection-editing.test.ts` | PB-ZN-03, 04, 05, 06, 07 | FAIL |
| PB-TL-01…08 | doorway «Установка проёма»; door/window «Инструмент … и параметры новых …» | `src/doorway/selection-editing.test.ts` | PB-TL-01, 02, 03 (с откосами призрака), 04, 05, 05b, 06, 07 (выделено), 08 (окно из параметров хоста) | FAIL (старая сигнатура `createElementTool`) |
| DT-03 (адапт.) | door «Инструмент «Дверь» и параметры новых дверей» | `src/doorway/door-tool.test.ts` | DT-03 | FAIL (сигнатура) |
| WTL-01…03, 07…10b (адапт.) | doorway «Инвариант размещения проёма», «Перемещение проёма», «Ввод чисел размеров проёма» | `src/doorway/window-tool.test.ts` | WTL-01, 02, 03, 07, 08, 09, 10, 10b | FAIL (сигнатура, `createSelectionEditing`) |

## Coverage

### Happy paths

- Правка высоты проёма и двери, высоты и подоконника окна в подписи; ширины и расстояний в цепочке (PB-ED-01,
  06, 14, WTL-09…10b, PB-ED-07).
- Установка с параметрами по умолчанию и из хоста (PB-TL-01…07), наследование после правки (PB-ED-07, 09, 12,
  13; PB-ZN-06).
- Зоны направления: геометрия и смена направления (PB-ZN-00…02d, 04, 08).
- Подчёркивание всех правимых чисел и штриховые альтернативы (PB-RN-01, 01b, 05, 05b, 06).
- Панели: только кнопки, панели только у «Стена» и «Проёмы» (PB-UI-01, 02, PB-GR-01).

### Boundary cases

- Мёртвая зона включительно и сразу за ней; зависимость от зума (PB-SW-03, 03b, PB-TL-05).
- Края зон направления, середина двери, глубина зоны = ширина двери (PB-ZN-02, 02d).
- Края прямоугольника попадания с допуском (PB-EN-03, 03b), повёрнутый прямоугольник (PB-EN-03d).
- Подоконник 0 (PB-ED-15, PB-PAR-05, PB-EN-02b), нулевое расстояние «0» (PB-EN-01b, PB-RN-01b).
- Ширина, ограниченная соседом, наследуется фактической (PB-ED-09).

### Negative cases

- Неположительная или нечисловая высота/ширина, отрицательный подоконник (PB-ED-03, 11, 16).
- Esc, потеря фокуса, то же значение (PB-ED-17, 18).
- Мультивыделение, выделение со стеной, невыделенный элемент, нет выделения (PB-ED-04, 04b, PB-ZN-07,
  PB-RN-03, 03b, 05c).
- Клик вне зон, клик в зону текущего направления (PB-ZN-03, 05).
- Подчёркивания и альтернатив нет у призрака и в PDF (PB-RN-02, 04, 05c).
- Выделение (нажатием инструмента), перемещение, стрелки, установка не наследуют параметры (PB-ED-08, 10).
- Выделенный размер: числа элемента не правятся (PB-ED-20).

### Invariants

- Правка одного вида не меняет параметры других видов (PB-PAR-03, PB-ED-12).
- Сторона открывания не входит в параметры новых дверей (PB-PAR-01, 04; PB-ZN-06).
- Запись истории — до правки, одна на применение (PB-ED-01, PB-ZN-04: порядок `record`, `replace`).
- Раскладка правимых чисел совпадает с отрисованной подписью (PB-EN-04, 04b).
- Чистые функции не мутируют вход (PB-PAR-06, PB-ZN-08).

### Integration cases

- Порядок нажатия в `pointerdown`: число → зона → `pressPick` (PB-INT-02, исходник без комментариев).
- Хост в `main.ts`: `params` — одно значение из `initialParams()`, `inherit` → `inheritFrom` (PB-INT-03). Динамика undo и вкладок — вручную (нет DOM-харнесса).
- Параметры новых элементов — одно значение в `main.ts`, не в хранилище (PB-INT-01).
- Инструмент и правка на месте на одном хосте видят общие параметры (PB-ED-07, 09, 12, 13; PB-ZN-06).

## Retired and Adapted Tests

По test-plan.md «Retired and Adapted Tests» (спецификация изменена намеренно):

- снято: `door-tool.test.ts` DT-01, DT-02, DT-02b, DT-04…DT-12; `door-kind.test.ts` DK-03, DK-03b, DK-03c;
  `door-edit.test.ts` DE-07, DE-07b; `openings-group.test.ts` GR-05, GR-06, вызов `groupSelect` в GR-08,
  утверждения о `door-rotate` в GR-10; `window-tool.test.ts` WTL-04, WTL-05, WTL-06;
- адаптировано без изменения утверждений: `door-tool.test.ts` DT-03, `window-tool.test.ts` WTL-01…03,
  WTL-07…10b — новая сигнатура `createElementTool(kind, host)`, правка числа через `createSelectionEditing`,
  общий фейковый хост.

## Unexpected Passes

- PB-RN-02, PB-RN-03, PB-RN-03b, PB-RN-04, PB-RN-05c проходят до реализации. Это ожидаемо: они проверяют
  отсутствие штриховых подчёркиваний и альтернатив, а сейчас штриховых элементов у чисел нет вовсе. Каждый из
  них парный к падающему позитивному тесту (PB-RN-01, 05, 06), без которого негативный тест не имеет силы.

## Tests That Could Not Run

- `src/doorway/editable-numbers.test.ts` (PB-EN-01…04b, 13 тестов) не загружался до реализации: модуля
  `src/doorway/editable-numbers.ts` нет (`Cannot find module './editable-numbers'`). Файл обнаружен раннером
  (в отчёте как упавший файл); тесты выполнятся после появления модуля.
