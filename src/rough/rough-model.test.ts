import { describe, expect, it } from "vitest"
import { PLASTER_THICKNESS, SCREED_THICKNESS, parseThickness, screedLabel } from "./rough-model"

// change add-rough-works-plan: толщины и подпись стяжки (spec rough-works-plan «Параметры инструментов», «Подпись стяжки и правка на месте»)

describe("толщины", () => {
  it("RW-01: значения по умолчанию — 20 мм штукатурки и 50 мм стяжки", () => {
    expect(PLASTER_THICKNESS.default).toBe(20)
    expect(SCREED_THICKNESS.default).toBe(50)
  })

  it.each([
    ["5", 5],
    ["100", 100],
    ["20", 20],
    [" 30 ", 30],
  ])("RW-02: штукатурка %s мм принимается", (text, mm) => {
    expect(parseThickness(text, PLASTER_THICKNESS)).toBe(mm)
  })

  it.each(["0", "4", "101", "abc", "2,5", "2.5", "", "-5", "1e2", "20мм"])("RW-02: штукатурка «%s» не принимается", (text) => {
    expect(parseThickness(text, PLASTER_THICKNESS)).toBeNull()
  })

  it.each([
    ["10", 10],
    ["200", 200],
    ["65", 65],
  ])("RW-03: стяжка %s мм принимается", (text, mm) => {
    expect(parseThickness(text, SCREED_THICKNESS)).toBe(mm)
  })

  it.each(["5", "9", "201", "abc", "65,5", ""])("RW-03: стяжка «%s» не принимается", (text) => {
    expect(parseThickness(text, SCREED_THICKNESS)).toBeNull()
  })

  it("RW-04: подпись стяжки — «h = 65мм»", () => {
    expect(screedLabel(65)).toBe("h = 65мм")
    expect(screedLabel(100)).toBe("h = 100мм")
  })
})
