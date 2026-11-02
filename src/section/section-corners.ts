import type { Point, SectionCornerPoint } from "../types"
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
  anchor: SectionCornerPoint
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
