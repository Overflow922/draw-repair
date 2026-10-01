import polylabel from "polylabel"
import { unionRegions } from "./polygon-union"
import type { Region } from "./polygon-union"
import type { Point, Wall } from "./types"
import { displayPolygons, dist, dot, pointInPolygon, polygonArea, sub } from "./wall-geometry"

// Помещения (change room-area-labels): дыры объединения отображаемых форм стен.
// Ничего не хранится и не кэшируется — пересчёт по текущим стенам при каждом вызове.

export interface Room {
  outline: Point[]
  holes: Point[][] // внешние контуры островов внутри помещения
  areaCm2: number
  labelAt: Point
}

// замыкание закрывает только шум вычислений на швах (одна ступень целой сетки адаптера)
const CLOSE_CM = 0.001
const MIN_AREA_CM2 = 1000
// площадь считается по контурам в целой сетке; запас лишь на погрешность деления
const AREA_EPS = 1e-6
const LABEL_PRECISION_CM = 1

const ring = (poly: Point[]): [number, number][] => poly.map((p): [number, number] => [p.x, p.y])

// центр масс многоугольника; знак площади сокращается, обход не важен
function centroidOf(poly: Point[]): Point {
  let a = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    const c = p.x * q.y - q.x * p.y
    a += c
    cx += (p.x + q.x) * c
    cy += (p.y + q.y) * c
  }
  return { x: cx / (3 * a), y: cy / (3 * a) }
}

// центр масс помещения: контур минус острова, взвешенные по площади
function roomCentroid(outline: Point[], holes: Point[][], areaCm2: number): Point {
  const parts = [{ c: centroidOf(outline), w: polygonArea(outline) }, ...holes.map((h) => ({ c: centroidOf(h), w: -polygonArea(h) }))]
  return {
    x: parts.reduce((s, { c, w }) => s + c.x * w, 0) / areaCm2,
    y: parts.reduce((s, { c, w }) => s + c.y * w, 0) / areaCm2,
  }
}

function segmentDistance(p: Point, a: Point, b: Point): number {
  const d = sub(b, a)
  const len2 = dot(d, d)
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, dot(sub(p, a), d) / len2))
  return dist(p, { x: a.x + d.x * t, y: a.y + d.y * t })
}

const distToRing = (p: Point, poly: Point[]): number =>
  Math.min(...poly.map((a, i) => segmentDistance(p, a, poly[(i + 1) % poly.length])))

// центр масс, если он в помещении и не ближе R/2 к границе; иначе полюс недоступности
// (полюс неустойчив в вытянутых помещениях: максимум расстояния — целый отрезок)
function labelPoint(outline: Point[], holes: Point[][], areaCm2: number): Point {
  const pole = polylabel([ring(outline), ...holes.map(ring)], LABEL_PRECISION_CM)
  const c = roomCentroid(outline, holes, areaCm2)
  const inside = pointInPolygon(c, outline) && !holes.some((h) => pointInPolygon(c, h))
  const clearance = Math.min(...[outline, ...holes].map((poly) => distToRing(c, poly)))
  return inside && clearance >= pole.distance / 2 ? c : { x: pole[0], y: pole[1] }
}

function roomsOf(region: Region): Room[] {
  return region.holes.flatMap((hole) => {
    const holes = hole.islands.map((island) => island.outer)
    const areaCm2 = polygonArea(hole.path) - holes.reduce((s, h) => s + polygonArea(h), 0)
    const nested = hole.islands.flatMap(roomsOf)
    if (areaCm2 < MIN_AREA_CM2 - AREA_EPS) return nested
    return [{ outline: hole.path, holes, areaCm2, labelAt: labelPoint(hole.path, holes, areaCm2) }, ...nested]
  })
}

export function findRooms(walls: Wall[]): Room[] {
  const pieces = walls.flatMap((wall) => displayPolygons(wall, walls))
  return unionRegions(pieces, CLOSE_CM).flatMap(roomsOf)
}

// «14,25 м²»: округление до сотых м² в целых, без разделителя тысяч
export function formatArea(areaCm2: number): string {
  const hundredths = Math.round(areaCm2 / 100)
  const whole = Math.floor(hundredths / 100)
  const frac = String(hundredths % 100).padStart(2, "0")
  return `${whole},${frac} м²`
}
