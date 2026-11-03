import type { Point, SectionLine } from "../types"
import { endMarks } from "./section-marks"
import type { Bounds, FigurePlacement } from "./section-layout"
import type { SectionEntry } from "./section-scene"

// Что не должна занимать фигура разреза при перемещении (change move-section-figure, design D2): другие фигуры с названиями,
// линии разреза с концевыми штрихами и обозначениями, а также многоугольники и рамки объектов плана, которые передаёт вызывающий
// (стены, батареи, коммуникации, размеры, выноски, примечания). Чистые функции.

// место под название над фигурой в единицах чертежа: зависит от кегля и масштаба холста, поэтому приходит снаружи
export interface TitleSize {
  width: number
  height: number
}

const LINE_HALF_CM = 3 // половина толщины штриховой линии разреза как препятствия
const LABEL_HALF_CM = 7 // половина размера места под обозначение

export const boxPolygon = (b: Bounds): Point[] => [
  { x: b.minX, y: b.minY },
  { x: b.maxX, y: b.minY },
  { x: b.maxX, y: b.maxY },
  { x: b.minX, y: b.maxY },
]

// занятое место фигуры: сама фигура и название над ней (название может быть шире узкой фигуры)
export const figureRect = (p: FigurePlacement, title: TitleSize): Bounds => ({
  minX: p.x,
  maxX: p.x + Math.max(p.width, title.width),
  minY: p.floorY - p.height - title.height,
  maxY: p.floorY,
})

const segmentQuad = (a: Point, b: Point): Point[] => {
  const len = Math.hypot(b.x - a.x, b.y - a.y)
  if (len === 0) return []
  const nx = (-(b.y - a.y) / len) * LINE_HALF_CM
  const ny = ((b.x - a.x) / len) * LINE_HALF_CM
  return [
    { x: a.x + nx, y: a.y + ny },
    { x: b.x + nx, y: b.y + ny },
    { x: b.x - nx, y: b.y - ny },
    { x: a.x - nx, y: a.y - ny },
  ]
}

const around = (pts: readonly Point[]): Bounds => ({
  minX: Math.min(...pts.map((p) => p.x)),
  minY: Math.min(...pts.map((p) => p.y)),
  maxX: Math.max(...pts.map((p) => p.x)),
  maxY: Math.max(...pts.map((p) => p.y)),
})

// линия разреза как она нарисована: отрезки и по рамке на каждый концевой штрих со стрелкой и обозначением
function lineObstacles(shown: SectionLine): Point[][] {
  const quads = shown.points.slice(1).map((p, i) => segmentQuad(shown.points[i], p))
  const marks = endMarks(shown).flatMap((m): Point[][] => {
    const arrow = around([m.end, m.tail, m.strokeFrom, m.strokeTo])
    const label = { minX: m.labelAt.x - LABEL_HALF_CM, minY: m.labelAt.y - LABEL_HALF_CM, maxX: m.labelAt.x + LABEL_HALF_CM, maxY: m.labelAt.y + LABEL_HALF_CM }
    return [boxPolygon(arrow), boxPolygon(label)]
  })
  return [...quads, ...marks].filter((poly) => poly.length >= 3)
}

export interface FigureObstacleSources {
  entries: readonly SectionEntry[]
  // линия, фигуру которой двигают: её собственная фигура препятствием не считается
  lineId: string
  title: TitleSize
  // многоугольники объектов плана и рамки размеров, выносок и примечаний
  plan: readonly (readonly Point[])[]
}

export function figureObstacles(src: FigureObstacleSources): Point[][] {
  // автоматические фигуры сами обходят переставленные (section-layout), поэтому упором служат только переставленные
  const others = src.entries.filter((e) => e.line.id !== src.lineId && e.line.figureAt !== undefined).map((e) => boxPolygon(figureRect(e.placement, src.title)))
  const lines = src.entries.flatMap((e) => lineObstacles(e.shown))
  return [...src.plan.map((poly) => [...poly]), ...others, ...lines]
}
