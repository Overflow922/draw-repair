import type { Point, SectionLine } from "../types"
import { pointInPolygon } from "../wall-geometry"
import type { DrywallWall } from "../types"
import { sectionFigure } from "./section-figure"
import { SECTION_BAR_GAP_CM, SECTION_STROKE_CM, endClearance, endMarks } from "./section-marks"
import type { EndMark } from "./section-marks"

// Вынос концов линии разреза на свободное место (change add-section-view, design D2; spec section-view «Обозначение линии
// разреза на плане»): штрих, стрелка и обозначение не стоят на стенах, батареях и коммуникациях плана. Если конец стоит на них,
// он выносится вдоль линии наружу до первого свободного места; сама линия (хранимые вершины) не меняется. Разрезаются только
// стены гипсокартона, поэтому они не препятствие для штриха — его длиной управляет зазор до разрезаемой стены. Чистые функции.

// препятствие: многоугольник и, у стены, её идентификатор
export interface SectionObstacle {
  shape: readonly Point[]
  wallId: string | null
}

const STEP_CM = 5 // шаг переноса конца и шаг проверки вдоль штриха и стрелки
const MAX_SHIFT_CM = 1500
const MARGIN_CM = 3 // свободное место — не ближе к препятствию
const LABEL_HALF_CM = 7 // половина размера места под букву

export type EndShift = readonly [number, number]

const unit = (from: Point, to: Point): Point => {
  const len = Math.hypot(to.x - from.x, to.y - from.y)
  return len === 0 ? { x: 0, y: 0 } : { x: (to.x - from.x) / len, y: (to.y - from.y) / len }
}

// линия с концами, вынесенными наружу вдоль своих концевых отрезков на shift[0] и shift[1]
export function extendLine(line: SectionLine, shift: EndShift): SectionLine {
  const pts = line.points.map((p) => ({ ...p }))
  const n = pts.length
  const out = (end: Point, next: Point, t: number): Point => {
    const u = unit(next, end)
    return { x: end.x + u.x * t, y: end.y + u.y * t }
  }
  pts[0] = out(line.points[0], line.points[1], shift[0])
  pts[n - 1] = out(line.points[n - 1], line.points[n - 2], shift[1])
  return { ...line, points: pts }
}

function sampleSegment(a: Point, b: Point): Point[] {
  const len = Math.hypot(b.x - a.x, b.y - a.y)
  const n = Math.max(1, Math.ceil(len / STEP_CM))
  return Array.from({ length: n + 1 }, (_, i) => ({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n }))
}

function edgeDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

function blocked(p: Point, shape: readonly Point[]): boolean {
  if (pointInPolygon(p, [...shape])) return true
  for (let i = 0, j = shape.length - 1; i < shape.length; j = i++) if (edgeDistance(p, shape[j], shape[i]) < MARGIN_CM) return true
  return false
}

// точки конца линии: штрих отдельно (стены гипсокартона, которые режет линия, ему не мешают), стрелка и место буквы — отдельно
function samplesOf(mark: EndMark): { bar: Point[]; rest: Point[] } {
  const c = mark.labelAt
  const box = [-LABEL_HALF_CM, 0, LABEL_HALF_CM].flatMap((dx) => [-LABEL_HALF_CM, 0, LABEL_HALF_CM].map((dy): Point => ({ x: c.x + dx, y: c.y + dy })))
  return { bar: sampleSegment(mark.strokeFrom, mark.strokeTo), rest: [...sampleSegment(mark.tail, mark.end), ...box] }
}

function isFree(mark: EndMark, obstacles: readonly SectionObstacle[], cut: ReadonlySet<string>): boolean {
  const { bar, rest } = samplesOf(mark)
  return obstacles.every((o) => (o.wallId !== null && cut.has(o.wallId) ? true : !bar.some((p) => blocked(p, o.shape)))) &&
    obstacles.every((o) => !rest.some((p) => blocked(p, o.shape)))
}

// насколько вынести каждый конец линии наружу, чтобы штрих, стрелка и буква встали на свободное место; 0, если свободного места нет
// Сечения и свободная длина считаются по линии с вынесенными концами: у фигуры исходной линии стены обрезаны по её концам.
export function freeShifts(line: SectionLine, drywall: readonly DrywallWall[], obstacles: readonly SectionObstacle[]): [number, number] {
  const shiftOf = (end: 0 | 1): number => {
    for (let t = 0; t <= MAX_SHIFT_CM; t += STEP_CM) {
      const shift: EndShift = end === 0 ? [t, 0] : [0, t]
      const shown = extendLine(line, shift)
      const figure = sectionFigure(shown, drywall)
      const cut = new Set(figure.pieces.map((p) => p.wallId))
      // штрих полной длины и зазор до разрезаемой стены: пока места мало, конец выносится дальше
      if (endClearance(shown, figure)[end] < SECTION_STROKE_CM + SECTION_BAR_GAP_CM) continue
      if (isFree(endMarks(shown)[end], obstacles, cut)) return t
    }
    return 0
  }
  return [shiftOf(0), shiftOf(1)]
}
