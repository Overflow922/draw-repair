import type { Point, Wall } from "./types"
import { add, degenerate, dist, mul, sub } from "./wall-geometry"

// Трекинг свободного конца по горизонтали и вертикали узлов чертежа
// (change wall-axis-tracking-snap, design D1). Узлы — концы осей стен.

const EPS = 1e-9
const PARALLEL_TOL = 1e-12 // луч параллелен оси экрана: компонента направления в пределах погрешности

// вспомогательная линия трекинга: от узла до конца сегмента
export interface TrackLine {
  from: Point
  to: Point
}

export interface TrackHit {
  node: Point
  value: number // координата линии узла: x вертикали или y горизонтали
}

export interface FreeTrack {
  x: TrackHit | null
  y: TrackHit | null
}

export interface RayTrack {
  point: Point
  line: TrackLine
}

const same = (p: Point, q: Point): boolean => Math.abs(p.x - q.x) <= EPS && Math.abs(p.y - q.y) <= EPS

// концы осей стен ненулевой длины в порядке массива (a, затем b) — порядок задаёт выбор при равенстве;
// без точек, где совпадают концы осей двух стен, и без начала текущей стены
export function trackingNodes(walls: readonly Wall[], start: Point): Point[] {
  const ends = walls.filter((w) => !degenerate(w)).flatMap((w, i) => [w.a, w.b].map((p) => ({ p, wall: i })))
  return ends
    .filter(({ p, wall }) => !same(p, start) && !ends.some((o) => o.wall !== wall && same(o.p, p)))
    .map(({ p }) => p)
}

// лучшая линия по одной оси: ближайшая к курсору в пределах радиуса; при равенстве — более ранний узел
function bestAxis(coord: number, nodes: readonly Point[], radiusCm: number, axis: "x" | "y"): TrackHit | null {
  let best: TrackHit | null = null
  let bestD = Infinity
  for (const node of nodes) {
    const d = Math.abs(coord - node[axis])
    if (d <= radiusCm && d < bestD - EPS) {
      best = { node, value: node[axis] }
      bestD = d
    }
  }
  return best
}

// направление не задано: абсцисса и ордината выравниваются независимо
export function trackFree(raw: Point, nodes: readonly Point[], radiusCm: number): FreeTrack {
  return { x: bestAxis(raw.x, nodes, radiusCm, "x"), y: bestAxis(raw.y, nodes, radiusCm, "y") }
}

// направление задано: пересечение луча start + s·dir (s > 0) со сработавшей линией узла,
// ближайшее к курсору; линии, параллельные лучу, не участвуют
export function trackOnRay(
  raw: Point,
  nodes: readonly Point[],
  radiusCm: number,
  start: Point,
  dir: Point,
): RayTrack | null {
  let best: RayTrack | null = null
  let bestD = Infinity
  // кандидаты в порядке узлов, у узла — вертикаль раньше горизонтали
  for (const node of nodes) {
    for (const point of rayHits(raw, node, radiusCm, start, dir)) {
      const d = dist(raw, point)
      if (d < bestD - EPS) {
        best = { point, line: { from: node, to: point } }
        bestD = d
      }
    }
  }
  return best
}

// пересечения луча с вертикалью и горизонталью узла, сработавшими у курсора и лежащими впереди начала;
// координата линии в точке пересечения — точно координата узла
function rayHits(raw: Point, node: Point, radiusCm: number, start: Point, dir: Point): Point[] {
  const hits: Point[] = []
  const rel = sub(node, start)
  if (Math.abs(dir.x) > PARALLEL_TOL && Math.abs(raw.x - node.x) <= radiusCm) {
    const s = rel.x / dir.x
    if (s > EPS) hits.push({ x: node.x, y: add(start, mul(dir, s)).y })
  }
  if (Math.abs(dir.y) > PARALLEL_TOL && Math.abs(raw.y - node.y) <= radiusCm) {
    const s = rel.y / dir.y
    if (s > EPS) hits.push({ x: add(start, mul(dir, s)).x, y: node.y })
  }
  return hits
}
