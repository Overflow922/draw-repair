import { CHAIN_OFFSET_EM, DIM_TEXT_GAP_PX, textDirection, upOf } from "../doorway/editable-numbers"
import { hostPoint } from "../doorway/doorway-faces"
import { CHAR_WIDTH } from "../doorway/element-label"
import { formatLength } from "../format-length"
import { dimGeometry } from "../geometry"
import type { DimGeometry } from "../geometry"
import type { Battery, Point, Unit, Wall } from "../types"
import { add, dot, mul, unit as unitVector } from "../wall-geometry"
import { batterySpan } from "./battery-geometry"
import { batteryNumbers } from "./battery-edit"
import { hostOfBattery } from "./battery-motion"

// Раскладка чисел выделенной батареи (change add-battery, design D10; spec battery «Числа выделенной батареи»): размерные
// линии вне прямоугольника — цепочка «расстояние до участка, длина, расстояние до участка» вдоль передней стороны,
// толщина за торцом b, отступ за торцом a. Одна раскладка для отрисовки и для попадания клика. Чистые функции без DOM.

export type BatteryField = "toA" | "toB" | "length" | "thickness" | "gap"

export interface BatteryNumber {
  field: BatteryField
  text: string // число в текущей единице, как нарисовано
  valueCm: number // значение в см — для поля ввода и применения
  geom: DimGeometry | null // размерная линия; нулевое расстояние — только число (null)
  center: Point // центр текста числа, мировые координаты — туда же ставится поле ввода
  dir: Point // единичное направление текста
  widthCm: number
  heightCm: number
}

const ZERO = 1e-6

// знак смещения линии a → b, при котором она уходит в сторону desired
function sideOf(a: Point, b: Point, desired: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return Math.sign(dot({ x: -dy, y: dx }, desired)) || 1
}

// k — px на см чертежа, labelPx — кегль подписи
export function batteryNumberLayout(b: Battery, walls: readonly Wall[], unit: Unit, k: number, labelPx: number): BatteryNumber[] {
  const host = hostOfBattery(b, walls)
  if (!host) return []
  const axis = unitVector(host.a, host.b)
  const outward = mul({ x: -axis.y, y: axis.x }, b.face) // от стены к передней стороне
  const [start, end] = batterySpan(b, host)
  const half = host.thicknessCm / 2
  const backLat = b.face * (half + b.gapCm)
  const frontLat = b.face * (half + b.gapCm + b.thicknessCm)
  const faceLat = b.face * half
  const offsetCm = (labelPx * CHAIN_OFFSET_EM) / k
  const numbers = batteryNumbers(b, walls)
  const out: BatteryNumber[] = []

  const push = (field: BatteryField, valueCm: number, from: Point, to: Point, away: Point): void => {
    const text = formatLength(valueCm, unit)
    const widthCm = (text.length * labelPx * CHAR_WIDTH) / k
    const heightCm = labelPx / k
    if (valueCm <= ZERO) {
      // нулевое расстояние — только число, текст стоит над точкой
      const at = add(from, mul(away, offsetCm))
      out.push({ field, text, valueCm, geom: null, center: add(at, mul(upOf({ x: 1, y: 0 }), labelPx / 2 / k)), dir: { x: 1, y: 0 }, widthCm, heightCm })
      return
    }
    const geom = dimGeometry(from, to, sideOf(from, to, away) * offsetCm)
    if (!geom) return
    const dir = textDirection({ x: to.x - from.x, y: to.y - from.y })
    const mid = { x: (geom.p1.x + geom.p2.x) / 2, y: (geom.p1.y + geom.p2.y) / 2 }
    out.push({ field, text, valueCm, geom, center: add(mid, mul(upOf(dir), (DIM_TEXT_GAP_PX + labelPx / 2) / k)), dir, widthCm, heightCm })
  }

  if (Number.isFinite(numbers.toA)) push("toA", numbers.toA, hostPoint(host, start - numbers.toA, frontLat), hostPoint(host, start, frontLat), outward)
  push("length", b.lengthCm, hostPoint(host, start, frontLat), hostPoint(host, end, frontLat), outward)
  if (Number.isFinite(numbers.toB)) push("toB", numbers.toB, hostPoint(host, end, frontLat), hostPoint(host, end + numbers.toB, frontLat), outward)
  push("thickness", b.thicknessCm, hostPoint(host, end, backLat), hostPoint(host, end, frontLat), axis)
  push("gap", b.gapCm, hostPoint(host, start, faceLat), hostPoint(host, start, backLat), mul(axis, -1))
  return out
}
