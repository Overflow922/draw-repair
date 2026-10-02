import { distanceToWall } from "./geometry"
import { findRooms } from "./room-area"
import type { Point, Wall } from "./types"
import { cross, dist, dot, displayPolygons, pointInPolygon, sub } from "./wall-geometry"

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

export type RulerReading =
  | { kind: "wall"; wall: Wall; from: Point; to: Point; lengthCm: number }
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

export function rulerReading(p: Point, walls: Wall[]): RulerReading {
  const forms = walls.map((wall) => ({ wall, polys: displayPolygons(wall, walls) }))
  const wall = wallUnder(p, forms)
  if (wall) return { kind: "wall", wall, from: wall.a, to: wall.b, lengthCm: dist(wall.a, wall.b) }
  const polys = forms.flatMap((f) => f.polys)
  return { kind: "space", horizontal: span(p, polys, "x"), vertical: span(p, polys, "y"), angles: roomAngles(p, walls, freeCapCorners(forms)) }
}

// углы плоских торцов свободных концов: конец оси, не лежащий в форме ни одной другой стены
function freeCapCorners(forms: WallForm[]): Point[] {
  return forms.flatMap(({ wall, polys }) => {
    if (!polys.length) return []
    const attached = (e: Point): boolean => forms.some((o) => o.wall !== wall && o.polys.some((poly) => pointInPolygon(e, poly)))
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

// пролёт вдоль оси axis через курсор: ближайшие пересечения лучей с рёбрами форм по обе стороны
function span(p: Point, polys: Point[][], axis: "x" | "y"): Span | null {
  const across = axis === "x" ? "y" : "x"
  let lo = -Infinity
  let hi = Infinity
  for (const poly of polys) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]
      const b = poly[(i + 1) % poly.length]
      // ребро вдоль луча: на линии луча — коллинеарно, вход даст соседнее ребро; иначе не пересекает
      if (a[across] === b[across]) continue
      if (p[across] < Math.min(a[across], b[across]) || p[across] > Math.max(a[across], b[across])) continue
      const at = a[axis] + ((p[across] - a[across]) * (b[axis] - a[axis])) / (b[across] - a[across])
      if (at < p[axis] && at > lo) lo = at
      if (at > p[axis] && at < hi) hi = at
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
