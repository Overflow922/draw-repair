import { formatLength } from "../format-length"
import type { Room } from "../room-area"
import type { Point, Unit, Wall, WallElement } from "../types"
import { isWindow } from "../types"
import { add, mul } from "../wall-geometry"
import { heightLabelAt, heightLabelSide, labelDirection } from "./doorway-layout"

// Подпись элемента стены в рамке (change add-window design D6; popups-buttons-only design D1): «H=…» у проёма и
// двери, «H=…» и синее «H под.=…» у окна. Раскладка подписи — чистая функция: по ней рисуется подпись и находятся
// её правимые числа. Ширина текста — оценка по кеглю: measureText контекста jsPDF возвращает не единицы листа.

export type LabelField = "height" | "sill"

export interface LabelPart {
  text: string
  color: "ink" | "sill"
  field: LabelField
  valueLength: number // длина числа в конце текста части
}

export interface ElementLabel {
  parts: LabelPart[]
}

export const LABEL_GAP = "  "
export const LABEL_FRAME_PAD = 0.3 // поле рамки подписи, доля кегля
export const CHAR_WIDTH = 0.6 // ширина символа, доля кегля

const part = (prefix: string, value: string, color: LabelPart["color"], field: LabelField): LabelPart => ({
  text: `${prefix}${value}`,
  color,
  field,
  valueLength: value.length,
})

export function elementLabel(d: WallElement, unit: Unit): ElementLabel {
  const h = part("H=", formatLength(d.heightCm, unit), "ink", "height")
  if (!isWindow(d)) return { parts: [h] }
  return { parts: [h, part("H под.=", formatLength(d.sillCm, unit), "sill", "sill")] }
}

export const labelWidth = (label: ElementLabel, labelPx: number): number =>
  label.parts.map((x) => x.text).join(LABEL_GAP).length * labelPx * CHAR_WIDTH

// смещение центра числа части от центра подписи вдоль направления текста, px
export function partNumberOffsetPx(label: ElementLabel, index: number, labelPx: number): number {
  const total = label.parts.map((x) => x.text).join(LABEL_GAP).length
  let start = 0
  for (let i = 0; i < index; i++) start += (label.parts[i].text + LABEL_GAP).length
  const p = label.parts[index]
  const prefix = p.text.length - p.valueLength
  return (start + prefix + p.valueLength / 2 - total / 2) * labelPx * CHAR_WIDTH
}

export interface LabelLayout {
  label: ElementLabel
  center: Point // центр подписи, мировые координаты
  dir: Point // единичное направление текста вдоль оси опорной стены
  widthPx: number // ширина текста, px метрик
  padPx: number // поле рамки, px метрик
}

// подпись по центру элемента вне тела стены: за полосой bandPx от грани стороны подписи и ещё на полувысоту рамки.
// k — px метрик на см чертежа; на экране bandPx — полоса цепочки размеров, в PDF цепочек нет
export function elementLabelLayout(
  d: WallElement,
  walls: readonly Wall[],
  rooms: readonly Room[],
  unit: Unit,
  k: number,
  labelPx: number,
  bandPx: number,
): LabelLayout | null {
  const side = heightLabelSide(d, walls, rooms)
  const face = side === null ? null : heightLabelAt(d, walls, side, 0)
  const out = side === null ? null : heightLabelAt(d, walls, side, 1)
  const dir = labelDirection(d, walls)
  if (!face || !out || !dir) return null
  const label = elementLabel(d, unit)
  const padPx = LABEL_FRAME_PAD * labelPx
  const gapCm = (bandPx + labelPx / 2 + padPx) / k
  return {
    label,
    center: add(face, mul({ x: out.x - face.x, y: out.y - face.y }, gapCm)),
    dir,
    widthPx: labelWidth(label, labelPx),
    padPx,
  }
}
