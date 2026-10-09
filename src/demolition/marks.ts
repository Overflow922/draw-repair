import type { DemolitionMark, Point, Wall } from "../types"
import { pointInPolygon } from "../wall-geometry"
import { markRegion } from "./mark-region"
import { EPS_CM, MIN_WIDTH_CM, canDemolish, effectiveMarks, lengthOf, span } from "./mark-model"
import type { ResolvedMark } from "./mark-model"

export { EPS_CM, MIN_WIDTH_CM, canDemolish, effectiveMarks, span }
export type { ResolvedMark }

// Операции над списком пометок сноса (change demolition-plan, design D2). Входы не мутируются; если операция
// ничего не изменила, возвращается тот же массив — по нему инструмент решает, писать ли шаг истории.

// пометка с участком [lo, hi] от конца a: привязка — ближний к середине участка конец (равенство → a)
export function markFromSpan(id: string, wall: Wall, lo: number, hi: number): DemolitionMark {
  const len = lengthOf(wall)
  return (lo + hi) / 2 <= len / 2
    ? { id, wallId: wall.id, anchor: "a", fromCm: lo, toCm: hi }
    : { id, wallId: wall.id, anchor: "b", fromCm: len - hi, toCm: len - lo }
}

interface Cluster {
  indices: number[] // слитые пометки стены по порядку списка
  lo: number
  hi: number
}

// Пометки стены, пересекающиеся с участком [lo, hi] или отстоящие от него не дальше EPS_CM, — транзитивно;
// seed — индексы, входящие в группу заранее.
function clusterOf(marks: readonly DemolitionMark[], wall: Wall, lo: number, hi: number, seed: readonly number[] = []): Cluster {
  const hit = new Set(seed)
  let low = lo
  let high = hi
  for (let grew = true; grew; ) {
    grew = false
    marks.forEach((m, i) => {
      if (hit.has(i) || m.wallId !== wall.id) return
      const [start, end] = span(m, wall)
      if (start > high + EPS_CM || end < low - EPS_CM) return
      hit.add(i)
      low = Math.min(low, start)
      high = Math.max(high, end)
      grew = true
    })
  }
  return { indices: [...hit].sort((a, b) => a - b), lo: low, hi: high }
}

// Группа сливается в одну пометку: она занимает место первой слитой и сохраняет её идентификатор; новый участок
// без пересечений добавляется в конец с новым идентификатором.
function replaceCluster(marks: readonly DemolitionMark[], wall: Wall, c: Cluster, newId: () => string): DemolitionMark[] {
  const lo = Math.max(0, c.lo)
  const hi = Math.min(lengthOf(wall), c.hi)
  const [first] = c.indices
  const firstMark = first === undefined ? undefined : marks[first]
  if (first === undefined || !firstMark) return [...marks, markFromSpan(newId(), wall, lo, hi)]
  const merged = markFromSpan(firstMark.id, wall, lo, hi)
  return marks.flatMap((m, i) => (i === first ? [merged] : c.indices.includes(i) ? [] : [m]))
}

const sameMark = (a: DemolitionMark, b: DemolitionMark): boolean =>
  a.id === b.id && a.wallId === b.wallId && a.anchor === b.anchor && a.fromCm === b.fromCm && a.toCm === b.toCm

export const sameMarks = (a: readonly DemolitionMark[], b: readonly DemolitionMark[]): boolean =>
  a.length === b.length &&
  a.every((m, i) => {
    const other = b[i]
    return other !== undefined && sameMark(m, other)
  })

// Пометить участок [fromA, toA] стены от конца a (обрезается по стене). Отклоняется (тот же массив), если стены нет,
// её нельзя сносить, границы не конечны или ширина после обрезки меньше MIN_WIDTH_CM.
export function addMark(
  marks: DemolitionMark[],
  walls: readonly Wall[],
  wallId: string,
  fromA: number,
  toA: number,
  newId: () => string = () => crypto.randomUUID(),
): DemolitionMark[] {
  const wall = walls.find((w) => w.id === wallId)
  if (!wall || !canDemolish(wall) || !Number.isFinite(fromA) || !Number.isFinite(toA)) return marks
  const lo = Math.max(0, fromA)
  const hi = Math.min(lengthOf(wall), toA)
  if (hi - lo < MIN_WIDTH_CM) return marks
  const next = replaceCluster(marks, wall, clusterOf(marks, wall, lo, hi), newId)
  return sameMarks(next, marks) ? marks : next
}

export function removeMark(marks: DemolitionMark[], id: string): DemolitionMark[] {
  return marks.some((m) => m.id === id) ? marks.filter((m) => m.id !== id) : marks
}

// Слияние пересекающихся и соприкасающихся пометок каждой существующей стены (загрузка документа, правка чисел);
// пометки на отсутствующие стены не трогаются.
export function mergeAll(marks: DemolitionMark[], walls: readonly Wall[]): DemolitionMark[] {
  let list = marks
  for (let i = 0; i < list.length; ) {
    const m = list[i]
    const wall = m && walls.find((w) => w.id === m.wallId)
    if (!m || !wall) {
      i++
      continue
    }
    const [lo, hi] = span(m, wall)
    const group = clusterOf(list, wall, lo, hi, [i])
    if (group.indices.length < 2) {
      i++
      continue
    }
    list = replaceCluster(list, wall, group, () => m.id)
    i = 0
  }
  return list
}

// Действующая пометка, в область сноса которой попадает точка; из нескольких — последняя в списке.
export function markAt(p: Point, resolved: readonly ResolvedMark[], walls: readonly Wall[]): ResolvedMark | null {
  for (let i = resolved.length - 1; i >= 0; i--) {
    const r = resolved[i]
    if (r && markRegion(r, walls).some((poly) => pointInPolygon(p, poly))) return r
  }
  return null
}
