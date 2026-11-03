import type { Point, SectionShape, SectionView } from "../types"
import type { SectionFigure } from "./section-figure"
import type { FigurePoint } from "./section-shape"

// Положение фигур разреза вокруг габаритов плана (change add-section-view, design D4; spec section-view «Фигура разреза —
// положение»). Положение вычисляется, пользователь его не выбирает. Чистые функции.

export const SECTION_GAP_CM = 100

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

// диапазон X линии разреза: для взглядов вверх и вниз фигура занимает те же X
export interface LineSpanX {
  minX: number
  maxX: number
}

// положение фигуры: левая нижняя точка пола в чертеже и размеры; название рисуется над фигурой
export interface FigurePlacement {
  lineId: string
  label: string
  view: SectionView
  x: number
  floorY: number
  width: number
  height: number
}

// порядок обозначений: A…Z, затем A1…Z1, A2…
const labelRank = (label: string): number => {
  const round = label.length > 1 ? Number(label.slice(1)) : 0
  return round * 26 + (label.charCodeAt(0) - 65)
}

const bySide = (view: SectionView): "vertical" | "horizontal" => (view === "up" || view === "down" ? "vertical" : "horizontal")

export function layoutFigures(
  figures: readonly SectionFigure[],
  bounds: Bounds,
  spans: ReadonlyMap<string, LineSpanX>,
  // сохранённые позиции переставленных фигур (change move-section-figure, design D1): они стоят на своём месте и не занимают слот
  fixed: ReadonlyMap<string, Point> = new Map(),
): FigurePlacement[] {
  const ordered = [...figures].sort((a, b) => labelRank(a.label) - labelRank(b.label))
  // дальняя граница уже занятого места у каждой стороны габаритов
  const edge: Record<SectionView, number> = {
    up: bounds.minY - SECTION_GAP_CM,
    down: bounds.maxY + SECTION_GAP_CM,
    left: bounds.minX - SECTION_GAP_CM,
    right: bounds.maxX + SECTION_GAP_CM,
  }
  // места переставленных фигур: автоматические фигуры обходят их (change move-section-figure, design D1), чтобы не лечь поверх
  const pinned = ordered.flatMap((f): Bounds[] => {
    const at = fixed.get(f.lineId)
    return at === undefined ? [] : [{ minX: at.x, maxX: at.x + f.width, minY: at.y - f.height, maxY: at.y }]
  })
  const overlapping = (r: Bounds): Bounds | undefined =>
    pinned.find((p) => r.minX < p.maxX && r.maxX > p.minX && r.minY < p.maxY && r.maxY > p.minY)
  // сдвигает дальнюю границу стороны за занятое переставленной фигурой место, пока автоматическая фигура лежит на нём
  const clearEdge = (f: SectionFigure, rectAt: (edgeValue: number) => Bounds, past: (p: Bounds) => number): void => {
    for (let hit = overlapping(rectAt(edge[f.view])); hit !== undefined; hit = overlapping(rectAt(edge[f.view]))) edge[f.view] = past(hit)
  }
  return ordered.map((f): FigurePlacement => {
    const base = { lineId: f.lineId, label: f.label, view: f.view, width: f.width, height: f.height }
    const at = fixed.get(f.lineId)
    if (at !== undefined) return { ...base, x: at.x, floorY: at.y }
    if (bySide(f.view) === "vertical") {
      const x = spans.get(f.lineId)?.minX ?? bounds.minX
      const across = { minX: x, maxX: x + f.width }
      if (f.view === "up") {
        clearEdge(f, (e) => ({ ...across, minY: e - f.height, maxY: e }), (p) => p.minY - SECTION_GAP_CM)
        const floorY = edge.up
        edge.up = floorY - f.height - SECTION_GAP_CM
        return { ...base, x, floorY }
      }
      clearEdge(f, (e) => ({ ...across, minY: e, maxY: e + f.height }), (p) => p.maxY + SECTION_GAP_CM)
      const floorY = edge.down + f.height
      edge.down = floorY + SECTION_GAP_CM
      return { ...base, x, floorY }
    }
    const rows = { minY: bounds.maxY - f.height, maxY: bounds.maxY }
    if (f.view === "right") {
      clearEdge(f, (e) => ({ ...rows, minX: e, maxX: e + f.width }), (p) => p.maxX + SECTION_GAP_CM)
      const x = edge.right
      edge.right = x + f.width + SECTION_GAP_CM
      return { ...base, x, floorY: bounds.maxY }
    }
    clearEdge(f, (e) => ({ ...rows, minX: e - f.width, maxX: e }), (p) => p.minX - SECTION_GAP_CM)
    const x = edge.left - f.width
    edge.left = x - SECTION_GAP_CM
    return { ...base, x, floorY: bounds.maxY }
  })
}

// точка фигуры (s от левого края вправо, z вверх от пола) в координатах чертежа
export const figureToWorld = (p: FigurePlacement, s: number, z: number): Point => ({ x: p.x + s, y: p.floorY - z })

// прямоугольник детали в чертеже (change add-section-shapes, design D2): верх фигуры по z — меньший Y
export const shapeWorldBox = (p: FigurePlacement, shape: SectionShape): Bounds => {
  const a = figureToWorld(p, shape.s0, shape.z1)
  const b = figureToWorld(p, shape.s1, shape.z0)
  return { minX: a.x, minY: a.y, maxX: b.x, maxY: b.y }
}

// обратное преобразование: точка чертежа в координатах фигуры (change add-section-shapes, design D8); зеркальность взгляда
// `down` уже заложена в самих s сечений фигуры, поэтому сама фигура всегда рисуется слева направо
export const worldToFigure = (p: FigurePlacement, w: Point): FigurePoint => ({ s: w.x - p.x, z: p.floorY - w.y })
