import { readFileSync } from "node:fs"
import type { jsPDFOptions } from "jspdf"
import { describe, expect, it, vi } from "vitest"
import { drawing, drywall, rectWalls } from "../reconstruction/reconstruction.test-utils"
import type { Drawing, SectionLine, SectionShape } from "../types"

// change add-section-shapes: деталь разреза в PDF (spec pdf-export «Деталь разреза в PDF», «Выделение детали не попадает в PDF»)

const texts = vi.hoisted((): string[] => [])

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
          if (typeof text === "string") texts.push(text)
          else if (Array.isArray(text)) for (const t of text) if (typeof t === "string") texts.push(t)
          return Reflect.apply(original, this, args)
        },
      })
    }
  }
  return { ...mod, jsPDF: RecordingPdf }
})

const { buildPdfPages, pagesOf } = await import("./pdf")

const font = readFileSync(new URL("../assets/pt-sans-regular.ttf", import.meta.url)).toString("base64")
const SEP = new Date(2026, 8, 5, 14, 32, 7)

// линия x = 100 от y = 0 до y = 300, взгляд вправо; полка 40 см шириной и 1 см высотой на высоте 120 см     схематично
const line: SectionLine = { id: "L1", label: "A", view: "right", points: [{ x: 100, y: 0 }, { x: 100, y: 300 }] }
const SHELF: SectionShape = { id: "p1", lineId: "L1", s0: 10, s1: 50, z0: 120, z1: 121 }
const withShapes = (shapes: SectionShape[]): Drawing =>
  drawing({ walls: rectWalls("k", 0, 0, 420, 520), reconstruction: { walls: [drywall("g", 20, 30, 220, 30, 10, 270)], dimensions: [], sections: [line], sectionShapes: shapes } })

const build = (d: Drawing) => {
  texts.length = 0
  return buildPdfPages(pagesOf(d), "cm", 50, "A3", font, d.name, SEP)
}

describe("детали в PDF", () => {
  it("SH-900: страница «Реконструкция» получает детали в фигуре линии; другие страницы — нет", () => {
    const pages = pagesOf(withShapes([SHELF]))
    pages.forEach((p) => {
      const shapes = p.reconstruction?.sections?.flatMap((e) => e.shapes) ?? []
      expect(shapes).toEqual(p.title === "Реконструкция" ? [SHELF] : [])
    })
  })

  it("SH-901: деталь не добавляет на лист ни одной надписи: ни габаритов, ни расстояний", () => {
    build(withShapes([]))
    const without = [...texts]
    build(withShapes([SHELF]))
    expect(texts).toEqual(without)
  })

  it("SH-902: страница получает ту же раскладку с деталью и без неё — детали не меняют габариты страницы", () => {
    const withShape = pagesOf(withShapes([SHELF]))
    const without = pagesOf(withShapes([]))
    const i = withShape.findIndex((p) => p.title === "Реконструкция")
    expect(withShape[i].reconstruction?.sections?.[0].figure).toEqual(without[i].reconstruction?.sections?.[0].figure)
  })
})
