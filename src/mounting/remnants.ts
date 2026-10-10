import { EPS_CM, lengthOf } from "../demolition/mark-model"
import type { ResolvedMark } from "../demolition/mark-model"
import type { Point, Wall } from "../types"

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

// остатки в порядке стен чертежа, внутри стены — от конца a
export const remnantWalls = (walls: readonly Wall[], marks: readonly ResolvedMark[]): Wall[] => walls.flatMap((w) => remnantsOf(w, marks))
