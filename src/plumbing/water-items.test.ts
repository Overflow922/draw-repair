import { describe, expect, it } from "vitest"
import { FURNITURE_KIND_ORDER } from "../furniture/furniture-kinds"
import type { FurnitureItem } from "../types"
import { isWaterKind, waterItems } from "./water-items"

// change add-plumbing-plan: приборы — предметы «Мебели», подключаемые к воде (spec plumbing-plan «Приборы плана «Сантехника»»,
// сценарий «Какие виды показываются»; design D2)

const item = (id: string, kind: FurnitureItem["kind"]): FurnitureItem => ({ id, kind, x: 0, y: 0, widthCm: 60, lengthCm: 60, angleDeg: 0 })

describe("приборы", () => {
  it("WI-01: приборы — ровно «Раковина», «Посудомойка», «Стиральная машина»", () => {
    expect(FURNITURE_KIND_ORDER.filter(isWaterKind)).toEqual(["dishwasher", "sink", "washer"])
  })

  it("WI-02: сушильная машина, варочная панель и холодильник — не приборы", () => {
    for (const k of ["dryer", "hob", "fridge", "kitchenCabinet", "table"] as const) expect(isWaterKind(k)).toBe(false)
  })

  it("WI-03: из предметов «Мебели» остаются только приборы, в прежнем порядке и с теми же данными", () => {
    const items = [item("s", "sink"), item("k", "kitchenCabinet"), item("w", "washer"), item("d", "dryer"), item("m", "dishwasher"), item("h", "hob")]
    expect(waterItems(items)).toEqual([item("s", "sink"), item("w", "washer"), item("m", "dishwasher")])
  })
})
