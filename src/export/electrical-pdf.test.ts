import { readFileSync } from "node:fs"
import type { jsPDF, jsPDFOptions } from "jspdf"
import { describe, expect, it, vi } from "vitest"
import { drawing, rectWalls } from "../reconstruction/reconstruction.test-utils"
import type { Callout, Dimension, Drawing, ExhaustFan, FurnitureItem, LightFixture, LightSwitch } from "../types"
import { legendEntries } from "./legend"
import type { PlanPage } from "./pdf"
import { parsePaint } from "./pdf-paint.test-utils"
import type { PaintOp } from "./pdf-paint.test-utils"

// change add-electrical-plan: страница «Электрооборудование» в PDF и её легенда
// (spec pdf-export «Страница плана «Электрооборудование»»; design D6)
//
//  вид сверху, схематично, не в масштабе. Комната: внутренние грани x = 0, x = 400, y = 0, y = 300; S — выключатель на внешней
//  грани северной стены y = −20, T — стол
//
//   ###########S########################   <-- внешняя грань y = −20
//   #                                  #
//   #        +----+                    #
//   #        | T  |                    #
//   #        +----+                    #
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

const table: FurnitureItem = { id: "t1", kind: "table", x: 200, y: 150, widthCm: 80, lengthCm: 160, angleDeg: 0 }
const spot: LightFixture = { id: "a", kind: "spot", x: 100, y: 80 }
const fan: ExhaustFan = { id: "e", x: 300, y: 200 }
const block: LightSwitch = { id: "s", at: { x: 200, y: -20 }, angle: -90, keys: [{ lines: ["L2", "LV1"] }, { lines: ["L3"] }] }
const callout: Callout = { id: "c", target: { x: 300, y: 100 }, at: { x: 350, y: 60 }, text: "h=900" }

const room = (): Drawing => drawing({ walls: rectWalls("k", -10, -10, 410, 310) })
const full = (): Drawing => ({
  ...room(),
  furniture: { items: [table], dimensions: [] },
  ceiling: { ceilings: [{ id: "c50", at: { x: 100, y: 100 }, dropMm: 50 }], lights: [spot] },
  switching: { switches: [block], exhausts: [fan] },
})
const electrical = (d: Drawing): PlanPage | undefined => pagesOf(d)[10]
const labels = (page: PlanPage | undefined): string[] => (page ? legendEntries(page).map((e) => e.label) : [])

const RED = [0xe0, 0x1b, 0x1b].map((v) => v / 255)
const near = (a: readonly number[], b: readonly number[]): boolean => a.every((v, i) => Math.abs(v - (b[i] ?? 0)) < 0.01)
type Stroke = Extract<PaintOp, { kind: "stroke" }>
const redSubpaths = (ops: PaintOp[]) => ops.filter((op): op is Stroke => op.kind === "stroke" && near(op.color, RED)).flatMap((op) => op.subpaths)

describe("страница «Электрооборудование» в PDF", () => {
  it("EPDF-01: страниц одиннадцать; последняя — «Электрооборудование» после «Групп включения»", () => {
    const pages = pagesOf(full())
    expect(pages).toHaveLength(11)
    expect(pages[9]?.title).toBe("Группы включения")
    expect(pages[10]?.title).toBe("Электрооборудование")
    expect(build(full()).getNumberOfPages()).toBe(11)
  })

  it("EPDF-02: на странице подложка, предметы «Мебели» и выключатели; потолков и освещения нет", () => {
    const page = electrical(full())
    expect(page?.electrical?.items).toEqual([table])
    expect(page?.electrical?.switches).toEqual([block])
    expect(page?.ceiling).toBeUndefined()
    expect(page?.switching).toBeUndefined()
    expect(page?.distances).toBeUndefined()
    expect(page?.dimensions).toEqual([])
    expect(page?.reconstruction).toBeDefined()
  })

  it("EPDF-03: подписи клавиш выведены на одиннадцатой странице; светильников и вытяжек среди знаков нет", () => {
    build(full())
    const shown = textsOn(11)
    for (const t of ["L2,LV1", "L3"]) expect(shown).toContain(t)
    // подписей потолка «-50мм» на странице нет
    expect(shown).not.toContain("-50мм")
  })

  it("EPDF-04: знак клавиши — кружок 3 мм при масштабе 1:50 и 1:100", () => {
    const size = (sp: readonly { x: number; y: number }[]): { w: number; h: number } => {
      const xs = sp.map((p) => p.x)
      const ys = sp.map((p) => p.y)
      return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
    }
    for (const scale of [50, 100]) {
      const circles = redSubpaths(parsePaint(build(full(), scale), 11)).filter((sp) => sp.length >= 4 && Math.abs(size(sp).w - 3) < 0.05 && Math.abs(size(sp).h - 3) < 0.05)
      expect(circles.length, `1:${scale}`).toBeGreaterThan(0)
    }
  })

  it("EPDF-05: размеры других планов на странице не выводятся", () => {
    const dim: Dimension = { from: { a: { wallId: "k1", edge: 0 }, b: { wallId: "k2", edge: 0 } }, to: { a: { wallId: "k1", edge: 1 }, b: { wallId: "k2", edge: 1 } }, offset: 20 }
    const d: Drawing = { ...full(), dimensions: [dim], plumbing: { dimensions: [dim] }, furniture: { items: [table], dimensions: [dim] } }
    expect(pagesOf(d)[0]?.dimensions).toEqual([dim])
    expect(electrical(d)?.dimensions).toEqual([])
  })

  it("EPDF-06: первые десять страниц такие же, как без выносок и примечаний плана; они лежат на одиннадцатой", () => {
    const base = full()
    const withPlan: Drawing = { ...base, electrical: { callouts: [callout], notes: ["Розетки — отдельно"] } }
    expect(pagesOf(withPlan).slice(0, 10)).toEqual(pagesOf(base).slice(0, 10))
    const page = electrical(withPlan)
    expect(page?.callouts).toEqual([callout])
    expect(page?.notes).toEqual(["Розетки — отдельно"])
    build(withPlan)
    expect(textsOn(11)).toContain("h=900")
    for (let p = 1; p <= 10; p++) expect(textsOn(p)).not.toContain("h=900")
  })

  it("EPDF-07: страница без мебели и выключателей остаётся и показывает подложку", () => {
    const pages = pagesOf(room())
    expect(pages).toHaveLength(11)
    expect(pages[10]?.walls.length).toBeGreaterThan(0)
    expect(pages[10]?.electrical).toEqual({ items: [], switches: [] })
  })

  it("EPDF-08: чертёж без стен даёт пустую одиннадцатую страницу, она остаётся в документе", () => {
    const d = drawing({ walls: [] })
    expect(pagesOf(d)).toHaveLength(11)
    expect(build(d).getNumberOfPages()).toBe(11)
  })

  it("EPDF-09: выключатели не меняют первые девять страниц", () => {
    const without = pagesOf({ ...full(), switching: { exhausts: [fan] } })
    const withSwitch = pagesOf(full())
    expect(withSwitch.slice(0, 9)).toEqual(without.slice(0, 9))
  })
})

describe("легенда страницы «Электрооборудование»", () => {
  it("EPDF-10: есть «Выключатель»; записей «Стол», «Натяжной потолок», светильника, «Вытяжка» и «Линия освещения» нет", () => {
    const shown = labels(electrical(full()))
    expect(shown).toContain("Выключатель")
    for (const absent of ["Стол", "Натяжной потолок", "Точечный встроенный светильник", "Вытяжка", "Линия освещения"]) expect(shown).not.toContain(absent)
  })

  it("EPDF-11: без выключателей записи «Выключатель» нет", () => {
    expect(labels(electrical({ ...full(), switching: {} }))).not.toContain("Выключатель")
  })

  it("EPDF-12: запись «Выключатель» есть на «Группах включения» и «Электрооборудовании» и нет на остальных девяти страницах", () => {
    expect(pagesOf(full()).map((p) => labels(p).includes("Выключатель"))).toEqual([false, false, false, false, false, false, false, false, false, true, true])
  })
})
