import { describe, expect, it } from "vitest"
import type { ExhaustFan, LightFixture, LightLine } from "../types"
import { isLineName, lineLabel, lineNumber, parseLineName, visibleLines } from "./light-lines"

// change line-dropdown (spec light-lines «Линия освещения и метка», exhaust-fan «Вытяжка»): светильники и вытяжки не разделяются,
// у вытяжки то же имя L<n>; метка LV<n> из чертежа, созданного раньше, показывается как есть

const spot: LightFixture = { id: "s", kind: "spot", x: 0, y: 0 }
const fan: ExhaustFan = { id: "f", x: 10, y: 20 }

describe("имя линии вытяжки — то же L<n>, что у светильника", () => {
  it.each(["3", "L3", "l3", " l3 "])("«%s» → L3", (text) => {
    expect(parseLineName(text)).toBe("L3")
  })
  it.each(["LV3", "lv3", "0", "L0", "abc", "", "L2.5"])("«%s» не принимается", (text) => {
    expect(parseLineName(text)).toBeNull()
  })
  it("каноническое имя и число; LV из старого чертежа читается", () => {
    expect(lineLabel(2)).toBe("L2")
    expect(lineNumber("LV12")).toBe(12)
    expect(lineNumber("L7")).toBe(7)
    expect(isLineName("LV1")).toBe(true)
    expect(isLineName("LL1")).toBe(false)
    expect(isLineName("LV0")).toBe(false)
  })
})

describe("visibleLines с вытяжками", () => {
  const line = (id: string, targetId: string, name: string): LightLine => ({ id, targetId, name })
  it("метка L<n> вытяжки показывается у вытяжки", () => {
    const v = visibleLines([line("a", "f", "L1")], [spot], [fan])
    expect(v.map((x) => x.line.id)).toEqual(["a"])
    expect(v[0]?.light).toBe(fan)
  })
  it("метка LV<n> вытяжки из старого чертежа показывается", () => {
    expect(visibleLines([line("a", "f", "LV1")], [spot], [fan]).map((x) => x.line.id)).toEqual(["a"])
  })
  it("метка LV<n> светильника не показывается", () => {
    expect(visibleLines([line("a", "s", "LV1")], [spot], [fan])).toEqual([])
  })
  it("метка удалённой вытяжки не показывается", () => {
    expect(visibleLines([line("a", "f", "L1")], [spot], [])).toEqual([])
  })
  it("метка следует за вытяжкой", () => {
    const moved: ExhaustFan = { id: "f", x: 50, y: 60 }
    expect(visibleLines([line("a", "f", "L1")], [], [moved])[0]?.light).toMatchObject({ x: 50, y: 60 })
  })
})
