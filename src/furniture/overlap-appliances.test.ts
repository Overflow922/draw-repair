import { describe, expect, it } from "vitest"
import type { FurnitureItem } from "../types"
import type { FurnitureKind } from "./furniture-kinds"
import { furnitureOverlaps, itemOverlaps } from "./overlap"
import { warningText } from "./warning"

// change add-furniture-appliances: встраиваемая техника в кухонной колонне, в кухонном шкафу и друг на друге (spec furniture-plan
// «Пересечения стола», сценарии «Техника в кухонной колонне», «Духовой шкаф и стиральная машина — встроенные», «Сушильная машина на
// стиральной», «Сушильная машина над встроенной стиральной», «Микроволновка вне колонны», «Встроенная техника одного уровня»,
// «Кухонная колонна на другом предмете»). Все предметы с центром (100, 100) налагаются друг на друга.

const item = (id: string, kind: FurnitureKind, x: number, y: number, widthCm: number, lengthCm: number): FurnitureItem => ({ id, kind, x, y, widthCm, lengthCm, angleDeg: 0 })
const at = (id: string, kind: FurnitureKind): FurnitureItem => item(id, kind, 100, 100, 40, 30)
const plaque = (items: FurnitureItem[]): string | null => warningText(furnitureOverlaps(items, []))

// таблица пар design: наложение — обычная расстановка; все остальные пары из этих десяти видов — пересечение
const EXEMPT: readonly (readonly [FurnitureKind, FurnitureKind])[] = [
  // объекты кухни (change add-furniture-kitchen-objects)
  ["wineCabinet", "kitchenCabinet"],
  ["dishwasher", "kitchenCabinet"],
  ["hob", "kitchenCabinet"],
  ["sink", "kitchenCabinet"],
  ["hob", "wineCabinet"],
  ["hob", "dishwasher"],
  ["sink", "wineCabinet"],
  ["sink", "dishwasher"],
  // встраиваемая техника
  ["oven", "kitchenColumn"],
  ["microwave", "kitchenColumn"],
  ["oven", "microwave"],
  ["oven", "kitchenCabinet"],
  ["washer", "kitchenCabinet"],
  ["hob", "oven"],
  ["sink", "oven"],
  ["hob", "washer"],
  ["sink", "washer"],
  ["dryer", "washer"],
]
const KINDS = ["kitchenCabinet", "kitchenColumn", "oven", "microwave", "washer", "dryer", "hob", "sink", "dishwasher", "wineCabinet"] as const
const isExempt = (a: FurnitureKind, b: FurnitureKind): boolean => EXEMPT.some(([x, y]) => (x === a && y === b) || (x === b && y === a))
const PAIRS = KINDS.flatMap((a, i) => KINDS.slice(i).map((b) => [a, b] as const))

describe("встраиваемая техника: исключения пересечений", () => {
  it.each(PAIRS)("OAP-01: %s и %s — пересечение по таблице пар, при любом порядке идентификаторов", (a, b) => {
    const expected = isExempt(a, b) ? 0 : 1
    expect(furnitureOverlaps([at("a", a), at("b", b)], [])).toHaveLength(expected)
    expect(furnitureOverlaps([at("a", b), at("b", a)], [])).toHaveLength(expected)
  })

  it("OAP-02: колонна, духовой шкаф и микроволновка 60×62 на одном месте — пересечений нет, плашки нет", () => {
    const column = item("k", "kitchenColumn", 100, 100, 60, 62)
    const oven = item("o", "oven", 100, 100, 60, 62)
    const microwave = item("m", "microwave", 100, 100, 60, 62)
    expect(furnitureOverlaps([column, oven, microwave], [])).toEqual([])
    expect(furnitureOverlaps([microwave, oven, column], [])).toEqual([])
    expect(plaque([column, oven, microwave])).toBeNull()
  })

  it("OAP-03: духовой шкаф в кухонном шкафу с варочной панелью, стиральная машина в другом шкафу с раковиной — пересечений нет", () => {
    const items = [
      item("k1", "kitchenCabinet", 100, 100, 60, 62),
      item("o", "oven", 100, 100, 60, 62),
      item("h", "hob", 100, 100, 52, 30),
      item("k2", "kitchenCabinet", 160, 100, 60, 62),
      item("w", "washer", 160, 100, 60, 60),
      item("s", "sink", 160, 100, 45, 40),
    ]
    expect(furnitureOverlaps(items, [])).toEqual([])
    expect(furnitureOverlaps([...items].reverse(), [])).toEqual([])
  })

  it("OAP-04: сушильная машина на стиральной 60×60 — пересечений нет", () => {
    expect(furnitureOverlaps([item("w", "washer", 100, 100, 60, 60), item("d", "dryer", 100, 100, 60, 60)], [])).toEqual([])
    expect(furnitureOverlaps([item("d", "dryer", 100, 100, 60, 60), item("w", "washer", 100, 100, 60, 60)], [])).toEqual([])
  })

  it("OAP-05: сушильная машина над стиральной, встроенной в кухонный шкаф, — пересекается только со шкафом", () => {
    const items = [item("k", "kitchenCabinet", 100, 100, 60, 62), item("w", "washer", 100, 100, 60, 60), item("d", "dryer", 100, 100, 60, 60)]
    expect(furnitureOverlaps(items, []).map((o) => [o.itemKind, o.otherKind].sort())).toEqual([["dryer", "kitchenCabinet"]])
    expect(plaque(items)).toBe("Мебель пересекается: кухонный шкаф, сушильная машина")
  })

  it("OAP-06: микроволновка на кухонном шкафу — пересечение", () => {
    const items = [item("k", "kitchenCabinet", 100, 100, 60, 62), item("m", "microwave", 100, 100, 60, 62)]
    expect(furnitureOverlaps(items, [])).toHaveLength(1)
    expect(plaque(items)).toBe("Мебель пересекается: кухонный шкаф, микроволновка")
  })

  it("OAP-07: варочная панель над микроволновкой в колонне — пересекает микроволновку и колонну, микроволновка с колонной — нет", () => {
    const items = [item("k", "kitchenColumn", 100, 100, 60, 62), item("m", "microwave", 100, 100, 60, 62), item("h", "hob", 100, 100, 52, 30)]
    expect(furnitureOverlaps(items, []).map((o) => [o.itemKind, o.otherKind].sort())).toEqual([
      ["hob", "kitchenColumn"],
      ["hob", "microwave"],
    ])
    expect(plaque(items)).toBe("Мебель пересекается: варочная панель, кухонная колонна, микроволновка")
  })

  it("OAP-08: встроенная техника одного уровня — пересечение, плашка называет виды в порядке каталога", () => {
    expect(plaque([at("a", "oven"), at("b", "washer")])).toBe("Мебель пересекается: духовой шкаф, стиральная машина")
    expect(plaque([at("a", "oven"), at("b", "dishwasher")])).toBe("Мебель пересекается: посудомойка, духовой шкаф")
    expect(plaque([at("a", "oven"), at("b", "oven")])).toBe("Духовой шкаф пересекается: духовой шкаф")
    expect(plaque([at("a", "washer"), at("b", "washer")])).toBe("Стиральная машина пересекается: стиральная машина")
    const twoMicrowaves = [item("k", "kitchenColumn", 100, 100, 60, 62), item("m1", "microwave", 100, 100, 60, 62), item("m2", "microwave", 100, 100, 60, 62)]
    expect(furnitureOverlaps(twoMicrowaves, []).map((o) => [o.itemKind, o.otherKind])).toEqual([["microwave", "microwave"]])
    expect(plaque(twoMicrowaves)).toBe("Микроволновка пересекается: микроволновка")
  })

  it("OAP-09: кухонная колонна на кухонном шкафу, стиральной машине и другой колонне — пересечение", () => {
    expect(plaque([at("a", "kitchenColumn"), at("b", "kitchenCabinet")])).toBe("Мебель пересекается: кухонный шкаф, кухонная колонна")
    expect(plaque([at("a", "kitchenColumn"), at("b", "washer")])).toBe("Мебель пересекается: кухонная колонна, стиральная машина")
    expect(plaque([at("a", "kitchenColumn"), at("b", "kitchenColumn")])).toBe("Кухонная колонна пересекается: кухонная колонна")
  })

  it("OAP-10: призрак духового шкафа над колонной с микроволновкой пересечений не даёт, призрак стиральной машины — даёт", () => {
    const column = [item("k", "kitchenColumn", 100, 100, 60, 62), item("m", "microwave", 100, 100, 60, 62)]
    expect(itemOverlaps(item("ghost", "oven", 100, 100, 60, 62), [], column)).toEqual([])
    expect(itemOverlaps(item("ghost", "washer", 100, 100, 60, 60), [], column)).toHaveLength(2)
  })
})
