import { describe, expect, it } from "vitest"
import { drywallColors } from "../reconstruction/reconstruction-render"
import { DARK_PALETTE, LIGHT_PALETTE } from "../theme"
import { conflictColor } from "./furniture-render"
import { FURNITURE_KINDS, FURNITURE_KIND_ORDER, isFurnitureKind, kindEntry } from "./furniture-kinds"

// change furniture-items-catalog: каталог видов мебели (spec furniture-plan «Каталог видов мебели»). Проверки идут по всем
// видам каталога: новый вид получает их без новых тестов.

const rgb = (css: string): [number, number, number] => {
  const hex = css.match(/^#([0-9a-f]{6})$/i)?.[1]
  if (hex) return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)]
  const parts = css.match(/rgba?\(([^)]+)\)/)?.[1]?.split(",").map((s) => parseFloat(s)) ?? []
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0]
}
const distance = (a: string, b: string): number => Math.hypot(...rgb(a).map((v, i) => v - (rgb(b)[i] ?? 0)))

describe("каталог видов мебели", () => {
  // TCR (change add-furniture-chair): в каталоге новый вид
  it("FIK-01: в каталоге «Стол» (80 × 160) и «Стул» (45 × 45), угол 0", () => {
    expect(FURNITURE_KIND_ORDER).toEqual(["table", "chair"])
    expect(kindEntry("table").label).toBe("Стол")
    expect(kindEntry("table").defaults).toEqual({ widthCm: 80, lengthCm: 160, angleDeg: 0 })
    expect(kindEntry("chair").label).toBe("Стул")
    expect(kindEntry("chair").defaults).toEqual({ widthCm: 45, lengthCm: 45, angleDeg: 0 })
  })

  it("FIK-02: порядок видов совпадает с порядком записей каталога", () => {
    expect([...FURNITURE_KIND_ORDER]).toEqual(Object.keys(FURNITURE_KINDS))
  })

  it("FIK-03: isFurnitureKind принимает только виды каталога", () => {
    expect(isFurnitureKind("table")).toBe(true)
    // TCR (change add-furniture-chair): «chair» теперь вид каталога, в примере не-вида — «sofa»
    for (const x of ["", "sofa", "toString", undefined, 1, null]) expect(isFurnitureKind(x), String(x)).toBe(false)
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

    it("FIK-12: цвет различим от бумаги, подложки, гипсокартона, подсветки, своего контура и цветов других видов в обеих схемах", () => {
      for (const [theme, palette] of [["light", LIGHT_PALETTE], ["dark", DARK_PALETTE]] as const) {
        const c = e.colors[theme]
        const others = FURNITURE_KIND_ORDER.filter((k) => k !== kind).map((k) => kindEntry(k).colors[theme].fill)
        for (const other of [palette.paper, palette.muted, drywallColors(theme).fill, conflictColor(theme), c.stroke, ...others]) {
          expect(distance(c.fill, other)).toBeGreaterThan(40)
        }
      }
    })

    it("FIK-13: цвета светлой и тёмной схем различны", () => {
      expect(e.colors.light.fill).not.toBe(e.colors.dark.fill)
    })
  })
})
