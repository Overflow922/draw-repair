import { batteryRect } from "../battery/battery-geometry"
import { shapeOfCommunication } from "../communications/geometry"
import { segmentShape } from "../communications/shape"
import type { Shape } from "../communications/shape"
import { hostOf } from "../doorway/doorway-faces"
import { cutPieces, openingLines } from "../doorway/doorway-layout"
import type { Battery, Communication, Point, FurnitureItem, Wall, WallElement } from "../types"
import { clipHalfPlane, displayPolygons, polygonArea } from "../wall-geometry"
import type { FurnitureKind } from "./furniture-kinds"
import { itemCorners } from "./item"

// Пересечения стола с другими объектами (change furniture-plan-table, design D4): препятствия приводятся к многоугольникам,
// пересечение — отсечение многоугольника препятствия сторонами прямоугольника стола. Касание граней пересечением не является:
// наложение распознаётся при глубине больше RECOGNITION_DEPTH_CM (как в wall-collision). Чистые функции, входы не мутируются.

export const OBSTACLE_ORDER = ["wall", "drywall", "plaster", "opening", "door", "window", "battery", "communication", "furniture"] as const

export type ObstacleKind = (typeof OBSTACLE_ORDER)[number]

export interface Obstacle {
  kind: ObstacleKind
  polygons: readonly (readonly Point[])[]
}

export interface Overlap {
  kind: ObstacleKind
  // предмет, чьё пересечение это; у пересечения двух предметов — тот, чей идентификатор меньше
  itemId: string
  itemKind: FurnitureKind
  // вид второго предмета у пересечения двух предметов (kind "furniture"), иначе не задан
  otherKind?: FurnitureKind
  region: Point[]
}

// всё, что есть на плане «Мебель» помимо столов: подложка и коммуникации
export interface ObstacleSource {
  // стены подложки (обмер, «Монтаж») и стены гипсокартона
  walls: readonly Wall[]
  drywall: readonly Wall[]
  // виртуальные стены полос штукатурки (plasterObstacles)
  plaster: readonly Wall[]
  elements: readonly WallElement[]
  batteries: readonly Battery[]
  communications: readonly Communication[]
}

const RECOGNITION_DEPTH_CM = 0.01
const MIN_AREA_CM2 = 1e-9
const CIRCLE_SEGMENTS = 48

function circlePolygon(c: Point, r: number): Point[] {
  return Array.from({ length: CIRCLE_SEGMENTS }, (_, i) => {
    const a = (2 * Math.PI * i) / CIRCLE_SEGMENTS
    return { x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) }
  })
}

function shapePolygon(shape: Shape): Point[] {
  return shape.kind === "circle" ? circlePolygon(shape.c, shape.r) : [...shape.pts]
}

const elementKind = (e: WallElement): ObstacleKind => (e.kind === "window" ? "window" : e.kind === "door" ? "door" : "opening")

// препятствия плана: стены подложки с вырезами проёмов, стены ГКЛ, штукатурка, проёмы/двери/окна, батареи, коммуникации
export function obstaclesOf(source: ObstacleSource): Obstacle[] {
  const out: Obstacle[] = []
  const { walls, elements } = source
  for (const w of walls) {
    const body = cutPieces(w, wallPieces(w, walls), walls, elements)
    if (body.length > 0) out.push({ kind: "wall", polygons: body })
  }
  for (const w of source.drywall) out.push({ kind: "drywall", polygons: wallPieces(w, source.drywall) })
  for (const w of source.plaster) {
    const shape = segmentShape(w.a, w.b, w.thicknessCm)
    if (shape) out.push({ kind: "plaster", polygons: [shapePolygon(shape)] })
  }
  for (const e of elements) {
    const outline = hostOf(e, walls) ? openingLines(e, walls, elements)?.outline : null
    if (outline) out.push({ kind: elementKind(e), polygons: [outline] })
  }
  for (const b of source.batteries) {
    const host = walls.find((w) => w.id === b.wallId)
    if (host) out.push({ kind: "battery", polygons: [batteryRect(b, host)] })
  }
  for (const c of source.communications) out.push({ kind: "communication", polygons: [shapePolygon(shapeOfCommunication(c))] })
  return out
}

// форма стены в плане: то, что нарисовано (с углами и стыками)
const wallPieces = (w: Wall, all: readonly Wall[]): Point[][] => displayPolygons(w, [...all]).map((p) => [...p])

// сторона прямоугольника: отсечение оставляет точки со скалярным произведением (q − c)·n ≥ −half
function clipByRect(poly: readonly Point[], t: FurnitureItem, shrinkCm: number): Point[] {
  const [p0, p1, , p3] = itemCorners(t)
  const c = { x: t.x, y: t.y }
  const len = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y)
  const w = len(p0, p1)
  const l = len(p0, p3)
  const u = { x: (p1.x - p0.x) / w, y: (p1.y - p0.y) / w }
  const v = { x: (p3.x - p0.x) / l, y: (p3.y - p0.y) / l }
  const hw = w / 2 - shrinkCm
  const hl = l / 2 - shrinkCm
  if (hw <= 0 || hl <= 0) return []
  let out = [...poly]
  out = clipHalfPlane(out, c, u, -hw)
  out = clipHalfPlane(out, c, { x: -u.x, y: -u.y }, -hw)
  out = clipHalfPlane(out, c, v, -hl)
  out = clipHalfPlane(out, c, { x: -v.x, y: -v.y }, -hl)
  return out
}

// область пересечения многоугольника со столом или null: распознаётся по столу, сжатому на допуск, область — по полному столу
function overlapRegion(poly: readonly Point[], t: FurnitureItem): Point[] | null {
  if (poly.length < 3) return null
  const core = clipByRect(poly, t, RECOGNITION_DEPTH_CM)
  if (core.length < 3 || polygonArea(core) <= MIN_AREA_CM2) return null
  return clipByRect(poly, t, 0)
}

// пересечения одного стола с препятствиями и с другими столами (для призрака и выделенного стола)
export function itemOverlaps(table: FurnitureItem, obstacles: readonly Obstacle[], others: readonly FurnitureItem[] = []): Overlap[] {
  const out: Overlap[] = []
  for (const o of obstacles)
    for (const poly of o.polygons) {
      const region = overlapRegion(poly, table)
      if (region) out.push({ kind: o.kind, itemId: table.id, itemKind: table.kind, region })
    }
  for (const other of others) {
    if (other.id === table.id) continue
    const region = overlapRegion(itemCorners(other), table)
    if (region) out.push({ kind: "furniture", itemId: table.id, itemKind: table.kind, otherKind: other.kind, region })
  }
  return out
}

// пересечения всех столов плана; пара столов даёт одну область (у стола с меньшим идентификатором)
export function furnitureOverlaps(items: readonly FurnitureItem[], obstacles: readonly Obstacle[]): Overlap[] {
  return items.flatMap((t) =>
    itemOverlaps(
      t,
      obstacles,
      items.filter((o) => o.id > t.id),
    ),
  )
}

// виды препятствий без повторов в порядке OBSTACLE_ORDER
export function overlapKinds(overlaps: readonly Overlap[]): ObstacleKind[] {
  const present = new Set(overlaps.map((o) => o.kind))
  return OBSTACLE_ORDER.filter((k) => present.has(k))
}
