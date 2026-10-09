import type { Side } from "../doorway/doorway-faces"
import type { DemolitionMark, Point, Wall } from "../types"
import { dot, sub } from "../wall-geometry"
import { faceBounds } from "./mark-chains"
import type { NumberTarget } from "./mark-chains"
import { EPS_CM, MIN_WIDTH_CM, effectiveMarks, lengthOf, span } from "./mark-model"
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
export function editNumber(
  marks: readonly DemolitionMark[],
  walls: readonly Wall[],
  id: string,
  which: NumberTarget,
  side: Side,
  valueCm: number,
): { marks: DemolitionMark[]; id: string } | null {
  const r = effectiveMarks(marks, walls).find((x) => x.mark.id === id)
  if (!r || !Number.isFinite(valueCm)) return null
  if (which === "width" ? valueCm < MIN_WIDTH_CM : valueCm < 0) return null
  const bounds = faceBounds(r, walls, side)
  if (!bounds) return null
  const len = lengthOf(r.wall)
  const width = r.to - r.from
  let start = r.from
  let end = r.to
  if (which === "gapA") {
    start = clamp(bounds.j0 + valueCm, 0, len - width)
    end = start + width
  } else if (which === "gapB") {
    start = clamp(bounds.j1 - valueCm - width, 0, len - width)
    end = start + width
  } else {
    end = clamp(bounds.start + valueCm, r.from + MIN_WIDTH_CM, len)
  }
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
