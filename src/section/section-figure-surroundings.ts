import type { DoorLeaf } from "../doorway/doorway-layout"
import type { CalloutLayout } from "../callout/callout-layout"
import type { DimGeometry } from "../geometry"
import type { Point } from "../types"
import { boxPolygon } from "./section-figure-obstacles"
import type { SectionObstacle } from "./section-free"

// Многоугольники объектов плана «Реконструкция», на которые не должна заходить фигура разреза (change move-section-figure,
// design D2): тела стен, батареи и коммуникации (`sectionObstacles`), сектора открывания дверей, размерные линии и выноски.
// Чистая функция: раскладка выносок и геометрия размеров приходят готовыми.

const STROKE_HALF_CM = 3 // половина толщины тонкой линии (размерная, выносная, линия выноски) как препятствия
const ARC_STEPS = 8

const segmentQuad = (a: Point, b: Point): Point[] => {
  const len = Math.hypot(b.x - a.x, b.y - a.y)
  if (len === 0) return []
  const nx = (-(b.y - a.y) / len) * STROKE_HALF_CM
  const ny = ((b.x - a.x) / len) * STROKE_HALF_CM
  return [
    { x: a.x + nx, y: a.y + ny },
    { x: b.x + nx, y: b.y + ny },
    { x: b.x - nx, y: b.y - ny },
    { x: a.x - nx, y: a.y - ny },
  ]
}

// сектор открывания двери: четверть круга от закрытого положения полотна до открытого — выпуклый многоугольник
export function doorSwingPolygon(door: DoorLeaf): Point[] {
  const u = { x: door.arcFrom.x - door.hinge.x, y: door.arcFrom.y - door.hinge.y }
  const v = { x: door.arcTo.x - door.hinge.x, y: door.arcTo.y - door.hinge.y }
  const arc = Array.from({ length: ARC_STEPS + 1 }, (_, i): Point => {
    const t = ((i / ARC_STEPS) * Math.PI) / 2
    return { x: door.hinge.x + u.x * Math.cos(t) + v.x * Math.sin(t), y: door.hinge.y + u.y * Math.cos(t) + v.y * Math.sin(t) }
  })
  return [door.hinge, ...arc]
}

// размерная линия с выносными: три тонких отрезка
export function dimensionPolygons(g: Pick<DimGeometry, "a" | "b" | "p1" | "p2">): Point[][] {
  return [segmentQuad(g.p1, g.p2), segmentQuad(g.a, g.p1), segmentQuad(g.b, g.p2)].filter((q) => q.length >= 3)
}

// подложка текста выноски (экранные пиксели → единицы чертежа) и линия со стрелкой
export function calloutPolygons(layout: CalloutLayout, pxPerCm: number, pan: Point): Point[][] {
  const toWorld = (p: Point): Point => ({ x: p.x / pxPerCm + pan.x, y: p.y / pxPerCm + pan.y })
  const { x, y, w, h } = layout.box
  const a = toWorld({ x, y })
  const b = toWorld({ x: x + w, y: y + h })
  return [boxPolygon({ minX: a.x, minY: a.y, maxX: b.x, maxY: b.y }), segmentQuad(toWorld(layout.lineStart), toWorld(layout.arrowTip))].filter((q) => q.length >= 3)
}

export interface PlanSurroundings {
  obstacles: readonly SectionObstacle[]
  doors: readonly DoorLeaf[]
  dimensions: readonly Pick<DimGeometry, "a" | "b" | "p1" | "p2">[]
  callouts: readonly CalloutLayout[]
  pxPerCm: number
  pan: Point
}

export function planSurroundings(s: PlanSurroundings): Point[][] {
  return [
    ...s.obstacles.map((o) => [...o.shape]),
    ...s.doors.map(doorSwingPolygon),
    ...s.dimensions.flatMap(dimensionPolygons),
    ...s.callouts.flatMap((c) => calloutPolygons(c, s.pxPerCm, s.pan)),
  ]
}
