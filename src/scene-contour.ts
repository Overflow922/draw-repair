import type { Point, Wall } from "./types"
import { add, coveredInterval, degenerate, displayPolygons, dist, dot, lerp, mul, sub, uncovered } from "./wall-geometry"

// Контур отображаемых тел сцены: рёбра всех кусков, открытые снаружи, и выпуклые вершины
// этого контура — углы тел стен (change wall-body-corners-snap, design D1, D4).
// Все функции чистые: входные стены не мутируются.

const EPS = 1e-9
const SLICE = 1e-7
// смещение ребра наружу при проверке открытости: больше SLICE — куски, отсечённые
// clipHalfPlane, могут выступать за свою плоскость на SLICE
export const EDGE_SHIFT = 3 * SLICE
export const LINE_TOL = 1e-6 // допуск коллинеарности рёбер контура и совпадения вершин

// открытый участок ребра контура сцены с наружной нормалью
export interface OpenEdge {
  p1: Point
  p2: Point
  normal: Point
}

export interface SceneContour {
  pieces: Point[][]
  open: OpenEdge[]
}

// выпуклая вершина контура: две открытые грани с наружными нормалями, расходящимися от точки
export interface ConvexCorner {
  point: Point
  edges: readonly [OpenEdge, OpenEdge]
}

// единичные наружные нормали рёбер выпуклого куска (ребро i: piece[i] → piece[i+1])
export function edgeNormals(piece: Point[]): Point[] {
  const c = mul(piece.reduce(add, { x: 0, y: 0 }), 1 / piece.length)
  return piece.map((a, i) => {
    const b = piece[(i + 1) % piece.length]
    const len = dist(a, b)
    if (len < EPS) return { x: 0, y: 0 }
    const n = mul({ x: b.y - a.y, y: a.x - b.x }, 1 / len)
    return dot(n, sub(c, a)) > 0 ? mul(n, -1) : n
  })
}

export function hiddenBy(q1: Point, q2: Point, pieces: Point[][]): [number, number][] {
  const hidden: [number, number][] = []
  for (const pc of pieces) {
    const iv = coveredInterval(q1, q2, pc)
    if (iv) hidden.push(iv)
  }
  return hidden
}

// Контур сцены: рёбра всех кусков отображаемых тел, открытые снаружи — точки,
// смещённые от ребра по наружной нормали, не лежат ни в одном куске (change fix-wall-snap-overlap, design D2).
export function sceneContour(walls: Wall[]): SceneContour {
  const pieces = walls.filter((w) => !degenerate(w)).flatMap((w) => displayPolygons(w, walls))
  const open: OpenEdge[] = []
  for (const piece of pieces) {
    const normals = edgeNormals(piece)
    piece.forEach((p1, k) => {
      const normal = normals[k]
      if (normal.x === 0 && normal.y === 0) return
      const p2 = piece[(k + 1) % piece.length]
      const shift = mul(normal, EDGE_SHIFT)
      for (const [t0, t1] of uncovered(hiddenBy(add(p1, shift), add(p2, shift), pieces)))
        open.push({ p1: lerp(p1, p2, t0), p2: lerp(p1, p2, t1), normal })
    })
  }
  return { pieces, open }
}

const cross2 = (a: Point, b: Point): number => a.x * b.y - a.y * b.x

// конец открытого участка, противоположный вершине v
export const farEnd = (e: OpenEdge, v: Point): Point => (dist(e.p1, v) <= LINE_TOL ? e.p2 : e.p1)

// Выпуклые вершины контура: точки, где сходятся два открытых участка разных направлений, причём
// каждый участок уходит от вершины внутрь полуплоскости другого (вогнутая вершина — наоборот).
// Порядок — по порядку открытых участков (стены массива), каждая точка один раз.
export function convexCorners(scene: SceneContour): ConvexCorner[] {
  const corners: ConvexCorner[] = []
  const { open } = scene
  for (let i = 0; i < open.length; i++) {
    for (let j = i + 1; j < open.length; j++) {
      const e1 = open[i]
      const e2 = open[j]
      if (Math.abs(cross2(e1.normal, e2.normal)) <= LINE_TOL) continue
      for (const v of [e1.p1, e1.p2]) {
        if (dist(e2.p1, v) > LINE_TOL && dist(e2.p2, v) > LINE_TOL) continue
        const toward1 = sub(farEnd(e1, v), v)
        const toward2 = sub(farEnd(e2, v), v)
        if (dot(toward1, e2.normal) >= -LINE_TOL || dot(toward2, e1.normal) >= -LINE_TOL) continue
        if (corners.some((c) => dist(c.point, v) <= LINE_TOL)) continue
        corners.push({ point: v, edges: [e1, e2] })
      }
    }
  }
  return corners
}
