## Context

Наблюдаемое состояние кода после change `drawing-plans` (на 2026-10-09):

- `src/plans.ts`: `PLANS` с единственным планом `measure`, `PlanId`, `DEFAULT_PLAN`, `isPlanId`, `activePlanOf`, `historyKey` (для не-`measure` плана — `"<drawingId>:<plan>"`). `Drawing.activePlan?` хранится в документе версии 3; `parseStore` отбрасывает недопустимое значение. `planHistory(history, drawingId, plan)` в `history.ts`; в `main.ts` вся работа с историей идёт через `activeHistory()`.
- `src/export/pdf.ts`: `PlanPage { walls, dimensions, doorways }`, `pagesOf(drawing)` даёт по странице на план каталога, `buildPdfPages`, `availableFormatsForPages`, `exportPages`; `buildPdf/availableFormats/exportDrawing` — одностраничные обёртки для approved-тестов.
- `main.ts` держит состояние обмерочного плана в локальных `walls`, `dimensions`, `doorways` (зеркало `current()`), `tool: Tool`, выделение и жесты; обработчики холста (`pointerdown/move/up`, `click`, `keydown`) знают только обмерочный план; `activate(id)` сбрасывает все жесты и выделение и ставит `tool = "wall"`; `setPlan(id)` вызывает `activate`. Слияние продолжения стены (`mergeContinuation`) вызывается в `commitPoint`.
- `render.ts`: `drawScene(ctx, w, h, walls, preview, unit, view, selected, opts)`; стены рисует `drawWall` (форма `displayPolygons`, выемки проёмов `cutPieces`, штриховка материала `strokeHatch45`), `opts.palette`, `SCREEN_METRICS`/`PDF_METRICS` (`contourPx`, `hatchPx`, `mmPx`, `labelPx`). `Palette` (`theme.ts`) проверяется approved-тестом на точный набор ключей — поля добавлять нельзя.
- Примитивы геометрии: `displayPolygons(wall, walls)` — форма стены с учётом стыков; `clipHalfPlane`; `coveredInterval`; `pointInPolygon`; `polygonArea`; `jambsT(el, host)` (откосы по t от конца a), `hostPoint(host, t, lat)`; `snapRadiusCm(zoom)`; `wallNearBody(p, walls, tolCm)`; `openNumberEditor`; `formatLength(cm, unit)` (целые см, метры с запятой); `CHAR_WIDTH`, `CHAIN_OFFSET_EM`, `DIM_TEXT_GAP_PX` — образец правки чисел на месте у проёма.
- Утверждённые тесты неизменны (Rule 5). Спецификация этого change сознательно меняет два существующих поведения (состав каталога, `pagesOf`): соответствующие тесты меняются запросами на изменение тестов (см. `test-plan.md`).

## Goals / Non-Goals

**Goals:**
- Модель пометок сноса и чистые функции над ней (домен): действие пометок, слияние, правка чисел, области сноса, скрытие элементов, привязка к узлам, перенос привязки при слиянии стен.
- Инструмент «Демонтаж», выделение пометки и правка чисел на месте.
- Отображение плана «Демонтаж» на холсте и в PDF одной функцией отрисовки.
- Хранение пометок и их история без повышения версий документов.
- Наборы инструментов планов и инструмент по умолчанию — данными в каталоге.

**Non-Goals:**
- Размеры, подписи площадей и подписи элементов на плане демонтажа; ластик и выделение стен подложки.
- Частичный снос элемента стены; изменение стен обмерочного плана демонтажем.
- Абстрактная цепочка «план строится на результате предыдущего» (планов два).
- Название плана в основной надписи (`TODO.md`).

## Decisions

### D0. Раскладка модулей `src/demolition/`

| Файл | Содержимое |
|---|---|
| `mark-model.ts` | `EPS_CM`, `MIN_WIDTH_CM`, `ResolvedMark`, `MarkSpan`, `span`, `canDemolish`, `effectiveMarks` (D2); без зависимостей от остальных модулей папки, чтобы `mark-region` и `marks` не образовывали цикл |
| `marks.ts` | `addMark`, `removeMark`, `mergeAll`, `markFromSpan`, `sameMarks`, `markAt` (D2); повторно экспортирует символы `mark-model.ts` |
| `mark-region.ts` | `markRegion`, `hiddenElements`, `visibleElements` (D3) |
| `mark-snap.ts` | `alongNodes`, `snapAlong` (D4) |
| `mark-numbers.ts` | `numbersOf`, `editNumber`, `markNumberLayout`, `markLabelSpot`, `markNumberAt` (D5) |
| `mark-follow.ts` | `reanchorMarks` (D6) |
| `demolition-render.ts` | `drawDemolitionScene`, `demolitionColor` (D8) |
| `demolition-tool.ts` | `createDemolitionTool`, `DemolitionToolHost` (D10) |

Все файлы, кроме `demolition-render.ts` (канвас) и `demolition-tool.ts` (состояние жеста), — чистые функции; ни один не обращается к DOM, `localStorage`, `main.ts`. Домен зависит от `types`, `wall-geometry`, `doorway/doorway-faces` (`jambsT`, `hostPoint`), `format-length`.

### D1. Каталог, наборы инструментов, тип `Tool`

`PLANS` получает вторую запись `{ id: "demolition", label: "Демонтаж" }` после `measure`. В `plans.ts` добавляется

```
PLAN_TOOLS: Record<PlanId, readonly Tool[]>   // measure: wall, doorway, door, window, dimension, ruler, eraser; demolition: demolition, ruler
toolsOf(plan: PlanId): readonly Tool[]
defaultToolOf(plan: PlanId): Tool             // первый инструмент набора: wall / demolition
```

`Tool` (`doorway/openings-group.ts`) расширяется значением `"demolition"`; `plans.ts` импортирует `Tool` как тип. `historyKey` не меняется. `activate()` и `setPlan()` выставляют `tool = defaultToolOf(activePlanOf(current()))`.

Наборы инструментов — данные каталога, а не условия в `main.ts`: следующие планы добавляются записью, а проверка «инструмент доступен на плане» — чистая функция.

### D2. Модель пометки и `marks.ts`

```
interface DemolitionMark { id: string; wallId: string; anchor: "a" | "b"; fromCm: number; toCm: number }   // types.ts
Drawing.demolition?: DemolitionMark[]                                                                        // types.ts

EPS_CM = 0.01;  MIN_WIDTH_CM = 1
interface ResolvedMark { mark: DemolitionMark; wall: Wall; from: number; to: number }    // from/to — от конца a, обрезаны по [0, len]

span(mark, wall): [number, number]       // границы от конца a без обрезки: anchor a → [fromCm, toCm]; b → [len − toCm, len − fromCm]
canDemolish(wall: Wall): boolean         // материал не "reinforced" и стена не вырождена
effectiveMarks(marks: readonly DemolitionMark[], walls: readonly Wall[]): ResolvedMark[]
addMark(marks, walls, wallId, fromA, toA, newId?: () => string): DemolitionMark[]
removeMark(marks, id): DemolitionMark[]
mergeAll(marks, walls): DemolitionMark[]
markAt(p: Point, resolved: readonly ResolvedMark[], walls: readonly Wall[]): ResolvedMark | null
```

Все функции чистые: входы не мутируются; результат — новый массив, а если операция ничего не изменила — **тот же массив** (`===`), по нему инструмент решает, писать ли шаг истории.

- `effectiveMarks`: в порядке списка; пометка действует, если стена с `wallId` есть в `walls`, `canDemolish(wall)`, а участок `span`, обрезанный по `[0, len]`, длиннее `EPS_CM`; стена с несколькими пометками даёт несколько записей.
- `addMark`: `fromA < toA` — участок в координатах от конца `a`; обрезается по `[0, len]`; отклоняется (тот же массив), если стены нет, `!canDemolish`, обрезанная ширина `< MIN_WIDTH_CM` или значения не конечны. Новый участок сливается со всеми пометками той же стены, чьи `span` пересекаются с ним или отстоят не дальше `EPS_CM`; результат — одна пометка с объединённым участком; её `id` — идентификатор первой по порядку списка из слитых, иначе `newId()` (по умолчанию `crypto.randomUUID`); она занимает место первой слитой, новая без слияния добавляется в конец. Конец привязки результата — ближний к середине участка (`mid ≤ len/2` → `a`, иначе `b`; равенство → `a`); `fromCm/toCm` записываются от него. Если новый список по содержимому равен исходному (например, участок уже целиком внутри существующей пометки) — возвращается исходный массив.
- `mergeAll`: слияние по тем же правилам пометок каждой существующей стены без добавления новой; пометки на отсутствующие стены не меняются и сохраняют порядок.
- `markAt`: пометка, в область которой (`markRegion`) попадает точка; из нескольких — последняя в списке.

### D3. Область сноса и скрытие элементов (`mark-region.ts`)

```
markRegion(r: ResolvedMark, walls: readonly Wall[]): Point[][]
hiddenElements(elements: readonly WallElement[], resolved: readonly ResolvedMark[]): WallElement[]
visibleElements(elements, resolved): WallElement[]
```

`markRegion`: полигоны `displayPolygons(r.wall, walls)`, обрезанные `clipHalfPlane` по нормали оси: по `from`, если `from > EPS_CM`, и по `to`, если `to < len − EPS_CM`. При `from ≤ EPS_CM` / `to ≥ len − EPS_CM` обрезки с этой стороны нет, поэтому у «целой стены» область включает торцевые части формы за концами оси. Пустые полигоны отбрасываются.

`hiddenElements`: элемент скрыт, если у действующей пометки его опорной стены (`r.wall.id === el.wallId`) интервал `[from, to]` пересекается с интервалом откосов `jambsT(el, r.wall)` на длину `> EPS_CM`; касание не скрывает; элемент без действующих пометок на своей стене не скрыт. `visibleElements` — дополнение (порядок сохраняется).

### D4. Узлы и привязка (`mark-snap.ts`)

```
alongNodes(wall: Wall, walls: readonly Wall[], elements: readonly WallElement[]): number[]
snapAlong(t: number, nodes: readonly number[], radiusCm: number, lenCm: number): number
```

`alongNodes` — координаты вдоль оси от конца `a`, по возрастанию, без дублей в пределах `EPS_CM`: `0` и `len`; откосы элементов этой стены (`jambsT`); границы вдоль оси, в которых форма другой стены входит в полосу этой стены и выходит из неё: для каждой другой стены её полигоны `displayPolygons` обрезаются полосой этой стены (`clipHalfPlane` по нормали оси с обеих сторон, `|lat| ≤ толщина/2`, границы полосы включительно), и берутся наименьшая и наибольшая координаты `t` вдоль оси у оставшихся вершин; узлы вне `[0, len]` отбрасываются. Одной оси для этого недостаточно: стена, примыкающая торцом к грани (T-примыкание), с осью не пересекается, но её форма лежит на границе полосы и даёт узлы.

`snapAlong`: ближайший узел, если расстояние до него `≤ radiusCm`; иначе `Math.round(t)`; результат зажимается в `[0, lenCm]`. Проекция курсора на ось: `t = dot(p − a, unit(a, b))`.

### D5. Числа участка (`mark-numbers.ts`)

```
type NumberTarget = "gapA" | "width" | "gapB"
interface MarkNumbers { gapA: number; width: number; gapB: number }
numbersOf(r: ResolvedMark): MarkNumbers                          // from; to − from; len − to
editNumber(marks, walls, id, which: NumberTarget, valueCm: number): { marks: DemolitionMark[]; id: string } | null
interface MarkNumberSpot { target: NumberTarget; text: string; valueCm: number; center: Point; dir: Point; widthCm: number; heightCm: number }
markNumberLayout(r: ResolvedMark, unit: Unit, k: number, labelPx: number): MarkNumberSpot[]   // три числа: gapA, width, gapB
markLabelSpot(r, unit, k, labelPx): MarkNumberSpot                                             // только ширина
markNumberAt(p: Point, spots: readonly MarkNumberSpot[], tolCm: number): MarkNumberSpot | null
```

`editNumber` (`null` — недопустимый ввод или недействующая/неизвестная пометка; иначе новый список и идентификатор слитой пометки): `valueCm` не конечное, `gapA/gapB < 0` или `width < MIN_WIDTH_CM` → `null`. Пусть `[from, to]` — действующий участок (от `a`), `W = to − from`, `L` — длина: `gapA = x` → начало `min(x, L − W)`, ширина `W`; `gapB = x` → конец `L − min(x, L − W)`, ширина `W`; `width = x` → начало `from`, конец `from + min(x, L − from)`. Результат записывается как `addMark`-слияние с удалением прежней пометки (пересекающиеся и соприкасающиеся сливаются, якорь пересчитывается); идентификатор — как у слитого результата (редактируемая пометка стоит в списке на своём месте, поэтому её `id` сохраняется, если она первая слитая; иначе берётся `id` первой слитой).

Раскладка (по образцу `editableNumbers` проёма): ось `axis = unit(a, b)`, `dir` — направление текста слева направо вдоль оси (`atan2`, разворот на π при `|angle| > π/2`), `up = (dir.y, −dir.x)`; число отрезка `[t0, t1]` оси стоит в точке `hostPoint(wall, (t0+t1)/2, lat)`, `lat = thickness/2 + CHAIN_OFFSET_EM·labelPx/k` (сторона нормали `(−axis.y, axis.x)`), смещённой на `up · (DIM_TEXT_GAP_PX + labelPx/2)/k`; отрезок нулевой длины (`≤ 1e-6`) — `dir = (1, 0)`, подъём `labelPx/2/k`. Отрезки: `[0, from]`, `[from, to]`, `[to, len]`. `text = formatLength(value, unit)`, `widthCm = text.length·labelPx·CHAR_WIDTH/k`, `heightCm = labelPx/k`. `markNumberAt` — как `numberAt` проёма (прямоугольник числа, допуск, ближайший центр).

### D6. Перенос привязки при слиянии стен (`mark-follow.ts`)

Положение хранится относительно конца привязки, поэтому перемещение стены и её концов следует за стеной само (как у проёма) и кода не требует. Единственная операция, переопределяющая концы с сохранением положения в плане, — слияние продолжения (`mergeContinuation`, `wall-merge.ts`).

```
reanchorMarks(marks: readonly DemolitionMark[], before: readonly Wall[], after: readonly Wall[]): DemolitionMark[]
```

Стены сравниваются по `id`. Если у стены изменилась ровно одна вершина `E` (`a` или `b`), и она сместилась на том же луче наружу (стена удлинилась; противоположный конец `O` не двигался), все пометки этой стены получают привязку `O` с расстояниями от `O`, измеренными по старой стене: для `O = a` это `[s, e]` (границы от `a`), для `O = b` — `[len_old − e, len_old − s]`. Пометки, уже привязанные к `O`, остаются без изменений; расстояния не зависят от величины удлинения. Остальные пометки не меняются. `main.ts` вызывает `reanchorMarks` сразу после успешного слияния. Расстояния от неподвижного конца одинаковы у стены до и после слияния, поэтому отмена слияния на обмерочном плане возвращает пометки на прежние места без записей в истории.

### D7. Хранение (`storage.ts`) и история (`history.ts`)

`storage.ts`: `isDemolitionMark(value: unknown): value is DemolitionMark` (непустые строки `id`, `wallId`; `anchor` `a|b`; `fromCm`, `toCm` конечные числа, `fromCm ≥ 0`, `toCm > fromCm`). `parseStore` для каждого чертежа: поле `demolition` отсутствует — не дописывается; список — отбрасываются некорректные и со стеной, которой нет в чертеже; затем `mergeAll`; результат записывается в чертёж только если поле было в документе (непустой массив после фильтрации сохраняется, пустой — как пустой массив). Пометки на железобетоне сохраняются. Значение поля, не являющееся массивом, читается как отсутствующее поле (список пустой, поле в чертёж не записывается).

`history.ts`: `HistoryEntry` расширяется записью `{ kind: "demolition"; marks: DemolitionMark[] }`; функции

```
recordMarks(history: DrawingHistory, marks: readonly DemolitionMark[]): void       // снимок до правки; срез ветки повтора, лимит HISTORY_LIMIT
undoMarks(history, current: readonly DemolitionMark[]): DemolitionMark[] | null    // снимок из past; текущие пометки кладутся в future
redoMarks(history, current): DemolitionMark[] | null
```

Снимки копируются. `isHistoryEntry` принимает `kind: "demolition"` с `marks.every(isDemolitionMark)`. Версия документа истории — 2. Существующие функции и записи `walls`/`close` не меняются; `undoEntry` на записи `demolition` не вызывается (в истории плана «Демонтаж» только такие записи).

### D8. Отрисовка (`demolition-render.ts`, `render.ts`)

```
interface DemolitionScene {
  walls: readonly Wall[]; doorways: readonly WallElement[]      // подложка; элементы — без скрытых
  marks: readonly ResolvedMark[]; selectedId?: string | null
  ghost?: { wallId: string; from: number; to: number } | null   // превью протяжки, от конца a
}
drawDemolitionScene(ctx, w, h, scene: DemolitionScene, unit: Unit, view: View, opts: { color: string; grid?: boolean; metrics?: RenderMetrics; palette?: Palette }): void
demolitionColor(theme: Theme): string                            // красный: светлая и тёмная схема
```

1. Подложка: `drawScene(ctx, w, h, walls, null, unit, view, [], { grid, metrics, palette: { ...palette, ink: palette.muted }, dimensions: [], doorways, underlay: true })`.
2. Для каждой пометки: полигоны `markRegion` в экранных координатах закрашиваются `palette.paper`; затем в клипе по ним красные линии под углом 135° к осям (направление экрана `(1, 1)`, шаг и фаза как у `strokeHatch45`, толщина `metrics.hatchPx`); затем красный контур области (`metrics.contourPx`). Цвет — `opts.color`.
3. Подпись ширины (`markLabelSpot`) красным; у выделенной — три числа `markNumberLayout` (как у проёма — с подчёркиванием правимых чисел); превью `ghost` — красный пунктир по области с числом ширины.

В `render.ts` добавляется опция `RenderOptions.underlay?: boolean`: подавляет подписи помещений, размеры и отрисовку `drawDoorways`; вырезы в стенах по списку `doorways` остаются. Штриховка 45° вынесена в экспортируемую функцию (`strokeHatch`) для повторного использования с обратным направлением. Поле палитры не добавляется (approved-тест на набор ключей).

### D9. PDF: страница демонтажа

`PlanPage` получает необязательное поле `demolition?: readonly ResolvedMark[]`; страницы без поля рисуются как раньше (approved-тесты не затрагиваются). `pagesOf(drawing)` возвращает по странице на план каталога: для `measure` — как сейчас; для `demolition` — `{ walls: drawing.walls, dimensions: [], doorways: visibleElements(doorways, marks), demolition: marks }`, где `marks = effectiveMarks(drawing.demolition ?? [], drawing.walls)`. `drawPage` при `page.demolition !== undefined` вызывает `drawDemolitionScene` с `PDF_METRICS`, без сетки, светлой палитрой и светлым красным (`demolitionColor("light")`). Габариты и список форматов — по стенам подложки (`wallsBBox` без размеров). Условие доступности экспорта не меняется.

### D10. Инструмент «Демонтаж» и интеграция в `main.ts`

`demolition-tool.ts` — состояние жеста и выделения без DOM (редактор числа остаётся в `main.ts` поверх `openNumberEditor`):

```
interface DemolitionToolHost {
  walls(): readonly Wall[]; elements(): readonly WallElement[]; marks(): readonly DemolitionMark[]
  setMarks(next: DemolitionMark[]): void     // заменить пометки чертежа
  record(): void                             // одна запись истории (снимок текущих пометок) — перед setMarks и только при изменении
  changed(): void; redraw(): void
  radiusCm(): number; newId(): string
}
interface DemolitionTool {
  down(p: Point, px: Point): void            // p — мир (см), px — экранная точка
  move(p: Point, px: Point): void
  up(p: Point, px: Point): void
  cancel(): void                             // Escape: прервать протяжку без изменений
  dragging(): boolean
  ghost(): { wallId: string; from: number; to: number } | null
  select(p: Point): boolean                  // без инструмента: выделить пометку под точкой; false — выделение снято
  selectedId(): string | null
  clearSelection(): void
  deleteSelected(): boolean
  numberAt(p: Point, unit: Unit, k: number, labelPx: number, tolCm: number): MarkNumberSpot | null   // правимое число выделенной пометки
  applyNumber(which: NumberTarget, valueCm: number): boolean   // editNumber → record + setMarks + changed; выделение сохраняется
}
createDemolitionTool(host: DemolitionToolHost): DemolitionTool
```

Разбор жеста — в `up`: нажатие `down` запоминает стену под точкой (`wallNearBody(p, walls, host.radiusCm())`; нет стены — жеста нет) и экранную точку; `move` дальше мёртвой зоны (`> 4 px` от нажатия) начинает протяжку и обновляет `ghost()`: границы — проекции точки нажатия и текущей точки на ось нажатой стены, привязанные `snapAlong(…, alongNodes(wall, walls, elements), host.radiusCm(), len)`, упорядоченные по возрастанию. `up` с протяжкой и шириной `≥ MIN_WIDTH_CM` → `addMark(…)`; иначе клик: точка в области действующей пометки (`markAt`) → `removeMark`, иначе стена под курсором → `addMark` на `[0, len]`. Если результат — тот же массив, `record`/`setMarks` не вызываются. Для `!canDemolish(wall)` жест ничего не делает.

`main.ts`: `onDemolition()` (= активный план `demolition`) — в начале обработчиков холста левой кнопки (`pointerdown`/`move`/`up`/`click`/`pointerleave`) и `window keydown` (Delete, Escape) идёт делегирование адаптеру и `return`; средняя кнопка и колесо остаются общими. Без инструмента (`tool === "none"`) нажатие вызывает `numberAt` (открыть `openNumberEditor`), иначе `select`. `redraw()` для плана «Демонтаж» вызывает `drawDemolitionScene` вместо `render(...)` (то же `canvas`/DPR-обёртка), `syncFormats` не меняется. `undo/redo` для плана «Демонтаж» работают через `undoMarks/redoMarks` и `resetEditing`; `setMarks` обновляет `current().demolition` и ставит `dirty`. После успешного слияния стен в `commitPoint` вызывается `reanchorMarks`. Кнопки инструментов показываются по `toolsOf(plan)` (атрибут `hidden`); новая кнопка `#tool-demolition` с SVG-иконкой в стиле остальных — без вспомогательной панели. «Линейка» вызывает `rulerReading(cursor, walls)` по стенам подложки без изменений. `activate()` дополнительно сбрасывает адаптер (`cancel`, `clearSelection`, закрытие редактора) и ставит инструмент по умолчанию плана.

### D11. Порядок и границы работ

1. Каталог и наборы инструментов (`plans.ts`, `Tool`), `DemolitionMark`, `Drawing.demolition?`.
2. Домен: `marks`, `mark-region`, `mark-snap`, `mark-numbers`, `mark-follow`.
3. Хранение и история.
4. Отрисовка (`render.ts`: `underlay`, `strokeHatch`; `demolition-render.ts`).
5. PDF: `pagesOf`, `PlanPage.demolition`, `drawPage`.
6. Адаптер инструмента, интеграция в `main.ts`, `index.html`, `style.css`.

## Risks / Trade-offs

- **Пометки не откатываются с обмерочным планом.** Пометки — отдельная история; отмена правки обмерочного плана (удаление стены, смена материала) возвращает стену, и пометка, оставшаяся в хранилище, снова действует — ради этого пометки не удаляются при правках обмера. Слияние стен (`reanchorMarks`) меняет только привязку на неподвижный конец; расстояния от него одинаковы у стены до и после слияния, поэтому отмена слияния возвращает пометки на прежние места без их участия в истории обмерочного плана.
- **Недействующие пометки копятся в хранилище** (стены удалены навсегда): при загрузке пометки на отсутствующие стены отбрасываются, рост ограничен сессией.
- **Растущий `main.ts`** получает делегирование в одном месте; логика вынесена в `src/demolition/`.
- **Красный цвет не покрыт `parsePaths`** (операторы цвета PDF не разбираются): разбор цвета — в новом тестовом утилите на этапе тестов.
- **Область сноса у стыков.** Используется форма стены `displayPolygons` с обрезкой по плоскостям; у косых стыков и Т-примыканий граница может заходить на форму соседней стены.
- **Точность привязки.** Узлы по границам форм других стен считаются по `coveredInterval` на оси стены; для стен, лишь касающихся оси, интервал может быть пустым — узла нет, граница округляется до сантиметра.
- **Совместимость.** Документы и истории прежних версий открываются без миграции; документ с `demolition` старая версия приложения откроет (поле игнорируется), активный план `demolition` старая версия читает как `measure`.
