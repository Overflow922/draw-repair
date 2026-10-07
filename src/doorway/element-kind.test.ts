import { describe, expect, it } from "vitest"
import { acceptField, elementDefaults } from "./element-kind"

// change add-window: конфигурация инструмента по виду элемента — значения по умолчанию
// и допустимость значений полей (spec window «Инструмент «Окно»»; doorway «Инструмент «Проём»»; design D4).

describe("значения по умолчанию", () => {
  it("WT-01: окно 1200 / 1500 / 850 мм, проём 900 / 2100 мм (в см)", () => {
    expect(elementDefaults("window")).toEqual({ widthCm: 120, heightCm: 150, sillCm: 85 })
    expect(elementDefaults("doorway")).toEqual({ widthCm: 90, heightCm: 210 })
  })
})

describe("допустимость значений полей", () => {
  it("WT-02: подоконник — неотрицательное конечное число", () => {
    expect(acceptField("window", "sill", 0)).toBe(true)
    expect(acceptField("window", "sill", 85)).toBe(true)
    expect(acceptField("window", "sill", 1e5)).toBe(true)
    expect(acceptField("window", "sill", -0.01)).toBe(false)
    expect(acceptField("window", "sill", -10)).toBe(false)
    expect(acceptField("window", "sill", Number.NaN)).toBe(false)
    expect(acceptField("window", "sill", Number.POSITIVE_INFINITY)).toBe(false)
  })

  it("WT-02c: у проёма нет поля подоконника — любое значение не принимается", () => {
    expect(acceptField("doorway", "sill", 0)).toBe(false)
    expect(acceptField("doorway", "sill", 85)).toBe(false)
  })

  it("WT-02b: ширина и высота — положительные конечные числа у обоих видов", () => {
    for (const kind of ["window", "doorway"] as const)
      for (const field of ["width", "height"] as const) {
        expect(acceptField(kind, field, 1)).toBe(true)
        expect(acceptField(kind, field, 0.5)).toBe(true)
        expect(acceptField(kind, field, 0)).toBe(false)
        expect(acceptField(kind, field, -1)).toBe(false)
        expect(acceptField(kind, field, Number.NaN)).toBe(false)
        expect(acceptField(kind, field, Number.POSITIVE_INFINITY)).toBe(false)
      }
  })
})
