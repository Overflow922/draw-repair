import { describe, expect, it } from "vitest"
import type { Overlap } from "./overlap"
import { warningText } from "./warning"

// change add-furniture-wardrobes: плашка пересечений с настоящим каталогом (spec furniture-plan «Каталог видов мебели», сценарий
// «Плашка пересечений называет шкафы»); каталог не подменён.

const wall = (itemKind: Overlap["itemKind"]): Overlap => ({ kind: "wall", itemId: "a", itemKind, region: [] })
const pair = (itemKind: Overlap["itemKind"], otherKind: Overlap["itemKind"]): Overlap => ({ kind: "furniture", itemId: "a", itemKind, otherKind, region: [] })

describe("плашка пересечений называет шкафы", () => {
  it("WW-01: шкаф-купе пересекает стену — «Шкаф-купе пересекается: стена»", () => {
    expect(warningText([wall("slidingWardrobe")])).toBe("Шкаф-купе пересекается: стена")
  })

  it("WW-02: двустворчатый шкаф пересекает стену — «Шкаф двустворчатый пересекается: стена»", () => {
    expect(warningText([wall("doubleWardrobe")])).toBe("Шкаф двустворчатый пересекается: стена")
  })

  it("WW-03: два шкафа-купе — «Шкаф-купе пересекается: шкаф-купе»", () => {
    expect(warningText([pair("slidingWardrobe", "slidingWardrobe")])).toBe("Шкаф-купе пересекается: шкаф-купе")
  })

  it("WW-04: шкафы разных видов — «Мебель пересекается: шкаф-купе, шкаф двустворчатый» в порядке каталога независимо от порядка предметов", () => {
    expect(warningText([pair("slidingWardrobe", "doubleWardrobe")])).toBe("Мебель пересекается: шкаф-купе, шкаф двустворчатый")
    expect(warningText([pair("doubleWardrobe", "slidingWardrobe")])).toBe("Мебель пересекается: шкаф-купе, шкаф двустворчатый")
  })

  it("WW-05: шкаф-купе пересекает стену и двустворчатый шкаф — слова объектов идут перед словами видов", () => {
    expect(warningText([pair("slidingWardrobe", "doubleWardrobe"), wall("slidingWardrobe")])).toBe("Мебель пересекается: стена, шкаф-купе, шкаф двустворчатый")
  })
})
