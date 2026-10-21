import { EPS_CM, lengthOf } from "../demolition/mark-model"
import type { ResolvedMark } from "../demolition/mark-model"
import { pointSegmentDist } from "../demolition/mark-ends"
import { markRegion } from "../demolition/mark-region"
import type { Point, Wall } from "../types"
import { add, displayPolygons, dot, mul, pointInPolygon, sub, unit } from "../wall-geometry"

// Остатки стен обмерочного плана после сноса (change mounting-plan, design D1): ось стены режется по участкам
// действующих пометок, каждый оставшийся кусок длиннее EPS_CM — виртуальная стена с теми же толщиной и материалом.
// Чистые функции, входы не мутируются.

// идентификатор остатка: стена и начало участка от конца a в миллиметрах
export const remnantId = (wallId: string, startCm: number): string => `${wallId}~${Math.round(startCm * 10)}`

// точка оси на расстоянии t от конца a; концы стены копируются без вычислений
function pointAt(wall: Wall, len: number, t: number): Point {
  if (t <= 0) return { x: wall.a.x, y: wall.a.y }
  if (t >= len) return { x: wall.b.x, y: wall.b.y }
  const k = t / len
  return { x: wall.a.x + (wall.b.x - wall.a.x) * k, y: wall.a.y + (wall.b.y - wall.a.y) * k }
}

// участки стены, оставшиеся после сноса: [начало, конец] от конца a, в порядке вдоль оси
export function remnantSpans(wall: Wall, marks: readonly ResolvedMark[]): [number, number][] {
  const len = lengthOf(wall)
  const spans = marks
    .filter((m) => m.wall.id === wall.id)
    .map((m): [number, number] => [m.from, m.to])
    .sort((p, q) => p[0] - q[0])
  const pieces: [number, number][] = []
  let cursor = 0
  for (const [from, to] of spans) {
    if (from - cursor > EPS_CM) pieces.push([cursor, from])
    cursor = Math.max(cursor, to)
  }
  if (len - cursor > EPS_CM) pieces.push([cursor, len])
  return pieces
}

function remnantsOf(wall: Wall, marks: readonly ResolvedMark[]): Wall[] {
  const len = lengthOf(wall)
  return remnantSpans(wall, marks).map(([start, end]) => ({
    id: remnantId(wall.id, start),
    a: pointAt(wall, len, start),
    b: pointAt(wall, len, end),
    thicknessCm: wall.thicknessCm,
    type: wall.type,
  }))
}

// Выступ формы за концы оси (change demolition-no-neighbor-overlap, design D4): форма стены обмера в стыках заходит за концы
// оси (угловая часть, продолжение через разрыв соседней стены). Сносом выступ не уходит, если лежит вне области сноса, но
// остатки считаются по оси и без снесённого соседа выступа не получают, поэтому он добавляется отдельной короткой стеной.
const reach = (wall: Wall, points: readonly Point[]): [number, number] => {
  const u = unit(wall.a, wall.b)
  const ts = points.map((p) => dot(sub(p, wall.a), u))
  return [Math.min(...ts), Math.max(...ts) - lengthOf(wall)]
}

// точка оси стены на расстоянии t от конца a (t < 0 — за концом a, t > длины — за концом b)
const axisPoint = (wall: Wall, t: number): Point => add(wall.a, mul(unit(wall.a, wall.b), t))

function overhangStubs(walls: readonly Wall[], marks: readonly ResolvedMark[], base: readonly Wall[]): Wall[] {
  const regions = marks.flatMap((m) => markRegion(m, walls, marks))
  const shapes = new Map<string, Point[][]>()
  const shapeOf = (r: Wall): Point[][] => {
    const known = shapes.get(r.id)
    if (known) return known
    const polys = displayPolygons(r, [...base])
    shapes.set(r.id, polys)
    return polys
  }
  const covered = (p: Point): boolean =>
    regions.some((poly) => pointInPolygon(p, poly)) ||
    base.some((r) => pointSegmentDist(p, r.a, r.b) <= r.thicknessCm + 1 && shapeOf(r).some((poly) => pointInPolygon(p, poly)))
  const marked = marks.map((m) => m.wall)
  const stubs: Wall[] = []
  for (const wall of walls) {
    const near = marked.some((m) => m === wall || pointSegmentDist(wall.a, m.a, m.b) <= m.thicknessCm + wall.thicknessCm || pointSegmentDist(wall.b, m.a, m.b) <= m.thicknessCm + wall.thicknessCm)
    if (!near) continue
    const polys = displayPolygons(wall, [...walls])
    if (polys.length === 0) continue
    const [lo, hi] = reach(wall, polys.flat())
    const len = lengthOf(wall)
    for (const [end, over] of [["a", -lo], ["b", hi]] as const) {
      if (over <= EPS_CM) continue
      const t0 = end === "a" ? -over : len
      const t1 = end === "a" ? 0 : len + over
      const probe = axisPoint(wall, (t0 + t1) / 2)
      if (covered(probe)) continue
      stubs.push({ id: `${wall.id}^${end}`, a: axisPoint(wall, t0), b: axisPoint(wall, t1), thicknessCm: wall.thicknessCm, type: wall.type })
    }
  }
  return stubs
}

// остатки в порядке стен чертежа, внутри стены — от конца a; затем выступы формы, оставшиеся без снесённого соседа
export function remnantWalls(walls: readonly Wall[], marks: readonly ResolvedMark[]): Wall[] {
  const base = walls.flatMap((w) => remnantsOf(w, marks))
  return marks.length === 0 ? base : [...base, ...overhangStubs(walls, marks, base)]
}
