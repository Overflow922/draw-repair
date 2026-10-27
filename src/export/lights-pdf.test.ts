import { readFileSync } from "node:fs"
import type { jsPDF, jsPDFOptions } from "jspdf"
import { describe, expect, it, vi } from "vitest"
import { drawing, rectWalls } from "../reconstruction/reconstruction.test-utils"
import { LIGHT_PALETTE } from "../theme"
import type { Drawing, LightFixture, StretchCeiling } from "../types"
import { legendEntries, wrapLabel } from "./legend"
import type { PlanPage } from "./pdf"
import { parsePaint } from "./pdf-paint.test-utils"
import type { PaintOp } from "./pdf-paint.test-utils"

// change add-ceiling-lighting: объекты освещения на восьмой странице PDF и записи видов освещения в легенде
// (spec pdf-export «Страница плана «Потолки и освещение»», «Легенда на странице PDF»; design D8)
//
//  вид сверху, схематично, не в масштабе. Комната: стены толщиной 20 см по осям [-10,410]×[-10,310], внутренние грани
//  x = 0, x = 400, y = 0, y = 300. Светильник S в (100, 80), бра B на грани y = 0 с центром (120, 0)
//
//   ##########/B\#########################
//   #<--120-->  |80                       #
//   #<---100--->(S)                       #
//   #                                     #
//   #######################################

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

const { buildPdfPages, pageBounds, pagesOf } = await import("./pdf")

const font = readFileSync(new URL("../assets/pt-sans-regular.ttf", import.meta.url)).toString("base64")
const SEP = new Date(2026, 8, 5, 14, 32, 7)

const build = (d: Drawing, scale = 50): jsPDF => {
  texts.length = 0
  return buildPdfPages(pagesOf(d), "cm", scale, "A3", font, d.name, SEP)
}
const textsOn = (n: number): string[] => texts.filter((t) => t.page === n).map((t) => t.text)

const spot = (id: string, x: number, y: number): LightFixture => ({ id, kind: "spot", x, y })
const sconce: LightFixture = { id: "b", kind: "sconce", x: 120, y: 0, angleDeg: 90 }
const outlet: LightFixture = { id: "o", kind: "lighting-outlet", x: 300, y: 200 }
const smoke: LightFixture = { id: "d", kind: "smoke-detector", x: 200, y: 150 }
const ceiling: StretchCeiling = { id: "c", at: { x: 300, y: 100 }, dropMm: 50 }

const withLights = (lights: LightFixture[], ceilings: StretchCeiling[] = [ceiling]): Drawing => ({
  ...drawing({ walls: rectWalls("k", -10, -10, 410, 310) }),
  ceiling: { ceilings, lights },
})
const labels = (page: PlanPage | undefined): string[] => (page ? legendEntries(page).map((e) => e.label) : [])

const RED = [0xe0, 0x1b, 0x1b].map((v) => v / 255)
const near = (a: readonly number[], b: readonly number[]): boolean => a.every((v, i) => Math.abs(v - (b[i] ?? 0)) < 0.01)
type Stroke = Extract<PaintOp, { kind: "stroke" }>
// горизонтальные отрезки красного цвета: перекрестие знака светильника
const redBars = (ops: PaintOp[]): number[] =>
  ops
    .filter((op): op is Stroke => op.kind === "stroke" && near(op.color, RED))
    .flatMap((op) => op.subpaths)
    .filter((sp) => sp.length === 2 && Math.abs((sp[0]?.y ?? 0) - (sp[1]?.y ?? 1)) < 1e-6)
    .map((sp) => Math.abs((sp[1]?.x ?? 0) - (sp[0]?.x ?? 0)))

describe("освещение на странице PDF", () => {
  it("CL-P1: на восьмой странице знаки и размеры «100», «80» светильника и «120» бра", () => {
    const d = withLights([spot("s", 100, 80), sconce])
    const doc = build(d)
    expect(doc.getNumberOfPages()).toBe(9) // TCR (change add-switching-plan): девять — девятый план «Группы включения»
    expect(textsOn(8)).toEqual(expect.arrayContaining(["100", "80", "120"]))
    expect(redBars(parsePaint(doc, 8)).length).toBeGreaterThan(0)
  })

  it("CL-P2: знак 3 мм при 1:50 и 1:100", () => {
    const d = withLights([spot("s", 100, 80)])
    for (const scale of [50, 100]) {
      const bars = redBars(parsePaint(build(d, scale), 8))
      expect(bars.some((w) => Math.abs(w - 3) < 0.01)).toBe(true)
    }
  })

  it("CL-P3: на первых семи страницах объектов освещения и их чисел нет", () => {
    const d = withLights([spot("s", 100, 80)], [])
    const doc = build(d)
    for (let n = 1; n <= 7; n++) expect(redBars(parsePaint(doc, n))).toEqual([])
    expect(textsOn(1)).not.toContain("80")
  })

  it("CL-P4: габариты страницы включают центры объектов освещения", () => {
    const page = pagesOf(withLights([spot("s", 700, 80)]))[7]
    if (!page) throw new Error("нет страницы")
    expect(pageBounds(page, 50).maxX).toBeGreaterThanOrEqual(700)
    const bare = pagesOf(withLights([]))[7]
    if (!bare) throw new Error("нет страницы")
    expect(pageBounds(bare, 50).maxX).toBeLessThan(700)
  })
})

describe("легенда освещения", () => {
  it("CL-P10: после «Натяжной потолок» — виды в порядке каталога, каждый один раз; отсутствующих нет", () => {
    const page = pagesOf(withLights([outlet, spot("s1", 100, 80), sconce, spot("s2", 200, 80)]))[7]
    expect(labels(page)).toEqual(["Кирпич", "Натяжной потолок", "Точечный встроенный светильник", "Бра", "Электровывод для освещения"])
  })

  it("CL-P11: образец ДПС — красный знак и подпись «ДПС»; длинная подпись переносится", () => {
    const d = withLights([smoke], [])
    const doc = build(d)
    const shown = textsOn(8)
    expect(shown).toContain("ДПС")
    const lines = wrapLabel("Датчик пожарной сигнализации потолочный")
    expect(lines.length).toBeGreaterThan(1)
    expect(shown).toEqual(expect.arrayContaining(lines))
    expect(parsePaint(doc, 8).some((op) => op.kind === "fill" && near(op.color, RED))).toBe(true)
  })

  it("CL-P12: записей видов освещения нет в легендах первых семи страниц", () => {
    const pages = pagesOf(withLights([spot("s", 100, 80), sconce, outlet, smoke, { id: "l", kind: "chandelier", x: 200, y: 200 }]))
    const titles = ["Точечный встроенный светильник", "Датчик пожарной сигнализации потолочный", "Люстра", "Бра", "Электровывод для освещения"]
    for (const page of pages.slice(0, 7)) expect(labels(page).filter((l) => titles.includes(l))).toEqual([])
    expect(labels(pages[7]).filter((l) => titles.includes(l))).toEqual(titles)
  })

  it("CL-P13: цвет знаков — светлой схемы", () => {
    expect(LIGHT_PALETTE.lightingRed).toBe("#e01b1b")
  })
})
