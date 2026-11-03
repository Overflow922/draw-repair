import type { DrywallWall, Point, SectionLine, SectionShape, Wall } from "../types"
import { sectionFigure } from "./section-figure"
import type { SectionFigure } from "./section-figure"
import { layoutFigures } from "./section-layout"
import { extendLine, freeShifts } from "./section-free"
import type { SectionObstacle } from "./section-free"
import type { Bounds, FigurePlacement, LineSpanX } from "./section-layout"

// Линия разреза вместе с вычисленной фигурой и её местом на плане (change add-section-view, design D2, D4). Чистая функция.

export interface SectionEntry {
  line: SectionLine
  // линия с концами, вынесенными на свободное место (section-free): так рисуются штрихи, стрелки и буквы; вершины line не меняются
  shown: SectionLine
  figure: SectionFigure
  placement: FigurePlacement
  // детали разреза этой линии (change add-section-shapes, design D2)
  shapes: readonly SectionShape[]
}

// четыре угла тела стены: прямоугольник оси шириной в толщину
function bodyCorners(w: Wall): Point[] {
  const dx = w.b.x - w.a.x
  const dy = w.b.y - w.a.y
  const len = Math.hypot(dx, dy)
  if (len === 0) return [w.a]
  const nx = (-dy / len) * (w.thicknessCm / 2)
  const ny = (dx / len) * (w.thicknessCm / 2)
  return [
    { x: w.a.x + nx, y: w.a.y + ny },
    { x: w.a.x - nx, y: w.a.y - ny },
    { x: w.b.x + nx, y: w.b.y + ny },
    { x: w.b.x - nx, y: w.b.y - ny },
  ]
}

function boundsOf(points: readonly Point[]): Bounds | null {
  if (points.length === 0) return null
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) }
}

// габариты плана: подложка, штукатурка, стены гипсокартона; без стен — вершины самих линий
export function planBounds(planWalls: readonly Wall[], lines: readonly SectionLine[]): Bounds {
  const walls = boundsOf(planWalls.flatMap(bodyCorners))
  return walls ?? boundsOf(lines.flatMap((l) => l.points)) ?? { minX: 0, minY: 0, maxX: 0, maxY: 0 }
}

const spanX = (line: SectionLine): LineSpanX => ({
  minX: Math.min(...line.points.map((p) => p.x)),
  maxX: Math.max(...line.points.map((p) => p.x)),
})

// planWalls — всё, что входит в габариты: стены подложки, куски штукатурки и стены гипсокартона
export function sectionEntries(
  lines: readonly SectionLine[],
  drywall: readonly DrywallWall[],
  planWalls: readonly Wall[],
  obstacles: readonly SectionObstacle[] = [],
  shapes: readonly SectionShape[] = [],
): SectionEntry[] {
  if (lines.length === 0) return []
  const figures = lines.map((l) => sectionFigure(l, drywall))
  const spans = new Map(lines.map((l) => [l.id, spanX(l)]))
  const fixed = new Map(lines.flatMap((l) => (l.figureAt === undefined ? [] : [[l.id, l.figureAt] as const])))
  const placements = layoutFigures(figures, planBounds(planWalls, lines), spans, fixed)
  return placements.flatMap((placement) => {
    const line = lines.find((l) => l.id === placement.lineId)
    const figure = figures.find((f) => f.lineId === placement.lineId)
    if (line === undefined || figure === undefined) return []
    const shown = extendLine(line, freeShifts(line, drywall, obstacles))
    return [{ line, shown, figure, placement, shapes: shapes.filter((s) => s.lineId === line.id) }]
  })
}
