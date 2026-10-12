import type { Point } from "../types"

// Выпуклые тела для расчёта коммуникаций (change add-communications, design D2, D3): круг стояка и многоугольник
// (прямоугольник воздуховода, тело стены, квадрат установки). Глубина наложения — расстояние минимального сдвига,
// сдвиг до касания — первое касание при движении тела вдоль направления. Чистая геометрия без DOM.

export type Shape = { kind: "circle"; c: Point; r: number } | { kind: "poly"; pts: readonly Point[] }

// всё, что короче, — касание или совпадение, а не наложение
const EPS = 1e-9

// общие допуски коммуникаций (placement, guard, edit): касание — наложение не глубже CONTACT_DEPTH_CM (общее
// соглашение стен, wall-collision); CLEAR_CM — «свободно»; поиск положения касания делением пополам
export const CONTACT_DEPTH_CM = 1e-6
export const CLEAR_CM = 1e-9
export const BISECT_ITERATIONS = 50

const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y })
const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y })
const mul = (a: Point, k: number): Point => ({ x: a.x * k, y: a.y * k })
const dot = (a: Point, b: Point): number => a.x * b.x + a.y * b.y
const norm = (a: Point): number => Math.hypot(a.x, a.y)

export const rectShape = (cx: number, cy: number, halfW: number, halfH: number): Shape => ({
  kind: "poly",
  pts: [
    { x: cx - halfW, y: cy - halfH },
    { x: cx + halfW, y: cy - halfH },
    { x: cx + halfW, y: cy + halfH },
    { x: cx - halfW, y: cy + halfH },
  ],
})

// тело стены — прямоугольник вдоль оси шириной в толщину (wall-collision); нулевая длина — тела нет
export function segmentShape(a: Point, b: Point, thicknessCm: number): Shape | null {
  const d = sub(b, a)
  const len = norm(d)
  if (len < EPS) return null
  const n = { x: (-d.y / len) * (thicknessCm / 2), y: (d.x / len) * (thicknessCm / 2) }
  return { kind: "poly", pts: [add(a, n), add(b, n), sub(b, n), sub(a, n)] }
}

export const translate = (s: Shape, v: Point): Shape =>
  s.kind === "circle" ? { kind: "circle", c: add(s.c, v), r: s.r } : { kind: "poly", pts: s.pts.map((p) => add(p, v)) }

export function centroid(s: Shape): Point {
  if (s.kind === "circle") return s.c
  const sum = s.pts.reduce(add, { x: 0, y: 0 })
  return mul(sum, 1 / s.pts.length)
}

// знак ориентации обхода: +1 или −1; внешняя нормаль ребра e — (e.y, −e.x) при +1
function orientation(pts: readonly Point[]): number {
  let area = 0
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length]
    area += p.x * q.y - q.x * p.y
  })
  return area >= 0 ? 1 : -1
}

interface Edge {
  p: Point
  q: Point
  e: Point
  len: number
  n: Point // внешняя единичная нормаль
}

function edgesOf(pts: readonly Point[]): Edge[] {
  const s = orientation(pts)
  const out: Edge[] = []
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length]
    const e = sub(q, p)
    const len = norm(e)
    if (len < EPS) return
    out.push({ p, q, e, len, n: { x: (s * e.y) / len, y: (-s * e.x) / len } })
  })
  return out
}

const project = (pts: readonly Point[], axis: Point): [number, number] => {
  const v = pts.map((p) => dot(p, axis))
  return [Math.min(...v), Math.max(...v)]
}

// глубина наложения круга на многоугольник и нормаль от круга к многоугольнику
function circleInPoly(c: Point, r: number, pts: readonly Point[]): { depth: number; normal: Point } {
  const edges = edgesOf(pts)
  const sd = edges.map((e) => dot(sub(c, e.p), e.n))
  if (sd.every((v) => v <= 0)) {
    let k = 0
    sd.forEach((v, i) => {
      if (v > sd[k]) k = i
    })
    return { depth: r - sd[k], normal: mul(edges[k].n, -1) }
  }
  let best = Infinity
  let nearest = c
  for (const e of edges) {
    const u = Math.max(0, Math.min(1, dot(sub(c, e.p), e.e) / (e.len * e.len)))
    const q = add(e.p, mul(e.e, u))
    const dd = norm(sub(c, q))
    if (dd < best) {
      best = dd
      nearest = q
    }
  }
  const depth = r - best
  const dir = sub(nearest, c)
  return { depth, normal: best > EPS ? mul(dir, 1 / best) : { x: 1, y: 0 } }
}

const orient = (n: Point, from: Shape, to: Shape): Point => {
  const d = sub(centroid(to), centroid(from))
  return dot(n, d) >= 0 ? n : mul(n, -1)
}

// глубина наложения (0 — касание или разделены) и нормаль контакта от a к b
export function penetration(a: Shape, b: Shape): { depth: number; normal: Point } {
  const none = { depth: 0, normal: { x: 1, y: 0 } }
  if (a.kind === "circle" && b.kind === "circle") {
    const d = sub(b.c, a.c)
    const dist = norm(d)
    const depth = a.r + b.r - dist
    return depth <= 0 ? none : { depth, normal: dist > EPS ? mul(d, 1 / dist) : { x: 1, y: 0 } }
  }
  if (a.kind === "circle" && b.kind === "poly") {
    const r = circleInPoly(a.c, a.r, b.pts)
    return r.depth <= 0 ? none : r
  }
  if (a.kind === "poly" && b.kind === "circle") {
    const r = circleInPoly(b.c, b.r, a.pts)
    return r.depth <= 0 ? none : { depth: r.depth, normal: mul(r.normal, -1) }
  }
  if (a.kind !== "poly" || b.kind !== "poly") return none
  let depth = Infinity
  let normal = { x: 1, y: 0 }
  for (const e of [...edgesOf(a.pts), ...edgesOf(b.pts)]) {
    const [a0, a1] = project(a.pts, e.n)
    const [b0, b1] = project(b.pts, e.n)
    const o = Math.min(a1, b1) - Math.max(a0, b0)
    if (o <= 0) return none
    if (o < depth) {
      depth = o
      normal = e.n
    }
  }
  return { depth, normal: orient(normal, a, b) }
}

export interface Touch {
  t: number // сдвиг до касания, ≥ 0
  contact: Point // точка касания в системе чертежа
}

// ближайший корень |w + t·d|² = R² при t ≥ −EPS (d — единичный)
function circleHit(w: Point, d: Point, R: number): number | null {
  const wd = dot(w, d)
  const disc = wd * wd - (dot(w, w) - R * R)
  if (disc < 0) return null
  const t = -wd - Math.sqrt(disc)
  return t >= -EPS ? Math.max(t, 0) : null
}

// круг c, r движется вдоль единичного d к многоугольнику pts
function sweepCirclePoly(c: Point, r: number, d: Point, pts: readonly Point[]): Touch | null {
  let best: Touch | null = null
  const take = (t: number, contact: Point): void => {
    if (!best || t < best.t) best = { t, contact }
  }
  for (const e of edgesOf(pts)) {
    const dn = dot(d, e.n)
    if (dn < -1e-12) {
      const t = (r - dot(sub(c, e.p), e.n)) / dn
      if (t < -EPS) continue
      const q = sub(add(c, mul(d, t)), mul(e.n, r))
      const u = dot(sub(q, e.p), e.e) / (e.len * e.len)
      if (u >= -EPS && u <= 1 + EPS) take(Math.max(t, 0), q)
    }
    const t = circleHit(sub(c, e.p), d, r)
    if (t !== null) take(t, e.p)
  }
  return best
}

const inPoly = (p: Point, pts: readonly Point[]): boolean => edgesOf(pts).every((e) => dot(sub(p, e.p), e.n) <= 1e-7)

function sweepPolys(a: readonly Point[], d: Point, b: readonly Point[]): Touch | null {
  let enter = -Infinity
  let exit = Infinity
  for (const e of [...edgesOf(a), ...edgesOf(b)]) {
    const [a0, a1] = project(a, e.n)
    const [b0, b1] = project(b, e.n)
    const v = dot(d, e.n)
    if (Math.abs(v) < 1e-12) {
      if (a1 <= b0 + EPS || b1 <= a0 + EPS) return null
      continue
    }
    const t0 = (b0 - a1) / v
    const t1 = (b1 - a0) / v
    enter = Math.max(enter, Math.min(t0, t1))
    exit = Math.min(exit, Math.max(t0, t1))
  }
  if (!(enter < exit - EPS) || exit <= 0) return null
  const t = Math.max(enter, 0)
  const moved = a.map((p) => add(p, mul(d, t)))
  const touching = [...moved.filter((p) => inPoly(p, b)), ...b.filter((p) => inPoly(p, moved))]
  const contact = touching.length ? mul(touching.reduce(add, { x: 0, y: 0 }), 1 / touching.length) : centroid({ kind: "poly", pts: moved })
  return { t, contact }
}

// крайняя точка тела вдоль единичного d: у круга — точка окружности, у многоугольника — середина вершин, дальше всех
// лежащих по d (место, где налагающееся тело касается препятствия, лежащего по d)
function supportPoint(s: Shape, d: Point): Point {
  if (s.kind === "circle") return add(s.c, mul(d, s.r))
  const far = Math.max(...s.pts.map((p) => dot(p, d)))
  const edge = s.pts.filter((p) => dot(p, d) >= far - 1e-9)
  return mul(edge.reduce(add, { x: 0, y: 0 }), 1 / edge.length)
}

// первое касание тела a, движущегося вдоль единичного d, с неподвижным b; null — не коснётся.
// Тела, налагающиеся уже сейчас, считаются касающимися (сдвиг 0), если d направлен к b, иначе не мешают
export function sweep(a: Shape, d: Point, b: Shape): Touch | null {
  const p = penetration(a, b)
  if (p.depth > EPS) return dot(d, p.normal) > 1e-12 ? { t: 0, contact: supportPoint(a, d) } : null
  if (a.kind === "circle" && b.kind === "circle") {
    const t = circleHit(sub(a.c, b.c), d, a.r + b.r)
    if (t === null) return null
    const cA = add(a.c, mul(d, t))
    const dir = sub(b.c, cA)
    const dist = norm(dir)
    return { t, contact: dist > EPS ? add(cA, mul(dir, a.r / dist)) : cA }
  }
  if (a.kind === "circle" && b.kind === "poly") return sweepCirclePoly(a.c, a.r, d, b.pts)
  if (a.kind === "poly" && b.kind === "circle") {
    const hit = sweepCirclePoly(b.c, b.r, mul(d, -1), a.pts)
    return hit && { t: hit.t, contact: add(hit.contact, mul(d, hit.t)) }
  }
  if (a.kind !== "poly" || b.kind !== "poly") return null
  return sweepPolys(a.pts, d, b.pts)
}
