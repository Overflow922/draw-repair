import { describe, expect, it } from "vitest"
import type { Dimension, Wall } from "../types"
import { availableFormats, fitsFormat, placeOnPage } from "./pdf"
import type { BBox, PageFormat } from "./pdf"
import { drawingArea } from "./sheet-layout"

// change pdf-frame-title-block: вместимость форматов и размещение считаются по области чертежа внутри рамки,
// страница всегда альбомная. Масштаб 1:10 даёт 1 см мира = 1 мм листа, поэтому границы проверяются без
// накопления погрешности умножения на 0,1.

const FORMATS: PageFormat[] = ["A4", "A3", "A2", "A1", "A0"]
const box = (w: number, h: number): BBox => ({ minX: 0, minY: 0, maxX: w, maxY: h })

const wall = (ax: number, ay: number, bx: number, by: number, id = "w"): Wall => ({
  id,
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
  thicknessCm: 20,
  type: "brick",
})

const dim = (wallId: string, offset: number): Dimension => ({
  from: { a: { wallId, edge: 2 }, b: { wallId, edge: 1 } },
  to: { a: { wallId, edge: 3 }, b: { wallId, edge: 1 } },
  offset,
})

describe("граница области чертежа на A4 (272×145 мм)", () => {
  it("DA-5: чертёж ровно 272×145 мм помещается на A4", () => {
    expect(fitsFormat(box(272, 145), 10, "A4")).toBe(true)
  })

  it("DA-6: шире области на 0,1 мм — A4 не подходит", () => {
    expect(fitsFormat(box(272.1, 145), 10, "A4")).toBe(false)
  })

  it("DA-7: выше области на 0,1 мм — A4 не подходит", () => {
    expect(fitsFormat(box(272, 145.1), 10, "A4")).toBe(false)
  })

  it("DA-7: чертёж 277×190 мм (помещался при прежних полях 10 мм) на A4 больше не помещается, на A3 помещается", () => {
    expect(fitsFormat(box(277, 190), 10, "A4")).toBe(false)
    expect(fitsFormat(box(277, 190), 10, "A3")).toBe(true)
  })

  it.each([
    ["A3", 395, 232],
    ["A2", 569, 355],
    ["A1", 816, 529],
    ["A0", 1164, 776],
  ] as const)("DA-5: %s — граница %i×%i мм включительно", (f, w, h) => {
    expect(fitsFormat(box(w, h), 10, f)).toBe(true)
    expect(fitsFormat(box(w + 0.1, h), 10, f)).toBe(false)
    expect(fitsFormat(box(w, h + 0.1), 10, f)).toBe(false)
  })

  it("граница не зависит от положения чертежа в мировых координатах", () => {
    expect(fitsFormat({ minX: -5000, minY: 700, maxX: -4728, maxY: 845 }, 10, "A4")).toBe(true)
    expect(fitsFormat({ minX: -5000, minY: 700, maxX: -4727.9, maxY: 845 }, 10, "A4")).toBe(false)
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

describe("availableFormats", () => {
  it("пустой чертёж — все форматы", () => {
    expect(availableFormats([], [], 100)).toEqual(FORMATS)
  })

  it("FM-2: стена 20 м при 1:50 (404 мм с толщиной) не помещается на A3 (область 395 мм), список A2, A1, A0", () => {
    expect(availableFormats([wall(0, 0, 2000, 0)], [], 50)).toEqual(["A2", "A1", "A0"])
  })

  it("FM-4: стена 28 м при 1:100 (около 292 мм с запасом, шире 272) — первым и выбранным по умолчанию идёт A3", () => {
    const list = availableFormats([wall(0, 0, 2800, 0)], [], 100)
    expect(list[0]).toBe("A3")
    expect(list).toEqual(["A3", "A2", "A1", "A0"])
  })

  it("FM-1: размер, вынесенный за габарит, убирает A4 из списка; без него A4 есть", () => {
    const w = wall(0, 0, 1500, 0)
    expect(availableFormats([w], [], 100)).toContain("A4")
    const withDim = availableFormats([w], [dim("w", 2000)], 100)
    expect(withDim).not.toContain("A4")
    expect(withDim[0]).toBe("A3")
  })

  it("FM-3: список только сужается по мере роста стены — сначала уходит A4, затем A3 и так далее", () => {
    const lists = [1000, 2500, 3500, 6000, 9000, 12000].map((len) => availableFormats([wall(0, 0, len, 0)], [], 100))
    const lengths = lists.map((l) => l.length)
    for (let i = 1; i < lengths.length; i++) expect(lengths[i]).toBeLessThanOrEqual(lengths[i - 1] ?? Infinity)
    expect(lists[0]).toEqual(FORMATS)
    expect(lists[lists.length - 1]).toEqual([])
  })

  it("смена масштаба расширяет список: 20 м при 1:200 снова помещаются на A4", () => {
    expect(availableFormats([wall(0, 0, 2000, 0)], [], 200)).toEqual(FORMATS)
  })

  it("переполнение A0 — пустой список", () => {
    expect(availableFormats([wall(0, 0, 6000, 0)], [], 50)).toEqual([])
  })

  it("высокая стена 12 м при 1:50 (240 мм по высоте) не помещается на A4 и A3 в альбомной области, список A2, A1, A0", () => {
    expect(availableFormats([wall(0, 0, 0, 1200)], [], 50)).toEqual(["A2", "A1", "A0"])
  })
})

describe("инварианты вместимости", () => {
  const sizes: [number, number][] = [
    [100, 100],
    [272, 145],
    [273, 100],
    [100, 146],
    [390, 230],
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

  it("PL-2: чертёж 500×250 см при 1:100 на A4 центрирован в области 272×145 с началом (20; 5), а не на странице", () => {
    const p = placeOnPage(box(500, 250), 100, "A4")
    expect(p.landscape).toBe(true)
    expect(p.offsetX).toBeCloseTo(20 + (272 - 50) / 2, 9)
    expect(p.offsetY).toBeCloseTo(5 + (145 - 25) / 2, 9)
  })

  it("PL-2: на A3 центр области — x 20+395/2, y 5+232/2", () => {
    const p = placeOnPage(box(500, 250), 100, "A3")
    expect(p.offsetX).toBeCloseTo(20 + (395 - 50) / 2, 9)
    expect(p.offsetY).toBeCloseTo(5 + (232 - 25) / 2, 9)
  })

  it("DA-3: чертёж, равный области (272×145 мм при 1:10), встаёт в её левый верхний угол (20; 5)", () => {
    const p = placeOnPage(box(272, 145), 10, "A4")
    expect(p.offsetX).toBeCloseTo(20, 9)
    expect(p.offsetY).toBeCloseTo(5, 9)
  })

  it("DA-4: высокий чертёж 100×140 мм не заходит на основную надпись и центрирован по обеим осям области", () => {
    const area = drawingArea("A4")
    const p = placeOnPage(box(100, 140), 10, "A4")
    const left = p.offsetX
    const top = p.offsetY
    expect(top + 140).toBeLessThanOrEqual(area.y + area.h + 1e-9)
    expect(left - area.x).toBeCloseTo(area.x + area.w - (left + 100), 9)
    expect(top - area.y).toBeCloseTo(area.y + area.h - (top + 140), 9)
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
