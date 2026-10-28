import { describe, expect, it } from "vitest"
import { FURNITURE_KIND_ORDER, kindEntry } from "./furniture-kinds"
import type { Overlap } from "./overlap"
import { warningText } from "./warning"

// change add-wall-shower-drain: плашка пересечений с настоящим каталогом (spec furniture-plan «Каталог видов мебели», сценарии «Размеры
// трапа в стену по умолчанию», «Плашка пересечений называет трап в стену»); каталог не подменён.

const hit = (kind: Overlap["kind"], itemKind: Overlap["itemKind"]): Overlap => ({ kind, itemId: "a", itemKind, region: [] })
const pair = (itemKind: Overlap["itemKind"], otherKind: Overlap["itemKind"]): Overlap => ({ kind: "furniture", itemId: "a", itemKind, otherKind, region: [] })

describe("каталог: трап в стену", () => {
  it("WWD-01: двадцать шестой вид — «Трап в стену» 70 × 8, угол 0", () => {
    // TCR (change add-washbasin): после «Трапа в стену» в каталоге идёт «Умывальник», видов двадцать семь
    expect(FURNITURE_KIND_ORDER).toHaveLength(27)
    expect(FURNITURE_KIND_ORDER.at(-2)).toBe("wallShowerDrain")
    expect(kindEntry("wallShowerDrain").defaults).toEqual({ widthCm: 70, lengthCm: 8, angleDeg: 0 })
  })
})

describe("плашка пересечений называет трап в стену", () => {
  it("WWD-02: трап пересекает только окно — «Трап в стену пересекается: окно»", () => {
    expect(warningText([hit("window", "wallShowerDrain")])).toBe("Трап в стену пересекается: окно")
  })

  it("WWD-03: трап пересекает окно и стул — «Мебель пересекается: окно, стул, трап в стену»", () => {
    expect(warningText([pair("wallShowerDrain", "chair"), hit("window", "wallShowerDrain")])).toBe("Мебель пересекается: окно, стул, трап в стену")
  })
})
