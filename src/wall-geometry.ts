import type { Point, Wall } from "./types"

// привязка вершины живёт в wall-snap (change fix-wall-snap-overlap, design D8);
// реэкспорт сохраняет прежний путь импорта
export { snapRadiusCm, snapVertex } from "./wall-snap"
export type { VertexSnap } from "./wall-snap"

// Каноническая геометрия стен (change stable-wall-drawing, design D1).
// Единственный источник отображаемой формы: заливка, контур, подсветка,
// попадание курсора и превью потребляют displayPolygons.
// Все функции чистые: входные стены не мутируются (INV-PURE-1).

const EPS = 1e-9
const SLICE = 1e-7
// допуск прямого угла 0.5°: классификация через скалярное произведение направлений
const RIGHT_COS = Math.cos((0.5 * Math.PI) / 180)
export const RIGHT_SIN = Math.sin((0.5 * Math.PI) / 180)

export const dist = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y)
export const cross = (a: Point, b: Point): number => a.x * b.y - a.y * b.x
export const dot = (a: Point, b: Point): number => a.x * b.x + a.y * b.y
export const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y })
export const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y })
export const mul = (a: Point, k: number): Point => ({ x: a.x * k, y: a.y * k })
const neg = (a: Point): Point => ({ x: -a.x, y: -a.y })
export const signOf = (v: number): number => (v > 0 ? 1 : -1)

export function unit(from: Point, to: Point): Point {
  const l = dist(from, to)
  return l < EPS ? { x: 0, y: 0 } : mul(sub(to, from), 1 / l)
}

export const perp = (u: Point): Point => ({ x: -u.y, y: u.x })

function clampRange(v: number, lo: number, hi: number): number {
  return lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v))
}

export const degenerate = (w: Wall): boolean => dist(w.a, w.b) < EPS

const jointTol = (a: Wall, b: Wall): number => Math.max(a.thicknessCm, b.thicknessCm) / 2

// запас к диагонали угла: дрейф концов от накопленных правок не превращает угол в T-примыкание
const FACE_CORNER_MARGIN_CM = 1

// допуск углового стыка на грани (перенос и отрисовка): допуск вершины стыка с запасом или
// диагональ угла √(h₁²+h₂²) — точка, в которую рисование ставит вершину, прилипшую к грани у торца, — с запасом
export function faceCornerTol(a: Wall, b: Wall): number {
  const ha = a.thicknessCm / 2
  const hb = b.thicknessCm / 2
  return Math.max(Math.max(ha, hb) * 1.25, Math.hypot(ha, hb) + FACE_CORNER_MARGIN_CM) + EPS
}

export function clipHalfPlane(poly: Point[], origin: Point, normal: Point, lo: number): Point[] {
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

export function polygonArea(poly: Point[]): number {
  let s = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    s += cross(a, b)
  }
  return Math.abs(s) / 2
}

export function pointInPolygon(p: Point, poly: Point[]): boolean {
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
  return subtractPlanes(piece, [
    [c.a, n, h],
    [c.a, neg(n), h],
    [c.a, u, len],
    [c.a, neg(u), 0],
  ])
}

// разность выпуклого куска и выпуклого многоугольника (продолжение торца партнёра)
function subtractConvex(piece: Point[], poly: Point[]): Point[][] {
  const cx = poly.reduce((acc, q) => acc + q.x, 0) / poly.length
  const cy = poly.reduce((acc, q) => acc + q.y, 0) / poly.length
  const planes: [Point, Point, number][] = poly.map((a, i) => {
    const b = poly[(i + 1) % poly.length]
    let out = perp(unit(a, b))
    if (dot(out, sub({ x: cx, y: cy }, a)) > 0) out = neg(out)
    return [a, out, 0]
  })
  return subtractPlanes(piece, planes)
}

// снятие полос по плоскостям [o, внешняя нормаль, lo]: куски за плоскостью — снаружи тела
function subtractPlanes(piece: Point[], inside: [Point, Point, number][]): Point[][] {
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

// Угловой стык на грани (change corner-joint-face-caps, design D2–D4).
// Линия грани с сохраняемой стороной: dot(p − o, n) ≥ lo.
interface FaceLine {
  o: Point
  n: Point
  lo: number
}

interface FaceCorner {
  partner: Wall
  partnerEnd: Point
  partnerIn: Point // направление тела партнёра от его торца
  role: "through" | "abutting"
  ownTarget: FaceLine // до этой линии доращивается торец стены
  partnerTarget: FaceLine // до этой линии доращивается торец партнёра
  outerU: FaceLine // наружная грань упёртой: по ней срезается торец сквозной
  right: boolean // в пределах допуска прямого угла: раскладка прямоугольниками
}

const SIN15 = Math.sin((15 * Math.PI) / 180)
const COS15 = Math.cos((15 * Math.PI) / 180)

const inward = (w: Wall, end: Point): Point => (end === w.a ? unit(w.a, w.b) : unit(w.b, w.a))

// ровно один конец соседа в пороге углового стыка, у конца соседа — тоже только этот конец;
// концы ближе допуска вершины стыка — вершина (легаси), не угловой стык на грани
function partnerEndOf(wall: Wall, E: Point, scene: Wall[]): { c: Wall; v: Point } | null {
  let match: { c: Wall; v: Point } | null = null
  for (const c of scene) {
    if (c === wall || degenerate(c)) continue
    for (const v of [c.a, c.b]) {
      const d = dist(v, E)
      if (d <= jointTol(wall, c) + SLICE) return null
      if (d > faceCornerTol(wall, c)) continue
      if (match) return null
      match = { c, v }
    }
  }
  if (!match) return null
  const { c, v } = match
  for (const t of scene) {
    if (t === c || degenerate(t)) continue
    for (const q of [t.a, t.b]) {
      if (q !== E && dist(q, v) <= faceCornerTol(c, t)) return null
    }
  }
  return match
}

function faceCornerAt(wall: Wall, E: Point, walls: Wall[]): FaceCorner | null {
  const scene = walls.includes(wall) ? walls : [...walls, wall] // превью не в массиве
  const found = partnerEndOf(wall, E, scene)
  if (!found) return null
  const { c, v } = found
  const uW = unit(wall.a, wall.b)
  const uC = unit(c.a, c.b)
  if (Math.abs(cross(uW, uC)) < SIN15) return null
  // упёртая: проекция её конца лежит строго внутри длины соседа
  const alongE = dot(sub(E, c.a), uC)
  const alongV = dot(sub(v, wall.a), uW)
  const wallAbuts = alongE > 0 && alongE < dist(c.a, c.b)
  const partnerAbuts = alongV > 0 && alongV < dist(wall.a, wall.b)
  if (wallAbuts === partnerAbuts) return null
  const [S, sEnd, U, uEnd] = wallAbuts ? [c, v, wall, E] : [wall, E, c, v]
  const nS = perp(unit(S.a, S.b))
  const nU = perp(unit(U.a, U.b))
  // стороны — по направлению тел: наружная грань U обращена от тела S, внутренняя грань S — к телу U
  const sO = -signOf(dot(nU, inward(S, sEnd)))
  const sI = signOf(dot(nS, inward(U, uEnd)))
  const outerU: FaceLine = { o: U.a, n: mul(nU, -sO), lo: -U.thicknessCm / 2 }
  const innerS: FaceLine = { o: S.a, n: mul(nS, sI), lo: S.thicknessCm / 2 }
  const through = !wallAbuts
  return {
    partner: c,
    partnerEnd: v,
    partnerIn: inward(c, v),
    role: through ? "through" : "abutting",
    ownTarget: through ? outerU : innerS,
    partnerTarget: through ? innerS : outerU,
    outerU,
    right: Math.abs(dot(uW, uC)) <= RIGHT_SIN,
  }
}

// доращивание торца: полоса граней стены за сырым торцом (наружу от тела),
// по сохраняемую сторону целевой линии; пусто, если углы торца уже за линией
function capExtension(w: Wall, E: Point, uIn: Point, target: FaceLine): Point[] | null {
  const n = perp(unit(w.a, w.b))
  const h = w.thicknessCm / 2
  const corners = [add(E, mul(n, h)), add(E, mul(n, -h))]
  const rate = dot(uIn, target.n) // > 0: движение наружу от тела приближает к линии
  if (rate <= EPS) return null
  const reach = Math.max(0, ...corners.map((q) => (dot(sub(q, target.o), target.n) - target.lo) / rate))
  if (reach <= EPS) return null
  const strip = [corners[0], corners[1], sub(corners[1], mul(uIn, reach)), sub(corners[0], mul(uIn, reach))]
  const poly = clipHalfPlane(strip, target.o, target.n, target.lo)
  return poly.length >= 3 && polygonArea(poly) > 1e-9 ? poly : null
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
    // почти коллинеарный стык (отклонение от продолжения в (0.5°, 15°)): торцы обеих стен —
    // по биссектрисе угла через конец ранней стены; ранняя тоже срезается, поэтому сосед не вычитается
    const uInC = inward(c, v)
    const cosT = dot(uIn, uInC)
    if (cosT > -RIGHT_COS && cosT < -COS15 - EPS) {
      const V = !isLatest && iWall < walls.indexOf(c) ? E : v
      const nCut = unit(uInC, uIn)
      const onCut = (q: Point): Point => add(q, mul(uIn, dot(sub(V, q), nCut) / dot(uIn, nCut)))
      return { E, cap: [onCut(add(E, mul(nAB, hW))), onCut(add(E, mul(nAB, -hW)))], exempt: new Set([c]), wedge: null }
    }
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
      // перпендикулярно/косо: каждый угол торца — вдоль своей грани до линии дальней грани
      // ранней (дальняя — против направления тела поздней); выступающий угол срезается
      const alongN = dot(uIn, nC)
      const sFar = -signOf(alongN || latE)
      const onFarFace = (q: Point): Point => add(q, mul(uIn, (sFar * hC - dot(sub(q, c.a), nC)) / alongN))
      return { E, cap: [onFarFace(add(E, mul(nAB, hW))), onFarFace(add(E, mul(nAB, -hW)))], exempt: new Set(), wedge: null }
    }
    // вершина на грани или снаружи: плоский торец; на грани — клин принадлежит поздней
    const wedge = Math.abs(Math.abs(latE) - hC) <= SLICE ? { c, s: signOf(latE) } : null
    return { E, cap: flat.cap, exempt: new Set(), wedge }
  }
  // угловой стык на грани: сырой торец, замыкание угла строит displayPolygons
  if (faceCornerAt(wall, E, walls)) return flat
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
  let body: Point[] = [aPlus, bPlus, bMinus, aMinus]
  const fills: Point[][] = []
  const earlierFills: Point[][] = []
  // угловой стык на грани: торец сквозной срезан по наружной грани упёртой, торец каждой стены
  // продолжен до своей целевой линии — при любом порядке; продолжение принадлежит своей стене.
  // Поздняя из пары (превью — позднейшая) не отображается внутри продолжения ранней
  for (const [E, uIn] of [
    [wall.a, uAB],
    [wall.b, neg(uAB)],
  ] as const) {
    const fc = faceCornerAt(wall, E, walls)
    if (!fc || fc.right) continue
    if (fc.role === "through") body = clipHalfPlane(body, fc.outerU.o, fc.outerU.n, fc.outerU.lo)
    const own = capExtension(wall, E, uIn, fc.ownTarget)
    if (own) fills.push(own)
    if (!isLatest && iWall < walls.indexOf(fc.partner)) continue
    const theirs = capExtension(fc.partner, fc.partnerEnd, fc.partnerIn, fc.partnerTarget)
    if (theirs) earlierFills.push(theirs)
  }
  let pieces: Point[][] = [...(body.length >= 3 && polygonArea(body) > 1e-9 ? [body] : []), ...fills]
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
  for (const f of earlierFills) pieces = pieces.flatMap((pc) => subtractConvex(pc, f))
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

export const lerp = (a: Point, b: Point, t: number): Point => add(a, mul(sub(b, a), t))

// параметрический интервал ребра внутри выпуклого куска (пусто, если ребро снаружи)
export function coveredInterval(p1: Point, p2: Point, piece: Point[]): [number, number] | null {
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

// слияние интервалов; tol — зазор, который ещё считается касанием
export function mergeIntervals(hidden: [number, number][], tol = 0): [number, number][] {
  const sorted = [...hidden].sort((x, y) => x[0] - y[0])
  const merged: [number, number][] = []
  for (const iv of sorted) {
    const last = merged[merged.length - 1]
    if (last && iv[0] <= last[1] + tol) last[1] = Math.max(last[1], iv[1])
    else merged.push([iv[0], iv[1]])
  }
  return merged
}

// участки [0, 1], не накрытые скрытыми интервалами
export function uncovered(hidden: [number, number][]): [number, number][] {
  const visible: [number, number][] = []
  let cursor = 0
  for (const [t0, t1] of mergeIntervals(hidden)) {
    if (t0 > cursor) visible.push([cursor, Math.min(t0, 1)])
    cursor = Math.max(cursor, t1)
  }
  if (cursor < 1) visible.push([cursor, 1])
  return visible.filter(([t0, t1]) => t1 - t0 > 1e-6)
}

// видимые участки ребра: ребро минус интервалы, накрытые другими кусками той же стены
function visibleEdge(p1: Point, p2: Point, pieces: Point[][], self: number): [number, number][] {
  const hidden: [number, number][] = []
  pieces.forEach((other, j) => {
    if (j === self) return
    subtractIntervals(hidden, coveredInterval(p1, p2, other))
  })
  return uncovered(hidden)
}

function outlineOf(pieces: Point[][]): Seg[] {
  const out: Seg[] = []
  pieces.forEach((piece, i) => {
    for (let k = 0; k < piece.length; k++) {
      const p1 = piece[k]
      const p2 = piece[(k + 1) % piece.length]
      for (const [t0, t1] of visibleEdge(p1, p2, pieces, i)) out.push({ p1: lerp(p1, p2, t0), p2: lerp(p1, p2, t1) })
    }
  })
  return out
}

// внешняя граница отображаемой формы стены: рёбра кусков без участков, накрытых
// другими кусками той же стены (границы между телом и заливками стены не входят)
export function outlineSegments(wall: Wall, walls: Wall[]): Seg[] {
  return outlineOf(displayPolygons(wall, walls))
}

// допуски почти совпадающих рёбер соседних форм (design D2): угол — допуск прямого угла;
// касание покрывает h·(1 − cos 0.5°) до h = 25 см; расхождение — до 0.5 см
const TOUCH_CM = 1e-3
const MAX_GAP_CM = 0.5
const SIDE_PROBE_CM = 1e-3

interface Neighbour {
  pieces: Point[][]
  outline: Seg[]
}

// габарит сырого прямоугольника стены, расширенный на pad: продолжения торцов в угловых
// стыках выходят за сырой прямоугольник не дальше толщины соседа (design D1, п. 2)
function overlapsBox(a: Wall, b: Wall, pad: number): boolean {
  const box = (w: Wall): [number, number, number, number] => {
    const r = w.thicknessCm / 2 + pad
    return [Math.min(w.a.x, w.b.x) - r, Math.min(w.a.y, w.b.y) - r, Math.max(w.a.x, w.b.x) + r, Math.max(w.a.y, w.b.y) + r]
  }
  const [ax0, ay0, ax1, ay1] = box(a)
  const [bx0, by0, bx1, by1] = box(b)
  return ax0 <= bx1 && bx0 <= ax1 && ay0 <= by1 && by0 <= ay1
}

// соседи того же материала (толщина не важна), чьи формы могут касаться формы стены
function sameMaterialNeighbours(wall: Wall, walls: Wall[]): Neighbour[] {
  return walls
    .filter((w) => w !== wall && !degenerate(w) && w.type === wall.type)
    .filter((w) => overlapsBox(wall, w, Math.max(wall.thicknessCm, w.thicknessCm)))
    .map((w) => {
      const pieces = displayPolygons(w, walls)
      return { pieces, outline: outlineOf(pieces) }
    })
}

const insideAny = (p: Point, pieces: Point[][]): boolean => pieces.some((pc) => pointInPolygon(p, pc))

function pointSegDistance(p: Point, s: Seg): number {
  const d = sub(s.p2, s.p1)
  const len2 = dot(d, d)
  const t = len2 < EPS ? 0 : clampRange(dot(sub(p, s.p1), d) / len2, 0, 1)
  return dist(p, lerp(s.p1, s.p2, t))
}

// отрезки касаются или пересекаются (в пределах TOUCH_CM)
function segmentsTouch(a: Seg, b: Seg): boolean {
  const da = sub(a.p2, a.p1)
  const db = sub(b.p2, b.p1)
  const side = (s: Seg, d: Point, p: Point): number => cross(d, sub(p, s.p1))
  if (side(a, da, b.p1) * side(a, da, b.p2) < 0 && side(b, db, a.p1) * side(b, db, a.p2) < 0) return true
  return Math.min(pointSegDistance(a.p1, b), pointSegDistance(a.p2, b), pointSegDistance(b.p1, a), pointSegDistance(b.p2, a)) <= TOUCH_CM
}

// почти совпадающий участок (design D2): интервал [t0, t1] отрезка p1p2 в его параметризации
// и соответствующая часть отрезка q
interface Coincidence {
  iv: [number, number]
  part: Seg
}

function coincidence(p1: Point, p2: Point, q: Seg): Coincidence | null {
  const d = sub(p2, p1)
  const len = Math.hypot(d.x, d.y)
  const e = sub(q.p2, q.p1)
  const lenQ = Math.hypot(e.x, e.y)
  if (len < EPS || lenQ < EPS) return null
  if (Math.abs(cross(d, e)) / (len * lenQ) > RIGHT_SIN) return null
  if (!segmentsTouch({ p1, p2 }, q)) return null
  const len2 = len * len
  const e1 = dot(sub(q.p1, p1), d) / len2
  const e2 = dot(sub(q.p2, p1), d) / len2
  const t0 = Math.max(0, Math.min(e1, e2))
  const t1 = Math.min(1, Math.max(e1, e2))
  if (t1 - t0 <= EPS) return null
  // часть q, проецирующаяся в [t0, t1]
  const at = (t: number): Point => lerp(q.p1, q.p2, (t - e1) / (e2 - e1))
  const part = { p1: at(t0), p2: at(t1) }
  const gap = Math.max(Math.abs(cross(d, sub(part.p1, p1))), Math.abs(cross(d, sub(part.p2, p1)))) / len
  return gap <= MAX_GAP_CM ? { iv: [t0, t1], part } : null
}

// нормаль отрезка внутрь формы: ±n, если проба в середине с этой стороны внутри; иначе null
function inwardNormal(s: Seg, pieces: Point[][]): Point | null {
  const n = perp(unit(s.p1, s.p2))
  const mid = lerp(s.p1, s.p2, 0.5)
  if (insideAny(add(mid, mul(n, SIDE_PROBE_CM)), pieces)) return n
  if (insideAny(add(mid, mul(n, -SIDE_PROBE_CM)), pieces)) return neg(n)
  return null
}

// формы стены и соседа обращены от общего участка в противоположные стороны (design D2)
function facesOpposite(own: Seg, ownPieces: Point[][], other: Seg, otherPieces: Point[][]): boolean {
  const nOwn = inwardNormal(own, ownPieces)
  const nOther = inwardNormal(other, otherPieces)
  return nOwn !== null && nOther !== null && dot(nOwn, nOther) < 0
}

// канонический контур стены: внешняя граница формы без участков, совпадающих (или почти
// совпадающих) с внешней границей соседей того же материала — шов не рисуется (design D1, D2)
export function contourSegments(wall: Wall, walls: Wall[]): Seg[] {
  const own = displayPolygons(wall, walls)
  const neighbours = sameMaterialNeighbours(wall, walls)
  return outlineOf(own).flatMap(({ p1, p2 }) => {
    const hidden: [number, number][] = []
    for (const nb of neighbours)
      for (const q of nb.outline) {
        const c = coincidence(p1, p2, q)
        if (!c) continue
        const mine = { p1: lerp(p1, p2, c.iv[0]), p2: lerp(p1, p2, c.iv[1]) }
        if (facesOpposite(mine, own, c.part, nb.pieces)) hidden.push(c.iv)
      }
    return uncovered(hidden).map(([t0, t1]) => ({ p1: lerp(p1, p2, t0), p2: lerp(p1, p2, t1) }))
  })
}
