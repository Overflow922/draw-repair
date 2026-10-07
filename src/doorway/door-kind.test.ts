import { describe, expect, it } from "vitest"
import { acceptField, elementDefaults } from "./element-kind"

// change add-door: параметры инструмента «Дверь» (spec door «Инструмент «Дверь»»; design D4). Круг поворота
// снят в change popups-buttons-only: направление задаётся зонами (spec door «Направление выделенной двери»).

describe("значения по умолчанию двери", () => {
  it("DK-01: дверь 900 / 2100 мм, петли у a, открывание left; проём и окно — прежние", () => {
    expect(elementDefaults("door")).toEqual({ widthCm: 90, heightCm: 210, hinge: "a", swing: "left" })
    expect(elementDefaults("doorway")).toEqual({ widthCm: 90, heightCm: 210 })
    expect(elementDefaults("window")).toEqual({ widthCm: 120, heightCm: 150, sillCm: 85 })
  })

  it("DK-01b: значения по умолчанию — новый объект на каждый вызов (правка не протекает)", () => {
    const first = elementDefaults("door")
    first.widthCm = 1
    expect(elementDefaults("door").widthCm).toBe(90)
  })
})

describe("допустимость полей двери", () => {
  it("DK-02: ширина и высота — положительные конечные числа", () => {
    for (const field of ["width", "height"] as const) {
      expect(acceptField("door", field, 1)).toBe(true)
      expect(acceptField("door", field, 0.5)).toBe(true)
      expect(acceptField("door", field, 0)).toBe(false)
      expect(acceptField("door", field, -1)).toBe(false)
      expect(acceptField("door", field, Number.NaN)).toBe(false)
      expect(acceptField("door", field, Number.POSITIVE_INFINITY)).toBe(false)
    }
  })

  it("DK-02b: у двери нет поля подоконника", () => {
    expect(acceptField("door", "sill", 0)).toBe(false)
    expect(acceptField("door", "sill", 85)).toBe(false)
  })
})
