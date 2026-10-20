import { EPS_CM, MIN_WIDTH_CM, lengthOf } from "../demolition/mark-model"
import type { PlasterMark, Wall } from "../types"
import { plasterSpan } from "./plaster"
import { isSideMark } from "./rough-model"

// Операции над списком пометок штукатурки (change add-rough-works-plan, design D3). Входы не мутируются; если операция
// ничего не изменила, возвращается тот же массив — по нему инструмент решает, писать ли шаг истории.

// пометка с участком [lo, hi] от конца a: привязка — ближний к середине участка конец (равенство → a)
export function markFromSpan(id: string, wall: Wall, face: 1 | -1, thicknessMm: number, lo: number, hi: number): PlasterMark {
  const len = lengthOf(wall)
  return (lo + hi) / 2 <= len / 2
    ? { id, wallId: wall.id, face, anchor: "a", fromCm: lo, toCm: hi, thicknessMm }
    : { id, wallId: wall.id, face, anchor: "b", fromCm: len - hi, toCm: len - lo, thicknessMm }
}

interface Cluster {
  indices: number[]
  lo: number
  hi: number
}

// пометки той же грани той же стены, пересекающиеся с участком [lo, hi] или отстоящие от него не дальше EPS_CM, — транзитивно
function clusterOf(marks: readonly PlasterMark[], wall: Wall, face: 1 | -1, lo: number, hi: number, seed: readonly number[] = []): Cluster {
  const hit = new Set(seed)
  let low = lo
  let high = hi
  for (let grew = true; grew; ) {
    grew = false
    marks.forEach((m, i) => {
      if (hit.has(i) || !isSideMark(m) || m.wallId !== wall.id || m.face !== face) return
      const [start, end] = plasterSpan(m, wall)
      if (start > high + EPS_CM || end < low - EPS_CM) return
      hit.add(i)
      low = Math.min(low, start)
      high = Math.max(high, end)
      grew = true
    })
  }
  return { indices: [...hit].sort((a, b) => a - b), lo: low, hi: high }
}

// Группа сливается в одну пометку на месте первой слитой, с её идентификатором; новый участок без пересечений добавляется
// в конец с новым идентификатором. Толщина слитой — thicknessMm.
function replaceCluster(marks: readonly PlasterMark[], wall: Wall, face: 1 | -1, thicknessMm: number, c: Cluster, newId: () => string): PlasterMark[] {
  const lo = Math.max(0, c.lo)
  const hi = Math.min(lengthOf(wall), c.hi)
  const [first] = c.indices
  const firstMark = first === undefined ? undefined : marks[first]
  if (first === undefined || !firstMark) return [...marks, markFromSpan(newId(), wall, face, thicknessMm, lo, hi)]
  const merged = markFromSpan(firstMark.id, wall, face, thicknessMm, lo, hi)
  return marks.flatMap((m, i) => (i === first ? [merged] : c.indices.includes(i) ? [] : [m]))
}

const sameMark = (a: PlasterMark, b: PlasterMark): boolean => {
  if (a.face === "reveal" || b.face === "reveal") {
    return a.face === "reveal" && b.face === "reveal" && a.id === b.id && a.elementId === b.elementId && a.jamb === b.jamb && a.thicknessMm === b.thicknessMm
  }
  const same = a.id === b.id && a.wallId === b.wallId && a.face === b.face && a.anchor === b.anchor && a.thicknessMm === b.thicknessMm
  return a.face === "end" || b.face === "end" ? same : same && a.fromCm === b.fromCm && a.toCm === b.toCm
}

export const samePlaster = (a: readonly PlasterMark[], b: readonly PlasterMark[]): boolean =>
  a.length === b.length &&
  a.every((m, i) => {
    const other = b[i]
    return other !== undefined && sameMark(m, other)
  })

// Пометить участок [fromA, toA] грани face стены от конца a (обрезается по стене). Отклоняется (тот же массив), если стены нет,
// границы не конечны или ширина после обрезки меньше MIN_WIDTH_CM.
export function addPlaster(
  marks: PlasterMark[],
  walls: readonly Wall[],
  wallId: string,
  face: 1 | -1,
  fromA: number,
  toA: number,
  thicknessMm: number,
  newId: () => string = () => crypto.randomUUID(),
): PlasterMark[] {
  const wall = walls.find((w) => w.id === wallId)
  if (!wall || !Number.isFinite(fromA) || !Number.isFinite(toA)) return marks
  const lo = Math.max(0, fromA)
  const hi = Math.min(lengthOf(wall), toA)
  if (hi - lo < MIN_WIDTH_CM) return marks
  const next = replaceCluster(marks, wall, face, thicknessMm, clusterOf(marks, wall, face, lo, hi), newId)
  return samePlaster(next, marks) ? marks : next
}

// Пометить торец конца end стены (change plaster-wall-end-face, design D6): один торец — одна пометка, повтор ничего не меняет
export function addPlasterEnd(
  marks: PlasterMark[],
  walls: readonly Wall[],
  wallId: string,
  end: "a" | "b",
  thicknessMm: number,
  newId: () => string = () => crypto.randomUUID(),
): PlasterMark[] {
  if (!walls.some((w) => w.id === wallId) || marks.some((m) => m.face === "end" && m.wallId === wallId && m.anchor === end)) return marks
  return [...marks, { id: newId(), wallId, face: "end", anchor: end, thicknessMm }]
}

// Пометить откос jamb элемента стены (change plaster-opening-reveals, design D4): один откос — одна пометка, повтор ничего не меняет
export function addPlasterReveal(
  marks: PlasterMark[],
  elementId: string,
  jamb: "a" | "b",
  thicknessMm: number,
  newId: () => string = () => crypto.randomUUID(),
): PlasterMark[] {
  if (marks.some((m) => m.face === "reveal" && m.elementId === elementId && m.jamb === jamb)) return marks
  return [...marks, { id: newId(), face: "reveal", elementId, jamb, thicknessMm }]
}

export function removePlaster(marks: PlasterMark[], id: string): PlasterMark[] {
  return marks.some((m) => m.id === id) ? marks.filter((m) => m.id !== id) : marks
}

export function setPlasterThickness(marks: PlasterMark[], id: string, thicknessMm: number): PlasterMark[] {
  const target = marks.find((m) => m.id === id)
  if (!target || target.thicknessMm === thicknessMm) return marks
  return marks.map((m) => (m.id === id ? { ...m, thicknessMm } : m))
}

// Слияние пересекающихся и соприкасающихся пометок каждой существующей стены и грани (загрузка документа);
// пометки на отсутствующие стены не трогаются; слитая пометка сохраняет толщину первой.
export function mergeAllPlaster(marks: PlasterMark[], walls: readonly Wall[]): PlasterMark[] {
  let list = marks
  for (let i = 0; i < list.length; ) {
    const m = list[i]
    const wall = m && walls.find((w) => w.id === m.wallId)
    if (!m || !isSideMark(m) || !wall) {
      i++
      continue
    }
    const [lo, hi] = plasterSpan(m, wall)
    const group = clusterOf(list, wall, m.face, lo, hi, [i])
    if (group.indices.length < 2) {
      i++
      continue
    }
    list = replaceCluster(list, wall, m.face, m.thicknessMm, group, () => m.id)
    i = 0
  }
  return list
}
