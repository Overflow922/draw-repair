import { describe, expect, it } from "vitest"
import type { FurnitureItem } from "../types"
import type { FurnitureKind } from "./furniture-kinds"
import { furnitureOverlaps, itemOverlaps } from "./overlap"

// change add-furniture-kitchen-objects: объекты кухни в кухонном шкафу и на нём, врезные над встроенными (spec furniture-plan
// «Пересечения стола», сценарии «Объект кухни в кухонном шкафу и на нём», «Врезной объект над встроенным», «Объекты кухни одного
// уровня», «Объект кухни на другом предмете»). Все предметы с центром (100, 100) налагаются друг на друга.

const item = (id: string, kind: FurnitureKind, x: number, y: number, widthCm: number, lengthCm: number): FurnitureItem => ({ id, kind, x, y, widthCm, lengthCm, angleDeg: 0 })
const at = (id: string, kind: FurnitureKind): FurnitureItem => item(id, kind, 100, 100, 40, 30)

// пары, наложение которых — обычная расстановка; все остальные пары из этих пяти видов — пересечение
const EXEMPT: readonly (readonly [FurnitureKind, FurnitureKind])[] = [
  ["wineCabinet", "kitchenCabinet"],
  ["dishwasher", "kitchenCabinet"],
  ["hob", "kitchenCabinet"],
  ["sink", "kitchenCabinet"],
  ["hob", "wineCabinet"],
  ["hob", "dishwasher"],
  ["sink", "wineCabinet"],
  ["sink", "dishwasher"],
]
const KINDS = ["kitchenCabinet", "wineCabinet", "hob", "dishwasher", "sink"] as const
const isExempt = (a: FurnitureKind, b: FurnitureKind): boolean => EXEMPT.some(([x, y]) => (x === a && y === b) || (x === b && y === a))
const PAIRS = KINDS.flatMap((a, i) => KINDS.slice(i).map((b) => [a, b] as const))

describe("объекты кухни: исключения пересечений", () => {
  it.each(PAIRS)("OKO-01: %s и %s — пересечение по таблице пар, при любом порядке идентификаторов", (a, b) => {
    const expected = isExempt(a, b) ? 0 : 1
    expect(furnitureOverlaps([at("a", a), at("b", b)], [])).toHaveLength(expected)
    expect(furnitureOverlaps([at("a", b), at("b", a)], [])).toHaveLength(expected)
  })

  it("OKO-02: кухонный шкаф, посудомойка в нём и варочная панель на нём — пересечений нет", () => {
    const o = furnitureOverlaps([item("k", "kitchenCabinet", 100, 100, 60, 62), item("d", "dishwasher", 100, 100, 60, 62), item("h", "hob", 100, 100, 52, 30)], [])
    expect(o).toEqual([])
  })

  it("OKO-03: раковина на кухонном шкафу и на столе — остаётся только пара со столом", () => {
    // шкаф 60×62 центром (100, 100): x 70–130; раковина 45×40 центром (120, 100): x 97,5–142,5; стол 40×40 центром (155, 100): x 135–175 —
    // налагается на раковину на 7,5, до шкафа не доходит
    const o = furnitureOverlaps([item("k", "kitchenCabinet", 100, 100, 60, 62), item("s", "sink", 120, 100, 45, 40), item("t", "table", 155, 100, 40, 40)], [])
    expect(o.map((x) => [x.itemKind, x.otherKind].sort())).toEqual([["sink", "table"]])
  })

  it.each(["wallCabinet", "fridge", "tv"] as const)("OKO-04: посудомойка на предмете «%s» — пересечение остаётся", (other) => {
    expect(furnitureOverlaps([at("a", "dishwasher"), at("b", other)], [])).toHaveLength(1)
  })

  it("OKO-05: призрак раковины над кухонным шкафом и над посудомойкой пересечений не даёт, над варочной панелью — даёт", () => {
    expect(itemOverlaps(at("ghost", "sink"), [], [at("k", "kitchenCabinet"), at("d", "dishwasher")])).toEqual([])
    expect(itemOverlaps(at("ghost", "sink"), [], [at("h", "hob")])).toHaveLength(1)
  })
})
