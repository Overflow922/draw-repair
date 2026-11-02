import { textDirection, upOf } from "../doorway/editable-numbers"
import { CHAR_WIDTH } from "../doorway/element-label"
import { sizeInsetCm } from "../furniture/item-size-layout"
import type { SizeMetrics } from "../furniture/item-size-layout"
import { formatLength } from "../format-length"
import { dimGeometry } from "../geometry"
import type { DimGeometry } from "../geometry"
import type { Point, SectionShape, Unit } from "../types"
import { add, mul, sub } from "../wall-geometry"
import { figureToWorld } from "./section-layout"
import { figureFrame, resizeShape } from "./section-shape"
import { setGap, shapeGaps } from "./section-shape-gaps"
import type { ShapeSide } from "./section-shape-gaps"
import type { SectionEntry } from "./section-scene"

// Числа выделенной детали на фигуре (change add-section-shapes, design D5; spec section-view «Выделение, перемещение и правка
// детали разреза»): габариты — размерные линии у детали, расстояния — размерные линии от стороны до ближайшей грани. Та же
// раскладка, что у предмета «Мебели» (furniture/item-size-layout, item-wall-reach): одна для отрисовки, подчёркивания и попадания
// клика. Чистые функции; числа нигде не хранятся.

export type ShapeSize = "width" | "height"

export type ShapeNumberField = { kind: "size"; size: ShapeSize } | { kind: "gap"; side: ShapeSide }

export interface ShapeNumber {
  field: ShapeNumberField
  text: string // число в текущей единице, как нарисовано
  valueCm: number // значение в см — для поля ввода
  geom: DimGeometry | null // размерная линия; нулевое расстояние — только число (null)
  center: Point // центр текста числа, чертёж
  dir: Point // единичное направление текста
  widthCm: number
  heightCm: number
}

const ZERO_CM = 1e-6
const INSIDE_K = 3 // линия габарита лежит внутри детали, если поперёк неё места не меньше трёх отступов; иначе снаружи

// наружная нормаль стороны в чертеже: ось Y чертежа направлена вниз, а z — вверх
const NORMAL: Record<ShapeSide, Point> = { left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, bottom: { x: 0, y: 1 }, top: { x: 0, y: -1 } }

const textWidthCm = (text: string, k: number, m: SizeMetrics): number => (text.length * m.labelPx * CHAR_WIDTH) / k

export function shapeNumbers(entry: SectionEntry, shape: SectionShape, unit: Unit, k: number, m: SizeMetrics): ShapeNumber[] {
  const at = (s: number, z: number): Point => figureToWorld(entry.placement, s, z)
  const inset = sizeInsetCm(k, m)
  const box = (field: ShapeNumberField, valueCm: number) => {
    const text = formatLength(valueCm, unit)
    return { field, text, valueCm, widthCm: textWidthCm(text, k, m), heightCm: m.labelPx / k }
  }
  // число над размерной линией с зазором; направление текста — по линии
  const labelled = (field: ShapeNumberField, valueCm: number, from: Point, to: Point): ShapeNumber[] => {
    const geom = dimGeometry(from, to, 0)
    if (geom === null) return []
    const dir = textDirection(sub(to, from))
    return [{ ...box(field, valueCm), geom, center: add(mul(add(from, to), 0.5), mul(upOf(dir), (m.dimTextGapPx + m.labelPx / 2) / k)), dir }]
  }

  const width = shape.s1 - shape.s0
  const height = shape.z1 - shape.z0
  const widthZ = height >= INSIDE_K * inset ? shape.z1 - inset : shape.z1 + inset
  const heightS = width >= INSIDE_K * inset ? shape.s0 + inset : shape.s0 - inset
  const sizes = [
    ...labelled({ kind: "size", size: "width" }, width, at(shape.s0, widthZ), at(shape.s1, widthZ)),
    ...labelled({ kind: "size", size: "height" }, height, at(heightS, shape.z0), at(heightS, shape.z1)),
  ]

  const gaps = shapeGaps(shape, entry.figure, entry.shapes).flatMap((g): ShapeNumber[] => {
    const field: ShapeNumberField = { kind: "gap", side: g.side }
    const horizontal = g.side === "left" || g.side === "right"
    const sideCoord = { left: shape.s0, right: shape.s1, bottom: shape.z0, top: shape.z1 }[g.side]
    const from = horizontal ? at(sideCoord, g.at) : at(g.at, sideCoord)
    const to = horizontal ? at(g.face, g.at) : at(g.at, g.face)
    if (g.distance <= ZERO_CM) {
      // нулевое расстояние — одно число снаружи у точки стороны, текст горизонтален
      return [{ ...box(field, 0), geom: null, center: add(from, mul(NORMAL[g.side], (m.labelPx / 2 + m.dimTextGapPx) / k)), dir: { x: 1, y: 0 } }]
    }
    return labelled(field, g.distance, from, to)
  })
  return [...sizes, ...gaps]
}

// значение, введённое в число (в см), применяется к детали: габарит меняет размер при неподвижном центре, расстояние сдвигает
// деталь вдоль нормали стороны; null — правка не применяется
export function applyShapeNumber(entry: SectionEntry, shape: SectionShape, field: ShapeNumberField, valueCm: number): SectionShape | null {
  if (field.kind === "size") return resizeShape(shape, field.size, valueCm, figureFrame(entry.figure))
  return setGap(shape, shapeGaps(shape, entry.figure, entry.shapes), field.side, valueCm, figureFrame(entry.figure))
}
