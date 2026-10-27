import { describe, expect, it } from "vitest"
import type { ExhaustFan, LightFixture, LightLine } from "../types"
import { isLineName, lineLabel, lineNumber, parseLineName, visibleLines } from "./light-lines"

const spot: LightFixture = { id: "s", kind: "spot", x: 0, y: 0 }
const fan: ExhaustFan = { id: "f", x: 10, y: 20 }

describe("имя вытяжки с префиксом LV", () => {
  it.each(["3", "LV3", "lv3", " lv3 "])("«%s» для вытяжки → LV3", (text) => {
    expect(parseLineName(text, "LV")).toBe("LV3")
  })
  it.each(["L4", "0", "LV0", "abc", "", "LV2.5"])("«%s» для вытяжки не принимается", (text) => {
    expect(parseLineName(text, "LV")).toBeNull()
  })
  it("ввод LV3 для светильника не принимается", () => {
    expect(parseLineName("LV3")).toBeNull()
  })
  it("каноническое имя и число", () => {
    expect(lineLabel(2, "LV")).toBe("LV2")
    expect(lineNumber("LV12")).toBe(12)
    expect(lineNumber("L7")).toBe(7)
    expect(isLineName("LV1")).toBe(true)
    expect(isLineName("LL1")).toBe(false)
    expect(isLineName("LV0")).toBe(false)
  })
})

describe("visibleLines с вытяжками", () => {
  const line = (id: string, targetId: string, name: string): LightLine => ({ id, targetId, name })
  it("метка вытяжки показывается у вытяжки", () => {
    const v = visibleLines([line("a", "f", "LV1")], [spot], [fan])
    expect(v.map((x) => x.line.id)).toEqual(["a"])
    expect(v[0]?.light).toBe(fan)
  })
  it("метка не по виду носителя скрыта", () => {
    expect(visibleLines([line("a", "s", "LV1"), line("b", "f", "L1")], [spot], [fan])).toEqual([])
  })
  it("метка удалённой вытяжки не показывается", () => {
    expect(visibleLines([line("a", "f", "LV1")], [spot], [])).toEqual([])
  })
  it("метка следует за вытяжкой", () => {
    const moved: ExhaustFan = { id: "f", x: 50, y: 60 }
    expect(visibleLines([line("a", "f", "LV1")], [], [moved])[0]?.light).toMatchObject({ x: 50, y: 60 })
  })
})
