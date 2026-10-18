import type { RenderMetrics } from "./render"
import type { Palette } from "./theme"
import type { Material, Point } from "./types"
import { WOOD_TILE, tileExtent } from "./wood-tile"
import type { TilePattern } from "./wood-tile"

// Штриховки материалов стен как данные (change new-wall-materials, design D2, D3, D4). Линейные штриховки — серии линий
// под 45° или 135° к осям чертежа с шагом в мм листа; «Бетон» — заливка цветом схемы и пунктир; «Дерево» — повтор тайла.
// Фаза всех штриховок привязана к точке начала координат чертежа на холсте (origin), поэтому она не меняется при
// панораме и продолжается через стыки стен. Шаг и размер узора заданы в мм листа и от масштаба не зависят.

export interface LineSeries {
  angle: 45 | 135 // 45°: линии x + y = const («/»); 135°: линии y − x = const («\»)
  stepMm: number // расстояние между соседними линиями
  widthK: number // множитель толщины линии штриховки (m.hatchPx)
  dashMm: readonly number[] // пунктир, мм листа (чередование штрих/пауза); пусто — сплошная
}

export type HatchSpec =
  | { kind: "lines"; series: readonly LineSeries[] }
  | { kind: "fill-lines"; fill: keyof Pick<Palette, "concreteFill">; series: readonly LineSeries[] }
  | { kind: "tile"; tile: TilePattern; widthK: number }

// шаг 3 мм и толщина 1,0× — прежняя штриховка «Кирпича»
const SOLID_45 = (stepMm: number, widthK: number): LineSeries => ({ angle: 45, stepMm, widthK, dashMm: [] })

export const HATCHES: Record<Material, HatchSpec> = {
  blocks: { kind: "lines", series: [SOLID_45(2, 0.6)] },
  brick: { kind: "lines", series: [SOLID_45(3, 1)] },
  concrete: { kind: "fill-lines", fill: "concreteFill", series: [{ angle: 45, stepMm: 3, widthK: 1, dashMm: [1.2, 1.2] }] },
  gkl: {
    kind: "lines",
    series: [SOLID_45(4, 0.6), { angle: 135, stepMm: 4, widthK: 0.6, dashMm: [] }],
  },
  "wood-long": { kind: "tile", tile: WOOD_TILE, widthK: 0.8 },
}

// красная штриховка области сноса: линии 135° с шагом прежней штриховки «Кирпича» (change demolition-plan, design D8)
export const DEMOLITION_HATCH: LineSeries = { angle: 135, stepMm: 3, widthK: 1, dashMm: [] }

// штриховка стяжки плана «Черновые работы»: линии «/» под 45° с шагом реже, чем у материалов (change add-rough-works-plan, design D9)
export const SCREED_HATCH: LineSeries = { angle: 45, stepMm: 4, widthK: 0.6, dashMm: [] }

function polyBounds(poly: readonly Point[]): [number, number, number, number] {
  const xs = poly.map((p) => p.x)
  const ys = poly.map((p) => p.y)
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
}

function mod(x: number, m: number): number {
  return ((x % m) + m) % m
}

// константа линии штриховки в точке начала координат чертежа: x + y для 45°, y − x для 135°
export const anchorConstant = (origin: Point, angle: 45 | 135): number => (angle === 45 ? origin.x + origin.y : origin.y - origin.x)

// Серия линий поверх области poly. Линии идут по габаритам области и длиннее самой области (их обрезает клиппинг);
// пунктир начинается на общей для чертежа вертикали, а не на краю области, чтобы фаза не зависела от формы стены.
export function strokeHatchSeries(ctx: CanvasRenderingContext2D, poly: readonly Point[], series: LineSeries, origin: Point, m: RenderMetrics): void {
  const anchorC = anchorConstant(origin, series.angle)
  const [minX, minY, maxX, maxY] = polyBounds(poly)
  const step = series.stepMm * m.mmPx * Math.SQRT2
  const dash = series.dashMm.map((d) => d * m.mmPx)
  const dashPeriodX = dash.reduce((sum, d) => sum + d, 0) / Math.SQRT2
  const startX = dash.length > 0 && dashPeriodX > 0 ? minX - mod(minX - origin.x, dashPeriodX) : minX
  const rising = series.angle === 45
  const lo = rising ? minX + minY : minY - maxX
  const hi = rising ? maxX + maxY : maxY - minX
  ctx.lineWidth = m.hatchPx * series.widthK
  ctx.setLineDash(dash)
  ctx.beginPath()
  for (let c = lo - mod(lo - anchorC, step); c <= hi; c += step) {
    if (rising) {
      ctx.moveTo(startX, c - startX)
      ctx.lineTo(maxX, c - maxX)
    } else {
      ctx.moveTo(startX, startX + c)
      ctx.lineTo(maxX, maxX + c)
    }
  }
  ctx.stroke()
  ctx.setLineDash([])
}

// Повтор тайла сеткой от точки origin: рисуются тайлы, габариты которых пересекают габариты области poly.
export function strokeHatchTile(ctx: CanvasRenderingContext2D, poly: readonly Point[], tile: TilePattern, widthK: number, origin: Point, m: RenderMetrics): void {
  const [minX, minY, maxX, maxY] = polyBounds(poly)
  const w = tile.widthMm * m.mmPx
  const h = tile.heightMm * m.mmPx
  const ext = tileExtent(tile)
  const iFrom = Math.floor((minX - origin.x - ext.maxX * m.mmPx) / w)
  const iTo = Math.ceil((maxX - origin.x - ext.minX * m.mmPx) / w)
  const jFrom = Math.floor((minY - origin.y - ext.maxY * m.mmPx) / h)
  const jTo = Math.ceil((maxY - origin.y - ext.minY * m.mmPx) / h)
  ctx.lineWidth = m.hatchPx * widthK
  ctx.beginPath()
  for (let i = iFrom; i <= iTo; i++) {
    for (let j = jFrom; j <= jTo; j++) {
      const ox = origin.x + i * w
      const oy = origin.y + j * h
      for (const line of tile.lines) {
        line.forEach((p, k) => {
          const x = ox + p.x * m.mmPx
          const y = oy + p.y * m.mmPx
          if (k === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        })
      }
    }
  }
  ctx.stroke()
}
