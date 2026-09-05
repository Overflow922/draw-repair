import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import type { Wall } from "../types"
import { buildPdf, fitToPage, PAGE_FORMATS_MM, pdfFileName, wallsBBox } from "./pdf"

const wall = (ax: number, ay: number, bx: number, by: number): Wall => ({
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
  thicknessCm: 20,
  type: "brick",
})

const WIDE = { minX: 0, minY: 0, maxX: 5000, maxY: 3000 }
const TALL = { minX: 0, minY: 0, maxX: 500, maxY: 2000 }

describe("fitToPage", () => {
  it("альбом для широкого чертежа, портрет для высокого", () => {
    expect(fitToPage(WIDE, 210, 297, 10).landscape).toBe(true)
    expect(fitToPage(TALL, 210, 297, 10).landscape).toBe(false)
  })

  it("вписывает содержимое с полями на всех форматах", () => {
    for (const fmt of Object.keys(PAGE_FORMATS_MM) as (keyof typeof PAGE_FORMATS_MM)[]) {
      const [pw, ph] = PAGE_FORMATS_MM[fmt]
      for (const b of [WIDE, TALL]) {
        const fit = fitToPage(b, pw, ph, 10)
        const w = fit.landscape ? ph : pw
        const h = fit.landscape ? pw : ph
        const bw = b.maxX - b.minX
        const bh = b.maxY - b.minY
        const cw = (b.maxX - b.minX) * fit.scale
        const ch = bh * fit.scale
        expect(fit.offsetX + cw).toBeLessThanOrEqual(w - 10 + 1e-9)
        expect(fit.offsetY + ch).toBeLessThanOrEqual(h - 10 + 1e-9)
        expect(fit.offsetX + b.minX * fit.scale).toBeGreaterThanOrEqual(10 - 1e-9)
        expect(fit.offsetY + b.minY * fit.scale).toBeGreaterThanOrEqual(10 - 1e-9)
        expect(bw * fit.scale).toBeLessThanOrEqual(w - 20 + 1e-9)
      }
    }
  })

  it("выбирает ограничивающую сторону масштаба", () => {
    const fit = fitToPage(WIDE, 210, 297, 10)
    expect(fit.scale).toBeCloseTo(277 / 5000, 12)
    const tall = fitToPage(TALL, 210, 297, 10)
    expect(tall.scale).toBeCloseTo(277 / 2000, 12)
  })

  it("центрирует содержимое", () => {
    const fit = fitToPage(WIDE, 210, 297, 10)
    const w = 297, h = 210
    expect(fit.offsetX).toBeCloseTo(10, 9)
    expect(fit.offsetY).toBeGreaterThan(10)
    expect(fit.offsetY + 3000 * fit.scale).toBeCloseTo(h - fit.offsetY, 9)
    expect(fit.offsetX + 5000 * fit.scale).toBeCloseTo(w - fit.offsetX, 9)
  })

  it("работает с отрицательными координатами", () => {
    const b = { minX: -2000, minY: -1000, maxX: 1000, maxY: 500 }
    const fit = fitToPage(b, 297, 420, 10)
    const w = fit.landscape ? 420 : 297
    const h = fit.landscape ? 297 : 420
    expect(fit.landscape).toBe(true)
    const left = fit.offsetX + b.minX * fit.scale
    const top = fit.offsetY + b.minY * fit.scale
    expect(left).toBeGreaterThanOrEqual(10)
    expect(top).toBeGreaterThanOrEqual(10)
    expect(w - (fit.offsetX + b.maxX * fit.scale)).toBeCloseTo(left, 6)
    expect(h - (fit.offsetY + b.maxY * fit.scale)).toBeCloseTo(top, 6)
  })

  it("вырожденный bbox не даёт NaN и бесконечности", () => {
    const fit = fitToPage({ minX: 5, minY: 5, maxX: 5, maxY: 5 }, 210, 297, 10)
    expect(Number.isFinite(fit.scale)).toBe(true)
    expect(fit.scale).toBeGreaterThan(0)
  })
})

describe("wallsBBox", () => {
  it("охватывает концы стен с половиной толщины", () => {
    const b = wallsBBox([wall(-10, -20, 30, 40), wall(100, 5, 7, 8)])
    expect(b).toEqual({ minX: -20, minY: -30, maxX: 110, maxY: 50 })
  })
})

describe("pdfFileName", () => {
  it("имя чертежа и локальная дата-время до секунды", () => {
    expect(pdfFileName("Чертёж 1", new Date(2026, 8, 5, 14, 32, 7))).toBe("Чертёж 1_2026-09-05_14-32-07.pdf")
  })

  it("убирает запрещённые символы", () => {
    expect(pdfFileName('a/b\\c:d*e?f"g<h>i|j', new Date(2026, 0, 2, 3, 4, 5))).toBe("abcdefghij_2026-01-02_03-04-05.pdf")
  })

  it("имя только из запрещённых символов заменяется", () => {
    expect(pdfFileName("///", new Date(2026, 0, 2, 3, 4, 5))).toBe("Чертёж_2026-01-02_03-04-05.pdf")
  })

  it("дополняет компоненты времени нулём", () => {
    expect(pdfFileName("x", new Date(2026, 10, 12, 7, 8, 9))).toBe("x_2026-11-12_07-08-09.pdf")
  })
})

describe("buildPdf", () => {
  const font = readFileSync(new URL("../assets/pt-sans-regular.ttf", import.meta.url)).toString("base64")

  it("выдаёт валидный PDF со встроенным шрифтом", () => {
    const doc = buildPdf([wall(0, 0, 1500, 0), wall(1500, 0, 1500, 1000)], "mm", "A3", font)
    const buf = Buffer.from(doc.output("arraybuffer"))
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-")
    expect(buf.toString("latin1")).toContain("PTSans")
    expect(buf.length).toBeGreaterThan(1000)
  })

  it("широкий чертёж даёт альбомную страницу формата", () => {
    const doc = buildPdf([wall(0, 0, 5000, 0)], "mm", "A4", font)
    expect(doc.internal.pageSize.getWidth()).toBe(297)
    expect(doc.internal.pageSize.getHeight()).toBe(210)
  })

  it("высокий чертёж даёт портретную страницу формата", () => {
    const doc = buildPdf([wall(0, 0, 0, 2000)], "mm", "A2", font)
    expect(doc.internal.pageSize.getWidth()).toBe(420)
    expect(doc.internal.pageSize.getHeight()).toBe(594)
  })
})
