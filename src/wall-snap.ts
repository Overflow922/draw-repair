import { PX_PER_CM, SNAP_RADIUS_PX } from "./types"
import type { Point, Wall } from "./types"
import {
  add,
  clipHalfPlane,
  coveredInterval,
  cross,
  degenerate,
  displayPolygons,
  dist,
  dot,
  hitWall,
  lerp,
  mergeIntervals,
  mul,
  perp,
  pointInPolygon,
  polygonArea,
  signOf,
  sub,
  uncovered,
  unit,
} from "./wall-geometry"

// Привязка вершины стены с учётом всей сцены (change fix-wall-snap-overlap).
// Какая цель (грань или торец) — по зонам стены (design D1); где на ней — по контуру
// отображаемых тел сцены (D2, D3); квадрат установки не налагается на тела (D5).
// Все функции чистые: входные стены не мутируются.

const EPS = 1e-9
const SLICE = 1e-7
// смещение ребра наружу при проверке открытости: больше SLICE — куски, отсечённые
// clipHalfPlane, могут выступать за свою плоскость на SLICE
const EDGE_SHIFT = 3 * SLICE
const LINE_TOL = 1e-6 // допуск коллинеарности рёбер контура и совпадения вершин
const PROBE = 1e-5 // шаг пробной точки за концом открытого участка
const OVERLAP_AREA = 1e-6 // касание по стороне допустимо, наложение — нет
const ORTHO_TAN = Math.tan((15 * Math.PI) / 180)

export function snapRadiusCm(zoom: number): number {
  return SNAP_RADIUS_PX / (PX_PER_CM * zoom)
}

export interface VertexSnap {
  point: Point
  source: "wall" | "grid"
  normal?: Point // наружная нормаль грани или торца при прилипании (для квадрата установки)
}

export type ClickAction = { kind: "select"; wall: Wall } | { kind: "draw" }

interface Candidate {
  point: Point
  normal: Point
}

// открытый участок ребра контура сцены с наружной нормалью
interface OpenEdge {
  p1: Point
  p2: Point
  normal: Point
}

interface SceneContour {
  pieces: Point[][]
  open: OpenEdge[]
}

// линия цели: грань (или торец) стены; параметр s — вдоль u от origin
interface TargetLine {
  origin: Point
  u: Point
  normal: Point
}

// единичные наружные нормали рёбер выпуклого куска (ребро i: piece[i] → piece[i+1])
function edgeNormals(piece: Point[]): Point[] {
  const c = mul(piece.reduce(add, { x: 0, y: 0 }), 1 / piece.length)
  return piece.map((a, i) => {
    const b = piece[(i + 1) % piece.length]
    const len = dist(a, b)
    if (len < EPS) return { x: 0, y: 0 }
    const n = mul({ x: b.y - a.y, y: a.x - b.x }, 1 / len)
    return dot(n, sub(c, a)) > 0 ? mul(n, -1) : n
  })
}

function hiddenBy(q1: Point, q2: Point, pieces: Point[][]): [number, number][] {
  const hidden: [number, number][] = []
  for (const pc of pieces) {
    const iv = coveredInterval(q1, q2, pc)
    if (iv) hidden.push(iv)
  }
  return hidden
}

// Контур сцены: рёбра всех кусков отображаемых тел, открытые снаружи — точки,
// смещённые от ребра по наружной нормали, не лежат ни в одном куске (design D2).
function sceneContour(walls: Wall[]): SceneContour {
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

const onLine = (q: Point, line: TargetLine): boolean => Math.abs(dot(sub(q, line.origin), line.normal)) <= LINE_TOL

// Открытые участки грани стены длиной len в параметре s: коллинеарные рёбра контура
// с той же нормалью, слитые по допуску. Берутся только участки, связанные с гранью
// самой стены (пересекают [0, len]) — коллинеарные грани других стен не цель.
function openIntervals(scene: SceneContour, line: TargetLine, len: number): [number, number][] {
  const raw: [number, number][] = []
  for (const e of scene.open) {
    if (dot(e.normal, line.normal) < 1 - LINE_TOL || !onLine(e.p1, line) || !onLine(e.p2, line)) continue
    const s1 = dot(sub(e.p1, line.origin), line.u)
    const s2 = dot(sub(e.p2, line.origin), line.u)
    raw.push([Math.min(s1, s2), Math.max(s1, s2)])
  }
  return mergeIntervals(raw, LINE_TOL).filter(([lo, hi]) => lo <= len + LINE_TOL && hi >= -LINE_TOL)
}

// Сжатие открытого участка с конца s (dirIn — направление внутрь участка), design D3:
// выпуклая вершина — полусторона квадрата; вогнутая с углом θ — ещё 2·newHalf·cot θ,
// если угол острый (дальний угол квадрата не входит в соседа).
function endShrink(scene: SceneContour, line: TargetLine, s: number, dirIn: 1 | -1, newHalf: number): number {
  const v = add(line.origin, mul(line.u, s))
  const inDir = mul(line.u, dirIn)
  const probe = add(v, mul(sub(line.normal, inDir), PROBE))
  if (!scene.pieces.some((pc) => pointInPolygon(probe, pc))) return newHalf
  let cot = 0
  for (const e of scene.open)
    for (const [from, to] of [
      [e.p1, e.p2],
      [e.p2, e.p1],
    ] as const) {
      if (dist(from, v) > LINE_TOL) continue
      const d = sub(to, from)
      if (dot(d, line.normal) <= EPS) continue
      const ev = mul(d, 1 / Math.hypot(d.x, d.y))
      const sin = Math.abs(cross(inDir, ev))
      if (sin > EPS) cot = Math.max(cot, dot(inDir, ev) / sin)
    }
  return newHalf + 2 * newHalf * cot
}

// Кандидат на грани side стены w: ближайший несжатый открытый участок → сжатие →
// пусто = нет кандидата (без поиска на более далёких участках).
function faceCandidate(scene: SceneContour, w: Wall, side: number, p: Point, newHalf: number): Candidate | null {
  const u = unit(w.a, w.b)
  const n = perp(u)
  const offset = mul(n, side * (w.thicknessCm / 2))
  const line: TargetLine = { origin: add(w.a, offset), u, normal: mul(n, side) }
  const sc = dot(sub(p, w.a), u)
  let nearest: [number, number] | null = null
  let nearestD = Infinity
  for (const iv of openIntervals(scene, line, dist(w.a, w.b))) {
    const d = sc < iv[0] ? iv[0] - sc : sc > iv[1] ? sc - iv[1] : 0
    // строго меньше: при равенстве — участок с меньшим параметром
    if (d < nearestD - EPS) {
      nearest = iv
      nearestD = d
    }
  }
  if (!nearest) return null
  const lo = nearest[0] + endShrink(scene, line, nearest[0], 1, newHalf)
  const hi = nearest[1] - endShrink(scene, line, nearest[1], -1, newHalf)
  if (lo > hi + EPS) return null
  const s = lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, sc))
  return { point: add(add(w.a, mul(u, s)), offset), normal: line.normal }
}

// Кандидат на торце: только свободный торец (весь отрезок торца открыт) —
// вершина в плоскости торца на оси, нормаль наружу.
function capCandidate(scene: SceneContour, w: Wall, end: Point, out: Point): Candidate | null {
  const n = mul(perp(out), w.thicknessCm / 2)
  const shift = mul(out, EDGE_SHIFT)
  const visible = uncovered(hiddenBy(add(add(end, n), shift), add(sub(end, n), shift), scene.pieces))
  const free = visible.length === 1 && visible[0][0] <= LINE_TOL && visible[0][1] >= 1 - LINE_TOL
  return free ? { point: end, normal: out } : null
}

// квадрат, приставленный стороной с центром в point, вытянутый на sizeCm по normal
export function squareOnSide(point: Point, normal: Point, sizeCm: number): Point[] {
  const t = mul(perp(normal), sizeCm / 2)
  const far = mul(normal, sizeCm)
  const side1 = sub(point, t)
  const side2 = add(point, t)
  return [side1, side2, add(side2, far), add(side1, far)]
}

export function placementSquare(snap: VertexSnap, sizeCm: number): Point[] {
  if (snap.normal) return squareOnSide(snap.point, snap.normal, sizeCm)
  const h = sizeCm / 2
  const { x, y } = snap.point
  return [
    { x: x - h, y: y - h },
    { x: x + h, y: y - h },
    { x: x + h, y: y + h },
    { x: x - h, y: y + h },
  ]
}

// Квадрат на свободном конце сегмента (design D6a): конец, совпавший с точкой прилипания
// к стене, — квадрат установки у грани/торца; иначе последний блок будущей стены вдоль dir.
export function chainEndSquare(end: Point, dir: Point, snap: VertexSnap | null, sizeCm: number): Point[] {
  const stuck =
    snap !== null &&
    snap.source === "wall" &&
    Math.abs(snap.point.x - end.x) <= EPS &&
    Math.abs(snap.point.y - end.y) <= EPS
  return stuck ? placementSquare(snap, sizeCm) : squareOnSide(end, mul(dir, -1), sizeCm)
}

// площадь пересечения выпуклых многоугольников больше допуска касания
function overlapsBodies(square: Point[], pieces: Point[][]): boolean {
  return pieces.some((pc) => {
    let inter = square
    edgeNormals(pc).forEach((n, i) => {
      if (inter.length >= 3 && (n.x !== 0 || n.y !== 0)) inter = clipHalfPlane(inter, pc[i], mul(n, -1), 0)
    })
    return inter.length >= 3 && polygonArea(inter) > OVERLAP_AREA
  })
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
  const reach = Math.max(radiusCm, newHalf)
  let contour: SceneContour | null = null
  const scene = (): SceneContour => (contour ??= sceneContour(walls))
  // принятые кандидаты в порядке стен массива; квадрат не налагается на тела (design D5)
  const accepted: Candidate[] = []
  const accept = (c: Candidate | null): boolean => {
    if (!c || overlapsBodies(squareOnSide(c.point, c.normal, newWallThicknessCm), scene().pieces)) return false
    accepted.push(c)
    return true
  }
  for (const w of walls) {
    if (degenerate(w)) continue
    const u = unit(w.a, w.b)
    const len = dist(w.a, w.b)
    const rel = sub(p, w.a)
    const s = dot(rel, u)
    const lat = dot(rel, perp(u))
    const hW = w.thicknessCm / 2
    const side = signOf(lat)
    if (Math.abs(lat) <= hW + SLICE) {
      // в полосе: за концом — торец (продолжение, только вблизи торца), в пределах длины —
      // ближняя грань, запасная — дальняя, если ближняя не дала места (design D4)
      if (s > len) {
        if (s - len <= reach) accept(capCandidate(scene(), w, w.b, u))
      } else if (s < 0) {
        if (-s <= reach) accept(capCandidate(scene(), w, w.a, mul(u, -1)))
      } else if (!accept(faceCandidate(scene(), w, side, p, newHalf))) accept(faceCandidate(scene(), w, -side, p, newHalf))
      continue
    }
    // вне полосы — только грань: радиус привязки или край приставленного квадрата
    if (Math.abs(lat) - hW <= reach && s >= -reach && s <= len + reach) accept(faceCandidate(scene(), w, side, p, newHalf))
  }
  // ближайший; строго меньше — при равенстве побеждает стена раньше в массиве
  let best: Candidate | null = null
  let bestD = Infinity
  for (const c of accepted) {
    const d = dist(p, c.point)
    if (d < bestD - EPS) {
      best = c
      bestD = d
    }
  }
  if (best) {
    const result: VertexSnap = { point: best.point, source: "wall" }
    // замороженный контракт тестов — {point, source}: normal неперечислима
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

// Решение по клику без начатой цепочки в инструменте «Стена» (design D7): тело выделяет,
// прилипший квадрат рисует, полосный допуск тонких стен выделяет только без прилипания.
export function wallClickAction(raw: Point, snap: VertexSnap, walls: Wall[], toleranceCm: number): ClickAction {
  for (let i = walls.length - 1; i >= 0; i--) {
    const w = walls[i]
    if (!degenerate(w) && displayPolygons(w, walls).some((poly) => pointInPolygon(raw, poly)))
      return { kind: "select", wall: w }
  }
  if (snap.source === "wall") return { kind: "draw" }
  const hit = hitWall(raw, walls, toleranceCm)
  return hit ? { kind: "select", wall: hit } : { kind: "draw" }
}
