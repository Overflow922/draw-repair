import type { DemolitionMark, Wall, WallElement } from "../types"
import { dist } from "../wall-geometry"
import { canDemolish, windowBlocks } from "./mark-sections"

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

export { canDemolish }

// Пометки, которые действуют: стена есть, её можно сносить, участок, обрезанный по стене, длиннее EPS_CM и не
// пересекает участок окна (окно блокирует снос своего участка стены; проёмы и двери не мешают). Недействующие остаются
// в хранилище и снова действуют, когда условия выполнены (spec «Что сносится и что нет»).
export function effectiveMarks(marks: readonly DemolitionMark[], walls: readonly Wall[], elements: readonly WallElement[] = []): ResolvedMark[] {
  const resolved: ResolvedMark[] = []
  const blocks = new Map<string, [number, number][]>()
  for (const mark of marks) {
    const wall = walls.find((w) => w.id === mark.wallId)
    if (!wall || !canDemolish(wall)) continue
    const [start, end] = span(mark, wall)
    const from = Math.max(0, start)
    const to = Math.min(lengthOf(wall), end)
    if (to - from <= EPS_CM) continue
    const blocked = blocks.get(wall.id) ?? windowBlocks(wall, walls, elements)
    blocks.set(wall.id, blocked)
    if (blocked.some(([lo, hi]) => Math.min(to, hi) - Math.max(from, lo) > EPS_CM)) continue
    resolved.push({ mark, wall, from, to })
  }
  return resolved
}
