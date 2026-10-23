import { describe, expect, it } from "vitest"
import type { Overlap } from "./overlap"
import { warningText } from "./warning"

// change add-furniture-desk-office-chair: плашка пересечений с настоящим каталогом (spec furniture-plan «Каталог видов мебели»,
// сценарий «Плашка пересечений называет новые виды»); каталог не подменён.

const wall = (itemKind: Overlap["itemKind"]): Overlap => ({ kind: "wall", itemId: "a", itemKind, region: [] })
const pair = (itemKind: Overlap["itemKind"], otherKind: Overlap["itemKind"]): Overlap => ({ kind: "furniture", itemId: "a", itemKind, otherKind, region: [] })

describe("плашка пересечений называет письменный стол и компьютерное кресло", () => {
  it("DW-01: кресло пересекает стену — «Компьютерное кресло пересекается: стена»", () => {
    expect(warningText([wall("officeChair")])).toBe("Компьютерное кресло пересекается: стена")
  })

  it("DW-02: письменный стол пересекает стену — «Письменный стол пересекается: стена»", () => {
    expect(warningText([wall("desk")])).toBe("Письменный стол пересекается: стена")
  })

  it("DW-03: два письменных стола — «Письменный стол пересекается: письменный стол»", () => {
    expect(warningText([pair("desk", "desk")])).toBe("Письменный стол пересекается: письменный стол")
  })

  it("DW-04: кресло и письменный стол — «Мебель пересекается: письменный стол, компьютерное кресло» в порядке каталога независимо от порядка предметов", () => {
    expect(warningText([pair("officeChair", "desk")])).toBe("Мебель пересекается: письменный стол, компьютерное кресло")
    expect(warningText([pair("desk", "officeChair")])).toBe("Мебель пересекается: письменный стол, компьютерное кресло")
  })

  it("DW-05: кресло пересекает стену и письменный стол — слова объектов идут перед словами видов", () => {
    expect(warningText([pair("officeChair", "desk"), wall("officeChair")])).toBe("Мебель пересекается: стена, письменный стол, компьютерное кресло")
  })
})
