import type { Shape } from "../communications/shape"
import { textDirection, upOf } from "../doorway/editable-numbers"
import { CHAR_WIDTH } from "../doorway/element-label"
import type { SizeMetrics } from "../furniture/item-size-layout"
import { formatLength } from "../format-length"
import { dimGeometry } from "../geometry"
import type { DimGeometry } from "../geometry"
import type { LightFixture, Point, Unit } from "../types"
import { add, mul, sub } from "../wall-geometry"
import { insideBodies, lightReaches } from "./light-reach"
import type { LightAxis } from "./light-reach"
import { moveLight } from "./lights"

// Числа расстояний объектов освещения и ввод расстояния на месте (change add-ceiling-lighting, design D5; spec ceiling-lighting
// «Расстояния точки освещения до стен», «Правка расстояний освещения на месте»). Раскладка — как у расстояний предмета мебели:
// размерная линия от центра до грани, число над ней; ноль — только число у центра. Чистые функции.

export interface LightNumber {
  lightId: string
  axis: LightAxis
  text: string
  valueCm: number
  geom: DimGeometry | null
  center: Point // центр текста, мировые координаты — туда же ставится поле ввода
  dir: Point
  widthCm: number
  heightCm: number
}

const ZERO_CM = 1e-6

// k — px носителя на см чертежа
export function lightNumberLayout(l: LightFixture, bodies: readonly Shape[], unit: Unit, k: number, m: SizeMetrics): LightNumber[] {
  return lightReaches(l, bodies).flatMap((r): LightNumber[] => {
    const text = formatLength(r.t, unit)
    const base = { lightId: l.id, axis: r.axis, text, valueCm: r.t, widthCm: (text.length * m.labelPx * CHAR_WIDTH) / k, heightCm: m.labelPx / k }
    if (r.t <= ZERO_CM) {
      // число стоит у центра со стороны помещения (против направления к грани), текст горизонтален
      return [{ ...base, geom: null, center: add(r.from, mul(r.dir, -(m.labelPx / 2 + m.dimTextGapPx) / k)), dir: { x: 1, y: 0 } }]
    }
    const geom = dimGeometry(r.from, r.to, 0)
    if (!geom) return []
    const dir = textDirection(sub(r.to, r.from))
    const mid = mul(add(r.from, r.to), 0.5)
    return [{ ...base, geom, center: add(mid, mul(upOf(dir), (m.dimTextGapPx + m.labelPx / 2) / k)), dir }]
  })
}

// центр бра, сдвинутый вдоль грани: координата вдоль грани (X у грани ближе к горизонтали, иначе Y) округлена, другая — на грани
function alongFace(c: Point, dir: Point): Point {
  if (Math.abs(dir.x) >= Math.abs(dir.y)) {
    const x = Math.round(c.x)
    return { x, y: c.y + ((x - c.x) * dir.y) / dir.x }
  }
  const y = Math.round(c.y)
  return { x: c.x + ((y - c.y) * dir.x) / dir.y, y }
}

// ввод расстояния: объект сдвигается вдоль линии числа так, чтобы расстояние до той же грани стало равным value. Тот же
// массив — значение недопустимо, объекта или числа нет, центр оказался бы в теле стены или сдвига нет
export function applyLightDistance(lights: LightFixture[], id: string, axis: LightAxis, value: number, bodies: readonly Shape[]): LightFixture[] {
  if (!Number.isFinite(value) || value < 0) return lights
  const l = lights.find((x) => x.id === id)
  const r = l ? lightReaches(l, bodies).find((x) => x.axis === axis) : undefined
  if (!l || !r) return lights
  const moved = add(r.from, mul(r.dir, r.t - value))
  const at = l.kind === "sconce" ? alongFace(moved, r.dir) : { x: Math.round(moved.x), y: Math.round(moved.y) }
  if (insideBodies(at, bodies)) return lights
  return moveLight(lights, id, { at })
}
