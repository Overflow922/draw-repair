import { ZOOM_MAX, ZOOM_MIN } from "./types"
import type { Point, View, Wall } from "./types"

const EPS = 1e-6

export function zoomAt(view: View, factor: number, anchor: Point, pxPerCm: number): View {
  const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, view.zoom * factor))
  const world = { x: view.pan.x + anchor.x / (pxPerCm * view.zoom), y: view.pan.y + anchor.y / (pxPerCm * view.zoom) }
  return { zoom, pan: { x: world.x - anchor.x / (pxPerCm * zoom), y: world.y - anchor.y / (pxPerCm * zoom) } }
}

export function visibleWorld(view: View, w: number, h: number, pxPerCm: number): { min: Point; max: Point } {
  return {
    min: view.pan,
    max: { x: view.pan.x + w / (pxPerCm * view.zoom), y: view.pan.y + h / (pxPerCm * view.zoom) },
  }
}

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
  const consider = (p: Point, d: number) => {
    if (d <= bestDist) {
      best = p
      bestDist = d
    }
  }
  for (const w of walls) {
    const dx = w.b.x - w.a.x
    const dy = w.b.y - w.a.y
    const len2 = dx * dx + dy * dy
    if (len2 < EPS) {
      consider(w.a, distance(cursor, w.a))
      continue
    }
    const raw = ((cursor.x - w.a.x) * dx + (cursor.y - w.a.y) * dy) / len2
    const foot = { x: w.a.x + raw * dx, y: w.a.y + raw * dy }
    if (raw < 0 || raw > 1) {
      const end = raw < 0 ? w.a : w.b
      const dEnd = distance(cursor, end)
      consider(dEnd <= radiusCm ? end : foot, dEnd <= radiusCm ? dEnd : distance(cursor, foot))
    } else {
      consider(foot, distance(cursor, foot))
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

export function hitWall(p: Point, walls: Wall[], toleranceCm: number): Wall | null {
  let best: Wall | null = null
  let bestDist = Infinity
  for (const w of walls) {
    const d = distance(p, projectOnSegment(p, w))
    if (d <= Math.max(w.thicknessCm / 2, toleranceCm) && d < bestDist) {
      best = w
      bestDist = d
    }
  }
  return best
}

export function endpointAt(p: Point, wall: Wall, radiusCm: number): "a" | "b" | null {
  if (distance(p, wall.a) <= radiusCm) return "a"
  if (distance(p, wall.b) <= radiusCm) return "b"
  return null
}

export function handleAt(p: Point, wall: Wall, radiusCm: number): "a" | "b" | "mid" | null {
  const end = endpointAt(p, wall, radiusCm)
  if (end) return end
  return distance(p, { x: (wall.a.x + wall.b.x) / 2, y: (wall.a.y + wall.b.y) / 2 }) <= radiusCm ? "mid" : null
}

export function moveEndpoint(walls: Wall[], wall: Wall, end: "a" | "b", pos: Point): void {
  const old = wall[end]
  wall[end] = pos
  for (const w of walls) {
    if (w === wall) continue
    if (pointsEqual(w.a, old)) w.a = pos
    if (pointsEqual(w.b, old)) w.b = pos
  }
}

export function moveWall(walls: Wall[], wall: Wall, delta: Point): void {
  const { a, b } = wall
  wall.a = { x: a.x + delta.x, y: a.y + delta.y }
  wall.b = { x: b.x + delta.x, y: b.y + delta.y }
  for (const w of walls) {
    if (w === wall) continue
    if (pointsEqual(w.a, a)) w.a = wall.a
    if (pointsEqual(w.b, a)) w.b = wall.a
    if (pointsEqual(w.a, b)) w.a = wall.b
    if (pointsEqual(w.b, b)) w.b = wall.b
  }
}
