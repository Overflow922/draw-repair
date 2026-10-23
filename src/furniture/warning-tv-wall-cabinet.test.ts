import { describe, expect, it } from "vitest"
import type { Overlap } from "./overlap"
import { warningText } from "./warning"

// change add-furniture-tv-wall-cabinet: плашка пересечений с настоящим каталогом (spec furniture-plan «Каталог видов мебели»,
// сценарий «Плашка пересечений называет телевизор и подвесную тумбу»); каталог не подменён.

const wall = (itemKind: Overlap["itemKind"]): Overlap => ({ kind: "wall", itemId: "a", itemKind, region: [] })
const pair = (itemKind: Overlap["itemKind"], otherKind: Overlap["itemKind"]): Overlap => ({ kind: "furniture", itemId: "a", itemKind, otherKind, region: [] })

describe("плашка пересечений называет телевизор и подвесную тумбу", () => {
  it("TW-01: телевизор пересекает стену — «Телевизор пересекается: стена»", () => {
    expect(warningText([wall("tv")])).toBe("Телевизор пересекается: стена")
  })

  it("TW-02: подвесная тумба пересекает стену — «Подвесная тумба пересекается: стена»", () => {
    expect(warningText([wall("wallCabinet")])).toBe("Подвесная тумба пересекается: стена")
  })

  it("TW-03: два телевизора — «Телевизор пересекается: телевизор»", () => {
    expect(warningText([pair("tv", "tv")])).toBe("Телевизор пересекается: телевизор")
  })

  it("TW-04: телевизор и подвесная тумба — «Мебель пересекается: телевизор, подвесная тумба» в порядке каталога независимо от порядка предметов", () => {
    expect(warningText([pair("tv", "wallCabinet")])).toBe("Мебель пересекается: телевизор, подвесная тумба")
    expect(warningText([pair("wallCabinet", "tv")])).toBe("Мебель пересекается: телевизор, подвесная тумба")
  })

  it("TW-05: телевизор пересекает стену и подвесную тумбу — слова объектов идут перед словами видов", () => {
    expect(warningText([pair("tv", "wallCabinet"), wall("tv")])).toBe("Мебель пересекается: стена, телевизор, подвесная тумба")
  })
})
