import type { Shape } from "../communications/shape"
import type { LightFixture, Point } from "../types"
import { add, dot, mul, sub } from "../wall-geometry"

// Расстояния объектов освещения до чистовых граней и прилипание бра к грани (change add-ceiling-lighting, design D2, D3; spec
// ceiling-lighting «Расстояния точки освещения до стен», «Расстояние бра вдоль стены»). Грани — тела furnitureReachBodies
// (стены подложки и «Монтажа», гипсокартон, действующая штукатурка): выпуклые многоугольники. Луч из центра входит в тело на
// первой обращённой к нему грани; тело, в котором луч уже стоит, пропускается. Чистые функции.

// одно расстояние объекта: от центра from вдоль единичного dir до точки грани to; t — длина в см
export interface LightReach {
  axis: LightAxis
  t: number
  from: Point
  to: Point
  dir: Point
}

// у точки освещения — оси x и y чертежа, у бра — вдоль грани
export type LightAxis = "x" | "y" | "along"

const TIE_CM = 1e-6
const INSIDE_CM = 1e-6 // точка на границе тела в него не входит
const SCONCE_OFFSET_CM = 0.1 // лучи бра идут в 1 мм от грани, на которой оно стоит

// параметр входа луча p + s·d (s ≥ 0) в выпуклый многоугольник; null — луч его не встречает или стоит внутри
function entry(p: Point, d: Point, pts: readonly Point[]): number | null {
  let area = 0
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length] ?? a
    area += a.x * b.y - b.x * a.y
  })
  const orient = Math.sign(area) || 1
  let lo = -Infinity
  let hi = Infinity
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    if (!a || !b) continue
    const e = sub(b, a)
    const len = Math.hypot(e.x, e.y)
    if (len === 0) continue
    // f(s) = f0 + s·fd — расстояние со знаком внутрь многоугольника
    const n = { x: (-orient * e.y) / len, y: (orient * e.x) / len }
    const f0 = dot(n, sub(p, a))
    const fd = dot(n, d)
    if (Math.abs(fd) < 1e-12) {
      if (f0 < -INSIDE_CM) return null
      continue
    }
    const s = -f0 / fd
    if (fd > 0) lo = Math.max(lo, s)
    else hi = Math.min(hi, s)
  }
  if (lo > hi + INSIDE_CM || lo < -INSIDE_CM) return null
  return Math.max(0, lo)
}

// ближайшая грань по лучу; null — граней нет
function cast(p: Point, d: Point, bodies: readonly Shape[]): number | null {
  let best: number | null = null
  for (const body of bodies) {
    if (body.kind !== "poly") continue
    const s = entry(p, d, body.pts)
    if (s !== null && (best === null || s < best)) best = s
  }
  return best
}

// меньшее из двух направлений; при равенстве — первое
function nearer(center: Point, start: Point, axis: LightAxis, first: Point, second: Point, bodies: readonly Shape[]): LightReach | null {
  const reachOf = (dir: Point): LightReach | null => {
    const t = cast(start, dir, bodies)
    return t === null ? null : { axis, t, from: center, to: add(center, mul(dir, t)), dir }
  }
  const a = reachOf(first)
  const b = reachOf(second)
  if (!a) return b
  if (!b) return a
  return b.t < a.t - TIE_CM ? b : a
}

const LEFT = { x: -1, y: 0 }
const RIGHT = { x: 1, y: 0 }
const UP = { x: 0, y: -1 }
const DOWN = { x: 0, y: 1 }

// нормаль бра; остаток вычисления у углов, кратных 90°, обнуляется — иначе сдвиг вдоль горизонтальной грани уводит центр с грани
export const sconceNormal = (angleDeg: number): Point => {
  const r = (angleDeg * Math.PI) / 180
  const clean = (v: number): number => (Math.abs(v) < 1e-12 ? 0 : v)
  return { x: clean(Math.cos(r)), y: clean(Math.sin(r)) }
}

// направления вдоль грани бра: первым — с меньшим X, а у вертикальной грани — с меньшим Y (выбор при равенстве)
function alongDirs(angleDeg: number): [Point, Point] {
  const n = sconceNormal(angleDeg)
  const t = { x: -n.y, y: n.x }
  const back = { x: -t.x, y: -t.y }
  const firstIsT = Math.abs(t.x) > 1e-9 ? t.x < 0 : t.y < 0
  return firstIsT ? [t, back] : [back, t]
}

// расстояния объекта: у точки — по оси x и по оси y (без грани по оси — без числа), у бра — одно вдоль грани
export function lightReaches(l: LightFixture, bodies: readonly Shape[]): LightReach[] {
  const c = { x: l.x, y: l.y }
  if (l.kind === "sconce") {
    const start = add(c, mul(sconceNormal(l.angleDeg), SCONCE_OFFSET_CM))
    const [a, b] = alongDirs(l.angleDeg)
    const r = nearer(c, start, "along", a, b, bodies)
    return r ? [r] : []
  }
  return [nearer(c, c, "x", LEFT, RIGHT, bodies), nearer(c, c, "y", UP, DOWN, bodies)].filter((r): r is LightReach => r !== null)
}

const strictlyInside = (p: Point, pts: readonly Point[]): boolean => {
  let sign = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    if (!a || !b) continue
    const e = sub(b, a)
    const len = Math.hypot(e.x, e.y)
    if (len === 0) continue
    const f = (e.x * (p.y - a.y) - e.y * (p.x - a.x)) / len
    if (Math.abs(f) <= INSIDE_CM) return false
    const s = Math.sign(f)
    if (sign === 0) sign = s
    else if (s !== sign) return false
  }
  return sign !== 0
}

// точка внутри тела стены подложки, стены гипсокартона или полосы штукатурки (граница — не внутри)
export const insideBodies = (p: Point, bodies: readonly Shape[]): boolean => bodies.some((b) => b.kind === "poly" && strictlyInside(p, b.pts))

export interface SconceSnap {
  at: Point
  angleDeg: number
}

// точка ребра a–b, у которой координата вдоль ребра (X у ребра ближе к горизонтали, иначе Y) округлена до целого сантиметра
function roundAlong(foot: Point, a: Point, b: Point): Point {
  const e = sub(b, a)
  if (Math.abs(e.x) >= Math.abs(e.y)) {
    const x = Math.round(foot.x)
    return { x, y: a.y + ((x - a.x) * e.y) / e.x }
  }
  const y = Math.round(foot.y)
  return { x: a.x + ((y - a.y) * e.x) / e.y, y }
}

// прилипание бра: ближайшая к курсору чистовая грань не дальше maxCm, курсор вне тел; грань, закрытая другим телом (грань стены
// под штукатуркой), не годится. Центр — точка грани с округлением вдоль неё, направление — нормаль грани к курсору
export function snapSconce(cursor: Point, bodies: readonly Shape[], maxCm: number): SconceSnap | null {
  if (insideBodies(cursor, bodies)) return null
  let best: { snap: SconceSnap; dist: number } | null = null
  for (const body of bodies) {
    if (body.kind !== "poly") continue
    const pts = body.pts
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]
      const b = pts[(i + 1) % pts.length]
      if (!a || !b) continue
      const e = sub(b, a)
      const lenSq = dot(e, e)
      if (lenSq === 0) continue
      const s = Math.min(1, Math.max(0, dot(sub(cursor, a), e) / lenSq))
      const foot = add(a, mul(e, s))
      const dist = Math.hypot(cursor.x - foot.x, cursor.y - foot.y)
      if (dist > maxCm || (best && dist >= best.dist)) continue
      const len = Math.sqrt(lenSq)
      let n = { x: -e.y / len, y: e.x / len }
      if (dot(n, sub(cursor, foot)) < 0) n = { x: -n.x, y: -n.y }
      // грань открыта, если сразу за ней по нормали нет тела
      if (insideBodies(add(foot, mul(n, SCONCE_OFFSET_CM)), bodies)) continue
      const at = roundAlong(foot, a, b)
      best = { snap: { at, angleDeg: (Math.atan2(n.y, n.x) * 180) / Math.PI }, dist }
    }
  }
  return best?.snap ?? null
}
