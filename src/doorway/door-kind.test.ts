import { describe, expect, it } from "vitest"
import { acceptField, elementDefaults, nextDirection } from "./element-kind"

// change add-door: параметры инструмента «Дверь» и круг поворота
// (spec door «Инструмент «Дверь»», «Поворот двери»; design D4).

interface Dir {
  hinge: "a" | "b"
  swing: "left" | "right"
}

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

describe("круг поворота", () => {
  it("DK-03: a/left → b/left → b/right → a/right → a/left", () => {
    const seq: Dir[] = [{ hinge: "a", swing: "left" }]
    for (let i = 0; i < 4; i++) seq.push(nextDirection(seq[i]))
    expect(seq).toEqual([
      { hinge: "a", swing: "left" },
      { hinge: "b", swing: "left" },
      { hinge: "b", swing: "right" },
      { hinge: "a", swing: "right" },
      { hinge: "a", swing: "left" },
    ])
  })

  it("DK-03b: из любого направления четыре поворота возвращают его, промежуточные различны", () => {
    for (const hinge of ["a", "b"] as const)
      for (const swing of ["left", "right"] as const) {
        const seen = new Set<string>()
        let d: Dir = { hinge, swing }
        for (let i = 0; i < 4; i++) {
          seen.add(`${d.hinge}/${d.swing}`)
          d = nextDirection(d)
        }
        expect(seen.size).toBe(4)
        expect(d).toEqual({ hinge, swing })
      }
  })

  it("DK-03c: поворот не мутирует вход", () => {
    const d = { hinge: "a", swing: "left" } as const
    const copy = { ...d }
    nextDirection(d)
    expect(d).toEqual(copy)
  })
})
