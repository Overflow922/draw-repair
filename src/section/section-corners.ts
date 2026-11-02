import type { Point, SectionCornerPoint, ShapeCornerPoint } from "../types"
import { figureToWorld } from "./section-layout"
import type { SectionEntry } from "./section-scene"

// Углы штрихованных сечений на фигуре разреза как точки замера (change add-section-view, design D5; spec dimension-tool «Точки
// замера на фигуре разреза»). Чистые функции.

type Corner = SectionCornerPoint["at"]

const CORNERS: readonly Corner[] = [
  { s: "lo", z: "floor" },
  { s: "hi", z: "floor" },
  { s: "hi", z: "top" },
  { s: "lo", z: "top" },
]

// положение угла в координатах чертежа; null — линии, стены или рабочего отрезка нет
export function sectionCornerPosition(point: SectionCornerPoint, entries: readonly SectionEntry[]): Point | null {
  const entry = entries.find((e) => e.line.id === point.lineId)
  const piece = entry?.figure.pieces.find((p) => p.wallId === point.wallId && p.segment === point.segment)
  if (!entry || !piece) return null
  return figureToWorld(entry.placement, point.at.s === "lo" ? piece.s0 : piece.s1, point.at.z === "floor" ? 0 : piece.heightCm)
}

export interface SectionCornerHit {
  point: Point
  anchor: SectionCornerPoint | ShapeCornerPoint
}

const SHAPE_CORNERS: readonly ShapeCornerPoint["at"][] = [
  { s: "lo", z: "lo" },
  { s: "hi", z: "lo" },
  { s: "hi", z: "hi" },
  { s: "lo", z: "hi" },
]

// положение угла детали в координатах чертежа; null — линии или детали нет (change add-section-shapes, design D9)
export function shapeCornerPosition(point: ShapeCornerPoint, entries: readonly SectionEntry[]): Point | null {
  const entry = entries.find((e) => e.line.id === point.lineId)
  const shape = entry?.shapes.find((d) => d.id === point.shapeId)
  if (!entry || !shape) return null
  return figureToWorld(entry.placement, point.at.s === "lo" ? shape.s0 : shape.s1, point.at.z === "lo" ? shape.z0 : shape.z1)
}

// все четыре угла каждой детали всех переданных фигур
export function shapeCorners(entries: readonly SectionEntry[]): SectionCornerHit[] {
  return entries.flatMap((entry) =>
    entry.shapes.flatMap((shape) =>
      SHAPE_CORNERS.map((at): SectionCornerHit => {
        const anchor: ShapeCornerPoint = { kind: "shape", lineId: entry.line.id, shapeId: shape.id, at }
        return { point: figureToWorld(entry.placement, at.s === "lo" ? shape.s0 : shape.s1, at.z === "lo" ? shape.z0 : shape.z1), anchor }
      }),
    ),
  )
}

// все четыре угла каждого сечения всех переданных фигур
export function sectionCorners(entries: readonly SectionEntry[]): SectionCornerHit[] {
  return entries.flatMap((entry) =>
    entry.figure.pieces.flatMap((piece) =>
      CORNERS.map((at): SectionCornerHit => {
        const anchor: SectionCornerPoint = { kind: "section", lineId: entry.line.id, wallId: piece.wallId, segment: piece.segment, at }
        return { point: figureToWorld(entry.placement, at.s === "lo" ? piece.s0 : piece.s1, at.z === "floor" ? 0 : piece.heightCm), anchor }
      }),
    ),
  )
}
