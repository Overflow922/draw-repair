import { readFileSync } from "node:fs"
import type { jsPDFOptions } from "jspdf"
import { describe, expect, it, vi } from "vitest"
import { drawing, drywall, rectWalls } from "../reconstruction/reconstruction.test-utils"
import type { Drawing, SectionLine } from "../types"

// change add-section-view: страница PDF «Реконструкция» (spec pdf-export «Страница плана «Реконструкция»»)

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

const { buildPdfPages, pagesOf, pageBounds } = await import("./pdf")

const font = readFileSync(new URL("../assets/pt-sans-regular.ttf", import.meta.url)).toString("base64")
const SEP = new Date(2026, 8, 5, 14, 32, 7)

// комната 420 × 520 (стены 20), стена ГКЛ внутри; линия x = 100 от y = 0 до y = 300, взгляд вправо
//
//   +---------+  .  .  .  +-+      <- фигура правее габаритов на 100 см
//   |  ===    |           | |
//   +---------+           +-+
//   (план)                (фигура)       схематично, не в масштабе
const line: SectionLine = { id: "L1", label: "A", view: "right", points: [{ x: 100, y: 0 }, { x: 100, y: 300 }] }
const withSections = (sections: SectionLine[]): Drawing =>
  drawing({ walls: rectWalls("k", 0, 0, 420, 520), reconstruction: { walls: [drywall("g", 20, 30, 220, 30, 10, 270)], dimensions: [], sections } })

const build = (d: Drawing) => {
  texts.length = 0
  return buildPdfPages(pagesOf(d), "cm", 50, "A3", font, d.name, SEP)
}
const pagesWith = (text: string): number[] => [...new Set(texts.filter((t) => t.text === text).map((t) => t.page))]

describe("страница «Реконструкция»", () => {
  it("SV-400: название фигуры и обозначения линии — только на странице «Реконструкция»", () => {
    build(withSections([line]))
    expect(pagesWith("A–A")).toEqual([5])
    expect(pagesWith("A")).toEqual([5])
  })

  it("SV-401: без линий на странице нет ни названия, ни обозначений", () => {
    build(withSections([]))
    expect(pagesWith("A–A")).toEqual([])
  })

  it("SV-402: габариты страницы включают фигуру правее плана; страницы обмера и демонтажа не меняются", () => {
    const withLine = pagesOf(withSections([line]))
    const without = pagesOf(withSections([]))
    const index = withLine.findIndex((p) => p.title === "Реконструкция")
    expect(index).toBeGreaterThanOrEqual(0)
    // габарит плана — 430 (стена x 420 + 10); фигура — от 530 шириной 300
    expect(pageBounds(withLine[index], 50).maxX).toBeGreaterThanOrEqual(830)
    expect(pageBounds(without[index], 50).maxX).toBeLessThan(530)
    for (const i of [0, 1, 2, 3]) expect(pageBounds(withLine[i], 50)).toEqual(pageBounds(without[i], 50))
  })

  it("SV-403: страницы других планов линий и фигур не получают", () => {
    const pages = pagesOf(withSections([line]))
    pages.forEach((p, i) => {
      if (p.title !== "Реконструкция") expect(p.reconstruction?.sections, `страница ${i + 1}`).toBeUndefined()
    })
  })
})
