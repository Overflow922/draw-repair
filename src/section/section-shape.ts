import type { SectionLine, SectionShape } from "../types"
import type { SectionFigure } from "./section-figure"

// Деталь разреза — заштрихованный прямоугольник на фигуре линии (change add-section-shapes, design D1, D5; spec section-view
// «Деталь разреза», «Выделение, перемещение и правка детали разреза»). Правила геометрии без DOM: прямоугольник по двум точкам,
// принадлежность фигуре, сдвиг и габариты. Каждая правка возвращает новую деталь или null, если правка не применяется
// (не число, выход за фигуру или ничего не изменилось). Входы не мутируются.

const EPS = 1e-9

export interface FigurePoint {
  s: number
  z: number
}

// прямоугольник фигуры для деталей: от левого края самого левого сечения до правого края самого правого по s и 0…height по z
// (линия разреза может быть шире сечений — за их габарит деталь не выходит)
export interface FigureFrame {
  left: number
  right: number
  height: number
}

export function figureFrame(figure: Pick<SectionFigure, "pieces" | "width" | "height">): FigureFrame {
  if (figure.pieces.length === 0) return { left: 0, right: figure.width, height: figure.height }
  return { left: Math.min(...figure.pieces.map((p) => p.s0)), right: Math.max(...figure.pieces.map((p) => p.s1)), height: figure.height }
}

export type ShapeAxis = "width" | "height"

const finite = (...v: number[]): boolean => v.every((n) => Number.isFinite(n))

export const isValidShapeBounds = (s: Pick<SectionShape, "s0" | "s1" | "z0" | "z1">): boolean =>
  finite(s.s0, s.s1, s.z0, s.z1) && s.s0 < s.s1 && s.z0 < s.z1

// деталь целиком лежит в прямоугольнике фигуры
export const insideFrame = (s: SectionShape, frame: FigureFrame): boolean =>
  s.s0 >= frame.left - EPS && s.z0 >= -EPS && s.s1 <= frame.right + EPS && s.z1 <= frame.height + EPS

export const insideFramePoint = (p: FigurePoint, frame: FigureFrame): boolean =>
  p.s >= frame.left - EPS && p.z >= -EPS && p.s <= frame.right + EPS && p.z <= frame.height + EPS

// деталь по двум противоположным углам в любом порядке; null — нулевая ширина или высота
export function shapeFromCorners(a: FigurePoint, b: FigurePoint, id: string, lineId: string): SectionShape | null {
  const shape: SectionShape = { id, lineId, s0: Math.min(a.s, b.s), s1: Math.max(a.s, b.s), z0: Math.min(a.z, b.z), z1: Math.max(a.z, b.z) }
  return isValidShapeBounds(shape) ? shape : null
}

// детали, чьи линии ещё существуют: удаление линии уносит её детали (change add-section-shapes, design D6)
export const shapesOfLines = (shapes: readonly SectionShape[], lines: readonly SectionLine[]): SectionShape[] => {
  const ids = new Set(lines.map((l) => l.id))
  return shapes.filter((s) => ids.has(s.lineId))
}

const same = (a: SectionShape, b: SectionShape): boolean =>
  Math.abs(a.s0 - b.s0) < EPS && Math.abs(a.s1 - b.s1) < EPS && Math.abs(a.z0 - b.z0) < EPS && Math.abs(a.z1 - b.z1) < EPS

// сдвиг на (ds, dz) без ограничения жестом: выход за фигуру или нулевой сдвиг — null (стрелки)
export function moveShape(shape: SectionShape, ds: number, dz: number, frame: FigureFrame): SectionShape | null {
  if (!finite(ds, dz)) return null
  const next: SectionShape = { ...shape, s0: shape.s0 + ds, s1: shape.s1 + ds, z0: shape.z0 + dz, z1: shape.z1 + dz }
  return insideFrame(next, frame) && !same(shape, next) ? next : null
}

// грани, к которым притягиваются края детали при перетаскивании, и радиус привязки (см)
export interface DragSnap {
  s: readonly number[]
  z: readonly number[]
  radiusCm: number
}

// сдвиг по оси: край в радиусе привязки от грани притягивается к ней точно (ближайшая), иначе сдвиг округляется до 1 см
function snappedShift(d: number, edges: readonly [number, number], faces: readonly number[], radiusCm: number): { shift: number; snapped: boolean } {
  let best: number | null = null
  for (const edge of edges) for (const face of faces) {
    const delta = face - (edge + d)
    if (Math.abs(delta) <= radiusCm && (best === null || Math.abs(delta) < Math.abs(best))) best = delta
  }
  return best === null ? { shift: Math.round(d), snapped: false } : { shift: d + best, snapped: true }
}

// перетаскивание мышью: края притягиваются к граням (snap), иначе сдвиг округляется до 1 см; результат зажимается прямоугольником
// фигуры; null — деталь не сдвинулась
export function dragShape(shape: SectionShape, ds: number, dz: number, frame: FigureFrame, snap?: DragSnap): SectionShape | null {
  if (!finite(ds, dz)) return null
  const clamp = (r: { shift: number; snapped: boolean }, lo: number, hi: number): number =>
    r.snapped ? Math.min(Math.max(r.shift, lo), hi) : Math.min(Math.max(r.shift, Math.ceil(lo - EPS)), Math.floor(hi + EPS))
  const radius = snap?.radiusCm ?? 0
  const sShift = clamp(snappedShift(ds, [shape.s0, shape.s1], snap?.s ?? [], radius), frame.left - shape.s0, frame.right - shape.s1)
  const zShift = clamp(snappedShift(dz, [shape.z0, shape.z1], snap?.z ?? [], radius), -shape.z0, frame.height - shape.z1)
  const next: SectionShape = { ...shape, s0: shape.s0 + sShift, s1: shape.s1 + sShift, z0: shape.z0 + zShift, z1: shape.z1 + zShift }
  return same(shape, next) ? null : next
}

// ширина или высота становится value при неподвижном центре; не положительное число, выход за фигуру и отсутствие изменения — null
export function resizeShape(shape: SectionShape, axis: ShapeAxis, value: number, frame: FigureFrame): SectionShape | null {
  if (!Number.isFinite(value) || value <= 0) return null
  const next: SectionShape =
    axis === "width"
      ? { ...shape, s0: (shape.s0 + shape.s1) / 2 - value / 2, s1: (shape.s0 + shape.s1) / 2 + value / 2 }
      : { ...shape, z0: (shape.z0 + shape.z1) / 2 - value / 2, z1: (shape.z0 + shape.z1) / 2 + value / 2 }
  return insideFrame(next, frame) && !same(shape, next) ? next : null
}
