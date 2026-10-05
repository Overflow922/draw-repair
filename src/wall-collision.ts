import type { Segment } from "./edit-plan"
import { jointedWalls, teeEndAttached } from "./geometry"
import type { WallEnd } from "./ortho-stretch"
import type { Point, Wall } from "./types"
import { RIGHT_SIN, add, clipHalfPlane, cross, degenerate, dist, dot, mul, perp, polygonArea, sub, unit } from "./wall-geometry"

// Тела стен и допустимость положения (change wall-move-bounds, design D4): тело — прямоугольник оси
// шириной в толщину; пересечение — наложение глубже допуска; связанные пары и привязка конца к оси
// исключаются; для исходных наложений площадь не должна расти.

// пересечение распознаётся при наложении глубже 0.01 см; остановка — в касании
export const RECOGNITION_DEPTH_CM = 0.01
const CONTACT_DEPTH_CM = 1e-6
const AREA_TOL = 1e-6

interface Rect {
  c: Point
  u: Point
  n: Point
  halfLen: number
  halfT: number
}

function rectOf(s: Segment, thickness: number): Rect | null {
  const len = dist(s.a, s.b)
  if (len < 1e-9) return null
  const u = unit(s.a, s.b)
  return { c: mul(add(s.a, s.b), 0.5), u, n: perp(u), halfLen: len / 2, halfT: thickness / 2 }
}

function corners(r: Rect): Point[] {
  const du = mul(r.u, r.halfLen)
  const dn = mul(r.n, r.halfT)
  return [add(add(r.c, du), dn), add(sub(r.c, du), dn), sub(sub(r.c, du), dn), sub(add(r.c, du), dn)]
}

const radius = (r: Rect, axis: Point): number => Math.abs(dot(r.u, axis)) * r.halfLen + Math.abs(dot(r.n, axis)) * r.halfT

// глубина наложения (SAT, ось минимального перекрытия) и нормаль контакта
function overlap(p: Rect, q: Rect): { depth: number; normal: Point } {
  let depth = Infinity
  let normal = p.u
  for (const axis of [p.u, p.n, q.u, q.n]) {
    const o = radius(p, axis) + radius(q, axis) - Math.abs(dot(sub(q.c, p.c), axis))
    if (o < depth) {
      depth = o
      normal = axis
    }
  }
  return { depth, normal }
}

function overlapArea(p: Rect, q: Rect): number {
  let poly = corners(p)
  for (const [axis, half] of [[q.u, q.halfLen], [q.n, q.halfT]] as const) {
    poly = clipHalfPlane(poly, q.c, axis, -half)
    poly = clipHalfPlane(poly, q.c, mul(axis, -1), -half)
    if (poly.length < 3) return 0
  }
  return polygonArea(poly)
}

// конец, поставленный привязкой на линию оси стены axis (design D4)
export interface AxisSnap {
  wall: Wall
  end: WallEnd
  axis: Wall
}

// тело без участка у привязанного конца: наложение в пределах полутолщины оси. Параллельная оси
// стена — не T-примыкание: тело проверяется целиком, как и при участке не короче стены
function trimmedRect(s: Segment, wall: Wall, end: WallEnd, axis: Segment, axisThickness: number): Rect | null {
  const len = dist(s.a, s.b)
  const sin = Math.abs(cross(unit(s.a, s.b), unit(axis.a, axis.b)))
  if (sin <= RIGHT_SIN) return rectOf(s, wall.thicknessCm)
  const trim = axisThickness / 2 / sin
  if (trim >= len) return rectOf(s, wall.thicknessCm)
  const u = unit(s.a, s.b)
  const cut = end === "a" ? { a: add(s.a, mul(u, trim)), b: s.b } : { a: s.a, b: sub(s.b, mul(u, trim)) }
  return rectOf(cut, wall.thicknessCm)
}

export type CheckMode = "recognition" | "contact"
export type Verdict = { ok: true } | { ok: false; normal: Point | null }

interface PairStart {
  exempt: boolean
  depth0: number
  area0: number | null // площадь исходного наложения (глубже допуска), иначе null
}

export interface CollisionContext {
  check: (positions: ReadonlyMap<Wall, Segment>, mode: CheckMode) => Verdict
  minHalfThickness: number
}

export function collisionContext(walls: readonly Wall[], snaps: readonly AxisSnap[]): CollisionContext {
  const live = walls.filter((w) => !degenerate(w))
  const index = new Map(live.map((w, i) => [w, i]))
  const starts = new Map<string, PairStart>()

  const pairStart = (p: Wall, q: Wall): PairStart => {
    const key = (index.get(p) ?? 0) < (index.get(q) ?? 0) ? `${index.get(p)}:${index.get(q)}` : `${index.get(q)}:${index.get(p)}`
    const known = starts.get(key)
    if (known) return known
    const exempt = jointedWalls(p, q) ||
      teeEndAttached(p.a, p, q) || teeEndAttached(p.b, p, q) || teeEndAttached(q.a, q, p) || teeEndAttached(q.b, q, p)
    let depth0 = -Infinity
    let area0: number | null = null
    if (!exempt) {
      const rp = rectOf(p, p.thicknessCm)
      const rq = rectOf(q, q.thicknessCm)
      if (rp && rq) {
        depth0 = overlap(rp, rq).depth
        if (depth0 > RECOGNITION_DEPTH_CM) area0 = overlapArea(rp, rq)
      }
    }
    const data = { exempt, depth0, area0 }
    starts.set(key, data)
    return data
  }

  const bodyOf = (w: Wall, s: Segment, other: Wall, os: Segment): Rect | null => {
    const snap = snaps.find((x) => x.wall === w && x.axis === other)
    return snap ? trimmedRect(s, w, snap.end, os, other.thicknessCm) : rectOf(s, w.thicknessCm)
  }

  const check = (positions: ReadonlyMap<Wall, Segment>, mode: CheckMode): Verdict => {
    for (const [c, cs] of positions) {
      if (!index.has(c)) continue
      for (const o of live) {
        if (o === c) continue
        const os = positions.get(o)
        // пара двух изменяемых стен проверяется один раз
        if (os && (index.get(o) ?? 0) < (index.get(c) ?? 0)) continue
        const start = pairStart(c, o)
        if (start.exempt) continue
        const oSeg = os ?? o
        const rc = bodyOf(c, cs, o, oSeg)
        const ro = bodyOf(o, oSeg, c, cs)
        if (!rc || !ro) continue
        const { depth, normal } = overlap(rc, ro)
        if (start.area0 !== null) {
          if (depth > 0 && overlapArea(rc, ro) > start.area0 + AREA_TOL) return { ok: false, normal }
          continue
        }
        const tol = mode === "recognition" ? RECOGNITION_DEPTH_CM : Math.max(CONTACT_DEPTH_CM, start.depth0 + 1e-9)
        if (depth > tol) return { ok: false, normal }
      }
    }
    return { ok: true }
  }

  const minHalfThickness = live.reduce((m, w) => Math.min(m, w.thicknessCm / 2), Infinity)
  return { check, minHalfThickness: Number.isFinite(minHalfThickness) ? minHalfThickness : 1 }
}
