import type { DimGeometry } from "../geometry"
import type { Point } from "../types"

// Числа предмета мебели на плане (change furniture-dimensions): габариты (ширина и длина) и расстояния сторон до стен.
// Одна раскладка для отрисовки, подчёркивания и попадания клика (numberAt из doorway/editable-numbers).

// сторона прямоугольника предмета в его системе при угле 0: left — x = 0, right — x = w, top — y = 0, bottom — y = l
export type ItemSide = "left" | "right" | "top" | "bottom"

export type ItemSize = "width" | "length"

export type ItemNumberField = { kind: "size"; size: ItemSize } | { kind: "distance"; side: ItemSide }

export interface ItemNumber {
  field: ItemNumberField
  text: string // число в текущей единице, как нарисовано
  valueCm: number // значение в см — для поля ввода
  geom: DimGeometry | null // размерная линия; нулевое расстояние — только число (null)
  center: Point // центр текста числа, мировые координаты — туда же ставится поле ввода
  dir: Point // единичное направление текста
  widthCm: number
  heightCm: number
}
