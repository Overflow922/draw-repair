import type { Point, SectionShape } from "../types"
import { figureHit } from "./section-shape-snap"
import { shapeFromCorners } from "./section-shape"
import type { FigurePoint } from "./section-shape"
import type { SectionEntry } from "./section-scene"

// Размещение детали двумя кликами (change add-section-shapes, design D3, D8; spec section-view «Инструмент «Деталь разреза» и
// размещение детали»): первый клик — угол, второй — противоположный угол той же фигуры. Чистые функции, состояние не мутируется.

export interface ShapePlacing {
  lineId: string
  first: FigurePoint
}

// первый клик: угол на фигуре; null — клик вне фигуры (точка не задана)
export function startShape(entries: readonly SectionEntry[], world: Point, radiusCm: number): ShapePlacing | null {
  const hit = figureHit(entries, world, radiusCm)
  return hit === null ? null : { lineId: hit.entry.line.id, first: hit.point }
}

// второй клик: деталь по двум углам; null — клик вне той же фигуры или прямоугольник нулевой ширины или высоты (точка не задана)
export function finishShape(state: ShapePlacing, entries: readonly SectionEntry[], world: Point, radiusCm: number, id: string): SectionShape | null {
  const hit = figureHit(entries, world, radiusCm, state.lineId)
  return hit === null ? null : shapeFromCorners(state.first, hit.point, id, state.lineId)
}

// резинка до курсора: второй угол, привязанный так же, как при клике; null — курсор вне фигуры или даёт нулевую деталь
export function placingPreview(state: ShapePlacing, entries: readonly SectionEntry[], world: Point, radiusCm: number): SectionShape | null {
  return finishShape(state, entries, world, radiusCm, "")
}
