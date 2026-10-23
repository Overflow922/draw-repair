import { describe, expect, it } from "vitest"
import type { Overlap } from "./overlap"
import { warningText } from "./warning"

// change add-furniture-curtains: плашка пересечений с настоящим каталогом (spec furniture-plan «Каталог видов мебели», сценарий
// «Плашка пересечений называет шторы»); каталог не подменён.

const wall = (itemKind: Overlap["itemKind"]): Overlap => ({ kind: "wall", itemId: "a", itemKind, region: [] })
const pair = (itemKind: Overlap["itemKind"], otherKind: Overlap["itemKind"]): Overlap => ({ kind: "furniture", itemId: "a", itemKind, otherKind, region: [] })

describe("плашка пересечений называет шторы", () => {
  it("WC-01: шторы пересекают стену — «Шторы пересекается: стена»", () => {
    expect(warningText([wall("curtains")])).toBe("Шторы пересекается: стена")
  })

  it("WC-02: двое штор — «Шторы пересекается: шторы»", () => {
    expect(warningText([pair("curtains", "curtains")])).toBe("Шторы пересекается: шторы")
  })

  it("WC-03: шторы пересекают стену и стул — «Мебель пересекается: стена, стул, шторы», слова объектов перед словами видов", () => {
    expect(warningText([pair("curtains", "chair"), wall("curtains")])).toBe("Мебель пересекается: стена, стул, шторы")
    expect(warningText([pair("chair", "curtains"), wall("curtains")])).toBe("Мебель пересекается: стена, стул, шторы")
  })
})
