import { describe, expect, it } from "vitest"
import { reconstructionScene } from "../reconstruction/reconstruction-scene"
import { drawing, drywall } from "../reconstruction/reconstruction.test-utils"
import type { SectionLine, SectionShape } from "../types"
import { applyShapeNumber, shapeNumbers } from "./section-shape-numbers"
import type { ShapeNumber, ShapeNumberField } from "./section-shape-numbers"

// change add-section-shapes: числа выделенной детали — габариты и расстояния (spec section-view «Выделение, перемещение и
// правка детали разреза»)
//
//   линия A: y = 0, x от 0 до 220, взгляд up; поперёк неё стены X1 (x = 5) и X2 (x = 215) толщиной 10 и высотой 250 дают сечения
//   s 0..10 и s 210..220 на фигуре шириной 220; полка s 30..190, z 120..125                       схематично, не в масштабе
//
//   //|<-- 20 -->+==========+<-- 20 -->|//
//   --------------------------------------      пол, z = 0 (снизу 120)
const LINE: SectionLine = { id: "L1", label: "A", view: "up", points: [{ x: 0, y: 0 }, { x: 220, y: 0 }] }
const SHELF: SectionShape = { id: "p1", lineId: "L1", s0: 30, s1: 190, z0: 120, z1: 125 }
const METRICS = { labelPx: 12, dimTextGapPx: 3 }
const K = 1 // 1 px на см

const entryOf = (shapes: SectionShape[]) =>
  reconstructionScene(
    drawing({
      walls: [],
      reconstruction: { walls: [drywall("X1", 5, -50, 5, 50, 10, 250), drywall("X2", 215, -50, 215, 50, 10, 250)], dimensions: [], sections: [LINE], sectionShapes: shapes },
    }),
  ).sections[0]

const find = (list: ShapeNumber[], field: ShapeNumberField) => list.find((n) => JSON.stringify(n.field) === JSON.stringify(field))

describe("раскладка чисел", () => {
  const entry = entryOf([SHELF])
  const numbers = shapeNumbers(entry, SHELF, "cm", K, METRICS)

  // TCR (change add-section-shapes, правка по замечанию пользователя): края фигуры — грани, есть и расстояние сверху
  it("SH-600: габариты и четыре расстояния", () => {
    expect(numbers.map((n) => JSON.stringify(n.field)).sort()).toEqual(
      [
        { kind: "size", size: "width" },
        { kind: "size", size: "height" },
        { kind: "gap", side: "left" },
        { kind: "gap", side: "right" },
        { kind: "gap", side: "bottom" },
        { kind: "gap", side: "top" },
      ].map((f) => JSON.stringify(f)).sort(),
    )
  })

  it("SH-601: значения: ширина 160, высота 5, слева 20, справа 20, снизу 120", () => {
    expect(find(numbers, { kind: "size", size: "width" })).toMatchObject({ valueCm: 160, text: "160" })
    expect(find(numbers, { kind: "size", size: "height" })?.valueCm).toBe(5)
    expect(find(numbers, { kind: "gap", side: "left" })?.valueCm).toBe(20)
    expect(find(numbers, { kind: "gap", side: "right" })?.valueCm).toBe(20)
    expect(find(numbers, { kind: "gap", side: "bottom" })).toMatchObject({ valueCm: 120, text: "120" })
    expect(find(numbers, { kind: "gap", side: "top" })?.valueCm).toBe(125)
  })

  it("SH-602: единица мм: числа в миллиметрах", () => {
    const mm = shapeNumbers(entry, SHELF, "mm", K, METRICS)
    expect(find(mm, { kind: "size", size: "width" })?.text).toBe("1600")
    expect(find(mm, { kind: "gap", side: "bottom" })?.text).toBe("1200")
  })

  it("SH-603: у расстояний и габаритов есть размерная линия, у ненулевых — геометрия", () => {
    for (const n of numbers) expect(n.geom).not.toBeNull()
  })

  it("SH-604: нулевое расстояние — только число у стороны, без размерной линии", () => {
    const deep: SectionShape = { ...SHELF, s0: 10, s1: 210 } // вплотную к сечениям стен
    const zero = find(shapeNumbers(entryOf([deep]), deep, "cm", K, METRICS), { kind: "gap", side: "left" })
    expect(zero).toMatchObject({ valueCm: 0, text: "0", geom: null })
  })

  it("SH-605: числа лежат в чертеже у детали: центр числа ширины ближе к детали, чем 100 см", () => {
    const n = find(numbers, { kind: "size", size: "width" })
    const box = { x: entry.placement.x + 110, y: entry.placement.floorY - 122.5 }
    expect(Math.hypot((n?.center.x ?? 0) - box.x, (n?.center.y ?? 0) - box.y)).toBeLessThan(100)
  })

  it("SH-606: у ширины и высоты размерные линии разной ориентации", () => {
    const w = find(numbers, { kind: "size", size: "width" })
    const h = find(numbers, { kind: "size", size: "height" })
    expect(Math.abs(w?.dir.x ?? 0)).toBeGreaterThan(0.99)
    expect(Math.abs(h?.dir.y ?? 0)).toBeGreaterThan(0.99)
  })
})

describe("применение числа", () => {
  const entry = entryOf([SHELF])

  it("SH-610: ширина 100 мм... — габарит в см при неподвижном центре", () => {
    expect(applyShapeNumber(entry, SHELF, { kind: "size", size: "width" }, 100)).toMatchObject({ s0: 60, s1: 160, z0: 120, z1: 125 })
  })

  it("SH-611: расстояние слева 50 сдвигает деталь на 30 вправо", () => {
    expect(applyShapeNumber(entry, SHELF, { kind: "gap", side: "left" }, 50)).toMatchObject({ s0: 60, s1: 220 })
  })

  it("SH-612: недопустимое значение — null", () => {
    expect(applyShapeNumber(entry, SHELF, { kind: "size", size: "height" }, 0)).toBeNull()
    expect(applyShapeNumber(entry, SHELF, { kind: "gap", side: "bottom" }, -5)).toBeNull()
    expect(applyShapeNumber(entry, SHELF, { kind: "gap", side: "bottom" }, 250)).toBeNull()
  })

  it("SH-613: расстояние сверху 10 ставит верх на 10 см ниже верха фигуры", () => {
    expect(applyShapeNumber(entry, SHELF, { kind: "gap", side: "top" }, 10)).toMatchObject({ z0: 235, z1: 240 })
  })
})
