import { describe, expect, it } from "vitest"
import type { Overlap } from "./overlap"
import { warningText } from "./warning"

// change add-furniture-sofa: плашка пересечений с настоящим каталогом (spec furniture-plan «Каталог видов мебели», сценарий
// «Плашка пересечений называет диван»); в отличие от warning-kinds.test.ts каталог не подменён.

const wall = (itemKind: Overlap["itemKind"]): Overlap => ({ kind: "wall", itemId: "a", itemKind, region: [] })
const pair = (itemKind: Overlap["itemKind"], otherKind: Overlap["itemKind"]): Overlap => ({ kind: "furniture", itemId: "a", itemKind, otherKind, region: [] })

describe("плашка пересечений называет диван", () => {
  it("SW-01: диван пересекает стену — «Диван пересекается: стена»", () => {
    expect(warningText([wall("sofa")])).toBe("Диван пересекается: стена")
  })

  it("SW-02: два дивана — «Диван пересекается: диван»", () => {
    expect(warningText([pair("sofa", "sofa")])).toBe("Диван пересекается: диван")
  })

  it("SW-03: диван и стул — «Мебель пересекается: стул, диван» в порядке каталога независимо от порядка предметов", () => {
    expect(warningText([pair("sofa", "chair")])).toBe("Мебель пересекается: стул, диван")
    expect(warningText([pair("chair", "sofa")])).toBe("Мебель пересекается: стул, диван")
  })

  it("SW-04: диван пересекает стену и стул — слова объектов идут перед словами видов", () => {
    expect(warningText([pair("sofa", "chair"), wall("sofa")])).toBe("Мебель пересекается: стена, стул, диван")
  })
})
