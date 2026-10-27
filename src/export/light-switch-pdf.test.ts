import { readFileSync } from "node:fs"
import type { jsPDF, jsPDFOptions } from "jspdf"
import { describe, expect, it, vi } from "vitest"
import { drawing, rectWalls } from "../reconstruction/reconstruction.test-utils"
import type { Drawing, LightFixture, LightLine, LightSwitch } from "../types"
import { legendEntries } from "./legend"
import type { PlanPage } from "./pdf"
import { parsePaint } from "./pdf-paint.test-utils"
import type { PaintOp } from "./pdf-paint.test-utils"

// change add-light-switch: выключатели на странице «Группы включения» и запись легенды
// (spec pdf-export «Выключатель на странице», «Запись «Выключатель»»; design D4, D7)
//
//  вид сверху, схематично, не в масштабе. Комната: внутренние грани x = 0, x = 400, y = 0, y = 300; внешняя грань северной
//  стены y = −20
//
//      L2,LV1     L3     L4,L5         подписи клавиш над блоком
//        -o       -o      -o           клавиши: кружок на грани, стойка, штрих
//   ####################################   <-- внешняя грань y = −20
//   #                                  #

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

const spot: LightFixture = { id: "a", kind: "spot", x: 100, y: 80 }
const label: LightLine = { id: "m", targetId: "a", name: "L3" }
const block: LightSwitch = { id: "s", at: { x: 200, y: -20 }, angle: -90, keys: [{ lines: ["L2", "LV1"] }, { lines: ["L3"] }, { lines: ["L4", "L5"] }] }

const room = (): Drawing => drawing({ walls: rectWalls("k", -10, -10, 410, 310) })
const withSwitches = (switches: LightSwitch[], lines: LightLine[] = []): Drawing => ({
  ...room(),
  ceiling: { ceilings: [], lights: [spot] },
  switching: { ...(lines.length > 0 ? { lines } : null), ...(switches.length > 0 ? { switches } : null) },
})
const switchingPage = (d: Drawing): PlanPage | undefined => pagesOf(d)[8]
const labels = (page: PlanPage | undefined): string[] => (page ? legendEntries(page).map((e) => e.label) : [])

const RED = [0xe0, 0x1b, 0x1b].map((v) => v / 255)
const near = (a: readonly number[], b: readonly number[]): boolean => a.every((v, i) => Math.abs(v - (b[i] ?? 0)) < 0.01)
type Stroke = Extract<PaintOp, { kind: "stroke" }>
const redSubpaths = (ops: PaintOp[]) => ops.filter((op): op is Stroke => op.kind === "stroke" && near(op.color, RED)).flatMap((op) => op.subpaths)
// ширина и высота охватывающего прямоугольника подпути, мм
const sizeOf = (sp: readonly { x: number; y: number }[]): { w: number; h: number } => {
  const xs = sp.map((p) => p.x)
  const ys = sp.map((p) => p.y)
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
}
// кружок клавиши — подпуть 3 × 3 мм; контекст jsPDF выводит окружность дважды, поэтому одинаковые центры считаются один раз
const circles = (ops: PaintOp[]): string[] => {
  const centers = redSubpaths(ops)
    .filter((sp) => sp.length >= 4 && Math.abs(sizeOf(sp).w - 3) < 0.05 && Math.abs(sizeOf(sp).h - 3) < 0.05)
    .map((sp) => `${(Math.min(...sp.map((p) => p.x)) + 1.5).toFixed(1)},${(Math.min(...sp.map((p) => p.y)) + 1.5).toFixed(1)}`)
  return [...new Set(centers)]
}

describe("выключатель на странице «Группы включения»", () => {
  it("LS-100: три подписи клавиш на девятой странице", () => {
    build(withSwitches([block]))
    const shown = textsOn(9)
    for (const t of ["L2,LV1", "L3", "L4,L5"]) expect(shown).toContain(t)
  })

  it("LS-101: подписей выключателя нет на первых восьми страницах", () => {
    build(withSwitches([block]))
    for (let page = 1; page <= 8; page++) expect(textsOn(page)).not.toContain("L2,LV1")
  })

  it("LS-102: диаметр кружка клавиши 3 мм при 1:50 и при 1:100", () => {
    for (const scale of [50, 100]) expect(circles(parsePaint(build(withSwitches([block]), scale), 9)).length).toBeGreaterThan(0)
  })

  it("LS-103: выключатели не меняют первые восемь страниц", () => {
    build(withSwitches([]))
    const before = Array.from({ length: 8 }, (_, i) => textsOn(i + 1))
    build(withSwitches([block]))
    expect(Array.from({ length: 8 }, (_, i) => textsOn(i + 1))).toEqual(before)
  })

  it("LS-104: клавиша без линий — без подписи", () => {
    build(withSwitches([{ ...block, keys: [{ lines: [] }] }]))
    expect(textsOn(9).filter((t) => t.startsWith("L"))).toEqual([])
  })
})

describe("легенда страницы «Группы включения»: «Выключатель»", () => {
  it("LS-105: запись идёт после записей освещения и «Линии освещения»", () => {
    expect(labels(switchingPage(withSwitches([block], [label])))).toEqual(["Кирпич", "Точечный встроенный светильник", "Линия освещения", "Выключатель"])
  })

  it("LS-106: меток нет — «Выключатель» идёт сразу после записей видов освещения", () => {
    expect(labels(switchingPage(withSwitches([block])))).toEqual(["Кирпич", "Точечный встроенный светильник", "Выключатель"])
  })

  it("LS-107: нет выключателей — записи нет, в других легендах тоже", () => {
    expect(labels(switchingPage(withSwitches([])))).not.toContain("Выключатель")
    expect(pagesOf(withSwitches([block])).slice(0, 8).flatMap((p) => labels(p))).not.toContain("Выключатель")
  })

  it("LS-108: без выключателей кружков нет вовсе — ни на плане, ни образцом в легенде; образец без подписи", () => {
    // светильника нет: его знак тоже кружок 3 мм и мешал бы счёту
    const bare = (switches: LightSwitch[]): Drawing => ({ ...room(), ...(switches.length > 0 ? { switching: { switches } } : null) })
    expect(circles(parsePaint(build(bare([])), 9))).toHaveLength(0)
    const one: LightSwitch = { ...block, keys: [{ lines: [] }] }
    expect(circles(parsePaint(build(bare([one])), 9)).length).toBeGreaterThan(0)
    expect(textsOn(9).filter((t) => t.startsWith("L"))).toEqual([])
  })
})
