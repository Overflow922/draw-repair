import { describe, expect, it } from "vitest"
import type { Overlap } from "./overlap"
import { warningText } from "./warning"

// change add-furniture-bed-nightstand: плашка пересечений с настоящим каталогом (spec furniture-plan «Каталог видов мебели», сценарий
// «Плашка пересечений называет кровать и прикроватный столик»); каталог не подменён.

const wall = (itemKind: Overlap["itemKind"]): Overlap => ({ kind: "wall", itemId: "a", itemKind, region: [] })
const pair = (itemKind: Overlap["itemKind"], otherKind: Overlap["itemKind"]): Overlap => ({ kind: "furniture", itemId: "a", itemKind, otherKind, region: [] })

describe("плашка пересечений называет кровать и прикроватный столик", () => {
  it("BN-01: кровать пересекает стену — «Кровать пересекается: стена»", () => {
    expect(warningText([wall("bed")])).toBe("Кровать пересекается: стена")
  })

  it("BN-02: прикроватный столик пересекает стену — «Прикроватный столик пересекается: стена»", () => {
    expect(warningText([wall("nightstand")])).toBe("Прикроватный столик пересекается: стена")
  })

  it("BN-03: две кровати — «Кровать пересекается: кровать»", () => {
    expect(warningText([pair("bed", "bed")])).toBe("Кровать пересекается: кровать")
  })

  it("BN-04: кровать и столик — «Мебель пересекается: кровать, прикроватный столик» в порядке каталога независимо от порядка предметов", () => {
    expect(warningText([pair("bed", "nightstand")])).toBe("Мебель пересекается: кровать, прикроватный столик")
    expect(warningText([pair("nightstand", "bed")])).toBe("Мебель пересекается: кровать, прикроватный столик")
  })

  it("BN-05: кровать пересекает стену и столик — слова объектов идут перед словами видов", () => {
    expect(warningText([pair("bed", "nightstand"), wall("bed")])).toBe("Мебель пересекается: стена, кровать, прикроватный столик")
  })
})
