import type { TrackLine } from "../battery/battery-guide"
import type { FurnitureItem, Point } from "../types"
import type { Side } from "./room-sides"

// Центровка предметов (change furniture-center-snap, design D1, D3): центр предмета прилипает к линиям центровки — поперёк
// стороны помещения через её середину и по осям мира через центр другого предмета. Чистые функции без состояния и DOM.

// прямая: точка, единичное направление и источник (середина стороны или центр предмета), от которого рисуется риска
export interface SnapLine {
  origin: Point
  dir: Point
  anchor: Point
}

export interface SnapResult {
  center: Point
  hits: SnapLine[] // линии, к которым центр прилип: для рисок
}

// радиус прилипания центра мебели, экранные px: вдвое меньше радиуса центровки батареи (CENTER_SNAP_RADIUS_PX), который не меняется
export const FURNITURE_SNAP_RADIUS_PX = 17.5

const PARALLEL_EPS = 1e-9

const cross = (a: Point, b: Point): number => a.x * b.y - a.y * b.x
const minus = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y })

// расстояние от точки до прямой (со знаком по нормали (−dir.y, dir.x))
const signedDistance = (line: SnapLine, p: Point): number => cross(line.dir, minus(p, line.origin))

function sideLine(s: Side): SnapLine | null {
  const along = minus(s.b, s.a)
  const length = Math.hypot(along.x, along.y)
  if (length === 0) return null
  const mid = { x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2 }
  return { origin: mid, dir: { x: -along.y / length, y: along.x / length }, anchor: mid }
}

export function centerSources(sides: readonly Side[], items: readonly FurnitureItem[], excludedIds: ReadonlySet<string>): SnapLine[] {
  const fromSides = sides.flatMap((s) => sideLine(s) ?? [])
  const fromItems = items
    .filter((t) => !excludedIds.has(t.id))
    .flatMap((t): SnapLine[] => {
      const center = { x: t.x, y: t.y }
      return [
        { origin: center, dir: { x: 0, y: 1 }, anchor: center },
        { origin: center, dir: { x: 1, y: 0 }, anchor: center },
      ]
    })
  return [...fromSides, ...fromItems]
}

function nearest(lines: readonly SnapLine[], p: Point, radiusCm: number): SnapLine | null {
  let best: SnapLine | null = null
  let bestDistance = Infinity
  for (const line of lines) {
    const d = Math.abs(signedDistance(line, p))
    if (d <= radiusCm && d < bestDistance) {
      best = line
      bestDistance = d
    }
  }
  return best
}

function intersection(a: SnapLine, b: SnapLine): Point {
  const t = cross(minus(b.origin, a.origin), b.dir) / cross(a.dir, b.dir)
  return { x: a.origin.x + t * a.dir.x, y: a.origin.y + t * a.dir.y }
}

export function snapCenter(center: Point, lines: readonly SnapLine[], radiusCm: number): SnapResult {
  const first = nearest(lines, center, radiusCm)
  if (!first) return { center, hits: [] }
  const d = signedDistance(first, center)
  const onFirst = { x: center.x + d * first.dir.y, y: center.y - d * first.dir.x }
  const crossing = lines.filter((l) => Math.abs(cross(first.dir, l.dir)) > PARALLEL_EPS)
  const second = nearest(crossing, onFirst, radiusCm)
  if (!second) return { center: onFirst, hits: [first] }
  return { center: intersection(first, second), hits: [first, second] }
}

// риска: от источника через центр предмета с выступом за оба конца; k — px на см чертежа
export function guideTrack(hit: SnapLine, center: Point, k: number, overshootPx: number): TrackLine {
  const span = minus(center, hit.anchor)
  const length = Math.hypot(span.x, span.y)
  const dir = length === 0 ? hit.dir : { x: span.x / length, y: span.y / length }
  const over = overshootPx / k
  return {
    from: { x: hit.anchor.x - dir.x * over, y: hit.anchor.y - dir.y * over },
    to: { x: center.x + dir.x * over, y: center.y + dir.y * over },
  }
}
