import { CHAIN_OFFSET_EM, DIM_TEXT_GAP_PX } from "../doorway/editable-numbers"
import { CHAR_WIDTH } from "../doorway/element-label"
import { hostPoint } from "../doorway/doorway-faces"
import { formatLength } from "../format-length"
import type { DemolitionMark, Point, Unit, Wall } from "../types"
import { add, dot, mul, sub, unit as unitVector } from "../wall-geometry"
import { EPS_CM, MIN_WIDTH_CM, effectiveMarks, lengthOf, span } from "./mark-model"
import type { MarkSpan } from "./mark-model"
import { markFromSpan, mergeAll } from "./marks"

// Числа участка (change demolition-plan, design D5): расстояние от конца a, ширина, расстояние до конца b —
// значения, правка и раскладка на холсте по образцу цепочки чисел проёма (doorway/editable-numbers).

export type NumberTarget = "gapA" | "width" | "gapB"

export interface MarkNumbers {
  gapA: number
  width: number
  gapB: number
}

export interface MarkNumberSpot {
  target: NumberTarget
  text: string
  valueCm: number
  center: Point // центр текста, мировые координаты
  dir: Point // единичное направление текста слева направо
  widthCm: number
  heightCm: number
}

export function numbersOf(r: MarkSpan): MarkNumbers {
  return { gapA: r.from, width: r.to - r.from, gapB: lengthOf(r.wall) - r.to }
}

// Правка числа выделенной пометки: отступы сдвигают участок с сохранением ширины, ширина сохраняет начало; значение
// за допустимым зажимается. null — недопустимый ввод (не число, отступ < 0, ширина < MIN_WIDTH_CM) или недействующая
// пометка. Результат сливается с соседними; id — идентификатор пометки, в которую влился участок.
export function editNumber(
  marks: readonly DemolitionMark[],
  walls: readonly Wall[],
  id: string,
  which: NumberTarget,
  valueCm: number,
): { marks: DemolitionMark[]; id: string } | null {
  const r = effectiveMarks(marks, walls).find((x) => x.mark.id === id)
  if (!r || !Number.isFinite(valueCm)) return null
  if (which === "width" ? valueCm < MIN_WIDTH_CM : valueCm < 0) return null
  const len = lengthOf(r.wall)
  const width = r.to - r.from
  let start = r.from
  let end = r.to
  if (which === "gapA") {
    start = Math.min(valueCm, len - width)
    end = start + width
  } else if (which === "gapB") {
    end = len - Math.min(valueCm, len - width)
    start = end - width
  } else {
    end = r.from + Math.min(valueCm, len - r.from)
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

const ZERO = 1e-6

// направление текста вдоль оси слева направо (как у чисел размеров и проёма)
function textDirection(axis: Point): Point {
  let angle = Math.atan2(axis.y, axis.x)
  if (angle > Math.PI / 2 || angle < -Math.PI / 2) angle += Math.PI
  return { x: Math.cos(angle), y: Math.sin(angle) }
}

// Три числа выделенной пометки на стороне нормали (−d.y, d.x) оси a → b: центры отрезков [0, from], [from, to],
// [to, длина]; k — px на см чертежа, labelPx — кегль подписи.
export function markNumberLayout(r: MarkSpan, unit: Unit, k: number, labelPx: number): MarkNumberSpot[] {
  const len = lengthOf(r.wall)
  const lineDir = textDirection(unitVector(r.wall.a, r.wall.b))
  const lateral = r.wall.thicknessCm / 2 + (CHAIN_OFFSET_EM * labelPx) / k
  const parts: [NumberTarget, number, number][] = [
    ["gapA", 0, r.from],
    ["width", r.from, r.to],
    ["gapB", r.to, len],
  ]
  return parts.map(([target, from, to]) => {
    const valueCm = to - from
    const text = formatLength(valueCm, unit)
    // нулевой отступ — только число над точкой; иначе — над линией цепочки с зазором
    const zero = valueCm <= ZERO
    const dir = zero ? { x: 1, y: 0 } : lineDir
    const lift = zero ? labelPx / 2 / k : (DIM_TEXT_GAP_PX + labelPx / 2) / k
    const up = { x: dir.y, y: -dir.x }
    return {
      target,
      text,
      valueCm,
      center: add(hostPoint(r.wall, (from + to) / 2, lateral), mul(up, lift)),
      dir,
      widthCm: (text.length * labelPx * CHAR_WIDTH) / k,
      heightCm: labelPx / k,
    }
  })
}

// подпись невыделенной пометки — только ширина
export function markLabelSpot(r: MarkSpan, unit: Unit, k: number, labelPx: number): MarkNumberSpot {
  const spots = markNumberLayout(r, unit, k, labelPx)
  const width = spots.find((s) => s.target === "width")
  if (!width) throw new Error("раскладка чисел без ширины")
  return width
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
