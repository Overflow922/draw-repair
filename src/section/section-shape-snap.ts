import { GRID_STEP_CM } from "../types"
import type { Point } from "../types"
import { worldToFigure } from "./section-layout"
import { figureFrame, insideFramePoint } from "./section-shape"
import type { FigurePoint } from "./section-shape"
import type { SectionEntry } from "./section-scene"

// Точка клика инструмента «Деталь разреза» на фигуре (change add-section-shapes, design D8; spec section-view «Инструмент
// «Деталь разреза» и размещение детали»): чертёж → координаты фигуры → привязка. Чистые функции.

export interface FigureHit {
  entry: SectionEntry
  point: FigurePoint
}

// значение, привлечённое ближайшей гранью в радиусе привязки; иначе — шаг сетки 10 см от начала фигуры
function snapAxis(value: number, faces: readonly number[], radiusCm: number): number {
  let best: number | null = null
  for (const f of faces) if (Math.abs(f - value) <= radiusCm && (best === null || Math.abs(f - value) < Math.abs(best - value))) best = f
  return best ?? Math.round(value / GRID_STEP_CM) * GRID_STEP_CM
}

// грани по осям: сечения стен и детали фигуры (кроме excludeId — перетаскиваемой), для z ещё пол
export function snapFaces(entry: SectionEntry, excludeId?: string): { s: number[]; z: number[] } {
  const shapes = entry.shapes.filter((d) => d.id !== excludeId)
  const s = [...entry.figure.pieces.flatMap((p) => [p.s0, p.s1]), ...shapes.flatMap((d) => [d.s0, d.s1])]
  const z = [0, ...entry.figure.pieces.map((p) => p.heightCm), ...shapes.flatMap((d) => [d.z0, d.z1])]
  return { s, z }
}

// фигура, на прямоугольнике которой лежит клик, и привязанная точка; lineId — второй клик остаётся на той же фигуре;
// null — клик вне прямоугольника фигуры, на другой фигуре или у фигуры без стен (нулевая высота)
export function figureHit(entries: readonly SectionEntry[], world: Point, radiusCm: number, lineId?: string): FigureHit | null {
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i]
    if (lineId !== undefined && entry.line.id !== lineId) continue
    if (entry.figure.height <= 0) continue
    const raw = worldToFigure(entry.placement, world)
    const frame = figureFrame(entry.figure)
    if (!insideFramePoint(raw, frame)) continue
    const f = snapFaces(entry)
    const clamp = (v: number, min: number, max: number): number => Math.min(Math.max(v, min), max)
    return {
      entry,
      point: { s: clamp(snapAxis(raw.s, f.s, radiusCm), frame.left, frame.right), z: clamp(snapAxis(raw.z, f.z, radiusCm), 0, frame.height) },
    }
  }
  return null
}
