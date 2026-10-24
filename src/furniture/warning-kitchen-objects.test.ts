import { describe, expect, it } from "vitest"
import type { Overlap } from "./overlap"
import { warningText } from "./warning"

// change add-furniture-kitchen-objects: плашка пересечений с настоящим каталогом (spec furniture-plan «Каталог видов мебели», сценарий
// «Плашка пересечений называет объекты кухни»; «Пересечения стола», сценарий «Объекты кухни одного уровня»); каталог не подменён.

const wall = (itemKind: Overlap["itemKind"]): Overlap => ({ kind: "wall", itemId: "a", itemKind, region: [] })
const pair = (itemKind: Overlap["itemKind"], otherKind: Overlap["itemKind"]): Overlap => ({ kind: "furniture", itemId: "a", itemKind, otherKind, region: [] })

describe("плашка пересечений называет объекты кухни", () => {
  it("WKO-01: винный шкаф пересекает стену и холодильник — виды в порядке каталога", () => {
    expect(warningText([pair("wineCabinet", "fridge"), wall("wineCabinet")])).toBe("Мебель пересекается: стена, холодильник двустворчатый, винный шкаф")
  })

  it("WKO-02: объект кухни на стене — название вида", () => {
    expect(warningText([wall("sink")])).toBe("Раковина пересекается: стена")
    expect(warningText([wall("hob")])).toBe("Варочная панель пересекается: стена")
    expect(warningText([wall("dishwasher")])).toBe("Посудомойка пересекается: стена")
    expect(warningText([wall("wineCabinet")])).toBe("Винный шкаф пересекается: стена")
  })

  it("WKO-03: объекты кухни одного уровня", () => {
    expect(warningText([pair("sink", "hob")])).toBe("Мебель пересекается: варочная панель, раковина")
    expect(warningText([pair("sink", "sink")])).toBe("Раковина пересекается: раковина")
    expect(warningText([pair("dishwasher", "wineCabinet")])).toBe("Мебель пересекается: винный шкаф, посудомойка")
    expect(warningText([pair("dishwasher", "dishwasher")])).toBe("Посудомойка пересекается: посудомойка")
  })
})
