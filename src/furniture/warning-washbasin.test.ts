import { describe, expect, it } from "vitest"
import { FURNITURE_KIND_ORDER, kindEntry } from "./furniture-kinds"
import type { Overlap } from "./overlap"
import { warningText } from "./warning"

// change add-washbasin: плашка пересечений с настоящим каталогом (spec furniture-plan «Каталог видов мебели», сценарии «Размеры умывальника
// по умолчанию», «Плашка пересечений называет умывальник»); каталог не подменён.

const hit = (kind: Overlap["kind"], itemKind: Overlap["itemKind"]): Overlap => ({ kind, itemId: "a", itemKind, region: [] })
const pair = (itemKind: Overlap["itemKind"], otherKind: Overlap["itemKind"]): Overlap => ({ kind: "furniture", itemId: "a", itemKind, otherKind, region: [] })

describe("каталог: умывальник", () => {
  it("WWB-01: двадцать седьмой и последний вид — «Умывальник» 60 × 48, угол 0; «Раковина» остаётся 45 × 40", () => {
    expect(FURNITURE_KIND_ORDER).toHaveLength(27)
    expect(FURNITURE_KIND_ORDER.at(-1)).toBe("washbasin")
    expect(kindEntry("washbasin").defaults).toEqual({ widthCm: 60, lengthCm: 48, angleDeg: 0 })
    expect(kindEntry("sink").defaults).toEqual({ widthCm: 45, lengthCm: 40, angleDeg: 0 })
  })
})

describe("плашка пересечений называет умывальник", () => {
  it("WWB-02: умывальник пересекает только стену — «Умывальник пересекается: стена»", () => {
    expect(warningText([hit("wall", "washbasin")])).toBe("Умывальник пересекается: стена")
  })

  it("WWB-03: умывальник пересекает стену и стул — «Мебель пересекается: стена, стул, умывальник»", () => {
    expect(warningText([hit("wall", "washbasin"), pair("washbasin", "chair")])).toBe("Мебель пересекается: стена, стул, умывальник")
  })
})
