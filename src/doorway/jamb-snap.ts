import type { TrackLine } from "../battery/battery-guide"
import type { Point, Wall, WallElement } from "../types"
import { add, cross, dot, mul, perp, sub, unit } from "../wall-geometry"
import type { Side } from "./doorway-faces"
import { hostOf, hostPoint, jambsT } from "./doorway-faces"

// Привязка квадрата установки стены к плоскости откоса элемента стены (change snap-wall-to-opening-jambs, design D1–D6;
// spec wall-drawing «Привязка к плоскости откоса проёма»). Чистые функции: линии и входные данные не изменяются.

// прямая через откос перпендикулярно оси опорной стены
export interface JambLine {
  origin: Point // откос на оси опорной стены
  dir: Point // единичное направление линии (поперёк оси опорной стены)
  outward: Point // единичное направление вдоль оси опорной стены от проёма (из-за откоса наружу)
  corners: [Point, Point] // концы откоса на двух гранях опорной стены
}

// позиция квадрата: вершина, середина стороны на линии, наружная нормаль этой стороны (внутрь квадрата)
export interface JambCandidate {
  point: Point
  base: Point
  normal: Point
}

export interface JambSnap extends JambCandidate {
  tracks: TrackLine[] // пунктирные линии привязки: по одной на каждую линию, к которой прилип квадрат
}

export type JambAccept = (c: JambCandidate) => boolean

const EPS = 1e-9
const PERPENDICULAR_TOL = 1e-6
// линия считается параллельной оси экрана в пределах 0.5° (как допуск прямого угла подписей проёма)
const AXIS_TILT = Math.tan((0.5 * Math.PI) / 180)

export function jambLines(walls: readonly Wall[], elements: readonly WallElement[]): JambLine[] {
  return elements.flatMap((element) => {
    const host = hostOf(element, walls)
    if (!host) return []
    const axis = unit(host.a, host.b)
    const half = host.thicknessCm / 2
    const line = (t: number, outward: Point): JambLine => ({
      origin: hostPoint(host, t, 0),
      dir: perp(axis),
      outward,
      corners: [hostPoint(host, t, -half), hostPoint(host, t, half)],
    })
    const [near, far] = jambsT(element, host)
    return [line(near, mul(axis, -1)), line(far, axis)]
  })
}

// позиция: линия, сторона относительно неё (знак нормали m = perp(dir), в которую уходит квадрат) и расстояние до курсора
interface Position {
  line: JambLine
  side: Side
  distance: number
}

const lateral = (line: JambLine): Point => perp(line.dir)

// Позиции квадрата у линии в радиусе: ближайшая из двух сторон квадрата курсора к линии; при равенстве — снаружи проёма
function positions(p: Point, line: JambLine, half: number, radiusCm: number): Position[] {
  const m = lateral(line)
  const c = dot(sub(p, line.origin), m)
  const outside: Side = dot(line.outward, m) >= 0 ? 1 : -1
  const found: Position[] = [
    { line, side: outside, distance: Math.abs(c - outside * half) },
    { line, side: -outside as Side, distance: Math.abs(c + outside * half) },
  ]
  return found.filter((q) => q.distance <= radiusCm + EPS)
}

const byDistance = (a: Position, b: Position): number => (Math.abs(a.distance - b.distance) <= EPS ? 0 : a.distance - b.distance)

const grid = (v: number, step: number): number => Math.round(v / step) * step

// положение вдоль одной линии по сетке: у линии, параллельной оси экрана, — мировая координата, иначе — расстояние от откоса
function alongLine(line: JambLine, onOffset: Point, p: Point, step: number): Point {
  const { dir, origin } = line
  if (Math.abs(dir.x) <= AXIS_TILT) return add(onOffset, mul(dir, (grid(p.y, step) - onOffset.y) / dir.y))
  if (Math.abs(dir.y) <= AXIS_TILT) return add(onOffset, mul(dir, (grid(p.x, step) - onOffset.x) / dir.x))
  return add(onOffset, mul(dir, grid(dot(sub(p, origin), dir), step) - dot(sub(onOffset, origin), dir)))
}

// пунктир от ближнего к квадрату конца откоса на грани стены до дальнего от него края стороны квадрата на линии
function track(line: JambLine, vertex: Point, normal: Point, half: number): TrackLine {
  const base = sub(vertex, mul(normal, half))
  const [from] = [...line.corners].sort((a, b) => Math.hypot(a.x - vertex.x, a.y - vertex.y) - Math.hypot(b.x - vertex.x, b.y - vertex.y))
  const ends = [add(base, mul(line.dir, half)), sub(base, mul(line.dir, half))]
  const [to] = ends.sort((a, b) => Math.hypot(b.x - from.x, b.y - from.y) - Math.hypot(a.x - from.x, a.y - from.y))
  return { from, to }
}

function onFirst(first: Position, p: Point, half: number): Point {
  const m = lateral(first.line)
  return add(p, mul(m, first.side * half - dot(sub(p, first.line.origin), m)))
}

function candidateOf(vertex: Point, normal: Point, half: number): JambCandidate {
  return { point: vertex, base: sub(vertex, mul(normal, half)), normal }
}

// вершина в пересечении двух перпендикулярных линий со сдвигом на half от каждой
function intersection(a: Position, b: Position, half: number): Point {
  const ma = lateral(a.line)
  const mb = lateral(b.line)
  const along = (q: Position, m: Point): number => dot(q.line.origin, m) + q.side * half
  return add(mul(ma, along(a, ma)), mul(mb, along(b, mb)))
}

const perpendicularTo = (a: JambLine, b: JambLine): boolean => Math.abs(dot(a.dir, b.dir)) <= PERPENDICULAR_TOL

export function snapToJambs(
  p: Point,
  lines: readonly JambLine[],
  thicknessCm: number,
  radiusCm: number,
  gridStepCm: number,
  accept: JambAccept,
): JambSnap | null {
  const half = thicknessCm / 2
  const firsts = lines.flatMap((line) => positions(p, line, half, radiusCm)).sort(byDistance)
  for (const first of firsts) {
    const normal = mul(lateral(first.line), first.side)
    const shifted = onFirst(first, p, half)
    const seconds = lines
      .filter((line) => line !== first.line && perpendicularTo(first.line, line))
      .flatMap((line) => positions(shifted, line, half, radiusCm))
      .sort(byDistance)
    for (const second of seconds) {
      const vertex = intersection(first, second, half)
      const found = candidateOf(vertex, normal, half)
      if (accept(found)) return { ...found, tracks: [track(first.line, vertex, normal, half), track(second.line, vertex, mul(lateral(second.line), second.side), half)] }
    }
    const vertex = alongLine(first.line, shifted, p, gridStepCm)
    const found = candidateOf(vertex, normal, half)
    if (accept(found)) return { ...found, tracks: [track(first.line, vertex, normal, half)] }
  }
  return null
}

// Квадрат, прилипший к грани стены, сдвигается вдоль грани к линии откоса (change jamb-snap-along-wall-face, design D1–D4):
// только линии, перпендикулярные грани (направление параллельно нормали квадрата) — они дают сторону квадрата вдоль нормали.
// c — кандидат грани: вершина и опора на грани, normal — наружная нормаль грани. null — сдвига нет.
export function alignAlongFace(c: JambCandidate, lines: readonly JambLine[], thicknessCm: number, radiusCm: number, accept: JambAccept): JambSnap | null {
  const half = thicknessCm / 2
  const perpendicularToFace = lines.filter((line) => Math.abs(cross(line.dir, c.normal)) <= PERPENDICULAR_TOL)
  for (const q of perpendicularToFace.flatMap((line) => positions(c.base, line, half, radiusCm)).sort(byDistance)) {
    const m = lateral(q.line)
    const shift = mul(m, q.side * half - dot(sub(c.base, q.line.origin), m))
    const moved: JambCandidate = { point: add(c.point, shift), base: add(c.base, shift), normal: c.normal }
    if (!accept(moved)) continue
    const centre = add(moved.base, mul(c.normal, half))
    return { ...moved, tracks: [track(q.line, centre, mul(m, q.side), half)] }
  }
  return null
}
