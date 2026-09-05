import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import type { Wall } from "../types"
import { availableFormats, buildPdf, pdfFileName, placeOnPage, wallsBBox } from "./pdf"

const wall = (ax: number, ay: number, bx: number, by: number): Wall => ({
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
  thicknessCm: 20,
  type: "brick",
})

const WIDE = { minX: 0, minY: 0, maxX: 5000, maxY: 3000 }
const TALL = { minX: 0, minY: 0, maxX: 500, maxY: 2000 }

describe("placeOnPage", () => {
  it("точный масштаб: 5 м при 1:100 — ровно 50 мм на листе", () => {
    const p = placeOnPage({ minX: 0, minY: 0, maxX: 500, maxY: 250 }, 100, "A4")
    expect(p.mmPerCm).toBe(0.1)
    expect((500 - 0) * p.mmPerCm).toBe(50)
    expect((250 - 0) * p.mmPerCm).toBe(25)
  })

  it("масштаб меняет размер листа: 5 м при 1:50 — 100 мм", () => {
    const p = placeOnPage({ minX: 0, minY: 0, maxX: 500, maxY: 250 }, 50, "A4")
    expect(p.mmPerCm).toBe(0.2)
    expect(500 * p.mmPerCm).toBe(100)
  })

  it("альбом для широкого чертежа, портрет для высокого", () => {
    expect(placeOnPage(WIDE, 100, "A4").landscape).toBe(true)
    expect(placeOnPage(TALL, 100, "A4").landscape).toBe(false)
  })

  it("центрирует содержимое в полях при положительных координатах", () => {
    const p = placeOnPage({ minX: 0, minY: 0, maxX: 500, maxY: 250 }, 100, "A4")
    expect(p.landscape).toBe(true)
    expect(p.offsetX).toBeCloseTo((297 - 50) / 2, 9)
    expect(p.offsetY).toBeCloseTo((210 - 25) / 2, 9)
  })

  it("центрирование инвариантно к сдвигу координат", () => {
    const base = placeOnPage({ minX: 0, minY: 0, maxX: 500, maxY: 250 }, 100, "A4")
    const shifted = placeOnPage({ minX: -2000, minY: -1000, maxX: -1500, maxY: -750 }, 100, "A4")
    const left = (o: number, minX: number) => o + minX * 0.1
    expect(left(base.offsetX, 0)).toBeCloseTo(123.5, 9)
    expect(left(shifted.offsetX, -2000)).toBeCloseTo(123.5, 9)
    expect(297 - left(base.offsetX, 500)).toBeCloseTo(123.5, 9)
    expect(297 - left(shifted.offsetX, -1500)).toBeCloseTo(123.5, 9)
  })
})

describe("availableFormats", () => {
  it("пустой чертёж — все форматы", () => {
    expect(availableFormats([], 100)).toEqual(["A4", "A3", "A2", "A1", "A0"])
  })

  it("стена 5 м при 1:100 вмещается в A4", () => {
    expect(availableFormats([wall(0, 0, 500, 0)], 100)).toEqual(["A4", "A3", "A2", "A1", "A0"])
  })

  it("стена 20 м при 1:50 не вмещается в A4 и A3", () => {
    expect(availableFormats([wall(0, 0, 2000, 0)], 50)).toEqual(["A2", "A1", "A0"])
  })

  it("переполнение A0 — пустой список", () => {
    expect(availableFormats([wall(0, 0, 6000, 0)], 50)).toEqual([])
  })

  it("смена масштаба расширяет список", () => {
    expect(availableFormats([wall(0, 0, 2000, 0)], 200)).toEqual(["A4", "A3", "A2", "A1", "A0"])
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
    const doc = buildPdf([wall(0, 0, 1500, 0), wall(1500, 0, 1500, 1000)], "mm", 100, "A3", font)
    const buf = Buffer.from(doc.output("arraybuffer"))
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-")
    expect(buf.toString("latin1")).toContain("PTSans")
    expect(buf.length).toBeGreaterThan(1000)
  })

  it("широкий чертёж даёт альбомную страницу формата", () => {
    const doc = buildPdf([wall(0, 0, 5000, 0)], "mm", 100, "A4", font)
    expect(doc.internal.pageSize.getWidth()).toBe(297)
    expect(doc.internal.pageSize.getHeight()).toBe(210)
  })

  it("высокий чертёж даёт портретную страницу формата", () => {
    const doc = buildPdf([wall(0, 0, 0, 2000)], "mm", 100, "A2", font)
    expect(doc.internal.pageSize.getWidth()).toBe(420)
    expect(doc.internal.pageSize.getHeight()).toBe(594)
  })
})
