import type { Point, Wall } from "./types"

const EPS = 1e-6

export function pointsEqual(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function projectOnSegment(p: Point, w: Wall): Point {
  const dx = w.b.x - w.a.x
  const dy = w.b.y - w.a.y
  const len2 = dx * dx + dy * dy
  if (len2 < EPS) return w.a
  const t = Math.max(0, Math.min(1, ((p.x - w.a.x) * dx + (p.y - w.a.y) * dy) / len2))
  return { x: w.a.x + t * dx, y: w.a.y + t * dy }
}

const ORTHO_TAN = Math.tan((15 * Math.PI) / 180)

export function snap(cursor: Point, walls: Wall[], gridStepCm: number, radiusCm: number, orthoFrom?: Point): Point {
  let best: Point | null = null
  let bestDist = radiusCm
  for (const w of walls) {
    const c = projectOnSegment(cursor, w)
    const d = distance(cursor, c)
    if (d <= bestDist) {
      best = c
      bestDist = d
    }
  }
  if (best) return best
  let p = cursor
  if (orthoFrom) {
    const dx = cursor.x - orthoFrom.x
    const dy = cursor.y - orthoFrom.y
    if (Math.abs(dy) <= ORTHO_TAN * Math.abs(dx)) p = { x: cursor.x, y: orthoFrom.y }
    else if (Math.abs(dx) <= ORTHO_TAN * Math.abs(dy)) p = { x: orthoFrom.x, y: cursor.y }
  }
  return {
    x: Math.round(p.x / gridStepCm) * gridStepCm,
    y: Math.round(p.y / gridStepCm) * gridStepCm,
  }
}
