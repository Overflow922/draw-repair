## Context

Сейчас (до change):

- `index.html` — у `#openings-panel` поля проёма и двери и кнопка `#door-rotate`; `#window-panel` с тремя
  полями; `#dim-panel` с полем «Вынос» и значением только для чтения.
- `src/doorway/doorway-tool.ts` — `createElementTool(kind, host, panel)`: у каждого инструмента свои
  `params` (параметры новых элементов), поля панели, «Повернуть», правка чисел цепочки на месте
  (`pressNumber` → `openNumberEditor`). Числа цепочки любого элемента обрабатывает `doorwayTool.pressNumber`
  в `main.ts`, независимо от вида элемента.
- `src/doorway/element-kind.ts` — `elementDefaults`, `acceptField`, `nextDirection` (круг «Повернуть»).
- `src/doorway/openings-group.ts` — переходы группы, в том числе `groupSelect` (выделение открывает панель).
- `src/render.ts` — `drawDoorways` раскладывает подпись «H=…» / «H под.=…» на месте (центр, угол, ширина
  частей) и рисует цепочки; раскладка подписи нигде больше не доступна, поэтому клик по подписи сейчас
  невозможно сопоставить с частью подписи.
- `pointerdown` в `main.ts`: `doorwayTool.pressNumber` → `pressPick` (маркеры → размер → элемент → стена).

## Goals / Non-Goals

**Goals:**
- Один источник раскладки правимых чисел: отрисовка подчёркивания и попадание клика считаются из одних данных.
- Параметры новых элементов — одно хранилище на приложение по видам, обновляемое правкой любого инструмента.
- Чистые функции для всего, что проверяется тестами: раскладка правимых чисел, наследование параметров,
  сторона открывания призрака, зоны направления двери.

**Non-Goals:**
- Панель «Стена» и поле толщины — без изменений (исключение инварианта, `TODO.md`).
- Правка числа размещённого размера, длины стены на холсте.
- Сохранение параметров новых элементов в документе или `localStorage`.

## Decisions

### D1. Раскладка правимых чисел — чистая функция

Новый модуль `src/doorway/editable-numbers.ts`:

```text
EditableTarget = { kind: "distance"; side; part } | { kind: "width" } | { kind: "height" } | { kind: "sill" }
EditableNumber = { target; text; valueCm; center (мир); dir (единичный вектор текста); widthCm; heightCm }
editableNumbers(d, walls, elements, rooms, unit, k, labelPx) -> EditableNumber[]
numberAt(p, numbers, tolCm) -> EditableNumber | null
```

- Числа цепочки — из `chainLabels` (как сейчас в `labelAt`), направление — вдоль грани.
- Числа подписи — из раскладки подписи, вынесенной из `drawDoorways` в `elementLabelLayout(d, walls, rooms,
  unit, k, labelPx, bandPx)` (модуль `element-label.ts`, как и `formatLength` в `format-length.ts`: центр,
  направление, ширина рамки; смещение числа части — `partNumberOffsetPx`). Для «H=…» и «H под.=…» центр числа —
  центр текста после префикса, ширина — по той же оценке `0.6 · labelPx` на символ, что и рамка.
- `drawDoorways` использует `elementLabelLayout` для рисования подписи, поэтому подпись и её попадание
  не расходятся. Подчёркивание рисуется по `editableNumbers` только при одиночном выделенном элементе и только
  с экранными метриками (в PDF выделения нет — `PDF_METRICS` ветка подчёркивание не рисует).
- `center` — центр текста числа (туда же ставится поле ввода), `dir` — направление текста, `widthCm` —
  ширина числа (`0.6 · labelPx` на символ), `heightCm` — кегль. У числа цепочки текст стоит над размерной
  линией (базовая линия «bottom» с зазором `dimTextGapPx`), поэтому его центр — середина размерной линии,
  сдвинутая «вверх по тексту» на `(dimTextGapPx + labelPx / 2) / k`; у числа «0» без линии — на
  `labelPx / 2 / k`. У числа подписи (базовая линия «middle») центр — на линии подписи.
- Попадание: точка в прямоугольнике числа (вдоль `dir` — `widthCm`, поперёк — `heightCm`), расширенном на
  допуск `tolCm`; при нескольких — ближайший центр. Адаптер передаёт допуск 4 px экрана (`4 / k`), так что
  клик по самой размерной линии под числом тоже попадает. Это заменяет `labelAt` (круг 20 px вокруг середины
  размерной линии).

Альтернатива — хранить «последние нарисованные прямоугольники» из рендера и искать по ним: отклонена,
рендер получил бы состояние, а тесты попадания зависели бы от отрисовки.

### D2. Подчёркивание

Штриховой отрезок `[3, 2]` px экрана, толщина `hatchPx`, цвет числа (`ink`, у «H под.» — `sill`),
параллельно направлению текста, длиной в ширину числа, серединой под центром числа. Размер не зависит от зума,
как текст.

- У числа подписи — на 2 px ниже нижнего края текста (`labelPx / 2 + 2` от линии подписи).
- У числа цепочки текст стоит на размерной линии в 1.5 px над ней: отдельный штрих под ним слился бы со
  сплошной размерной линией. Поэтому подчёркиванием служит сама размерная линия: под числом (на ширину числа)
  она рисуется штриховой, вне числа — сплошной. Раскладка цепочки не меняется.
- У числа «0» без размерной линии — на 2 px ниже нижнего края текста.

### D3. Правка на месте — одна точка входа

`ElementTool.pressNumber(p)` заменяется адаптером уровня приложения `createSelectionEditing(host)` в
`doorway-tool.ts` (`pressNumber`, `pressZone`, `closeEditor`), не привязанным к виду инструмента. Применение
по цели: `distance` → `setDistance`, `width` → `setWidth`, `height` → `setHeight`, `sill` → `setSill`
(`doorway-edit.ts`, без изменений). В поле — только число (`host.formatCm`). Поле ввода не поворачивается;
ставится по центру числа, как сейчас у цепочки.

### D4. Параметры новых элементов

В `element-kind.ts`:

```text
NewElementParams = { doorway: {widthCm, heightCm}; door: {widthCm, heightCm, hinge}; window: {widthCm, heightCm, sillCm} }
initialParams() -> NewElementParams                      // 90×210; 90×210, a; 120×150×85
inheritFrom(params, e: WallElement) -> NewElementParams  // заменяет параметры вида e его значениями
```

`main.ts` держит одно значение `newParams` (вне вкладок, вне истории). `ElementToolHost` получает
`params(): NewElementParams` и `inherit(e)`; инструменты читают параметры своего вида при построении
призрака и установке. `inherit` вызывается только из применения правки на месте (D3) и смены направления
(D6) — после `host.replace`, с фактическим элементом после ограничения инвариантом. Установка, перетаскивание,
стрелки, undo/redo `inherit` не вызывают. `acceptField` остаётся проверкой ввода; `nextDirection` удаляется.

### D5. Сторона открывания призрака

```text
ghostSwing(raw, wall, prev: DoorSwing, deadCm) -> DoorSwing
```

`s = (raw − wall.a) · (d.y, −d.x)`; `|s| ≤ deadCm` → `prev`; `s > 0` → `left`, иначе `right`.
`deadCm = 4 / k` (4 px экрана). Инструмент «Дверь» хранит `lastSwing` (начально `left`) на время работы
приложения и передаёт в `placeDoor` вместе с `hinge` из параметров. Центр призрака — по-прежнему проекция
курсора: петли от курсора задать нельзя (решение пользователя — наследуются, D4).

### D6. Зоны направления выделенной двери

В `doorway-layout.ts`:

```text
doorZones(d: WallDoor, walls) -> { hinge; swing; poly: Point[4] }[4]
doorZoneAt(p, d, walls) -> { hinge; swing } | null
```

Прямоугольник зоны: вдоль оси — от откоса петель до середины двери, поперёк — от грани стороны открывания
на `w` наружу (spec door «Направление выделенной двери»). Альтернативные обозначения — `doorLeaf` двери
с направлением зоны, штриховой линией `[4, 3]`, `hatchPx`, цвет `muted`.

Порядок нажатия в `pointerdown` (вне ластика): правимое число (D3) → зона направления одиночной выделенной
двери → `pressPick`. Клик в зону: `setDirection(d, hinge, swing)` (новая чистая правка в `doorway-edit.ts`
вместо `rotateDoor`) — `applied` при смене, `unchanged` при том же направлении; применённая правка — одна
запись истории и `inherit`.

### D7. Панели

- `index.html`: из `#openings-panel` удаляются `#doorway-fields`, `#door-fields` (с `#door-rotate`);
  `#window-panel` и `#dim-panel` удаляются. Стили полей (`.doorway-field`, `.group-fields`, `#dim-*`) — из
  `style.css`.
- `ElementPanel`, `setPanel` / `togglePanel` / `syncPanel` у `ElementTool` удаляются. Кнопка «Окно» —
  `setTool("window")` без переключения панели.
- `openings-group.ts`: `groupSelect` удаляется; выделение элемента не трогает `GroupState`.
- `main.ts`: `setElementPanel` сводится к закрытию панели группы при смене инструмента; `selectDoorway` не
  открывает панели. `setDimPanel`, `syncDimPanel`, обработчики `#dim-offset` удаляются; выделение размера
  только подсвечивает размер.

### D8. Исполняемые тесты прежнего поведения

Спецификация меняется намеренно, поэтому тесты удаляемого поведения (поля панелей, «Повернуть», `groupSelect`,
`nextDirection`, панель размера) заменяются на этапе написания тестов, а не реализации: в
`test-plan.md` перечисляются файлы и сценарии, которые снимаются, и тесты, которые их заменяют.

### D9. Поверхность для тестов

Сигнатуры, на которые опираются тесты (поведение — по спецификации):

| Модуль | Экспорт |
|---|---|
| `element-kind.ts` | `elementDefaults(kind)` (без изменений), `acceptField(kind, field, cm)` (без изменений), `initialParams(): NewElementParams`, `inheritFrom(params, e): NewElementParams`; `nextDirection` удаляется |
| `doorway-edit.ts` | `ghostSwing(raw, wall, prev, deadCm): DoorSwing`, `setDirection(d, hinge, swing): ElementEdit<WallDoor>`; `rotateDoor` удаляется |
| `doorway-layout.ts` | `doorZones(d, walls)`, `doorZoneAt(p, d, walls)` |
| `editable-numbers.ts` | `editableNumbers(d, walls, elements, rooms, unit, k, labelPx): EditableNumber[]`, `numberAt(p, numbers, tolCm)` |
| `doorway-tool.ts` | `createElementTool(kind, host)` — без панели: `ghost`, `dragging`, `hover`, `place`, `pressDoorway`, `dragTo`, `endDrag`, `nudge`, `closeEditor`, `reset`; `createSelectionEditing(host)` — `pressNumber(p): boolean`, `pressZone(p): boolean`, `closeEditor()` |
| `openings-group.ts` | `groupButtonClick`, `groupPick`, `groupButtonActive`; `groupSelect` удаляется |

`ElementToolHost` дополняется `params(): NewElementParams`, `inherit(e: WallElement): void`, `rooms(): Room[]`
и `unit(): Unit`. `editableNumbers` принимает `labelPx` числом, а не `RenderMetrics`, чтобы слой элементов
не зависел от `render.ts`. В `render.ts` выделенный элемент получает подчёркивания правимых чисел, выделенная
дверь — штриховые альтернативные направления.

## Risks / Trade-offs

- [Оценка ширины текста `0.6 · labelPx`] → попадание в часть подписи окна у границы частей может промахнуться
  на символ. Митигация: та же оценка уже задаёт рамку; поле попадания `NUMBER_HIT_PX` и выбор ближайшего центра.
- [Зоны направления перекрывают числа цепочки и чужие объекты] → числа главнее зон (D6), зоны активны только
  при одиночной выделенной двери.
- [Скрытый «режим» параметров новых элементов] → значения не видны до установки. Принято пользователем;
  призрак показывает ширину и направление до клика.
- [undo не откатывает параметры новых] → по спецификации; иначе история смешала бы чертёж и настройки
  инструмента.
- [Горизонтальное поле ввода на повёрнутой подписи] → поле перекрывает подпись наклонной стены; так уже
  работают числа цепочки.

## Migration Plan

Формат документа не меняется: параметры новых элементов в чертёж не входят. Откат — возврат файлов change.

## Open Questions

Нет. Панель «Стена» (поле толщины) и устаревшее описание образца «значения панели» в `.claude/rules/ui.md`
записываются в `TODO.md`.
