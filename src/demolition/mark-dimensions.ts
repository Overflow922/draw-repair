import { hostPoint } from "../doorway/doorway-faces"
import { CHAIN_OFFSET_EM } from "../doorway/editable-numbers"
import { dimGeometry } from "../geometry"
import type { DimGeometry } from "../geometry"
import type { RenderMetrics } from "../render"
import type { Point, Unit } from "../types"
import { add, mul } from "../wall-geometry"
import { lengthOf } from "./mark-model"
import type { MarkSpan } from "./mark-model"
import { markLabelSpot, markNumberLayout } from "./mark-numbers"
import type { MarkNumberSpot, NumberTarget } from "./mark-numbers"

// Размеры пометки (change demolition-dimension-chains, design D2): ширина участка — один размер чертежа
// с выносными линиями; у выделенной пометки — цепочка из трёх размеров (отступ от a, ширина, отступ до b).

export interface MarkDimension {
  target: NumberTarget
  fromCm: number
  toCm: number
  text: string
  geom: DimGeometry | null // null — размер нулевой длины: рисуется только число
  spot: MarkNumberSpot // число и его прямоугольник для попадания (markNumberLayout)
}

const ZERO = 1e-6

function boundsOf(r: MarkSpan, target: NumberTarget): [number, number] {
  if (target === "gapA") return [0, r.from]
  if (target === "gapB") return [r.to, lengthOf(r.wall)]
  return [r.from, r.to]
}

// k — px на см чертежа, labelPx — кегль подписи; линия размера отстоит от грани стены на CHAIN_OFFSET_EM · кегль
export function markDimensions(r: MarkSpan, selected: boolean, unit: Unit, k: number, labelPx: number): MarkDimension[] {
  const spots = selected ? markNumberLayout(r, unit, k, labelPx) : [markLabelSpot(r, unit, k, labelPx)]
  const offsetCm = (CHAIN_OFFSET_EM * labelPx) / k
  const face = r.wall.thicknessCm / 2
  return spots.map((spot) => {
    const [fromCm, toCm] = boundsOf(r, spot.target)
    const geom = spot.valueCm <= ZERO ? null : dimGeometry(hostPoint(r.wall, fromCm, face), hostPoint(r.wall, toCm, face), offsetCm)
    return { target: spot.target, fromCm, toCm, text: spot.text, geom, spot }
  })
}

// Точки габаритов размера ширины для страницы (см чертежа): концы выносных линий за линией размера и четыре угла числа
export function markDimensionExtent(r: MarkSpan, k: number, m: RenderMetrics): Point[] {
  const width = markDimensions(r, false, "cm", k, m.labelPx)[0]
  if (!width) return []
  const points: Point[] = []
  if (width.geom) {
    const beyond = m.dimOvershootPx / k
    const shift = { x: width.geom.nx * beyond, y: width.geom.ny * beyond }
    points.push(add(width.geom.p1, shift), add(width.geom.p2, shift))
  }
  const { center, dir, widthCm, heightCm } = width.spot
  const up = { x: dir.y, y: -dir.x }
  for (const sa of [-1, 1])
    for (const sb of [-1, 1]) points.push(add(center, add(mul(dir, (sa * widthCm) / 2), mul(up, (sb * heightCm) / 2))))
  return points
}
