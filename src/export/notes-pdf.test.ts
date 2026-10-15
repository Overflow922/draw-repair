import { readFileSync } from "node:fs"
import type { jsPDFOptions } from "jspdf"
import { describe, expect, it, vi } from "vitest"
import { drawing, wall } from "../mounting/mounting.test-utils"
import type { Drawing } from "../types"

// change add-plan-notes: блок примечаний на страницах PDF (spec plan-notes «Блок примечаний в PDF»;
// pdf-export «Область чертежа внутри рамки»). Текст и линии фиксируются на вызовах doc.text / doc.line вместе с номером
// страницы, координатами и реальной шириной строки по метрике шрифта.

interface TextCall {
  page: number
  text: string
  x: number
  y: number
  width: number
}

interface LineCall {
  page: number
  x1: number
  y1: number
  x2: number
  y2: number
  lineWidth: number
}

const texts = vi.hoisted((): TextCall[] => [])
const lines = vi.hoisted((): LineCall[] => [])

vi.mock("jspdf", async (importOriginal) => {
  const mod = await importOriginal<typeof import("jspdf")>()
  class RecordingPdf extends mod.jsPDF {
    constructor(options?: jsPDFOptions) {
      super(options)
      const text: unknown = Reflect.get(this, "text")
      const line: unknown = Reflect.get(this, "line")
      const lineWidth: unknown = Reflect.get(this, "setLineWidth")
      if (typeof text !== "function" || typeof line !== "function" || typeof lineWidth !== "function") throw new Error("jsPDF API недоступен")
      let currentWidth = 0
      Object.defineProperty(this, "setLineWidth", {
        configurable: true,
        writable: true,
        value: (...args: unknown[]): unknown => {
          if (typeof args[0] === "number") currentWidth = args[0]
          return Reflect.apply(lineWidth, this, args)
        },
      })
      Object.defineProperty(this, "text", {
        configurable: true,
        writable: true,
        value: (...args: unknown[]): unknown => {
          const [t, x, y] = args
          if (typeof t === "string" && typeof x === "number" && typeof y === "number") {
            texts.push({ page: this.getCurrentPageInfo().pageNumber, text: t, x, y, width: this.getTextWidth(t) })
          }
          return Reflect.apply(text, this, args)
        },
      })
      Object.defineProperty(this, "line", {
        configurable: true,
        writable: true,
        value: (...args: unknown[]): unknown => {
          const [x1, y1, x2, y2] = args
          if (typeof x1 === "number" && typeof y1 === "number" && typeof x2 === "number" && typeof y2 === "number") {
            lines.push({ page: this.getCurrentPageInfo().pageNumber, x1, y1, x2, y2, lineWidth: currentWidth })
          }
          return Reflect.apply(line, this, args)
        },
      })
    }
  }
  return { ...mod, jsPDF: RecordingPdf }
})

const { buildPdfPages, pagesOf } = await import("./pdf")
const { fitScale } = await import("./fit-scale")
const font = readFileSync(new URL("../assets/pt-sans-regular.ttf", import.meta.url)).toString("base64")
const NOW = new Date(2026, 8, 5, 14, 32, 7)

const build = (d: Drawing, format: "A4" | "A0" = "A4"): void => {
  texts.length = 0
  lines.length = 0
  buildPdfPages(pagesOf(d), "cm", 100, format, font, d.name, NOW)
}
const textsOn = (n: number): TextCall[] => texts.filter((t) => t.page === n)
const find = (n: number, text: string): TextCall | undefined => textsOn(n).find((t) => t.text === text)

const WALLS = [wall("A", 0, 0, 300, 0)]
const base = (extra: Partial<Drawing> = {}): Drawing => ({ ...drawing({ walls: WALLS }), ...extra })
const MEASURE = 1
const DEMOLITION = 2
const MOUNTING = 3

describe("блок примечаний в PDF", () => {
  it("заголовок, номера и тексты пунктов на отступах 3 и 12 мм от левой стороны блока (x = 107 на A4)", () => {
    build(base({ notes: ["Все размеры указаны в мм.", "Замеры проводились по низу помещения."] }))
    expect(find(MEASURE, "Примечание:")?.x).toBeCloseTo(110, 6)
    expect(find(MEASURE, "1.")?.x).toBeCloseTo(110, 6)
    expect(find(MEASURE, "2.")?.x).toBeCloseTo(110, 6)
    expect(find(MEASURE, "Все размеры указаны в мм.")?.x).toBeCloseTo(119, 6)
    expect(find(MEASURE, "Замеры проводились по низу помещения.")?.x).toBeCloseTo(119, 6)
  })

  it("строки идут сверху вниз с шагом 4,5 мм, блок стоит над основной надписью (низ на y = 150 мм)", () => {
    build(base({ notes: ["а", "б"] }))
    const t = find(MEASURE, "Примечание:")
    const a = find(MEASURE, "а")
    const b = find(MEASURE, "б")
    if (!t || !a || !b) throw new Error("блок не выведен")
    expect(b.y - a.y).toBeCloseTo(4.5, 6)
    expect(a.y).toBeGreaterThan(t.y)
    // высота блока 3 + 5 + 2·4,5 + 2 = 19; верх блока y = 131; первая строка: центр 131 + 8 + 2,25, база + 0,35·3,5
    expect(a.y).toBeCloseTo(131 + 8 + 2.25 + 0.35 * 3.5, 6)
    expect(b.y + 2.25 - 0.35 * 3.5 + 2).toBeLessThanOrEqual(150 + 1e-6)
  })

  it("заголовок подчёркнут тонкой линией 0,25 мм по ширине слова", () => {
    build(base({ notes: ["а"] }))
    const t = find(MEASURE, "Примечание:")
    if (!t) throw new Error("заголовок не выведен")
    const underline = lines.find((l) => l.page === MEASURE && Math.abs(l.x1 - t.x) < 1e-6 && Math.abs(l.y1 - l.y2) < 1e-9 && l.y1 > t.y && l.y1 < t.y + 2)
    expect(underline).toBeDefined()
    expect(underline?.x2).toBeCloseTo(t.x + t.width, 6)
    expect(underline?.lineWidth).toBeCloseTo(0.25, 9)
  })

  it("левее основной надписи (x < 107 мм на A4) тексты блока не выводятся", () => {
    build(base({ notes: ["Короткий", "Длинный пункт ".repeat(30)] }))
    const own = textsOn(MEASURE).filter((t) => t.text === "Примечание:" || /^\d\.$/.test(t.text) || t.text === "Короткий")
    expect(own.length).toBeGreaterThanOrEqual(4)
    for (const t of own) expect(t.x).toBeGreaterThanOrEqual(107)
  })

  it("пустой список — ни заголовка, ни номеров на странице", () => {
    build(base())
    for (const n of [MEASURE, DEMOLITION, MOUNTING]) {
      expect(find(n, "Примечание:")).toBeUndefined()
      expect(find(n, "1.")).toBeUndefined()
    }
  })

  it("у каждой страницы свои примечания", () => {
    build(base({ notes: ["обмер"], demolitionNotes: ["снос"], mounting: { walls: [], dimensions: [], notes: ["монтаж"] } }))
    expect(find(MEASURE, "обмер")).toBeDefined()
    expect(find(MEASURE, "снос")).toBeUndefined()
    expect(find(MEASURE, "монтаж")).toBeUndefined()
    expect(find(DEMOLITION, "снос")).toBeDefined()
    expect(find(DEMOLITION, "обмер")).toBeUndefined()
    expect(find(MOUNTING, "монтаж")).toBeDefined()
    expect(find(MOUNTING, "обмер")).toBeUndefined()
    for (const n of [MEASURE, DEMOLITION, MOUNTING]) expect(textsOn(n).filter((t) => t.text === "Примечание:")).toHaveLength(1)
  })

  it("примечания только одного плана не рисуют блок на других страницах", () => {
    build(base({ demolitionNotes: ["снос"] }))
    expect(find(MEASURE, "Примечание:")).toBeUndefined()
    expect(find(DEMOLITION, "Примечание:")).toBeDefined()
    expect(find(MOUNTING, "Примечание:")).toBeUndefined()
  })
})

describe("перенос длинного пункта", () => {
  const LONG = "Все размеры указаны без учёта черновых и чистовых отделочных материалов и допусков на неровность. ".repeat(4).trim()

  it("пункт занимает несколько строк, номер только у первой, продолжение на отступе 12 мм", () => {
    build(base({ notes: [LONG] }))
    const body = textsOn(MEASURE).filter((t) => Math.abs(t.x - 119) < 1e-6)
    expect(body.length).toBeGreaterThan(1)
    expect(textsOn(MEASURE).filter((t) => t.text === "1.")).toHaveLength(1)
    expect(body.map((t) => t.text).join(" ")).toBe(LONG)
    const ys = body.map((t) => t.y)
    ys.slice(1).forEach((y, i) => expect(y - ys[i]).toBeCloseTo(4.5, 6))
  })

  it("ни одна строка не выходит за правую сторону блока (по реальной метрике шрифта)", () => {
    build(base({ notes: [LONG, "я".repeat(400)] }))
    const body = textsOn(MEASURE).filter((t) => Math.abs(t.x - 119) < 1e-6)
    expect(body.length).toBeGreaterThan(2)
    for (const t of body) expect(t.x + t.width).toBeLessThanOrEqual(292 - 3 + 1e-6)
  })
})

describe("область чертежа", () => {
  const spacing = (format: "A4" | "A0"): { rows: number; titleToFirst: number; numberToText: number } => {
    build(base({ notes: ["а", "б"] }), format)
    const title = find(MEASURE, "Примечание:")
    const a = find(MEASURE, "а")
    const b = find(MEASURE, "б")
    if (!title || !a || !b) throw new Error("блок не выведен")
    return { rows: b.y - a.y, titleToFirst: a.y - title.y, numberToText: a.x - (find(MEASURE, "1.")?.x ?? NaN) }
  }

  it("блок на A0 имеет те же размеры, что на A4 (шаг, отступы)", () => {
    const a4 = spacing("A4")
    const a0 = spacing("A0")
    expect(a0.rows).toBeCloseTo(a4.rows, 6)
    expect(a0.titleToFirst).toBeCloseTo(a4.titleToFirst, 6)
    expect(a0.numberToText).toBeCloseTo(a4.numberToText, 6)
  })

  it("примечания не делают подобранный масштаб крупнее (область чертежа только уменьшается)", () => {
    const without = fitScale(pagesOf(base({ walls: [wall("A", 0, 0, 2400, 0), wall("B", 2400, 0, 2400, 1200)] })), "A4")
    const withNotes = fitScale(
      pagesOf(base({ walls: [wall("A", 0, 0, 2400, 0), wall("B", 2400, 0, 2400, 1200)], notes: Array.from({ length: 15 }, () => "п") })),
      "A4",
    )
    if (without === null || withNotes === null) throw new Error("масштаб не подобран")
    expect(withNotes).toBeGreaterThanOrEqual(without)
  })
})
