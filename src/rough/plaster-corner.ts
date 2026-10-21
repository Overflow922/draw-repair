import type { CornerPosition, CornerRef, Point, Wall } from "../types"
import { add, degenerate, displayPolygons, dist, dot, mul, perp, pointInPolygon, sub, unit } from "../wall-geometry"
import { plasterStrip } from "./plaster"
import type { PlasterPiece } from "./plaster"

// Углы контура штукатурки (change plaster-right-angle, design D1–D3): вершина, где две действующие полосы сходятся в единый
// контур «стены вместе со штукатуркой» — боковая с боковой либо торец с боковой. Чистые функции, входы не мутируются.

export type CornerKind = "inner" | "outer"

export interface PlasterCorner {
  point: Point
  kind: CornerKind
  // единичные направления плеч знака от вершины вдоль рёбер контура в выбранном секторе (меньшем 180°)
  arms: readonly [Point, Point]
  // пара ссылок на пометки штукатурки, упорядоченная по идентификатору и положению: идентифицирует угол
  corner: readonly [CornerRef, CornerRef]
}

// допуск совпадения точек и принадлежности вершины ребру, см
const TOL_CM = 0.01
// пробное смещение от вершины внутрь сектора, см (меньше минимальной толщины штукатурки 0,5 см)
const PROBE_CM = 0.05
// стыки с синусом угла меньше считаются коллинеарными
const MIN_SIN = 0.02

interface Strip {
  piece: PlasterPiece
  poly: Point[]
  outer: readonly [Point, Point]
  thicknessCm: number
  isEnd: boolean
}

const cross = (a: Point, b: Point): number => a.x * b.y - a.y * b.x

function stripOf(piece: PlasterPiece): Strip | null {
  const face = piece.mark.face
  if (face === "reveal" || degenerate(piece.wall) || piece.to - piece.from < TOL_CM) return null
  const poly = plasterStrip(piece)
  // порядок вершин полосы: две на теле стены, затем две на внешней поверхности (дальняя от тела сторона)
  return { piece, poly, outer: [poly[3], poly[2]], thicknessCm: piece.mark.thicknessMm / 10, isEnd: face === "end" }
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const d = sub(b, a)
  const len2 = dot(d, d)
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, dot(sub(p, a), d) / len2))
  return dist(p, add(a, mul(d, t)))
}

// Положение вершины в пометке: у края участка (в пределах толщины соседней полосы вдоль оси этой полосы) или внутри него.
// Координата — вдоль оси стены у боковой полосы и поперёк неё у торца; края — from и to куска.
function positionOf(strip: Strip, at: Point, other: Strip, sin: number): CornerPosition {
  const { wall, from, to } = strip.piece
  const axis = unit(wall.a, wall.b)
  const c = dot(sub(at, wall.a), strip.isEnd ? perp(axis) : axis)
  const reach = other.thicknessCm / sin + TOL_CM
  const dFrom = Math.abs(c - from)
  const dTo = Math.abs(c - to)
  if (Math.min(dFrom, dTo) > reach) return "through"
  return dFrom <= dTo ? "from" : "to"
}

const order = (a: CornerRef, b: CornerRef): number => (a.markId === b.markId ? a.at.localeCompare(b.at) : a.markId.localeCompare(b.markId))

// Ключ угла: ссылки в каноническом порядке, поэтому порядок в хранилище значения не имеет
export const cornerKey = (refs: readonly [CornerRef, CornerRef]): string =>
  [...refs].sort(order).map((r) => `${r.markId}:${r.at}`).join("|")

// Углы контура по действующим кускам штукатурки и стенам подложки. Кусок откоса в углах не участвует.
export function plasterCorners(pieces: readonly PlasterPiece[], walls: Wall[]): PlasterCorner[] {
  const strips = pieces.flatMap((p) => stripOf(p) ?? [])
  const bodies = walls.flatMap((w) => (degenerate(w) ? [] : displayPolygons(w, walls)))
  const material = (p: Point): boolean => bodies.some((poly) => pointInPolygon(p, poly)) || strips.some((s) => pointInPolygon(p, s.poly))
  const found = new Map<string, PlasterCorner>()
  for (let i = 0; i < strips.length; i++) {
    for (let j = i + 1; j < strips.length; j++) {
      const a = strips[i]
      const b = strips[j]
      if (!a || !b || (a.isEnd && b.isEnd)) continue
      const corner = cornerOf(a, b, material)
      if (!corner) continue
      const key = cornerKey(corner.corner)
      if (!found.has(key)) found.set(key, corner)
    }
  }
  return [...found.values()]
}

function cornerOf(a: Strip, b: Strip, material: (p: Point) => boolean): PlasterCorner | null {
  const u = unit(a.outer[0], a.outer[1])
  const v = unit(b.outer[0], b.outer[1])
  const sin = Math.abs(cross(u, v))
  if (sin < MIN_SIN) return null
  // пересечение линий внешних поверхностей
  const d1 = sub(a.outer[1], a.outer[0])
  const d2 = sub(b.outer[1], b.outer[0])
  const t = cross(sub(b.outer[0], a.outer[0]), d2) / cross(d1, d2)
  const at = add(a.outer[0], mul(d1, t))
  // вершина лежит на внешней поверхности одной полосы, а у другой — на её линии не дальше толщины первой (угловой квадрат)
  const dA = distanceToSegment(at, a.outer[0], a.outer[1])
  const dB = distanceToSegment(at, b.outer[0], b.outer[1])
  if (!((dA <= TOL_CM && dB <= a.thicknessCm + TOL_CM) || (dB <= TOL_CM && dA <= b.thicknessCm + TOL_CM))) return null
  // вершина контура: из четырёх секторов между линиями отличается от остальных ровно один
  const signs = [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const
  const solid = signs.filter(([s, k]) => material(add(at, mul(add(mul(u, s), mul(v, k)), PROBE_CM))))
  const [first] = solid.length === 1 ? solid : signs.filter((q) => !solid.includes(q))
  if ((solid.length !== 1 && solid.length !== 3) || !first) return null
  const [s, k] = first
  const refs: [CornerRef, CornerRef] = [
    { markId: a.piece.mark.id, at: positionOf(a, at, b, sin) },
    { markId: b.piece.mark.id, at: positionOf(b, at, a, sin) },
  ]
  refs.sort(order)
  return { point: at, kind: solid.length === 1 ? "outer" : "inner", arms: [mul(u, s), mul(v, k)], corner: refs }
}
