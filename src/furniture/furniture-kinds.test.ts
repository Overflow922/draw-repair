import { describe, expect, it } from "vitest"
import { FURNITURE_KINDS, FURNITURE_KIND_ORDER, isFurnitureKind, kindEntry } from "./furniture-kinds"

// change furniture-items-catalog: каталог видов мебели (spec furniture-plan «Каталог видов мебели»). Проверки идут по всем
// видам каталога: новый вид получает их без новых тестов.

describe("каталог видов мебели", () => {
  // TCR (change add-furniture-chair): в каталоге новый вид
  it("FIK-01: в каталоге «Стол» (80 × 160), «Стул» (45 × 45) и «Диван» (200 × 90), угол 0", () => {
    // TCR (change add-furniture-sofa): в каталоге новый вид
    // TCR (change add-furniture-desk-office-chair): в каталоге новые виды
    // TCR (change add-furniture-tv-wall-cabinet): в каталоге новые виды
    // TCR (change add-furniture-bed-nightstand): в каталоге новые виды
    // TCR (change add-furniture-wardrobes): в каталоге новые виды
    // TCR (change add-furniture-curtains): в каталоге новый вид
    // TCR (change add-furniture-kitchen-cabinet-fridge): в каталоге новые виды
    // TCR (change add-furniture-kitchen-objects): в каталоге новые виды
    // TCR (change add-furniture-appliances): в каталоге новые виды
    // TCR (change add-toilet): в каталоге новый вид
    expect(FURNITURE_KIND_ORDER).toEqual(["table", "chair", "sofa", "desk", "officeChair", "tv", "wallCabinet", "bed", "nightstand", "slidingWardrobe", "doubleWardrobe", "curtains", "kitchenCabinet", "fridge", "wineCabinet", "hob", "dishwasher", "sink", "kitchenColumn", "oven", "microwave", "washer", "dryer", "toilet"])
    expect(kindEntry("kitchenColumn").defaults).toEqual({ widthCm: 60, lengthCm: 62, angleDeg: 0 })
    expect(kindEntry("oven").defaults).toEqual({ widthCm: 60, lengthCm: 62, angleDeg: 0 })
    expect(kindEntry("microwave").defaults).toEqual({ widthCm: 60, lengthCm: 62, angleDeg: 0 })
    expect(kindEntry("washer").defaults).toEqual({ widthCm: 60, lengthCm: 60, angleDeg: 0 })
    expect(kindEntry("dryer").defaults).toEqual({ widthCm: 60, lengthCm: 60, angleDeg: 0 })
    expect(kindEntry("wineCabinet").defaults).toEqual({ widthCm: 30, lengthCm: 62, angleDeg: 0 })
    expect(kindEntry("hob").defaults).toEqual({ widthCm: 52, lengthCm: 30, angleDeg: 0 })
    expect(kindEntry("dishwasher").defaults).toEqual({ widthCm: 60, lengthCm: 62, angleDeg: 0 })
    expect(kindEntry("sink").defaults).toEqual({ widthCm: 45, lengthCm: 40, angleDeg: 0 })
    expect(kindEntry("kitchenCabinet").defaults).toEqual({ widthCm: 60, lengthCm: 62, angleDeg: 0 })
    expect(kindEntry("fridge").defaults).toEqual({ widthCm: 100, lengthCm: 90, angleDeg: 0 })
    expect(kindEntry("curtains").label).toBe("Шторы")
    expect(kindEntry("curtains").defaults).toEqual({ widthCm: 300, lengthCm: 13, angleDeg: 0 })
    expect(kindEntry("slidingWardrobe").label).toBe("Шкаф-купе")
    expect(kindEntry("slidingWardrobe").defaults).toEqual({ widthCm: 300, lengthCm: 60, angleDeg: 0 })
    expect(kindEntry("doubleWardrobe").label).toBe("Шкаф двустворчатый")
    expect(kindEntry("doubleWardrobe").defaults).toEqual({ widthCm: 100, lengthCm: 60, angleDeg: 0 })
    expect(kindEntry("bed").label).toBe("Кровать")
    expect(kindEntry("bed").defaults).toEqual({ widthCm: 160, lengthCm: 200, angleDeg: 0 })
    expect(kindEntry("nightstand").label).toBe("Прикроватный столик")
    expect(kindEntry("nightstand").defaults).toEqual({ widthCm: 30, lengthCm: 60, angleDeg: 0 })
    expect(kindEntry("tv").label).toBe("Телевизор")
    expect(kindEntry("tv").defaults).toEqual({ widthCm: 91, lengthCm: 11, angleDeg: 0 })
    expect(kindEntry("wallCabinet").label).toBe("Подвесная тумба")
    expect(kindEntry("wallCabinet").defaults).toEqual({ widthCm: 180, lengthCm: 42, angleDeg: 0 })
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
