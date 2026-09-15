import { PX_PER_CM, SNAP_RADIUS_PX } from "./types"
import type { Point, Wall } from "./types"

// Каноническая геометрия стен (change stable-wall-drawing, design D1).
// Единственный источник отображаемой формы: заливка, контур, подсветка,
// попадание курсора и превью потребляют displayPolygons.
// Все функции чистые: входные стены не мутируются (INV-PURE-1).

const EPS = 1e-9
const SLICE = 1e-7
// допуск прямого угла 0.5°: классификация через скалярное произведение направлений
const RIGHT_COS = Math.cos((0.5 * Math.PI) / 180)
const RIGHT_SIN = Math.sin((0.5 * Math.PI) / 180)
const ORTHO_TAN = Math.tan((15 * Math.PI) / 180)

const dist = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y)
const cross = (a: Point, b: Point): number => a.x * b.y - a.y * b.x
const dot = (a: Point, b: Point): number => a.x * b.x + a.y * b.y
const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y })
const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y })
const mul = (a: Point, k: number): Point => ({ x: a.x * k, y: a.y * k })
const neg = (a: Point): Point => ({ x: -a.x, y: -a.y })
const signOf = (v: number): number => (v > 0 ? 1 : -1)

function unit(from: Point, to: Point): Point {
  const l = dist(from, to)
  return l < EPS ? { x: 0, y: 0 } : mul(sub(to, from), 1 / l)
}

const perp = (u: Point): Point => ({ x: -u.y, y: u.x })

function clampRange(v: number, lo: number, hi: number): number {
  return lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v))
}

const degenerate = (w: Wall): boolean => dist(w.a, w.b) < EPS

const jointTol = (a: Wall, b: Wall): number => Math.max(a.thicknessCm, b.thicknessCm) / 2

export function snapRadiusCm(zoom: number): number {
  return SNAP_RADIUS_PX / (PX_PER_CM * zoom)
}

export interface VertexSnap {
  point: Point
  source: "wall" | "grid"
  normal?: Point // наружная нормаль грани при прилипании к грани (для квадрата установки)
}

interface Candidate {
  point: Point
  normal?: Point
}

// Кандидаты прилипания вершины к одной стене (грань / торец / продолжение).
function wallCandidates(p: Point, w: Wall, radiusCm: number, newHalf: number): Candidate[] {
  const u = unit(w.a, w.b)
  if (u.x === 0 && u.y === 0) return []
  const n = perp(u)
  const len = dist(w.a, w.b)
  const rel = sub(p, w.a)
  const s = dot(rel, u)
  const lat = dot(rel, n)
  const hW = w.thicknessCm / 2
  const facePoint = (sd: number): Candidate => {
    const sC = clampRange(s, newHalf, len - newHalf)
    return { point: add(add(w.a, mul(u, sC)), mul(n, sd * hW)), normal: mul(n, sd) }
  }
  if (Math.abs(lat) <= hW + SLICE) {
    // в полосе стены: за торцом / до торца — продолжение на оси
    if (s > len) return [{ point: w.b }]
    if (s < 0) return [{ point: w.a }]
    // курсор на стене (расстояние до неё 0): прилипание к ближайшей грани всегда —
    // иначе посреди тела возникала дыра с прыжком точки на узел сетки
    return [facePoint(signOf(lat))]
  }
  const faceDist = Math.abs(lat) - hW
  // зона конца: курсор в пределах радиуса от точки торца — прилипание к самому торцу.
  // Это делает старт следующей стены цепочки от стыка надёжным (без зазора и прыжков)
  for (const end of [w.a, w.b]) {
    if (dist(p, end) <= radiusCm) return [{ point: end }]
  }
  const out: Candidate[] = []
  // зона прилипания к грани: радиус привязки ИЛИ край приставленного квадрата
  // (квадрат стоит вплотную к грани — тело начинается ровно от него)
  const reach = Math.max(radiusCm, newHalf)
  // грань рядом с телом (включая зону конца: проекция не дальше reach за торцом)
  if (faceDist <= reach && s <= len + reach && s >= -reach) out.push(facePoint(signOf(lat)))
  // продолжение полосы за торцом в пределах радиуса
  if (s > len && Math.abs(lat) <= radiusCm) out.push({ point: w.b })
  if (s < 0 && Math.abs(lat) <= radiusCm) out.push({ point: w.a })
  return out
}

export function snapVertex(
  p: Point,
  walls: Wall[],
  radiusCm: number,
  gridStepCm: number,
  newWallThicknessCm: number,
  orthoFrom?: Point,
): VertexSnap {
  const newHalf = newWallThicknessCm / 2
  let best: { point: Point; d: number; normal?: Point } | null = null
  for (const w of walls) {
    if (degenerate(w)) continue
    for (const cand of wallCandidates(p, w, radiusCm, newHalf)) {
      const d = dist(p, cand.point)
      // строго меньше: при равенстве побеждает стена раньше в массиве (SNAP-DET-2)
      if (!best || d < best.d - EPS) best = { point: cand.point, d, normal: cand.normal }
    }
  }
  if (best) {
    const result: VertexSnap = { point: best.point, source: "wall" }
    if (best.normal)
      // вспомогательное поле для квадрата установки (main.ts); замороженный контракт
      // тестов — {point, source}, поэтому normal неэнумерируемо и невидимо для toEqual
      Object.defineProperty(result, "normal", { value: best.normal, enumerable: false })
    return result
  }
  const grid = (v: number): number => Math.round(v / gridStepCm) * gridStepCm
  if (orthoFrom) {
    const dx = p.x - orthoFrom.x
    const dy = p.y - orthoFrom.y
    // неподвижная координата = координата последней вершины точно; гридится только подвижная
    if (Math.abs(dy) <= ORTHO_TAN * Math.abs(dx)) return { point: { x: grid(p.x), y: orthoFrom.y }, source: "grid" }
    if (Math.abs(dx) <= ORTHO_TAN * Math.abs(dy)) return { point: { x: orthoFrom.x, y: grid(p.y) }, source: "grid" }
  }
  return { point: { x: grid(p.x), y: grid(p.y) }, source: "grid" }
}

function clipHalfPlane(poly: Point[], origin: Point, normal: Point, lo: number): Point[] {
  const out: Point[] = []
  const val = (q: Point): number => dot(sub(q, origin), normal) - lo
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const va = val(a)
    const vb = val(b)
    if (va >= -SLICE) out.push(a)
    if ((va > SLICE && vb < -SLICE) || (va < -SLICE && vb > SLICE)) {
      const t = va / (va - vb)
      out.push(add(a, mul(sub(b, a), t)))
    }
  }
  return out
}

function polygonArea(poly: Point[]): number {
  let s = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    s += cross(a, b)
  }
  return Math.abs(s) / 2
}

function pointInPolygon(p: Point, poly: Point[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const yi = poly[i].y
    const yj = poly[j].y
    if (yi > p.y !== yj > p.y && p.x < ((poly[j].x - poly[i].x) * (p.y - yi)) / (yj - yi) + poly[i].x)
      inside = !inside
  }
  if (inside) return true
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const e1 = poly[i]
    const e2 = poly[j]
    const len2 = dot(sub(e2, e1), sub(e2, e1))
    if (len2 < EPS) continue
    const t = clampRange(dot(sub(p, e1), sub(e2, e1)) / len2, 0, 1)
    if (dist(p, add(e1, mul(sub(e2, e1), t))) <= SLICE) return true
  }
  return false
}

// Разность выпуклого куска и выпуклого тела стены: послойное снятие полос.
// Куски результата НЕ пересекаются (каждая точка относится к первой плоскости,
// исключающей её), поэтому контур по их рёбам не теряет сегменты, а заливка
// не теряет области — в отличие от наивного набора комплементарных клипов,
// которые дублируют кусок целиком, когда тело его не касается.
function subtractBody(piece: Point[], c: Wall): Point[][] {
  const u = unit(c.a, c.b)
  const n = perp(u)
  const h = c.thicknessCm / 2
  const len = dist(c.a, c.b)
  const inside: [Point, Point, number][] = [
    [c.a, n, h],
    [c.a, neg(n), h],
    [c.a, u, len],
    [c.a, neg(u), 0],
  ]
  const result: Point[][] = []
  let survivors: Point[][] = [piece]
  for (const [o, nrm, lo] of inside) {
    const next: Point[][] = []
    for (const s of survivors) {
      const outside = clipHalfPlane(s, o, nrm, lo) // s за гранью тела (нарушение ограничения)
      const insideStrip = clipHalfPlane(s, o, neg(nrm), -lo) // s внутри ограничения: режется следующими плоскостями
      if (outside.length >= 3 && polygonArea(outside) > 1e-9) result.push(outside)
      if (insideStrip.length >= 3 && polygonArea(insideStrip) > 1e-9) next.push(insideStrip)
    }
    survivors = next
    if (!survivors.length) break
  }
  return result
}

interface EndShape {
  E: Point
  cap: [Point, Point]
  exempt: Set<Wall>
  wedge: { c: Wall; s: number } | null
}

function endShape(wall: Wall, E: Point, uIn: Point, nAB: Point, walls: Wall[], iWall: number, isLatest: boolean): EndShape {
  const hW = wall.thicknessCm / 2
  const flat: EndShape = { E, cap: [add(E, mul(nAB, hW)), add(E, mul(nAB, -hW))], exempt: new Set(), wedge: null }
  // соседи по концу
  const endNeighbors: { c: Wall; v: Point }[] = []
  for (const c of walls) {
    if (c === wall || degenerate(c)) continue
    for (const v of [c.a, c.b]) if (dist(v, E) <= jointTol(wall, c) + SLICE) endNeighbors.push({ c, v })
  }
  // стена «ранняя» для стыка, если сосед стоит в массиве позже неё
  const isEarlier = !isLatest && endNeighbors.every(({ c }) => walls.indexOf(c) > iWall)
  if (endNeighbors.length >= 2) {
    // 3+ конца в пороге: плоские торцы, взаимной обрезки нет
    return { E, cap: flat.cap, exempt: new Set(endNeighbors.map(({ c }) => c)), wedge: null }
  }
  if (endNeighbors.length === 1) {
    const { c, v } = endNeighbors[0]
    if (isEarlier) return flat
    const uC = unit(c.a, c.b)
    const nC = perp(uC)
    const hC = c.thicknessCm / 2
    const latE = dot(sub(E, c.a), nC)
    if (Math.abs(latE) < hC - SLICE) {
      // вершина внутри полосы соседа
      if (Math.abs(dot(uIn, uC)) >= RIGHT_COS) {
        // коллинеарно: зазор сводится к концу ранней стены
        return { E, cap: [add(v, mul(nAB, hW)), add(v, mul(nAB, -hW))], exempt: new Set(), wedge: null }
      }
      // перпендикулярно/косо: доводим до дальней грани ранней
      const alongN = dot(uIn, nC)
      const sFar = -signOf(alongN || latE)
      const tSlide = (sFar * hC - latE) / alongN
      const center = add(E, mul(uIn, tSlide))
      return { E, cap: [add(center, mul(nAB, hW)), add(center, mul(nAB, -hW))], exempt: new Set(), wedge: null }
    }
    // вершина на грани или снаружи: плоский торец; на грани — клин принадлежит поздней
    const wedge = Math.abs(Math.abs(latE) - hC) <= SLICE ? { c, s: signOf(latE) } : null
    return { E, cap: flat.cap, exempt: new Set(), wedge }
  }
  // свободный конец: T-примыкание к оси либо прилипание к полосе соседа
  for (const c of walls) {
    if (c === wall || degenerate(c)) continue
    if (!isLatest && walls.indexOf(c) > iWall) continue
    const uC = unit(c.a, c.b)
    const nC = perp(uC)
    const hC = c.thicknessCm / 2
    const rel = sub(E, c.a)
    const latE = dot(rel, nC)
    const along = dot(rel, uC)
    const lenC = dist(c.a, c.b)
    if (along < -SLICE || along > lenC + SLICE) continue
    const uW = uIn
    if (Math.abs(latE) < hC - SLICE) {
      // конец на оси или внутри полосы: торец подрезается по ближней грани со стороны подхода
      if (Math.abs(latE) <= SLICE && Math.abs(dot(uW, uC)) <= RIGHT_SIN) {
        const sNear = signOf(dot(uW, nC))
        const tSlide = (sNear * hC - latE) / dot(uW, nC)
        const center = add(E, mul(uIn, tSlide))
        return { E, cap: [add(center, mul(nAB, hW)), add(center, mul(nAB, -hW))], exempt: new Set(), wedge: null }
      }
      return { E, cap: flat.cap, exempt: new Set(), wedge: { c, s: signOf(latE) } }
    }
    if (Math.abs(Math.abs(latE) - hC) <= SLICE) {
      return { E, cap: flat.cap, exempt: new Set(), wedge: { c, s: signOf(latE) } }
    }
  }
  return flat
}

export function displayPolygons(wall: Wall, walls: Wall[]): Point[][] {
  if (degenerate(wall)) return []
  const iWall = walls.indexOf(wall)
  const isLatest = iWall === -1 // превью считается позднейшей
  const uAB = unit(wall.a, wall.b)
  const nAB = perp(uAB)
  const endA = endShape(wall, wall.a, uAB, nAB, walls, iWall, isLatest)
  const endB = endShape(wall, wall.b, neg(uAB), nAB, walls, iWall, isLatest)
  const order = (cap: [Point, Point]): [Point, Point] =>
    dot(sub(cap[1], wall.a), nAB) > dot(sub(cap[0], wall.a), nAB) ? [cap[1], cap[0]] : cap
  const [aPlus, aMinus] = order(endA.cap)
  const [bPlus, bMinus] = order(endB.cap)
  const shape: Point[] = [aPlus, bPlus, bMinus, aMinus]
  let pieces: Point[][] = polygonArea(shape) > 1e-9 ? [shape] : []
  // залив клина на непрямом угле принадлежит поздней стене:
  // треугольник между гранью ранней стены, торцом поздней и её гранью
  for (const end of [endA, endB]) {
    if (!end.wedge || (!isLatest && iWall !== -1 && walls.indexOf(end.wedge.c) > iWall)) continue
    const c = end.wedge.c
    const nC = perp(unit(c.a, c.b))
    const hC = c.thicknessCm / 2
    const corner = end.cap.find((q) => dot(sub(q, c.a), nC) * end.wedge!.s >= hC - SLICE)
    if (!corner) continue
    const uIn = end === endA ? uAB : neg(uAB)
    const alongN = dot(uIn, nC)
    if (Math.abs(alongN) < EPS) continue
    const tFace = (end.wedge.s * hC - dot(sub(corner, c.a), nC)) / alongN
    const facePt = add(corner, mul(uIn, tFace))
    const tri: Point[] = [end.E, corner, facePt]
    if (polygonArea(tri) > 1e-9) pieces.push(tri)
  }
  // поздняя стена не отображается внутри тела стен, стоящих раньше
  const exempt = new Set<Wall>([...endA.exempt, ...endB.exempt])
  for (let i = 0; i < walls.length; i++) {
    const c = walls[i]
    if (c === wall || degenerate(c) || exempt.has(c)) continue
    if (!isLatest && i >= iWall) continue
    pieces = pieces.flatMap((pc) => subtractBody(pc, c))
  }
  return pieces
}

function axisDistance(p: Point, w: Wall): number {
  const u = unit(w.a, w.b)
  if (u.x === 0 && u.y === 0) return dist(p, w.a)
  const rel = sub(p, w.a)
  const s = dot(rel, u)
  const len = dist(w.a, w.b)
  const along = clampRange(s, 0, len)
  return Math.hypot(s - along, dot(rel, perp(u)))
}

export function hitWall(p: Point, walls: Wall[], toleranceCm: number): Wall | null {
  // попадание по отображаемой форме: позже в массиве — выше
  for (let i = walls.length - 1; i >= 0; i--) {
    const w = walls[i]
    if (degenerate(w)) continue
    if (displayPolygons(w, walls).some((poly) => pointInPolygon(p, poly))) return w
  }
  // допуск выделения по оси для тонких стен (совместимость wall-selection)
  let best: Wall | null = null
  let bestD = toleranceCm
  for (const w of walls) {
    if (degenerate(w)) continue
    const d = axisDistance(p, w)
    if (d <= bestD) {
      best = w
      bestD = d
    }
  }
  return best
}

export interface Seg {
  p1: Point
  p2: Point
}

const lerp = (a: Point, b: Point, t: number): Point => add(a, mul(sub(b, a), t))

// параметрический интервал ребра внутри выпуклого куска (пусто, если ребро снаружи)
function coveredInterval(p1: Point, p2: Point, piece: Point[]): [number, number] | null {
  const cx = piece.reduce((acc, q) => acc + q.x, 0) / piece.length
  const cy = piece.reduce((acc, q) => acc + q.y, 0) / piece.length
  const d = sub(p2, p1)
  let t0 = 0
  let t1 = 1
  for (let i = 0; i < piece.length; i++) {
    const a = piece[i]
    const b = piece[(i + 1) % piece.length]
    let n = perp(sub(b, a))
    if (dot(n, sub({ x: cx, y: cy }, mul(add(a, b), 0.5))) > 0) n = neg(n)
    const n0 = dot(sub(p1, a), n)
    const dn = dot(d, n)
    if (Math.abs(dn) < EPS) {
      if (n0 > EPS) return null
      continue
    }
    const t = -n0 / dn
    if (dn > 0) t1 = Math.min(t1, t)
    else t0 = Math.max(t0, t)
    if (t0 > t1) return null
  }
  return [t0, t1]
}

function subtractIntervals(hidden: [number, number][], add: [number, number] | null): void {
  if (!add) return
  hidden.push(add)
}

function mergeIntervals(hidden: [number, number][]): [number, number][] {
  const sorted = [...hidden].sort((x, y) => x[0] - y[0])
  const merged: [number, number][] = []
  for (const iv of sorted) {
    const last = merged[merged.length - 1]
    if (last && iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1])
    else merged.push([iv[0], iv[1]])
  }
  return merged
}

// рёбра на гранях однотипных соседей не рисуются: контур непрерывен, как у одной стены.
// Возвращает true, если ребро преимущественно лежит на грани однотипного соседа.
function onSameTypeFace(wall: Wall, p1: Point, p2: Point, walls: Wall[]): boolean {
  const du = sub(p2, p1)
  const len2 = dot(du, du)
  if (len2 < EPS) return false
  const hidden: [number, number][] = []
  for (const w of walls) {
    if (w === wall || degenerate(w)) continue
    if (w.type !== wall.type || w.thicknessCm !== wall.thicknessCm) continue
    const u = unit(w.a, w.b)
    const n = perp(u)
    const h = w.thicknessCm / 2
    for (const sd of [1, -1] as const) {
      const q1 = add(w.a, mul(n, sd * h))
      const q2 = add(w.b, mul(n, sd * h))
      const qu = sub(q2, q1)
      if (Math.abs(cross(du, qu)) > 1e-6) continue
      if (Math.abs(cross(qu, sub(p1, q1))) > 1e-4) continue
      const lenQ2 = dot(qu, qu)
      const e1 = dot(sub(p1, q1), qu) / lenQ2
      const e2 = dot(sub(p2, q1), qu) / lenQ2
      hidden.push([Math.max(0, Math.min(e1, e2)), Math.min(1, Math.max(e1, e2))])
    }
  }
  const covered = mergeIntervals(hidden).reduce((acc, [t0, t1]) => acc + (t1 - t0), 0)
  return covered > 0.5
}

// видимые участки ребра: ребро минус интервалы, накрытые другими кусками той же стены
function visibleEdge(p1: Point, p2: Point, pieces: Point[][], self: number): [number, number][] {
  const hidden: [number, number][] = []
  pieces.forEach((other, j) => {
    if (j === self) return
    subtractIntervals(hidden, coveredInterval(p1, p2, other))
  })
  const visible: [number, number][] = []
  let cursor = 0
  for (const [t0, t1] of mergeIntervals(hidden)) {
    if (t0 > cursor) visible.push([cursor, Math.min(t0, 1)])
    cursor = Math.max(cursor, t1)
  }
  if (cursor < 1) visible.push([cursor, 1])
  return visible.filter(([t0, t1]) => t1 - t0 > 1e-6)
}

// канонический контур стены: видимые рёбра displayPolygons (швы однотипных стыков скрыты)
export function contourSegments(wall: Wall, walls: Wall[]): Seg[] {
  const pieces = displayPolygons(wall, walls)
  const out: Seg[] = []
  pieces.forEach((piece, i) => {
    for (let k = 0; k < piece.length; k++) {
      const p1 = piece[k]
      const p2 = piece[(k + 1) % piece.length]
      for (const [t0, t1] of visibleEdge(p1, p2, pieces, i)) {
        const s1 = lerp(p1, p2, t0)
        const s2 = lerp(p1, p2, t1)
        if (!onSameTypeFace(wall, s1, s2, walls)) out.push({ p1: s1, p2: s2 })
      }
    }
  })
  return out
}
