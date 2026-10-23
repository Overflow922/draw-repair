import { readFileSync } from "node:fs"
import type { jsPDF, jsPDFOptions } from "jspdf"
import { describe, expect, it, vi } from "vitest"
import { content, drawing, drywall, plaster, rectWalls, wall } from "../reconstruction/reconstruction.test-utils"
import type { Battery, Communication, Drawing, FurnitureItem } from "../types"
import { parsePaint } from "./pdf-paint.test-utils"

// change add-furniture-tv-wall-cabinet: раскладка легенды по двум столбцам в PDF (spec pdf-export «Легенда на странице PDF», сценарии
// «Шестнадцатая запись во втором столбце», «Число столбцов общее для документа», «Ширина легенды при двух столбцах»).

interface TextCall {
  page: number
  text: string
  x: number
  y: number
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
          const [text, x, y] = args
          if (typeof text === "string" && typeof x === "number" && typeof y === "number") texts.push({ page: this.getCurrentPageInfo().pageNumber, text, x, y })
          return Reflect.apply(original, this, args)
        },
      })
    }
  }
  return { ...mod, jsPDF: RecordingPdf }
})

const { buildPdfPages, pagesOf } = await import("./pdf")
const { LEGEND_GAP_MM, LEGEND_PAD_LEFT_MM, LEGEND_ROW_PITCH_MM, legendColumnWidthMm, legendWidthMm } = await import("./legend")
const { SAMPLE_LENGTH_MM } = await import("../render")
const { drawingArea, legendArea } = await import("./sheet-layout")

const font = readFileSync(new URL("../assets/pt-sans-regular.ttf", import.meta.url)).toString("base64")
const SEP = new Date(2026, 8, 5, 14, 32, 7)

const item = (id: string, kind: FurnitureItem["kind"], x: number, y: number, widthCm: number, lengthCm: number): FurnitureItem => ({ id, kind, x, y, widthCm, lengthCm, angleDeg: 0 })

function allKindsDrawing(): Drawing {
  const battery: Battery = { id: "b1", wallId: "k1", face: 1, anchor: "a", offsetCm: 100, lengthCm: 70, thicknessCm: 10, gapCm: 3 }
  const materials = ["blocks", "brick", "concrete", "gkl", "wood-long"] as const
  const walls = [...rectWalls("k", 0, 0, 420, 320), ...materials.map((m, i) => wall(`m${i}`, 600, i * 60, 800, i * 60, 10, m))]
  const riser: Communication = { kind: "riser", id: "r1", x: 200, y: 160, diameterCm: 11 }
  const duct: Communication = { kind: "duct", id: "d1", x: 300, y: 200, widthCm: 30, depthCm: 20 }
  const base = drawing({ walls, roughPlaster: [plaster("a", "k1", 1, "a", 0, 420, 20)], reconstruction: content([drywall("g", 20, 30, 220, 30, 10, 270)]) })
  const items = [
    item("t", "table", 200, 160, 80, 160),
    item("c", "chair", 100, 100, 45, 45),
    item("s", "sofa", 300, 100, 200, 90),
    item("p", "desk", 200, 300, 100, 50),
    item("o", "officeChair", 100, 300, 60, 60),
    item("v", "tv", 300, 300, 91, 11),
    item("w", "wallCabinet", 300, 400, 180, 42),
  ]
  return { ...base, furniture: { items, dimensions: [] }, batteries: [battery], communications: [riser, duct] }
}

function build(): { doc: jsPDF; pagesCount: number } {
  texts.length = 0
  const pages = pagesOf(allKindsDrawing())
  const doc = buildPdfPages(pages, "cm", 50, "A3", font, "Чертёж", SEP)
  return { doc, pagesCount: pages.length }
}

const textOf = (page: number, label: string): TextCall => {
  const found = texts.find((t) => t.page === page && t.text === label)
  if (!found) throw new Error(`подписи «${label}» нет на странице ${page}`)
  return found
}

describe("легенда в два столбца: раскладка в PDF", () => {
  it("LCP-01: «Телевизор» стоит во втором столбце на уровне первой записи первого, шаг и отступ те же", () => {
    build()
    const pages = pagesOf(allKindsDrawing())
    const columnMm = legendColumnWidthMm(pages)
    const first = textOf(6, "Блоки")
    const tv = textOf(6, "Телевизор")
    expect(tv.x - first.x).toBeCloseTo(columnMm, 6)
    expect(tv.y).toBeCloseTo(first.y, 6)
    const cabinetFirstLine = texts.find((t) => t.page === 6 && t.text === "Подвесная")
    expect(cabinetFirstLine).toBeDefined()
    expect(cabinetFirstLine?.x).toBeCloseTo(tv.x, 6)
  })

  it("LCP-02: образец второго столбца начинается на тот же отступ от начала столбца, что и в первом: подпись правее образца на длину образца и зазор", () => {
    build()
    const pages = pagesOf(allKindsDrawing())
    const area = legendArea("A3", legendWidthMm(pages))
    const columnMm = legendColumnWidthMm(pages)
    const tv = textOf(6, "Телевизор")
    expect(tv.x).toBeCloseTo(area.x + columnMm + LEGEND_PAD_LEFT_MM + SAMPLE_LENGTH_MM + LEGEND_GAP_MM, 6)
  })

  it("LCP-03: ширина легенды документа — два столбца, область чертежа сужена на неё на каждой странице", () => {
    const pages = pagesOf(allKindsDrawing())
    expect(legendWidthMm(pages)).toBeCloseTo(2 * legendColumnWidthMm(pages), 6)
    expect(drawingArea("A3", legendWidthMm(pages)).x).toBeCloseTo(legendArea("A3", legendWidthMm(pages)).x + legendWidthMm(pages), 6)
  })

  it("LCP-04: страница с тремя записями при двух столбцах документа рисует только первый столбец", () => {
    build()
    const pages = pagesOf(allKindsDrawing())
    const area = legendArea("A3", legendWidthMm(pages))
    const secondColumnX = area.x + legendColumnWidthMm(pages)
    const onFirstPage = texts.filter((t) => t.page === 1 && t.x >= area.x && t.x < area.x + area.w && t.y >= area.y)
    expect(onFirstPage.length).toBeGreaterThan(0)
    expect(onFirstPage.every((t) => t.x < secondColumnX)).toBe(true)
  })

  it("LCP-05: образец «Телевизор» нарисован линиями во втором столбце, в строке первой записи", () => {
    const { doc } = build()
    const pages = pagesOf(allKindsDrawing())
    const area = legendArea("A3", legendWidthMm(pages))
    const x0 = area.x + legendColumnWidthMm(pages)
    const strokes = parsePaint(doc, 6).filter((op) => op.kind === "stroke" && op.subpaths.flat().every((p) => p.x > x0 && p.x < x0 + legendColumnWidthMm(pages) && p.y >= area.y && p.y <= area.y + LEGEND_ROW_PITCH_MM))
    expect(strokes.length).toBeGreaterThan(0)
  })
})
