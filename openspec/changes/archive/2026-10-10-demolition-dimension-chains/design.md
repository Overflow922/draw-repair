## Context

Сейчас `drawDemolitionScene` (`src/demolition/demolition-render.ts`) рисует числа пометок текстом (`drawNumber`) в позициях `markNumberLayout` / `markLabelSpot` (`src/demolition/mark-numbers.ts`): линия цепочки отстоит от грани стены на `CHAIN_OFFSET_EM · кегль`, число стоит над ней. Размеры чертежа и цепочка проёма рисуются `drawDimensionGeom` (`src/render.ts`, сейчас не экспортируется): выносные линии от измеряемых точек, размерная линия со стрелками, число с белой подложкой, при `underline` — штриховой участок под числом. Габариты страницы PDF считает `wallsBBox` (`src/export/pdf.ts`) без пометок.

## Decisions

### D1. Размер пометки рисует `drawDimensionGeom`

`drawDimensionGeom` экспортируется из `render.ts` без изменения поведения. Для каждого размера пометки (ширина; у выделенной — отступ `a`, ширина, отступ `b`) сцена демонтажа строит `DimGeometry` через `dimGeometry(a, b, offset)`: `a`, `b` — точки грани стены (`hostPoint(wall, from|to, thickness/2)`), `offset = CHAIN_OFFSET_EM · кегль / k` в сторону нормали `(−d.y, d.x)` (ось `a → b` даёт тот же знак). Цвет — `opts.color`, подчёркивание — только у чисел выделенной пометки. Образец — цепочка проёма (блок `dimensionChains` в отрисовке выбранного проёма, `render.ts`).

### D2. Чистая раскладка размеров — `src/demolition/mark-dimensions.ts`

- `markDimensions(r: MarkSpan, selected: boolean, unit, k, labelPx): MarkDimension[]` — `{ target: NumberTarget; fromCm; toCm; text; geom: DimGeometry | null; spot: MarkNumberSpot }`; невыделенная — один элемент `width`, выделенная — три (`gapA`, `width`, `gapB`); `geom = null` у размера нулевой длины (`≤ 1e-6`), тогда рисуется только число в `spot` как раньше (`drawNumber`).
- `markDimensionExtent(r: MarkSpan, k, m: RenderMetrics): Point[]` — точки в см чертежа для габаритов страницы: концы размерной линии со сдвигом на `dimOvershootPx / k` дальше линии и четыре угла прямоугольника числа ширины (`markLabelSpot`).

Числа и их прямоугольники для попадания (`markNumberLayout`, `markNumberAt`) не меняются: правка по клику работает как раньше; размерные линии не выделяются.

### D3. Превью протяжки и PDF — тот же код

Превью протяжки получает ширину через `markDimensions(span, false, …)`; PDF вызывает ту же `drawDemolitionScene` (выделения в PDF нет — только ширины).

### D4. Габариты страницы демонтажа

`wallsBBox` получает последний необязательный параметр `extra: readonly Point[] = []` — дополнительные точки габаритов, поле `padCm` вокруг них то же. `pageBounds(page, scale)` экспортируется; для страницы демонтажа передаёт точки `markDimensionExtent` каждой пометки при `k = 10 / scale` (px страницы на см чертежа) и `labelPx = PDF_METRICS.labelPx`. Остальные страницы и вызовы `wallsBBox` без `extra` не меняются.

## Risks / Trade-offs

- Штриховка пометки и размерные линии красные одной толщины `hatchPx`: тесты, считающие красные штрихи толщины штриховки, различают их по углу (см. test-plan, TCR-1).
- Подчёркивание выделенных чисел теперь штрих размерной линии под числом (как у проёма), а не отдельная штриховая линия под текстом.
- Размерные линии выступают за грань стены на `1,2 · кегль` и лежат на стороне нормали: у стены с нормалью наружу они могут выходить за габариты стен, поэтому нужны D4.
