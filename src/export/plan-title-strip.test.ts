import { readFileSync } from "node:fs"
import type { jsPDF, jsPDFOptions } from "jspdf"
import { describe, expect, it, vi } from "vitest"
import { parseStore } from "../storage"
import type { Drawing, Wall } from "../types"
import { legendEntries, legendWidthMm } from "./legend"
import type { PageFormat, PlanPage } from "./pdf"
import { insideRect, parsePaths, pathsBBox, strokeSegments } from "./pdf-ops.test-utils"
import type { Rect } from "./pdf-ops.test-utils"

// change plan-title-strip: полоса названия плана 10 мм в левом верхнем углу рамки, область чертежа и столбец легенды
// начинаются под ней (spec pdf-export «Полоса названия плана», «Область чертежа внутри рамки», «Легенда на странице
// PDF»; design D1–D4; test-plan S-01…S-22). Текст фиксируется на вызове doc.text, векторные операторы разбираются
// из потока страницы, как в fit-scale-pdf.test.ts.

interface TextCall {
  page: number
  text: string
  x: number
  y: number
  widthMm: number
  fontMm: number
  align: string
}

const texts = vi.hoisted((): TextCall[] => [])

vi.mock("jspdf", async (importOriginal) => {
  const mod = await importOriginal<typeof import("jspdf")>()
  class RecordingPdf extends mod.jsPDF {
    constructor(options?: jsPDFOptions) {
      super(options)
      const original: unknown = Reflect.get(this, "text")
      if (typeof original !== "function") throw new Error("jsPDF.text недоступен")
      Object.defineProperty(this, "text", {
        configurable: true,
        writable: true,
        value: (...args: unknown[]): unknown => {
          const [text, x, y, options] = args
          const lines = typeof text === "string" ? [text] : Array.isArray(text) ? text.filter((t): t is string => typeof t === "string") : []
          if (typeof x === "number" && typeof y === "number") {
            const opt = typeof options === "object" && options !== null ? options : {}
            const align = "align" in opt && typeof opt.align === "string" ? opt.align : "left"
            for (const line of lines) {
              texts.push({
                page: this.getCurrentPageInfo().pageNumber,
                text: line,
                x,
                y,
                widthMm: this.getTextWidth(line),
                fontMm: this.getFontSize() / this.internal.scaleFactor,
                align,
              })
            }
          }
          return Reflect.apply(original, this, args)
        },
      })
    }
  }
  return { ...mod, jsPDF: RecordingPdf }
})

const { buildPdfPages, pagesOf, fitsFormat } = await import("./pdf")
const { drawingArea, frameRect, legendArea, planStripRect, titleBlockRect } = await import("./sheet-layout")
const { fitScale } = await import("./fit-scale")

const font = readFileSync(new URL("../assets/pt-sans-regular.ttf", import.meta.url)).toString("base64")
const SEP = new Date(2026, 8, 5, 14, 32, 7)
const FORMATS: PageFormat[] = ["A4", "A3", "A2", "A1", "A0"]
const CONTOUR_MM = 0.6
const STRIP_H = 10
const STRIP_TEXT_X = 23

function build(pages: PlanPage[], scale: number, format: PageFormat = "A4"): jsPDF {
  texts.length = 0
  return buildPdfPages(pages, "cm", scale, format, font, "Чертёж 1", SEP)
}

const wall = (ax: number, ay: number, bx: number, by: number, id: string, type: Wall["type"] = "brick"): Wall => ({
  id,
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
  thicknessCm: 20,
  type,
})
const page = (walls: Wall[], title?: string): PlanPage =>
  title === undefined ? { walls, dimensions: [], doorways: [] } : { walls, dimensions: [], doorways: [], title }

// текст названия в полосе: кегль 5 мм, начало на x = 23 мм
const stripText = (pageNumber: number): TextCall | undefined =>
  texts.find((t) => t.page === pageNumber && Math.abs(t.x - STRIP_TEXT_X) < 0.01 && Math.abs(t.fontMm - 5) < 0.01 && t.y < 20)

function ink(doc: jsPDF, pageNumber: number, format: PageFormat, pages: PlanPage[]): Rect {
  const chartLeft = drawingArea(format, legendWidthMm(pages)).x
  const paths = parsePaths(doc, pageNumber).filter(
    (p) => p.paint === "stroke" && Math.abs(p.widthMm - CONTOUR_MM) < 0.005 && (pathsBBox([p])?.x ?? 0) >= chartLeft - 1e-6,
  )
  const box = pathsBBox(paths)
  if (!box) throw new Error(`на странице ${pageNumber} контуры стен не нарисованы`)
  return box
}

function threePlanDrawing(): Drawing {
  const raw = {
    version: 3,
    activeId: "d1",
    drawings: [
      {
        id: "d1",
        name: "Чертёж 1",
        walls: [
          { id: "w1", a: { x: 0, y: 0 }, b: { x: 600, y: 0 }, thicknessCm: 20, type: "brick" },
          { id: "w2", a: { x: 600, y: 0 }, b: { x: 600, y: 400 }, thicknessCm: 20, type: "concrete" },
        ],
        dimensions: [],
        view: { zoom: 1, pan: { x: 0, y: 0 } },
        demolition: [{ id: "m1", wallId: "w1", anchor: "a", fromCm: 100, toCm: 190 }],
        mounting: { walls: [{ a: { x: 0, y: 400 }, b: { x: 600, y: 400 }, thicknessCm: 20, type: "brick" }], dimensions: [] },
      },
    ],
  }
  const drawing = parseStore(JSON.stringify(raw))?.store.drawings[0]
  if (!drawing) throw new Error("документ не загружен")
  return drawing
}

describe("геометрия: полоса, область и легенда", () => {
  it("S-01: полоса — верх рамки на всю её ширину высотой 10 мм (A4: x=20, y=5, 272×10)", () => {
    expect(planStripRect("A4")).toEqual({ x: 20, y: 5, w: 272, h: 10 })
  })

  it.each(FORMATS.map((f) => [f]))("S-01: полоса на %s совпадает с рамкой по x, y и ширине, высота 10 мм", (format) => {
    const frame = frameRect(format)
    expect(planStripRect(format)).toEqual({ x: frame.x, y: frame.y, w: frame.w, h: STRIP_H })
  })

  it("S-10: столбец легенды A4 шириной W — x=20, y=15, ширина W, высота 135 мм", () => {
    expect(legendArea("A4", 40)).toEqual({ x: 20, y: 15, w: 40, h: 135 })
  })

  it("S-12: область A4 без легенды — 272×135 мм, от x=20 до x=292, от y=15 до y=150", () => {
    expect(drawingArea("A4", 0)).toEqual({ x: 20, y: 15, w: 272, h: 135 })
  })

  it("S-13: область A4 с легендой шириной W — (272 − W)×135 мм от x=20+W", () => {
    expect(drawingArea("A4", 61.5)).toEqual({ x: 81.5, y: 15, w: 210.5, h: 135 })
  })

  it.each([
    ["A3", 222],
    ["A2", 345],
    ["A1", 519],
    ["A0", 766],
  ] as const)("S-14: высота области %s — %i мм (рамка − полоса 10 − основная надпись 55)", (format, h) => {
    expect(drawingArea(format, 0).h).toBe(h)
    expect(drawingArea(format, 0).y).toBe(15)
  })

  it.each(FORMATS.map((f) => [f]))("S-10: на %s верх столбца легенды равен верху области чертежа (y = 15) при любой ширине легенды", (format) => {
    for (const w of [0, 40, 61.5, 100]) {
      expect(legendArea(format, w).y, `ширина ${w}`).toBe(15)
      expect(legendArea(format, w).y).toBe(drawingArea(format, w).y)
      expect(legendArea(format, w).h).toBe(drawingArea(format, w).h)
    }
  })

  it.each(FORMATS.map((f) => [f]))("S-21: область чертежа и легенда не заходят на полосу и основную надпись на %s", (format) => {
    const strip = planStripRect(format)
    const block = titleBlockRect(format)
    const area = drawingArea(format, 50)
    expect(area.y).toBeGreaterThanOrEqual(strip.y + strip.h)
    expect(area.y + area.h).toBe(block.y)
  })

  it("S-16: граница по высоте — габарит 135 мм при 1:10 подходит, 135,1 мм нет", () => {
    const box = (h: number) => ({ minX: 0, minY: 0, maxX: 272, maxY: h })
    expect(fitsFormat(box(135), 10, "A4")).toBe(true)
    expect(fitsFormat(box(135.1), 10, "A4")).toBe(false)
  })

  it("S-17: чертёж высотой 140 мм при 1:10 (помещался в прежнюю область 145 мм) теперь получает 1:15", () => {
    // вертикальная стена 110 см: 110 + 20 + 10 мм запаса = 140 мм при 1:10
    expect(fitScale([page([wall(0, 0, 0, 110, "w")])], "A4")).toBe(15)
    // а 100 см (130 мм) по-прежнему помещается при 1:10
    expect(fitScale([page([wall(0, 0, 0, 100, "w")])], "A4")).toBe(10)
  })
})

describe("название плана на странице", () => {
  const pages = pagesOf(threePlanDrawing())

  it("S-02/S-03: название — кегль 5 мм, по левому краю, начало на 3 мм правее рамки, по центру полосы по высоте", () => {
    build(pages, 100)
    const t = stripText(1)
    expect(t?.text).toBe("Обмерочный план")
    expect(t?.align).toBe("left")
    // базовая линия: середина полосы (y = 10 мм) плюс 0,35 кегля, как у остальных подписей листа
    expect(t?.y).toBeCloseTo(10 + 0.35 * 5, 1)
    expect(t?.x).toBeCloseTo(23, 6)
  })

  it("S-04: у каждой из трёх страниц своё название плана", () => {
    build(pages, 100)
    expect([1, 2, 3].map((n) => stripText(n)?.text)).toEqual(["Обмерочный план", "Демонтаж", "Монтаж"])
  })

  it("S-22: название в полосе совпадает с названием в графе 5 той же страницы", () => {
    build(pages, 100)
    for (const n of [1, 2, 3]) {
      const title = stripText(n)?.text
      const copies = texts.filter((t) => t.page === n && t.text === title)
      expect(copies.length, `страница ${n}`).toBeGreaterThanOrEqual(2)
      // вторая копия — в графе 5 основной надписи (в нижней части листа, ниже верха надписи y = 150 мм)
      expect(copies.some((c) => c.y > titleBlockRect("A4").y), `страница ${n}`).toBe(true)
    }
  })

  it("S-05: страница без стен тоже имеет название плана, легенды на ней нет", () => {
    const doc = build([page([], "Демонтаж"), page([wall(0, 0, 500, 0, "w")], "Монтаж")], 100)
    expect(stripText(1)?.text).toBe("Демонтаж")
    expect(stripText(2)?.text).toBe("Монтаж")
    expect(texts.filter((t) => t.page === 1 && t.text === "Кирпич")).toHaveLength(0)
    expect(texts.filter((t) => t.page === 2 && t.text === "Кирпич")).toHaveLength(1)
    expect(doc.getNumberOfPages()).toBe(2)
  })

  it("S-20: страница без названия — текста в полосе нет, область та же", () => {
    build([page([wall(0, 0, 500, 0, "w")])], 100)
    expect(stripText(1)).toBeUndefined()
    // вне полосы название не выведено вовсе (в графе 5 тоже пусто)
    expect(texts.filter((t) => t.page === 1 && t.text === "Обмерочный план")).toHaveLength(0)
  })

  it("S-06: полоса не отделена линиями: внутри полосы и вдоль её нижней границы нет штрихов, кроме рамки", () => {
    const doc = build(pages, 100)
    for (const n of [1, 2, 3]) {
      const segs = strokeSegments(parsePaths(doc, n))
      // ни один горизонтальный или вертикальный штрих не заходит внутрь полосы (рамка лежит на её границе x = 20 / 292, y = 5);
      // диагональные отрезки штриховки образцов легенды в разборе потока выходят за обрезанный контур, поэтому не учитываются
      const axisAligned = segs.filter((s) => Math.abs(s.a.x - s.b.x) < 0.05 || Math.abs(s.a.y - s.b.y) < 0.05)
      const inside = axisAligned.filter((s) => {
        const x1 = Math.min(s.a.x, s.b.x)
        const x2 = Math.max(s.a.x, s.b.x)
        const y1 = Math.min(s.a.y, s.b.y)
        const y2 = Math.max(s.a.y, s.b.y)
        return x2 > 20.5 && x1 < 291.5 && y2 > 5.5 && y1 < 14.5
      })
      expect(inside, `страница ${n}: внутри полосы`).toHaveLength(0)
      // и вдоль нижней границы полосы нет разделительной линии (допуск ±1 мм)
      const along = segs.filter((s) => Math.abs(s.a.y - s.b.y) < 0.05 && s.a.y > 14 && s.a.y < 16 && Math.abs(s.a.x - s.b.x) > 10)
      expect(along, `страница ${n}: вдоль нижней границы`).toHaveLength(0)
    }
  })
  it.each([
    ["A4", 100],
    ["A0", 20],
    ["A2", 50],
  ] as const)("S-07/S-08: на %s при 1:%i кегль названия 5 мм и отступ 3 мм те же", (format, scale) => {
    build(pages, scale, format)
    const t = stripText(1)
    expect(t?.fontMm).toBeCloseTo(5, 6)
    expect(t?.x).toBeCloseTo(23, 6)
  })

  it("S-09: слишком длинное название уменьшается по размеру шрифта и остаётся внутри рамки", () => {
    const long = "Очень длинное название плана ".repeat(8).trim()
    build([page([wall(0, 0, 500, 0, "w")], long)], 100)
    const t = texts.find((x) => x.page === 1 && Math.abs(x.x - STRIP_TEXT_X) < 0.01 && x.y < 20 && x.text.startsWith("Очень"))
    expect(t).toBeDefined()
    expect(t?.fontMm ?? 5).toBeLessThan(5)
    const frame = frameRect("A4")
    expect(STRIP_TEXT_X + (t?.widthMm ?? 1e9)).toBeLessThanOrEqual(frame.x + frame.w)
  })
})

describe("область и легенда под полосой в PDF", () => {
  it("S-15: чертёж целиком под полосой: стена, занимавшая всю прежнюю высоту области, получает более мелкий масштаб, контуры не выше y = 20 мм", () => {
    // вертикальная стена 114,9 см: 114,9 + 20 + 10 = 144,9 мм при 1:10 — помещалась в прежнюю область (145 мм), в новую (135 мм) нет
    const tall = [page([wall(0, 0, 0, 114.9, "w")], "Обмерочный план")]
    const scale = fitScale(tall, "A4")
    expect(scale).toBe(15)
    const doc = build(tall, 15)
    const box = ink(doc, 1, "A4", tall)
    const area = drawingArea("A4", legendWidthMm(tall))
    expect(insideRect(box, area)).toBe(true)
    // верх области 15 мм плюс запас вокруг чертежа 5 мм: выше контуры подняться не могут (прежняя область давала y ≈ 10)
    expect(box.y).toBeGreaterThanOrEqual(15 + 5 - 0.31)
  })

  it.each([
    ["A4", 3000],
    ["A1", 6000],
  ] as const)("S-15: чертёж центрирован в новой области по высоте и ширине на %s: середина контуров в середине области", (format, lengthCm) => {
    const wide = [page([wall(0, 0, lengthCm, 0, "w")], "Обмерочный план")]
    const scale = fitScale(wide, format)
    if (scale === null) throw new Error("масштаб не подобран")
    const doc = build(wide, scale, format)
    const box = ink(doc, 1, format, wide)
    const area = drawingArea(format, legendWidthMm(wide))
    expect(box.y + box.h / 2).toBeCloseTo(area.y + area.h / 2, 0)
    expect(box.x + box.w / 2).toBeCloseTo(area.x + area.w / 2, 0)
  })

  it("S-10/S-11: первая запись легенды на одном уровне с верхом области чертежа (под полосой)", () => {
    const one = [page([wall(0, 0, 500, 0, "w")], "Обмерочный план")]
    build(one, 100)
    const label = texts.find((t) => t.page === 1 && t.text === "Кирпич")
    // центр первой строки легенды: верх столбца 15 мм + половина шага записи 7 мм, база текста ниже центра на 0,35 кегля
    expect(label?.y).toBeCloseTo(15 + 7 + 0.35 * 3.5, 1)
  })

  it("S-18: легенда с максимумом материалов помещается по высоте в область на всех форматах", () => {
    const all = page([wall(0, 0, 100, 0, "a", "brick"), wall(0, 50, 100, 50, "b", "concrete"), wall(0, 100, 100, 100, "c", "gkl"), wall(0, 150, 100, 150, "d", "wood-long"), wall(0, 200, 100, 200, "e", "blocks")], "Обмерочный план")
    const rows = legendEntries(all).length
    expect(rows).toBe(5)
    for (const format of FORMATS) expect(rows * 14, format).toBeLessThanOrEqual(legendArea(format, 40).h)
  })

  it("S-19: нет стен нигде — столбца легенды нет, область между полосой и основной надписью на всю ширину рамки", () => {
    expect(legendWidthMm([page([], "Обмерочный план")])).toBe(0)
    const area = drawingArea("A4", 0)
    expect(area).toEqual({ x: frameRect("A4").x, y: 15, w: frameRect("A4").w, h: 135 })
  })
})
