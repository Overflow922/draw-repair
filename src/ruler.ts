import { distanceToWall } from "./geometry"
import { findRooms } from "./room-area"
import type { Point, Wall } from "./types"
import { edgeLengthCm, endOverhangCm } from "./wall-length"
import { cross, dist, dot, displayPolygons, faceCornerTol, pointInPolygon, sub } from "./wall-geometry"

// Замеры инструмента «Линейка» (change ruler-tool, design D1–D4). Все функции чистые:
// пересчёт по текущим стенам при каждом вызове, ничего не хранится.

export interface Span {
  from: Point // левая (горизонталь) или верхняя (вертикаль) точка упора
  to: Point
  lengthCm: number
}

export interface RoomAngle {
  at: Point
  startDir: Point // единичный вектор вдоль ребра контура к следующей вершине
  sweepDeg: number // знаковый сектор от startDir через помещение к предыдущей вершине
  deg: number // внутренний угол, округлён до сотых
}

// объект плана для линейки (change ruler-objects-span, design D1): повёрнутый прямоугольник или круг
export type RulerObject =
  | { kind: "rect"; center: Point; u: Point; widthCm: number; depthCm: number } // u — единичная ось ширины, ось глубины v = (−u.y, u.x)
  | { kind: "circle"; center: Point; diameterCm: number }

type RulerRect = Extract<RulerObject, { kind: "rect" }>
type RulerCircle = Extract<RulerObject, { kind: "circle" }>

export type RulerReading =
  | { kind: "wall"; wall: Wall; from: Point; to: Point; lengthCm: number }
  | { kind: "object"; measures: Span[] } // размеры объекта под курсором: ширина и глубина прямоугольника или диаметр круга
  | { kind: "space"; horizontal: Span | null; vertical: Span | null; angles: RoomAngle[] }

interface WallForm {
  wall: Wall
  polys: Point[][]
}

const MIN_EDGE_CM = 0.1
const SPIKE_DEG = 1
const STRAIGHT_DEG = 0.5
const CAP_TOL_CM = 0.05 // вершина контура считается углом торца свободного конца
// стягивание в пересечение прямых соседних рёбер — только если оно рядом с ребром
const COLLAPSE_REACH_CM = 10 * MIN_EDGE_CM
const RAD_TO_DEG = 180 / Math.PI

const roundHundredths = (deg: number): number => Math.round(deg * 100) / 100

// стена под курсором главнее объекта; затем объект; иначе пролёт между стенами и торцами объектов (change ruler-objects-span, design D3)
export function rulerReading(p: Point, walls: Wall[], objects: readonly RulerObject[] = []): RulerReading {
  const forms = walls.map((wall) => ({ wall, polys: displayPolygons(wall, walls) }))
  const wall = wallUnder(p, forms)
  if (wall) return wallReading(wall, walls)
  const object = objectUnder(p, objects)
  if (object) return objectReading(p, object)
  const polys = [...forms.flatMap((f) => f.polys), ...objects.flatMap((o) => (o.kind === "rect" ? [rectCorners(o)] : []))]
  const circles = objects.filter((o): o is RulerCircle => o.kind === "circle")
  return {
    kind: "space",
    horizontal: span(p, polys, circles, "x"),
    vertical: span(p, polys, circles, "y"),
    angles: roomAngles(p, walls, freeCapCorners(forms)),
  }
}

const rectAxisV = (o: RulerRect): Point => ({ x: -o.u.y, y: o.u.x })

function rectCorners(o: RulerRect): Point[] {
  const v = rectAxisV(o)
  const hw = o.widthCm / 2
  const hd = o.depthCm / 2
  const at = (sw: number, sd: number): Point => ({ x: o.center.x + sw * hw * o.u.x + sd * hd * v.x, y: o.center.y + sw * hw * o.u.y + sd * hd * v.y })
  return [at(-1, -1), at(1, -1), at(1, 1), at(-1, 1)]
}

function insideObject(p: Point, o: RulerObject): boolean {
  if (o.kind === "circle") return dist(p, o.center) <= o.diameterCm / 2
  const v = rectAxisV(o)
  const d = sub(p, o.center)
  return Math.abs(dot(d, o.u)) <= o.widthCm / 2 && Math.abs(dot(d, v)) <= o.depthCm / 2
}

// объект, в теле которого курсор; среди нескольких — с ближайшим центром, при равенстве — стоящий раньше
function objectUnder(p: Point, objects: readonly RulerObject[]): RulerObject | null {
  let best: RulerObject | null = null
  let bestD = Infinity
  for (const o of objects) {
    if (!insideObject(p, o)) continue
    const d = dist(p, o.center)
    if (d < bestD) {
      best = o
      bestD = d
    }
  }
  return best
}

// прямоугольник: линии ширины и глубины проходят через курсор (следуют за ним, подписи не совпадают);
// круг: диаметр по горизонтали через центр
function objectReading(p: Point, o: RulerObject): RulerReading {
  const line = (from: Point, to: Point): Span => ({ from, to, lengthCm: dist(from, to) })
  if (o.kind === "circle") {
    const r = o.diameterCm / 2
    return { kind: "object", measures: [line({ x: o.center.x - r, y: o.center.y }, { x: o.center.x + r, y: o.center.y })] }
  }
  const v = rectAxisV(o)
  const d = sub(p, o.center)
  const a = dot(d, o.u)
  const b = dot(d, v)
  const hw = o.widthCm / 2
  const hd = o.depthCm / 2
  const at = (sa: number, sb: number): Point => ({ x: o.center.x + sa * o.u.x + sb * v.x, y: o.center.y + sa * o.u.y + sb * v.y })
  return { kind: "object", measures: [line(at(-hw, b), at(hw, b)), line(at(a, -hd), at(a, hd))] }
}

// замер стены: по оси; у конца с выступом тела (коллинеарное продолжение с зазором) линия идёт от плоскости
// торца — кромки, а число — длина кромка-кромка (change fix-collinear-edge-to-edge-length, design D6)
function wallReading(wall: Wall, walls: Wall[]): RulerReading {
  const u = unitVec(wall.a, wall.b)
  const overA = endOverhangCm(wall, "a", walls)
  const overB = endOverhangCm(wall, "b", walls)
  return {
    kind: "wall",
    wall,
    from: { x: wall.a.x - u.x * overA, y: wall.a.y - u.y * overA },
    to: { x: wall.b.x + u.x * overB, y: wall.b.y + u.y * overB },
    lengthCm: edgeLengthCm(wall, walls),
  }
}

// углы плоских торцов свободных концов: конец оси, не состыкованный ни с одной стеной (в допуске
// углового стыка с её концом) и не лежащий в форме другой стены. Стык проверяется по допуску, а не
// по форме: при повороте соседа на сотые доли градуса конец оси выходит из его формы на доли мм
function freeCapCorners(forms: WallForm[]): Point[] {
  return forms.flatMap(({ wall, polys }) => {
    if (!polys.length) return []
    const attached = (e: Point): boolean =>
      forms.some(
        (o) =>
          o.wall !== wall &&
          (o.polys.some((poly) => pointInPolygon(e, poly)) ||
            [o.wall.a, o.wall.b].some((q) => dist(q, e) <= faceCornerTol(wall, o.wall))),
      )
    const u = unitVec(wall.a, wall.b)
    const h = wall.thicknessCm / 2
    const n = { x: -u.y * h, y: u.x * h }
    return [wall.a, wall.b].filter((e) => !attached(e)).flatMap((e) => [
      { x: e.x + n.x, y: e.y + n.y },
      { x: e.x - n.x, y: e.y - n.y },
    ])
  })
}

// стена, в форме которой курсор; среди нескольких — ближайшая ось, при равенстве — ранняя
function wallUnder(p: Point, forms: WallForm[]): Wall | null {
  let best: Wall | null = null
  let bestD = Infinity
  for (const { wall, polys } of forms) {
    if (!polys.some((poly) => pointInPolygon(p, poly))) continue
    const d = distanceToWall(p, wall)
    if (d < bestD) {
      best = wall
      bestD = d
    }
  }
  return best
}

// пролёт вдоль оси axis через курсор: ближайшие пересечения лучей с рёбрами форм и окружностями по обе стороны
function span(p: Point, polys: Point[][], circles: RulerCircle[], axis: "x" | "y"): Span | null {
  const across = axis === "x" ? "y" : "x"
  let lo = -Infinity
  let hi = Infinity
  const take = (at: number): void => {
    if (at < p[axis] && at > lo) lo = at
    if (at > p[axis] && at < hi) hi = at
  }
  for (const c of circles) {
    const r = c.diameterCm / 2
    const offset = p[across] - c.center[across]
    if (Math.abs(offset) >= r) continue // луч мимо круга или касательный
    const half = Math.sqrt(r * r - offset * offset)
    take(c.center[axis] - half)
    take(c.center[axis] + half)
  }
  for (const poly of polys) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]
      const b = poly[(i + 1) % poly.length]
      // ребро вдоль луча: на линии луча — коллинеарно, вход даст соседнее ребро; иначе не пересекает
      if (a[across] === b[across]) continue
      if (p[across] < Math.min(a[across], b[across]) || p[across] > Math.max(a[across], b[across])) continue
      take(a[axis] + ((p[across] - a[across]) * (b[axis] - a[axis])) / (b[across] - a[across]))
    }
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null
  const point = (v: number): Point => (axis === "x" ? { x: v, y: p.y } : { x: p.x, y: v })
  return { from: point(lo), to: point(hi), lengthCm: hi - lo }
}

// торец свободного конца — конец перегородки, а не угол помещения
function roomAngles(p: Point, walls: Wall[], caps: Point[]): RoomAngle[] {
  const room = findRooms(walls).find((r) => pointInPolygon(p, r.outline) && !r.holes.some((h) => pointInPolygon(p, h)))
  if (!room) return []
  return contourAngles(cleanContour(room.outline)).filter((a) => !caps.some((c) => dist(a.at, c) <= CAP_TOL_CM))
}

const signedArea2 = (poly: Point[]): number => poly.reduce((s, a, i) => s + cross(a, poly[(i + 1) % poly.length]), 0)

// внутренний угол вершины v контура с ориентацией s (знак ориентированной площади), градусы
function interiorDeg(prev: Point, v: Point, next: Point, s: number): number {
  const e1 = sub(v, prev)
  const e2 = sub(next, v)
  return 180 - s * Math.atan2(cross(e1, e2), dot(e1, e2)) * RAD_TO_DEG
}

// точка, в которую стягивается короткое ребро a–b: пересечение прямых соседних рёбер,
// если они не почти параллельны и пересечение рядом; иначе середина ребра
function collapsePoint(prev: Point, a: Point, b: Point, next: Point): Point {
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  const d1 = sub(a, prev)
  const d2 = sub(next, b)
  const den = cross(d1, d2)
  if (Math.abs(den) <= 1e-9 * Math.hypot(d1.x, d1.y) * Math.hypot(d2.x, d2.y)) return mid
  const t = cross(sub(b, prev), d2) / den
  const x = { x: prev.x + d1.x * t, y: prev.y + d1.y * t }
  return dist(x, mid) <= COLLAPSE_REACH_CM ? x : mid
}

// шум целой сетки у стыков: короткие рёбра стягиваются, шипы удаляются — до неподвижной точки
function cleanContour(outline: Point[]): Point[] {
  let pts = [...outline]
  for (;;) {
    if (pts.length < 3) return []
    const n = pts.length
    const short = pts.findIndex((a, i) => dist(a, pts[(i + 1) % n]) < MIN_EDGE_CM)
    if (short >= 0) {
      const j = (short + 1) % n
      const q = collapsePoint(pts[(short + n - 1) % n], pts[short], pts[j], pts[(j + 1) % n])
      pts = pts.flatMap((v, i) => (i === short ? [q] : i === j ? [] : [v]))
      continue
    }
    const s = Math.sign(signedArea2(pts))
    const spike = pts.findIndex((v, i) => {
      const deg = interiorDeg(pts[(i + n - 1) % n], v, pts[(i + 1) % n], s)
      return deg < SPIKE_DEG || deg > 360 - SPIKE_DEG
    })
    if (spike < 0) return pts
    pts = pts.filter((_, i) => i !== spike)
  }
}

const unitVec = (from: Point, to: Point): Point => {
  const l = dist(from, to)
  return { x: (to.x - from.x) / l, y: (to.y - from.y) / l }
}

const rotate = (v: Point, deg: number): Point => {
  const r = deg / RAD_TO_DEG
  return { x: v.x * Math.cos(r) - v.y * Math.sin(r), y: v.x * Math.sin(r) + v.y * Math.cos(r) }
}

function contourAngles(pts: Point[]): RoomAngle[] {
  const n = pts.length
  if (n < 3) return []
  const s = Math.sign(signedArea2(pts))
  return pts.flatMap((v, i) => {
    const prev = pts[(i + n - 1) % n]
    const next = pts[(i + 1) % n]
    const deg = roundHundredths(interiorDeg(prev, v, next, s))
    if (Math.abs(deg - 180) < STRAIGHT_DEG) return []
    const startDir = unitVec(v, next)
    const toPrev = unitVec(v, prev)
    // из двух секторов между рёбрами внутренний имеет величину deg
    const sweepDeg = dist(rotate(startDir, deg), toPrev) <= dist(rotate(startDir, -deg), toPrev) ? deg : -deg
    return [{ at: v, startDir, sweepDeg, deg }]
  })
}
