import { describe, expect, it } from "vitest"
import type { FurnitureItem, Point, ToiletSizes } from "../types"
import { applyItemNumber } from "./item-edit"
import type { ItemNumber } from "./item-number"
import { itemSizeLayout } from "./item-size-layout"

// change add-toilet: четыре габарита унитаза (spec furniture-plan «Габариты унитаза»). Ожидания считаются здесь независимо:
// точки переводятся в систему предмета (начало — левый верхний угол при угле 0), отступ линии от стороны — кегль и два зазора
// в px, делённые на px/см.

const SCREEN = { labelPx: 14, dimTextGapPx: 1.5 }
const K = 3
const INSET = (SCREEN.labelPx + 2 * SCREEN.dimTextGapPx) / K
const DEFAULT: ToiletSizes = { bowlWidthCm: 38, bowlLengthCm: 52, blockWidthCm: 70, blockDepthCm: 20 }
const toilet = (angleDeg = 0, sizes: ToiletSizes = DEFAULT): FurnitureItem => ({
  id: "t",
  kind: "toilet",
  x: 100,
  y: 100,
  widthCm: sizes.blockWidthCm,
  lengthCm: sizes.bowlLengthCm + sizes.blockDepthCm,
  angleDeg,
  toilet: sizes,
})

function toLocal(t: FurnitureItem, p: Point): Point {
  const r = (t.angleDeg * Math.PI) / 180
  const dx = p.x - t.x
  const dy = p.y - t.y
  return {
    x: dx * Math.cos(r) + dy * Math.sin(r) + t.widthCm / 2,
    y: -dx * Math.sin(r) + dy * Math.cos(r) + t.lengthCm / 2,
  }
}

const numbers = (t: FurnitureItem, unit: "cm" | "mm" = "cm"): ItemNumber[] => itemSizeLayout(t, unit, K, SCREEN)
const byText = (list: readonly ItemNumber[], text: string): ItemNumber => {
  const n = list.find((x) => x.text === text)
  if (!n) throw new Error(`нет числа ${text}`)
  return n
}
const lineLocal = (t: FurnitureItem, n: ItemNumber): [Point, Point] => {
  if (!n.geom) throw new Error("нет линии")
  return [toLocal(t, n.geom.p1), toLocal(t, n.geom.p2)]
}
const sortedByX = ([a, b]: [Point, Point]): [Point, Point] => (a.x <= b.x ? [a, b] : [b, a])
const sortedByY = ([a, b]: [Point, Point]): [Point, Point] => (a.y <= b.y ? [a, b] : [b, a])

describe("четыре габарита унитаза", () => {
  it("TLN-01: показаны «38», «52», «70» и «20», общей длины «72» и полей width/length нет", () => {
    const list = numbers(toilet())
    expect(list.map((n) => n.text).sort()).toEqual(["20", "38", "52", "70"])
    expect(list.map((n) => n.field)).toEqual(
      expect.arrayContaining([
        { kind: "size", size: "bowlWidth" },
        { kind: "size", size: "bowlLength" },
        { kind: "size", size: "blockWidth" },
        { kind: "size", size: "blockDepth" },
      ]),
    )
  })

  it("TLN-02: в миллиметрах числа 380, 520, 700 и 200", () => {
    expect(numbers(toilet(), "mm").map((n) => n.text).sort()).toEqual(["200", "380", "520", "700"])
  })

  it("TLN-03: значения чисел в сантиметрах для поля ввода", () => {
    const list = numbers(toilet())
    expect(byText(list, "38").valueCm).toBe(38)
    expect(byText(list, "20").valueCm).toBe(20)
  })

  it("TLN-10: ширина блока — линия вдоль блока внутри него у верхней стороны на отступе, концы на x 0 и 70", () => {
    const t = toilet()
    const [a, b] = sortedByX(lineLocal(t, byText(numbers(t), "70")))
    expect([a.x, b.x].map((v) => Math.round(v * 1e6) / 1e6)).toEqual([0, 70])
    expect(a.y).toBeCloseTo(INSET, 6)
    expect(b.y).toBeCloseTo(INSET, 6)
  })

  it("TLN-11: глубина блока — линия поперёк блока от y = 0 до y = 20 у левой стороны на отступе", () => {
    const t = toilet()
    const [a, b] = sortedByY(lineLocal(t, byText(numbers(t), "20")))
    expect([a.y, b.y].map((v) => Math.round(v * 1e6) / 1e6)).toEqual([0, 20])
    expect(a.x).toBeCloseTo(INSET, 6)
    expect(b.x).toBeCloseTo(INSET, 6)
  })

  it("TLN-12: ширина чаши — линия вдоль чаши от x = 16 до x = 54 у лица блока (y = 20) на отступе внутрь чаши", () => {
    const t = toilet()
    const [a, b] = sortedByX(lineLocal(t, byText(numbers(t), "38")))
    expect([a.x, b.x].map((v) => Math.round(v * 1e6) / 1e6)).toEqual([16, 54])
    expect(a.y).toBeCloseTo(20 + INSET, 6)
    expect(b.y).toBeCloseTo(20 + INSET, 6)
  })

  it("TLN-13: длина чаши — линия от лица блока (y = 20) до носа (y = 72) у левого бока чаши (x = 16) на отступе", () => {
    const t = toilet()
    const [a, b] = sortedByY(lineLocal(t, byText(numbers(t), "52")))
    expect([a.y, b.y].map((v) => Math.round(v * 1e6) / 1e6)).toEqual([20, 72])
    expect(a.x).toBeCloseTo(16 + INSET, 6)
    expect(b.x).toBeCloseTo(16 + INSET, 6)
  })

  it("TLN-14: габариты поворачиваются вместе с предметом (угол 90): те же четыре числа, линии в системе предмета те же", () => {
    const t = toilet(90)
    const list = numbers(t)
    expect(list.map((n) => n.text).sort()).toEqual(["20", "38", "52", "70"])
    const [a, b] = sortedByX(lineLocal(t, byText(list, "70")))
    expect([a.x, b.x].map((v) => Math.round(v * 1e6) / 1e6)).toEqual([0, 70])
    expect(a.y).toBeCloseTo(INSET, 6)
  })

  it("TLN-15: у предмета другого вида остаются два габарита", () => {
    const table: FurnitureItem = { id: "x", kind: "table", x: 0, y: 0, widthCm: 80, lengthCm: 160, angleDeg: 0 }
    expect(numbers(table).map((n) => n.field)).toEqual([
      { kind: "size", size: "width" },
      { kind: "size", size: "length" },
    ])
  })

  it("TLN-16: мелкий зум — число глубины блока не помещается в 20 см и выносится наружу (линия левее предмета)", () => {
    const t = toilet()
    // k = 0,4: отступ 42,5 см, число «20» шире 20 см; решение «внутри или снаружи» принимается для каждого числа отдельно
    const list = itemSizeLayout(t, "cm", 0.4, SCREEN)
    expect(list).toHaveLength(4)
    const depth = byText(list, "20")
    const [a] = lineLocal(t, depth)
    expect(a.x).toBeLessThan(0)
  })
})

describe("ввод числа габарита унитаза", () => {
  const apply = (t: FurnitureItem, size: "bowlWidth" | "bowlLength" | "blockWidth" | "blockDepth", valueCm: number): FurnitureItem | null =>
    applyItemNumber(t, { kind: "size", size }, valueCm, [])

  it("TLN-20: глубина блока 25 даёт длину 77, центр и угол прежние", () => {
    expect(apply(toilet(), "blockDepth", 25)).toMatchObject({ x: 100, y: 100, angleDeg: 0, widthCm: 70, lengthCm: 77, toilet: { ...DEFAULT, blockDepthCm: 25 } })
  })

  it("TLN-21: ширина блока 80, длина чаши 60, ширина чаши 30", () => {
    expect(apply(toilet(), "blockWidth", 80)).toMatchObject({ widthCm: 80, lengthCm: 72 })
    expect(apply(toilet(), "bowlLength", 60)).toMatchObject({ widthCm: 70, lengthCm: 80 })
    expect(apply(toilet(), "bowlWidth", 30)).toMatchObject({ toilet: { ...DEFAULT, bowlWidthCm: 30 } })
  })

  it("TLN-22: недопустимые значения — шире блока, ноль, отрицательное, число без изменения — не применяются", () => {
    expect(apply(toilet(), "bowlWidth", 80)).toBeNull()
    expect(apply(toilet(), "blockWidth", 30)).toBeNull()
    expect(apply(toilet(), "blockDepth", 0)).toBeNull()
    expect(apply(toilet(), "blockDepth", -5)).toBeNull()
    expect(apply(toilet(), "blockDepth", Number.NaN)).toBeNull()
    expect(apply(toilet(), "blockDepth", 20)).toBeNull()
  })
})
