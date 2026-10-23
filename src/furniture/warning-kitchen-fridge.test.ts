import { describe, expect, it } from "vitest"
import type { Overlap } from "./overlap"
import { warningText } from "./warning"

// change add-furniture-kitchen-cabinet-fridge: плашка пересечений с настоящим каталогом (spec furniture-plan «Каталог видов мебели», сценарий
// «Плашка пересечений называет новые виды»); каталог не подменён.

const wall = (itemKind: Overlap["itemKind"]): Overlap => ({ kind: "wall", itemId: "a", itemKind, region: [] })
const pair = (itemKind: Overlap["itemKind"], otherKind: Overlap["itemKind"]): Overlap => ({ kind: "furniture", itemId: "a", itemKind, otherKind, region: [] })

describe("плашка пересечений называет кухонный шкаф и холодильник", () => {
  it("WK-01: шкаф пересекает стену и холодильник — «Мебель пересекается: стена, кухонный шкаф, холодильник двустворчатый»", () => {
    expect(warningText([pair("kitchenCabinet", "fridge"), wall("kitchenCabinet")])).toBe("Мебель пересекается: стена, кухонный шкаф, холодильник двустворчатый")
  })

  it("WK-02: два шкафа — «Кухонный шкаф пересекается: кухонный шкаф»", () => {
    expect(warningText([pair("kitchenCabinet", "kitchenCabinet")])).toBe("Кухонный шкаф пересекается: кухонный шкаф")
  })

  it("WK-03: холодильник пересекает стену — «Холодильник двустворчатый пересекается: стена»", () => {
    expect(warningText([wall("fridge")])).toBe("Холодильник двустворчатый пересекается: стена")
  })
})
