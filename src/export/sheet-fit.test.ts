import { describe, expect, it } from "vitest"
import { fitsFormat, placeOnPage } from "./pdf"
import type { BBox, PageFormat } from "./pdf"
import { drawingArea } from "./sheet-layout"

// change pdf-frame-title-block: вместимость форматов и размещение считаются по области чертежа внутри рамки,
// страница всегда альбомная. Масштаб 1:10 даёт 1 см мира = 1 мм листа, поэтому границы проверяются без
// накопления погрешности умножения на 0,1.

const FORMATS: PageFormat[] = ["A4", "A3", "A2", "A1", "A0"]
const box = (w: number, h: number): BBox => ({ minX: 0, minY: 0, maxX: w, maxY: h })

describe("граница области чертежа на A4 (272×135 мм)", () => {
  it("DA-5: чертёж ровно 272×135 мм помещается на A4", () => {
    expect(fitsFormat(box(272, 135), 10, "A4")).toBe(true)
  })

  it("DA-6: шире области на 0,1 мм — A4 не подходит", () => {
    expect(fitsFormat(box(272.1, 135), 10, "A4")).toBe(false)
  })

  it("DA-7: выше области на 0,1 мм — A4 не подходит", () => {
    expect(fitsFormat(box(272, 135.1), 10, "A4")).toBe(false)
  })

  it("DA-7: чертёж 277×190 мм (помещался при прежних полях 10 мм) на A4 больше не помещается, на A3 помещается", () => {
    expect(fitsFormat(box(277, 190), 10, "A4")).toBe(false)
    expect(fitsFormat(box(277, 190), 10, "A3")).toBe(true)
  })

  it.each([
    ["A3", 395, 222],
    ["A2", 569, 345],
    ["A1", 816, 519],
    ["A0", 1164, 766],
  ] as const)("DA-5: %s — граница %i×%i мм включительно", (f, w, h) => {
    expect(fitsFormat(box(w, h), 10, f)).toBe(true)
    expect(fitsFormat(box(w + 0.1, h), 10, f)).toBe(false)
    expect(fitsFormat(box(w, h + 0.1), 10, f)).toBe(false)
  })

  it("граница не зависит от положения чертежа в мировых координатах", () => {
    expect(fitsFormat({ minX: -5000, minY: 700, maxX: -4728, maxY: 835 }, 10, "A4")).toBe(true)
    expect(fitsFormat({ minX: -5000, minY: 700, maxX: -4727.9, maxY: 835 }, 10, "A4")).toBe(false)
  })
})

describe("страница всегда альбомная", () => {
  it("OR-4: placeOnPage даёт landscape для широкого, высокого и квадратного чертежа", () => {
    expect(placeOnPage(box(5000, 3000), 100, "A3").landscape).toBe(true)
    expect(placeOnPage(box(500, 2000), 100, "A3").landscape).toBe(true)
    expect(placeOnPage(box(1000, 1000), 100, "A3").landscape).toBe(true)
  })

  it("FM-6: чертёж 100×200 мм (высокий) проверяется по альбомной области: A4 нет, A3 есть", () => {
    expect(fitsFormat(box(100, 200), 10, "A4")).toBe(false)
    expect(fitsFormat(box(100, 200), 10, "A3")).toBe(true)
  })

  it("FM-5: чертёж 180×170 мм не помещается на A4 (в книжной области 185×232 поместился бы, но она не поддерживается)", () => {
    expect(fitsFormat(box(180, 170), 10, "A4")).toBe(false)
    expect(fitsFormat(box(180, 170), 10, "A3")).toBe(true)
  })
})

describe("инварианты вместимости", () => {
  const sizes: [number, number][] = [
    [100, 100],
    [272, 135],
    [273, 100],
    [100, 136],
    [390, 220],
    [600, 360],
    [1000, 700],
    [1200, 800],
  ]

  it("если формат вмещает чертёж, вмещает и каждый больший", () => {
    for (const [w, h] of sizes) {
      const fits = FORMATS.map((f) => fitsFormat(box(w, h), 10, f))
      const firstFit = fits.indexOf(true)
      if (firstFit >= 0) expect(fits.slice(firstFit).every(Boolean), `${w}×${h}`).toBe(true)
    }
  })

  it("fitsFormat согласован с размещением: чертёж, который помещается, лежит внутри области на всех четырёх сторонах", () => {
    for (const f of FORMATS) {
      const area = drawingArea(f)
      for (const [w, h] of sizes) {
        if (!fitsFormat(box(w, h), 10, f)) continue
        const p = placeOnPage(box(w, h), 10, f)
        const left = p.offsetX
        const top = p.offsetY
        expect(left, `${f} ${w}×${h} left`).toBeGreaterThanOrEqual(area.x - 1e-9)
        expect(top, `${f} ${w}×${h} top`).toBeGreaterThanOrEqual(area.y - 1e-9)
        expect(left + w, `${f} ${w}×${h} right`).toBeLessThanOrEqual(area.x + area.w + 1e-9)
        expect(top + h, `${f} ${w}×${h} bottom`).toBeLessThanOrEqual(area.y + area.h + 1e-9)
      }
    }
  })
})

describe("размещение в области чертежа", () => {
  it("PL-1: 5 м при 1:100 — ровно 50 мм на листе", () => {
    const p = placeOnPage(box(500, 250), 100, "A4")
    expect(p.mmPerCm).toBe(0.1)
    expect(500 * p.mmPerCm).toBe(50)
  })

  it("PL-2: чертёж 500×250 см при 1:100 на A4 центрирован в области 272×135 с началом (20; 15), а не на странице", () => {
    const p = placeOnPage(box(500, 250), 100, "A4")
    expect(p.landscape).toBe(true)
    expect(p.offsetX).toBeCloseTo(20 + (272 - 50) / 2, 9)
    expect(p.offsetY).toBeCloseTo(15 + (135 - 25) / 2, 9)
  })

  it("PL-2: на A3 центр области — x 20+395/2, y 15+222/2", () => {
    const p = placeOnPage(box(500, 250), 100, "A3")
    expect(p.offsetX).toBeCloseTo(20 + (395 - 50) / 2, 9)
    expect(p.offsetY).toBeCloseTo(15 + (222 - 25) / 2, 9)
  })

  it("DA-3: чертёж, равный области (272×135 мм при 1:10), встаёт в её левый верхний угол (20; 15)", () => {
    const p = placeOnPage(box(272, 135), 10, "A4")
    expect(p.offsetX).toBeCloseTo(20, 9)
    expect(p.offsetY).toBeCloseTo(15, 9)
  })

  it("DA-4: высокий чертёж 100×130 мм не заходит на основную надпись и центрирован по обеим осям области", () => {
    const area = drawingArea("A4")
    const p = placeOnPage(box(100, 130), 10, "A4")
    const left = p.offsetX
    const top = p.offsetY
    expect(top + 130).toBeLessThanOrEqual(area.y + area.h + 1e-9)
    expect(left - area.x).toBeCloseTo(area.x + area.w - (left + 100), 9)
    expect(top - area.y).toBeCloseTo(area.y + area.h - (top + 130), 9)
  })

  it("PL-3: центрирование инвариантно к сдвигу координат мира", () => {
    const base = placeOnPage(box(500, 250), 100, "A4")
    const shifted = placeOnPage({ minX: -2000, minY: -1000, maxX: -1500, maxY: -750 }, 100, "A4")
    const screenLeft = (offset: number, minX: number): number => offset + minX * 0.1
    const screenTop = (offset: number, minY: number): number => offset + minY * 0.1
    expect(screenLeft(shifted.offsetX, -2000)).toBeCloseTo(screenLeft(base.offsetX, 0), 9)
    expect(screenTop(shifted.offsetY, -1000)).toBeCloseTo(screenTop(base.offsetY, 0), 9)
    expect(screenLeft(base.offsetX, 0)).toBeCloseTo(20 + (272 - 50) / 2, 9)
  })
})
