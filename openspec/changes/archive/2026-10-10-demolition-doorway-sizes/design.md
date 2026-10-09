## Context

Сейчас числа пометки считаются по оси стены: `numbersOf`/`markNumberLayout` (`src/demolition/mark-numbers.ts`) дают три числа `[0, from]`, `[from, to]`, `[to, длина]` с одной стороны нормали; `markDimensions` (`mark-dimensions.ts`, change `demolition-dimension-chains`) рисует их `drawDimensionGeom`; `editNumber` правит их; инструмент `createDemolitionTool` (`demolition-tool.ts`) по клику снимает пометку, над которой нажали; `PLAN_TOOLS.demolition = ["demolition", "ruler"]` (`plans.ts`). У проёма расстояния считаются по граням до стыков: `faceRuns(host, walls, side)` (`doorway/doorway-faces.ts`), цепочка — `dimensionChains` (`doorway/doorway-layout.ts`).

## Decisions

### D1. Чистая раскладка цепочек по граням — `src/demolition/mark-chains.ts`

`faceBounds(r: MarkSpan, walls, side): FaceBounds | null` — `{ j0, j1, start, end }` в координате от конца `a`: свободный участок грани `[j0, j1]` из `faceRuns` с наибольшим перекрытием с `[r.from, r.to]` (иначе ближайший); `start = max(j0, from)`, `end = min(j1, to)`; если `from ≤ EPS_CM`, то `start = j0`; если `to ≥ длина − EPS_CM`, то `end = j1` (торцевая часть формы за концом оси; допуск `EPS_CM = 0,01` как в `markRegion`); затем `start` зажимается в `[j0, j1]`, `end` — в `[start, j1]` (размеры не отрицательны; пометка в разрыве у Т-примыкания даёт ширину 0). При равном перекрытии выбирается первый участок (меньшие `t`). Для `r.from`/`r.to` берутся границы `MarkSpan` (уже обрезанные по стене). `markChains(r, walls): MarkChainItem[]` — по три элемента на грань (`target ∈ {gapA, width, gapB}`) с `side ∈ {1, −1}`, `fromCm`, `toCm`, `lengthCm = max(0, toCm − fromCm)`; сторона `+1` — нормаль `(−d.y, d.x)`. Грани нет (`faceRuns` пуст) — пустой результат.

### D2. Правка чисел с учётом граней

`editNumber(marks, walls, id, which, side, valueCm)`: `which ∈ {a, width, b}` по `MarkChainItem.part`. Для грани `side` берётся `faceBounds`; `a`: `from' = j0 + v`, `to' = from' + w`; `b`: `to' = j1 − v`, `from' = to' − w`; `width`: `to' = start + v`, `from` не меняется (`w = to − from`). Затем `from' ∈ [0, L − w]` (для `a`, `b`) / `to' ∈ [from + 1, L]` (для `width`) зажимаются, результат сливается и ищется слитая пометка, как сейчас (`markFromSpan`, `mergeAll`). Недопустимый ввод — как сейчас (`null`). На свободной стене (`j0 = 0`, `j1 = L`) результат совпадает с прежним осевым.

### D3. Раскладка и подписи — `mark-dimensions.ts` (переработка)

`markDimensions(r, walls, mode: "chain" | "width", unit, k, labelPx): MarkDimension[]`: режим `chain` — шесть элементов (`markChains`), `width` — один (`width` грани `+1`, для PDF и ничего более). `MarkDimension = { side, part, fromCm, toCm, text, valueCm, geom: DimGeometry | null, spot }`; `geom` строится как у проёма: точки на грани `hostPoint(wall, t, side·h)`, вынос `CHAIN_OFFSET_EM·кегль/k` в сторону грани (`dimGeometry(a, b, offset · side)`); нулевой размер (`lengthCm ≤ 1e-6`) — `geom = null`, число над границей. `spot` — центр, направление и размеры числа для попадания и подчёркивания (как у `markNumberLayout`, центр на линии цепочки с зазором `DIM_TEXT_GAP_PX`). `markNumberAt` остаётся в `mark-numbers.ts`; `markNumberLayout`/`markLabelSpot`/`numbersOf` удаляются (заменены раскладкой). `markDimensionExtent(r, walls, k, m)` считает габариты `width`-режима.

### D4. Показ на экране

По умолчанию на экране: у выделенной пометки — `chain` с подчёркиванием, у превью — `chain` без подчёркивания, у остальных ничего. Для PDF (`pdf.ts`) сцена вызывается с `widths: true`: ширина каждой действующей пометки (`width`-режим, сплошная линия без подчёркивания), без цепочек. Реализация — поле `widths?: boolean` в `DemolitionOptions` (PDF: `true`, экран: не задано); у выделенной пометки при `widths` рисуется цепочка.

### D5. Инструмент «Демонтаж» и ластик

В `createDemolitionTool.up` клик по снесённой области возвращает `null` без изменений (ветка снятия удаляется). Новый метод `erase(p: Point): boolean` — снять пометку под точкой одним шагом истории (`markAt`, `removeMark`, `commit`), сбросить выделение, если она была выделена; `eraseTarget(p): string | null` — идентификатор пометки под точкой для подсветки. `PLAN_TOOLS.demolition = ["demolition", "ruler", "eraser"]`. `main.ts`: на плане «Демонтаж» при `tool === "eraser"` — клик вызывает `demolitionTool.erase(toWorld(e))`, движение запоминает цель подсветки (`hoverMark`), `drawDemolitionPlan` передаёт её сцене (`erasing: id | null`), сцена обводит область цветом `palette.erase`; класс курсора `tool-eraser` уже включается в `syncToolUI`. Нажатие на плане «Демонтаж» при ластике не ведёт к протяжке и выделению. Кнопка «Ластик» (`#tool-eraser`) уже в разметке с `data-tools`; набор инструментов плана делает её видимой. `setTool` сбрасывает выделение и протяжку (`resetDemolition`).

## Risks / Trade-offs

- Широкий радиус изменений тестов: утверждённые тесты чисел на оси (`mark-numbers.test.ts`, тесты инструмента с `numberAt/applyNumber`, рендер с подписью ширины невыделенной, габариты PDF), снятие пометки кликом — через запросы на изменение тестов (`test-plan.md`).
- Невыделенные пометки на экране без числа: ширина видна только при выделении и в PDF (решение пользователя).
- Правка ширины по грани с торцевой частью даёт `to' = j0 + v` (например, `10 + v` у внутренней грани): число на грани и ось различаются у угла — как и у проёма, где расстояние измеряется вдоль грани.
