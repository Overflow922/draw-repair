import { describe, expect, it } from "vitest"
import type { Overlap } from "./overlap"
import { warningText } from "./warning"

// change add-furniture-tropical-shower: плашка пересечений с настоящим каталогом (spec furniture-plan «Каталог видов мебели», сценарий
// «Плашка пересечений называет тропический душ»); каталог не подменён.

const wall = (itemKind: Overlap["itemKind"]): Overlap => ({ kind: "wall", itemId: "a", itemKind, region: [] })
const pair = (itemKind: Overlap["itemKind"], otherKind: Overlap["itemKind"]): Overlap => ({ kind: "furniture", itemId: "a", itemKind, otherKind, region: [] })

describe("плашка пересечений называет тропический душ", () => {
  it("WTS-01: душ пересекает только стену — «Тропический душ пересекается: стена»", () => {
    expect(warningText([wall("tropicalShower")])).toBe("Тропический душ пересекается: стена")
  })

  it("WTS-02: душ пересекает стену и стул — «Мебель пересекается: стена, стул, тропический душ»", () => {
    expect(warningText([pair("tropicalShower", "chair"), wall("tropicalShower")])).toBe("Мебель пересекается: стена, стул, тропический душ")
  })
})
