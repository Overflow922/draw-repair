import { hostPoint } from "../doorway/doorway-faces"
import type { Side } from "../doorway/doorway-faces"
import { CHAIN_OFFSET_EM, DIM_TEXT_GAP_PX } from "../doorway/editable-numbers"
import { CHAR_WIDTH } from "../doorway/element-label"
import { formatLength } from "../format-length"
import { dimGeometry } from "../geometry"
import type { DimGeometry } from "../geometry"
import type { RenderMetrics } from "../render"
import type { Point, Unit, Wall } from "../types"
import { add, mul, unit as unitVector } from "../wall-geometry"
import { markChains } from "./mark-chains"
import type { NumberTarget } from "./mark-chains"
import type { MarkSpan } from "./mark-model"
import type { MarkNumberSpot } from "./mark-numbers"

// Размеры пометки как у проёма (change demolition-doorway-sizes, design D3): по каждой грани цепочка из трёх размеров
// с выносными линиями; нулевой размер опускается целиком (change demolition-corner-dimensions, design D1).

export interface MarkDimension {
  side: Side
  target: NumberTarget
  fromCm: number
  toCm: number
  text: string
  valueCm: number
  geom: DimGeometry
  spot: MarkNumberSpot // число и его прямоугольник для подчёркивания и попадания клика
}

const ZERO = 1e-6

// направление текста вдоль оси слева направо (как у чисел размеров и проёма)
function textDirection(axis: Point): Point {
  let angle = Math.atan2(axis.y, axis.x)
  if (angle > Math.PI / 2 || angle < -Math.PI / 2) angle += Math.PI
  return { x: Math.cos(angle), y: Math.sin(angle) }
}

// k — px на см чертежа, labelPx — кегль подписи; линия размера отстоит от грани на CHAIN_OFFSET_EM · кегль в сторону грани
export function markDimensions(r: MarkSpan, walls: readonly Wall[], _mode: "chain", unit: Unit, k: number, labelPx: number): MarkDimension[] {
  const offsetCm = (CHAIN_OFFSET_EM * labelPx) / k
  const face = r.wall.thicknessCm / 2
  const lineDir = textDirection(unitVector(r.wall.a, r.wall.b))
  const up = { x: lineDir.y, y: -lineDir.x }
  const lift = (DIM_TEXT_GAP_PX + labelPx / 2) / k
  const out: MarkDimension[] = []
  for (const item of markChains(r, walls)) {
    if (item.lengthCm <= ZERO) continue
    const geom = dimGeometry(hostPoint(r.wall, item.fromCm, item.side * face), hostPoint(r.wall, item.toCm, item.side * face), offsetCm * item.side)
    if (!geom) continue
    const text = formatLength(item.lengthCm, unit)
    const spot: MarkNumberSpot = {
      side: item.side,
      target: item.target,
      text,
      valueCm: item.lengthCm,
      center: add(hostPoint(r.wall, (item.fromCm + item.toCm) / 2, item.side * (face + offsetCm)), mul(up, lift)),
      dir: lineDir,
      widthCm: (text.length * labelPx * CHAR_WIDTH) / k,
      heightCm: labelPx / k,
    }
    out.push({ side: item.side, target: item.target, fromCm: item.fromCm, toCm: item.toCm, text, valueCm: item.lengthCm, geom, spot })
  }
  return out
}

// Точки габаритов цепочки пометки для страницы (см чертежа): концы выносных линий за линией размера на обеих гранях
// и четыре угла каждого числа
export function markDimensionExtent(r: MarkSpan, walls: readonly Wall[], k: number, m: RenderMetrics): Point[] {
  const beyond = m.dimOvershootPx / k
  const points: Point[] = []
  for (const d of markDimensions(r, walls, "chain", "cm", k, m.labelPx)) {
    const shift = { x: d.geom.nx * beyond * d.side, y: d.geom.ny * beyond * d.side }
    points.push(add(d.geom.p1, shift), add(d.geom.p2, shift))
    const { center, dir, widthCm, heightCm } = d.spot
    const numberUp = { x: dir.y, y: -dir.x }
    for (const sa of [-1, 1])
      for (const sb of [-1, 1]) points.push(add(center, add(mul(dir, (sa * widthCm) / 2), mul(numberUp, (sb * heightCm) / 2))))
  }
  return points
}