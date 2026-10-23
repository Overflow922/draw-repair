import { describe, expect, it } from "vitest"
import { FURNITURE_KINDS, FURNITURE_KIND_ORDER, isFurnitureKind, kindEntry } from "./furniture-kinds"

// change furniture-items-catalog: каталог видов мебели (spec furniture-plan «Каталог видов мебели»). Проверки идут по всем
// видам каталога: новый вид получает их без новых тестов.

describe("каталог видов мебели", () => {
  // TCR (change add-furniture-chair): в каталоге новый вид
  it("FIK-01: в каталоге «Стол» (80 × 160), «Стул» (45 × 45) и «Диван» (200 × 90), угол 0", () => {
    // TCR (change add-furniture-sofa): в каталоге новый вид
    // TCR (change add-furniture-desk-office-chair): в каталоге новые виды
    expect(FURNITURE_KIND_ORDER).toEqual(["table", "chair", "sofa", "desk", "officeChair"])
    expect(kindEntry("desk").label).toBe("Письменный стол")
    expect(kindEntry("desk").defaults).toEqual({ widthCm: 100, lengthCm: 50, angleDeg: 0 })
    expect(kindEntry("officeChair").label).toBe("Компьютерное кресло")
    expect(kindEntry("officeChair").defaults).toEqual({ widthCm: 60, lengthCm: 60, angleDeg: 0 })
    expect(kindEntry("table").label).toBe("Стол")
    expect(kindEntry("table").defaults).toEqual({ widthCm: 80, lengthCm: 160, angleDeg: 0 })
    expect(kindEntry("chair").label).toBe("Стул")
    expect(kindEntry("chair").defaults).toEqual({ widthCm: 45, lengthCm: 45, angleDeg: 0 })
    expect(kindEntry("sofa").label).toBe("Диван")
    expect(kindEntry("sofa").defaults).toEqual({ widthCm: 200, lengthCm: 90, angleDeg: 0 })
  })

  it("FIK-02: порядок видов совпадает с порядком записей каталога", () => {
    expect([...FURNITURE_KIND_ORDER]).toEqual(Object.keys(FURNITURE_KINDS))
  })

  it("FIK-03: isFurnitureKind принимает только виды каталога", () => {
    expect(isFurnitureKind("table")).toBe(true)
    // TCR (change add-furniture-chair): «chair» теперь вид каталога, в примере не-вида — «sofa»
    // TCR (change add-furniture-sofa): «sofa» теперь вид каталога, в примере не-вида — «wardrobe»
    for (const x of ["", "wardrobe", "toString", undefined, 1, null]) expect(isFurnitureKind(x), String(x)).toBe(false)
  })

  describe.each(FURNITURE_KIND_ORDER)("вид %s", (kind) => {
    const e = kindEntry(kind)

    it("FIK-10: название, слово плашки и иконка заданы", () => {
      expect(e.label.length).toBeGreaterThan(0)
      expect(e.plaqueWord.length).toBeGreaterThan(0)
      expect(e.icon).toContain("<")
    })

    it("FIK-11: размеры по умолчанию положительны, угол в [0, 360)", () => {
      expect(e.defaults.widthCm).toBeGreaterThan(0)
      expect(e.defaults.lengthCm).toBeGreaterThan(0)
      expect(e.defaults.angleDeg).toBeGreaterThanOrEqual(0)
      expect(e.defaults.angleDeg).toBeLessThan(360)
    })

    // change furniture-line-drawings: вместо цвета у вида рисунок (spec furniture-plan «Каталог видов мебели»)
    it("FIK-12: рисунок вида — линии целиком внутри прямоугольника размеров по умолчанию", () => {
      const { widthCm, lengthCm } = e.defaults
      const d = e.drawing({ widthCm, lengthCm })
      expect(d.lines.length).toBeGreaterThan(0)
      expect(d.outline.length).toBeGreaterThan(2)
      for (const p of d.lines.flat()) {
        expect(p.x).toBeGreaterThanOrEqual(-1e-9)
        expect(p.x).toBeLessThanOrEqual(widthCm + 1e-9)
        expect(p.y).toBeGreaterThanOrEqual(-1e-9)
        expect(p.y).toBeLessThanOrEqual(lengthCm + 1e-9)
      }
    })

    it("FIK-13: рисунок отличается от рисунков других видов по форме, при тех же размерах", () => {
      const same = { widthCm: 60, lengthCm: 60 }
      const own = JSON.stringify(e.drawing(same))
      for (const other of FURNITURE_KIND_ORDER.filter((k) => k !== kind)) expect(JSON.stringify(kindEntry(other).drawing(same))).not.toBe(own)
    })
  })
})
