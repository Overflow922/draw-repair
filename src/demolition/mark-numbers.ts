import type { Side } from "../doorway/doorway-faces"
import type { DemolitionMark, Point, Wall } from "../types"
import { dot, sub } from "../wall-geometry"
import { clippedFaceBounds, faceBounds } from "./mark-chains"
import type { FaceBoundsOf, NumberTarget } from "./mark-chains"
import { EPS_CM, MIN_WIDTH_CM, effectiveMarks, lengthOf, span } from "./mark-model"
import type { MarkSpan } from "./mark-model"
import { markFromSpan, mergeAll } from "./marks"

// Числа участка (change demolition-plan, design D5; по граням — change demolition-doorway-sizes, design D2):
// значения, правка и попадание клика по образцу цепочки чисел проёма (doorway/editable-numbers).

export type { NumberTarget }

// число цепочки: цель и грань
export interface NumberRef {
  target: NumberTarget
  side: Side
}

export interface MarkNumberSpot extends NumberRef {
  text: string
  valueCm: number
  center: Point // центр текста, мировые координаты
  dir: Point // единичное направление текста слева направо
  widthCm: number
  heightCm: number
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi)

// Правка числа выделенной пометки на грани side: отступы сдвигают участок так, чтобы расстояние на грани стало
// введённым, с сохранением ширины вдоль оси; ширина сохраняет начало; значение за допустимым зажимается. null —
// недопустимый ввод (не число, отступ < 0, ширина < MIN_WIDTH_CM), недействующая пометка или стена без граней.
// Результат сливается с соседними; id — идентификатор пометки, в которую влился участок.
// Границы участка r после правки числа which на грани side (общая арифметика пометок сноса и штукатурки): отступы сдвигают
// участок с сохранением ширины, ширина сохраняет начало; значение за допустимым зажимается; null — недопустимый ввод или
// стена без граней.
// bounds — границы пометки на грани (по умолчанию faceBounds; план «Демонтаж» передаёт границы, зажатые срезами у соседей).
// Ширина, доходящая до конца грани у конца b стены (bounds.reach), ставит конец участка в конец стены: целая стена.
export function editedSpan(
  r: MarkSpan,
  walls: readonly Wall[],
  which: NumberTarget,
  side: Side,
  valueCm: number,
  boundsOf: FaceBoundsOf = faceBounds,
): [number, number] | null {
  if (!Number.isFinite(valueCm)) return null
  if (which === "width" ? valueCm < MIN_WIDTH_CM : valueCm < 0) return null
  const bounds = boundsOf(r, walls, side)
  if (!bounds) return null
  const len = lengthOf(r.wall)
  const width = r.to - r.from
  if (which === "gapA") {
    const start = clamp(bounds.j0 + valueCm, 0, len - width)
    return [start, start + width]
  }
  if (which === "gapB") {
    const start = clamp(bounds.j1 - valueCm - width, 0, len - width)
    return [start, start + width]
  }
  const end = bounds.start + valueCm
  if (bounds.reach !== undefined && end >= bounds.reach - EPS_CM) return [r.from, len]
  return [r.from, clamp(end, r.from + MIN_WIDTH_CM, len)]
}

export function editNumber(
  marks: readonly DemolitionMark[],
  walls: readonly Wall[],
  id: string,
  which: NumberTarget,
  side: Side,
  valueCm: number,
): { marks: DemolitionMark[]; id: string } | null {
  const r = effectiveMarks(marks, walls).find((x) => x.mark.id === id)
  if (!r) return null
  const edit = editedSpan(r, walls, which, side, valueCm, clippedFaceBounds)
  if (!edit) return null
  const [start, end] = edit
  const edited = markFromSpan(id, r.wall, start, end)
  const merged = mergeAll(
    marks.map((m) => (m.id === id ? edited : m)),
    walls,
  )
  const result = merged.find((m) => {
    if (m.wallId !== r.wall.id) return false
    const [from, to] = span(m, r.wall)
    return from <= start + EPS_CM && to >= end - EPS_CM
  })
  return result ? { marks: merged, id: result.id } : null
}

// число, в прямоугольник которого (вдоль текста — ширина, поперёк — кегль) с допуском tolCm попала точка;
// из нескольких — с ближайшим центром
export function markNumberAt(p: Point, spots: readonly MarkNumberSpot[], tolCm: number): MarkNumberSpot | null {
  let best: MarkNumberSpot | null = null
  let bestDistance = Infinity
  for (const spot of spots) {
    const rel = sub(p, spot.center)
    const along = dot(rel, spot.dir)
    const across = dot(rel, { x: -spot.dir.y, y: spot.dir.x })
    if (Math.abs(along) > spot.widthCm / 2 + tolCm || Math.abs(across) > spot.heightCm / 2 + tolCm) continue
    const d = Math.hypot(rel.x, rel.y)
    if (d < bestDistance) {
      best = spot
      bestDistance = d
    }
  }
  return best
}
