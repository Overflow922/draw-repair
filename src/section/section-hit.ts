import type { Point, SectionLine } from "../types"
import { figureToWorld } from "./section-layout"
import { endMarks } from "./section-marks"
import type { SectionEntry } from "./section-scene"

// Попадание клика в линию разреза (change add-section-view, design D7; spec section-view «Выделение и удаление линии
// разреза»): линия, обозначение, штриховка сечения и название фигуры дают одну и ту же линию. Чистые функции.

function segmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

const TITLE_ZONE_RADII = 3 // название фигуры над её верхом: полоса высотой в три радиуса привязки

function onLine(line: SectionLine, p: Point, radiusCm: number): boolean {
  const pts = line.points
  for (let i = 0; i + 1 < pts.length; i++) if (segmentDistance(p, pts[i], pts[i + 1]) <= radiusCm) return true
  // стрелка и обозначение рядом с ней — тоже часть линии
  return endMarks(line).some((m) => segmentDistance(p, m.tail, m.end) <= radiusCm || Math.hypot(p.x - m.labelAt.x, p.y - m.labelAt.y) <= radiusCm * 2)
}

function onFigure(entry: SectionEntry, p: Point, radiusCm: number): boolean {
  const { placement, figure } = entry
  const inside = (x0: number, y0: number, x1: number, y1: number): boolean => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1
  for (const piece of figure.pieces) {
    const lo = figureToWorld(placement, piece.s0, piece.heightCm)
    const hi = figureToWorld(placement, piece.s1, 0)
    if (inside(lo.x, lo.y, hi.x, hi.y)) return true
  }
  const top = figureToWorld(placement, 0, figure.height)
  return inside(placement.x, top.y - radiusCm * TITLE_ZONE_RADII, placement.x + placement.width, top.y)
}

// идентификатор линии под точкой; при нескольких — последняя из списка (рисуется поверх)
export function pickSection(entries: readonly SectionEntry[], p: Point, radiusCm: number): string | null {
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i]
    if (onLine(e.shown, p, radiusCm) || onFigure(e, p, radiusCm)) return e.line.id
  }
  return null
}
