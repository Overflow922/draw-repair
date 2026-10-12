import { readFileSync } from "node:fs"
import type { jsPDF, jsPDFOptions } from "jspdf"
import { describe, expect, it, vi } from "vitest"
import { drawing, wall } from "../mounting/mounting.test-utils"
import { legendWidthMm } from "../export/legend"
import { parsePaths } from "../export/pdf-ops.test-utils"
import type { PdfPath, Pt } from "../export/pdf-ops.test-utils"
import type { Communication, Drawing } from "../types"
import { duct, riser } from "./communications.test-utils"

// change add-communications: коммуникации в PDF (spec communications «Коммуникации в PDF»; drawing-plans
// «Одна страница PDF на каждый план»; test-plan CF-*). Векторные операторы страниц разбираются из потока jsPDF,
// текст фиксируется на вызове doc.text вместе с номером страницы.

interface TextCall {
  page: number
  text: string
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
          const [text] = args
          const lines = typeof text === "string" ? [text] : Array.isArray(text) ? text.filter((t): t is string => typeof t === "string") : []
          for (const line of lines) texts.push({ page: this.getCurrentPageInfo().pageNumber, text: line })
          return Reflect.apply(original, this, args)
        },
      })
    }
  }
  return { ...mod, jsPDF: RecordingPdf }
})

const { buildPdfPages, pageBounds, pagesOf, placeOnPage } = await import("../export/pdf")
const { fitScale } = await import("../export/fit-scale")

const font = readFileSync(new URL("../assets/pt-sans-regular.ttf", import.meta.url)).toString("base64")
const SCALE = 100

const base = (communications?: Communication[]): Drawing => ({
  ...drawing({ walls: [wall("W", 0, 0, 500, 0)] }),
  ...(communications ? { communications } : null),
})

function build(d: Drawing): { doc: jsPDF; pages: ReturnType<typeof pagesOf> } {
  texts.length = 0
  const pages = pagesOf(d)
  return { doc: buildPdfPages(pages, "cm", SCALE, "A4", font, "t", new Date(2026, 0, 1)), pages }
}

// где на листе (мм) лежит точка мира страницы i
function sheetPoint(pages: ReturnType<typeof pagesOf>, i: number, x: number, y: number): Pt {
  const page = pages[i]
  if (!page) throw new Error("нет страницы")
  const p = placeOnPage(pageBounds(page, SCALE), SCALE, "A4", legendWidthMm(pages))
  return { x: p.offsetX + x * p.mmPerCm, y: p.offsetY + y * p.mmPerCm }
}

const near = (a: Pt, b: Pt, tol: number): boolean => Math.hypot(a.x - b.x, a.y - b.y) <= tol

// путь — окружность: не меньше 4 вершин, все на расстоянии r от центра
const circleIn = (paths: readonly PdfPath[], c: Pt, rMm: number): boolean =>
  paths.some((p) => p.points.length >= 4 && p.points.every((q) => Math.abs(Math.hypot(q.x - c.x, q.y - c.y) - rMm) <= 0.03))

const hasSegment = (paths: readonly PdfPath[], a: Pt, b: Pt, tol = 0.03): boolean =>
  paths.some((p) =>
    p.points.some((q, i) => {
      const prev = p.points[i - 1]
      return prev !== undefined && ((near(prev, a, tol) && near(q, b, tol)) || (near(prev, b, tol) && near(q, a, tol)))
    }),
  )

describe("страницы PDF", () => {
  it("CF-01: коммуникации лежат на каждой странице pagesOf", () => {
    const list = [riser(250, 150, 11), duct(100, 150)]
    const pages = pagesOf(base(list))
    expect(pages).toHaveLength(3)
    for (const p of pages) expect(p.communications).toEqual(list)
  })

  it("CF-01b: без коммуникаций страницы их не несут", () => {
    for (const p of pagesOf(base())) expect(p.communications ?? []).toEqual([])
  })

  // pageBounds добавляет запас 0,5·масштаб = 50 см вокруг содержимого; габариты коммуникации — по телу (радиус, полуширина)
  const PAD = 0.5 * SCALE

  it("CF-02: габариты каждой страницы включают стояк Ø11 за габаритами стен точно: maxY = 900 + 5,5 + запас", () => {
    const pages = pagesOf(base([riser(250, 900, 11)]))
    for (const p of pages) expect(pageBounds(p, SCALE).maxY).toBeCloseTo(900 + 5.5 + PAD, 6)
    const without = pagesOf(base())
    for (const p of without) expect(pageBounds(p, SCALE).maxY).toBeLessThan(900)
  })

  it("CF-02b: коммуникации слева и справа: minX = −300 − 10 − запас (стояк Ø20), maxX = 900 + 20 + запас (воздуховод 40×20: полуширина 20)", () => {
    const pages = pagesOf(base([riser(-300, 100, 20), duct(900, 100, 40, 20)]))
    for (const p of pages) {
      const b = pageBounds(p, SCALE)
      expect(b.minX).toBeCloseTo(-300 - 10 - PAD, 6)
      expect(b.maxX).toBeCloseTo(900 + 20 + PAD, 6)
    }
  })

  it("CF-02d: ось Y воздуховода 40×20 (глубина 20 → полуглубина 10): maxY = 900 + 10 + запас, minY = −700 − 10 − запас", () => {
    const pages = pagesOf(base([duct(250, 900, 40, 20, "dd"), duct(250, -700, 40, 20, "du")]))
    for (const p of pages) {
      const b = pageBounds(p, SCALE)
      expect(b.maxY).toBeCloseTo(900 + 10 + PAD, 6)
      expect(b.minY).toBeCloseTo(-700 - 10 - PAD, 6)
    }
  })

  it("CF-02e: у воздуховода ширина и глубина не перепутаны: узкий и глубокий 20×60 → maxX/maxY дают 10 и 30", () => {
    const pages = pagesOf(base([duct(900, 900, 20, 60)]))
    for (const p of pages) {
      const b = pageBounds(p, SCALE)
      expect(b.maxX).toBeCloseTo(900 + 10 + PAD, 6)
      expect(b.maxY).toBeCloseTo(900 + 30 + PAD, 6)
    }
  })

  it("CF-02c: коммуникация внутри габаритов стен габариты не меняет", () => {
    const withIt = pagesOf(base([riser(250, 0, 11)]))
    const without = pagesOf(base())
    withIt.forEach((p, i) => expect(pageBounds(p, SCALE)).toEqual(pageBounds(without[i] as (typeof without)[number], SCALE)))
  })
})

describe("содержимое страниц", () => {
  it("CF-03: стояк Ø11 — окружность радиуса 0,55 мм на каждой из трёх страниц в масштабе 1:100", () => {
    const { doc, pages } = build(base([riser(250, 150, 11)]))
    for (let i = 0; i < 3; i++) expect(circleIn(parsePaths(doc, i + 1), sheetPoint(pages, i, 250, 150), 0.55), `страница ${i + 1}`).toBe(true)
  })

  it("CF-03b: без коммуникаций окружности на страницах нет", () => {
    const { doc, pages } = build(base())
    for (let i = 0; i < 3; i++) expect(circleIn(parsePaths(doc, i + 1), sheetPoint(pages, i, 250, 150), 0.55)).toBe(false)
  })

  it("CF-04: воздуховод 30×20 — прямоугольник и диагональ от левого верхнего угла к правому нижнему на каждой странице", () => {
    const { doc, pages } = build(base([duct(250, 150, 30, 20)]))
    for (let i = 0; i < 3; i++) {
      const paths = parsePaths(doc, i + 1)
      const tl = sheetPoint(pages, i, 235, 140)
      const br = sheetPoint(pages, i, 265, 160)
      const tr = sheetPoint(pages, i, 265, 140)
      const bl = sheetPoint(pages, i, 235, 160)
      expect(hasSegment(paths, tl, br), `диагональ, страница ${i + 1}`).toBe(true)
      expect(hasSegment(paths, tr, bl), `вторая диагональ, страница ${i + 1}`).toBe(false)
      const pts = paths.flatMap((p) => p.points)
      for (const corner of [tl, tr, br, bl]) expect(pts.some((q) => near(q, corner, 0.03))).toBe(true)
    }
  })

  it("CF-05: числа размера и расстояний в PDF не попадают: тексты страниц те же, что без коммуникаций", () => {
    const withIt = build(base([riser(250, 150, 11), duct(100, 150)]))
    const textsWith = texts.map((t) => `${t.page}:${t.text}`)
    const without = build(base())
    const textsWithout = texts.map((t) => `${t.page}:${t.text}`)
    expect(textsWith).toEqual(textsWithout)
    expect(textsWith.some((t) => t.includes("⌀"))).toBe(false)
    expect(withIt.pages).toHaveLength(without.pages.length)
  })

  it("CF-05b: размеры чертежа в мм: окружность при масштабе 1:100 — 1 см чертежа = 0,1 мм листа", () => {
    const { doc, pages } = build(base([riser(250, 150, 20)]))
    expect(circleIn(parsePaths(doc, 1), sheetPoint(pages, 0, 250, 150), 1.0)).toBe(true)
    expect(circleIn(parsePaths(doc, 1), sheetPoint(pages, 0, 250, 150), 0.55)).toBe(false)
  })
})

describe("экспорт без стен", () => {
  it("CF-06: чертёж только с коммуникациями — на страницах нет стен, масштаб не подбирается (экспорт недоступен)", () => {
    const only: Drawing = { ...drawing({ walls: [] }), communications: [riser(250, 150, 11)] }
    const pages = pagesOf(only)
    expect(pages.every((p) => p.walls.length === 0)).toBe(true)
    expect(fitScale(pages, "A4")).toBeNull()
  })
})
