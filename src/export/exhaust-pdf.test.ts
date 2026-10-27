import { readFileSync } from "node:fs"
import type { jsPDF, jsPDFOptions } from "jspdf"
import { describe, expect, it, vi } from "vitest"
import { drawing, rectWalls } from "../reconstruction/reconstruction.test-utils"
import type { Drawing, ExhaustFan, LightFixture, LightLine } from "../types"
import { legendEntries } from "./legend"
import type { PlanPage } from "./pdf"
import { parsePaint } from "./pdf-paint.test-utils"
import type { PaintOp } from "./pdf-paint.test-utils"

// change add-exhaust-fan: вытяжки на странице «Группы включения» и запись легенды
// (spec pdf-export «Вытяжка на странице», «Запись «Вытяжка»»; exhaust-fan «Знак на бумаге»)
//
//  вид сверху, схематично, не в масштабе. Комната: внутренние грани x = 0, x = 400, y = 0, y = 300
//
//   ####################################
//   #       LV1                        #
//   #      [x]  <-- вытяжка (100, 80): квадрат 3,5 мм, подпись на 2 мм правее и выше
//   ####################################

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

const { buildPdfPages, pagesOf } = await import("./pdf")

const font = readFileSync(new URL("../assets/pt-sans-regular.ttf", import.meta.url)).toString("base64")
const SEP = new Date(2026, 8, 5, 14, 32, 7)

const build = (d: Drawing, scale = 50): jsPDF => {
  texts.length = 0
  return buildPdfPages(pagesOf(d), "cm", scale, "A3", font, d.name, SEP)
}
const textsOn = (n: number): string[] => texts.filter((t) => t.page === n).map((t) => t.text)

const spot: LightFixture = { id: "a", kind: "spot", x: 200, y: 200 }
const fan: ExhaustFan = { id: "f", x: 100, y: 80 }
const mark: LightLine = { id: "m", targetId: "f", name: "LV1" }
const lightMark: LightLine = { id: "n", targetId: "a", name: "L3" }

const room = (): Drawing => drawing({ walls: rectWalls("k", -10, -10, 410, 310) })
const withFans = (exhausts: ExhaustFan[], lines: LightLine[] = []): Drawing => ({
  ...room(),
  ceiling: { ceilings: [], lights: [spot] },
  switching: { ...(lines.length > 0 ? { lines } : null), ...(exhausts.length > 0 ? { exhausts } : null) },
})
const switchingPage = (d: Drawing): PlanPage | undefined => pagesOf(d)[8]
const labels = (page: PlanPage | undefined): string[] => (page ? legendEntries(page).map((e) => e.label) : [])

const RED = [0xe0, 0x1b, 0x1b].map((v) => v / 255)
const near = (a: readonly number[], b: readonly number[]): boolean => a.every((v, i) => Math.abs(v - (b[i] ?? 0)) < 0.01)
type Stroke = Extract<PaintOp, { kind: "stroke" }>
const redSubpaths = (ops: PaintOp[]) => ops.filter((op): op is Stroke => op.kind === "stroke" && near(op.color, RED)).flatMap((op) => op.subpaths)
const sizeOf = (sp: readonly { x: number; y: number }[]): { w: number; h: number } => {
  const xs = sp.map((p) => p.x)
  const ys = sp.map((p) => p.y)
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
}
// квадрат знака вытяжки — замкнутый подпуть 3,5 × 3,5 мм
const squares = (ops: PaintOp[]): number =>
  redSubpaths(ops).filter((sp) => sp.length >= 4 && Math.abs(sizeOf(sp).w - 3.5) < 0.05 && Math.abs(sizeOf(sp).h - 3.5) < 0.05).length

describe("вытяжка на странице «Группы включения»", () => {
  it("знак вытяжки со стороной 3,5 мм при 1:50 и при 1:100, подпись «LV1» на девятой странице", () => {
    for (const scale of [50, 100]) {
      const pdf = build(withFans([fan], [mark]), scale)
      expect(squares(parsePaint(pdf, 9))).toBeGreaterThan(0)
      expect(textsOn(9)).toContain("LV1")
    }
  })

  it("без вытяжек квадратов нет", () => {
    expect(squares(parsePaint(build(withFans([])), 9))).toBe(0)
  })

  it("вытяжка не попадает на первые восемь страниц и не меняет их", () => {
    build(withFans([]))
    const before = Array.from({ length: 8 }, (_, i) => textsOn(i + 1))
    build(withFans([fan], [mark]))
    expect(Array.from({ length: 8 }, (_, i) => textsOn(i + 1))).toEqual(before)
    for (let page = 1; page <= 8; page++) expect(squares(parsePaint(build(withFans([fan], [mark])), page))).toBe(0)
  })

  it("метка LV1 у светильника не показывается", () => {
    build(withFans([fan], [{ id: "x", targetId: "a", name: "LV1" }]))
    expect(textsOn(9)).not.toContain("LV1")
  })
})

describe("легенда страницы «Группы включения»: «Вытяжка»", () => {
  it("запись идёт после видов освещения и до «Линии освещения»", () => {
    expect(labels(switchingPage(withFans([fan], [mark, lightMark])))).toEqual(["Кирпич", "Точечный встроенный светильник", "Вытяжка", "Линия освещения"])
  })
  it("нет вытяжек — записи нет, в других легендах тоже", () => {
    expect(labels(switchingPage(withFans([])))).not.toContain("Вытяжка")
    expect(pagesOf(withFans([fan])).slice(0, 8).flatMap((p) => labels(p))).not.toContain("Вытяжка")
  })
  it("образец рисует знак вытяжки в тех же 3,5 мм", () => {
    const bare: Drawing = { ...room(), switching: { exhausts: [fan] } }
    // на плане и в легенде — по квадрату
    expect(squares(parsePaint(build(bare), 9))).toBeGreaterThanOrEqual(2)
  })
})
