import { describe, expect, it } from "vitest"
import type { Overlap } from "./overlap"
import { warningText } from "./warning"

// change add-furniture-appliances: плашка пересечений с настоящим каталогом (spec furniture-plan «Каталог видов мебели», сценарий
// «Плашка пересечений называет встраиваемую технику»); каталог не подменён.

const wall = (itemKind: Overlap["itemKind"]): Overlap => ({ kind: "wall", itemId: "a", itemKind, region: [] })
const pair = (itemKind: Overlap["itemKind"], otherKind: Overlap["itemKind"]): Overlap => ({ kind: "furniture", itemId: "a", itemKind, otherKind, region: [] })

describe("плашка пересечений называет встраиваемую технику", () => {
  it("WAP-01: стиральная машина пересекает стену и холодильник — виды в порядке каталога", () => {
    expect(warningText([pair("washer", "fridge"), wall("washer")])).toBe("Мебель пересекается: стена, холодильник двустворчатый, стиральная машина")
  })

  it("WAP-02: техника на стене — название вида", () => {
    expect(warningText([wall("microwave")])).toBe("Микроволновка пересекается: стена")
    expect(warningText([wall("kitchenColumn")])).toBe("Кухонная колонна пересекается: стена")
    expect(warningText([wall("oven")])).toBe("Духовой шкаф пересекается: стена")
    expect(warningText([wall("dryer")])).toBe("Сушильная машина пересекается: стена")
  })
})
