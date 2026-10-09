import type { DemolitionMark, Wall } from "../types"
import { degenerate, dist } from "../wall-geometry"

// Модель пометки сноса (change demolition-plan, design D2): участок оси стены обмерочного плана. Хранится от конца
// привязки; действующий участок — от конца a, обрезанный по стене. Чистые функции, входы не мутируются.

// допуск совпадения границ участков и откосов, см
export const EPS_CM = 0.01
// наименьшая ширина участка, который можно пометить или ввести числом, см
export const MIN_WIDTH_CM = 1

// действующая пометка: from/to — от конца a стены, внутри [0, длина]
export interface ResolvedMark {
  mark: DemolitionMark
  wall: Wall
  from: number
  to: number
}

// участок стены без пометки: для превью протяжки и раскладки чисел
export type MarkSpan = Pick<ResolvedMark, "wall" | "from" | "to">

export const lengthOf = (wall: Wall): number => dist(wall.a, wall.b)

// границы пометки от конца a без обрезки по стене
export function span(mark: DemolitionMark, wall: Wall): [number, number] {
  const len = lengthOf(wall)
  return mark.anchor === "a" ? [mark.fromCm, mark.toCm] : [len - mark.toCm, len - mark.fromCm]
}

// железобетон не сносится (несущая стена); вырожденная стена не имеет оси
export const canDemolish = (wall: Wall): boolean => wall.type !== "reinforced" && !degenerate(wall)

// Пометки, которые действуют: стена есть, её можно сносить, а участок, обрезанный по стене, длиннее EPS_CM.
// Недействующие остаются в хранилище и снова действуют, когда условия выполнены (spec «Что сносится и что нет»).
export function effectiveMarks(marks: readonly DemolitionMark[], walls: readonly Wall[]): ResolvedMark[] {
  const resolved: ResolvedMark[] = []
  for (const mark of marks) {
    const wall = walls.find((w) => w.id === mark.wallId)
    if (!wall || !canDemolish(wall)) continue
    const [start, end] = span(mark, wall)
    const from = Math.max(0, start)
    const to = Math.min(lengthOf(wall), end)
    if (to - from > EPS_CM) resolved.push({ mark, wall, from, to })
  }
  return resolved
}
