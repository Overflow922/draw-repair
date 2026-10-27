import { readFileSync } from "node:fs"
import type { jsPDF, jsPDFOptions } from "jspdf"
import { describe, expect, it, vi } from "vitest"
import { content, drawing, drywall, rectWalls } from "../reconstruction/reconstruction.test-utils"
import type { Callout, Dimension, Drawing, FurnitureItem, LightFixture, StretchCeiling } from "../types"
import { legendEntries } from "./legend"
import type { PlanPage } from "./pdf"
import { parsePaint } from "./pdf-paint.test-utils"
import type { PaintOp } from "./pdf-paint.test-utils"

// change add-switching-plan: десятая страница PDF «Группы включения» и её легенда
// (spec pdf-export «Страница плана «Группы включения»», «Легенда страницы «Группы включения»»; design D7)
//
//  вид сверху, схематично, не в масштабе. Комната: стены толщиной 20 см по осям [-10,410]×[-10,310], внутренние грани
//  x = 0, x = 400, y = 0, y = 300. Светильник S в (100, 80), люстра X в (250, 150), стол T по центру
//
//   ##########################
//   #<--100-->(S)            #     на странице: стены, стол, знаки; без расстояний и заливки потолка
//   #            [ T ]  (X)  #
//   ##########################

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
const chandelier: LightFixture = { id: "x", kind: "chandelier", x: 250, y: 150 }
const stretch: StretchCeiling = { id: "c", at: { x: 300, y: 100 }, dropMm: 50 }
const table: FurnitureItem = { id: "t", kind: "table", x: 200, y: 150, widthCm: 80, lengthCm: 160, angleDeg: 0 }
const callout: Callout = { id: "co", target: { x: 100, y: 80 }, at: { x: 150, y: 120 }, text: "Выключатель у двери" }

const room = (): Drawing => drawing({ walls: rectWalls("k", -10, -10, 410, 310) })
const full = (): Drawing => ({
  ...room(),
  furniture: { items: [table], dimensions: [] },
  ceiling: { ceilings: [stretch], lights: [spot("s", 100, 80), chandelier] },
})
const labels = (page: PlanPage | undefined): string[] => (page ? legendEntries(page).map((e) => e.label) : [])

const RED = [0xe0, 0x1b, 0x1b].map((v) => v / 255)
const near = (a: readonly number[], b: readonly number[]): boolean => a.every((v, i) => Math.abs(v - (b[i] ?? 0)) < 0.01)
type Stroke = Extract<PaintOp, { kind: "stroke" }>
const redBars = (ops: PaintOp[]): number[] =>
  ops
    .filter((op): op is Stroke => op.kind === "stroke" && near(op.color, RED))
    .flatMap((op) => op.subpaths)
    .filter((sp) => sp.length === 2 && Math.abs((sp[0]?.y ?? 0) - (sp[1]?.y ?? 1)) < 1e-6)
    .map((sp) => Math.abs((sp[1]?.x ?? 0) - (sp[0]?.x ?? 0)))
const YELLOW_FILLS = (ops: PaintOp[]): PaintOp[] => ops.filter((op) => op.kind === "fill" && op.color[0] > 0.9 && op.color[1] > 0.8 && op.color[2] < 0.7)

describe("страница «Группы включения»", () => {
  it("SW-30: страница десятая; на ней знаки светильника и люстры, без расстояний и подписи потолка", () => {
    const doc = build(full())
    expect(doc.getNumberOfPages()).toBe(10)
    expect(redBars(parsePaint(doc, 10)).length).toBeGreaterThan(0)
    const shown = textsOn(10)
    for (const t of ["100", "80", "-50мм"]) expect(shown).not.toContain(t)
  })

  it("SW-31: у стола нет габаритов «80» и «160»", () => {
    build(full())
    const shown = textsOn(10)
    for (const t of ["80", "160"]) expect(shown).not.toContain(t)
  })

  it("SW-32: жёлтой заливки натяжного потолка нет на десятой странице, а на восьмой есть", () => {
    const doc = build(full())
    expect(YELLOW_FILLS(parsePaint(doc, 10))).toEqual([])
    expect(YELLOW_FILLS(parsePaint(doc, 8)).length).toBeGreaterThan(0)
  })

  it("SW-33: страница без мебели и освещения остаётся", () => {
    const doc = build(room())
    expect(doc.getNumberOfPages()).toBe(10)
    expect(redBars(parsePaint(doc, 10))).toEqual([])
  })

  it("SW-34: знак 3 мм при 1:50 и 1:100", () => {
    for (const scale of [50, 100]) {
      const bars = redBars(parsePaint(build(full(), scale), 10))
      expect(bars.some((w) => Math.abs(w - 3) < 0.01)).toBe(true)
    }
  })

  it("SW-35: размер плана «Мебель» на десятой странице не выводится", () => {
    const dim: Dimension = { from: { a: { wallId: "k1", edge: 0 }, b: { wallId: "k2", edge: 1 } }, to: { a: { wallId: "k3", edge: 0 }, b: { wallId: "k4", edge: 1 } }, offset: 20 }
    const d: Drawing = { ...full(), furniture: { items: [table], dimensions: [dim] } }
    build(full())
    const plain = textsOn(10)
    build(d)
    expect(textsOn(10)).toEqual(plain)
  })

  // TCR (change merge-lighting-plans): выноски и примечания единого плана лежат в объектах плана ceiling и выводятся только на
  // первой его странице (восьмой); на девятой и десятой их нет (spec pdf-export «Выноски только на первом чертеже»)
  it("SW-36: выноски и примечания плана есть на восьмой странице и их нет на девятой и десятой", () => {
    build(full())
    const nineBefore = textsOn(9)
    const tenBefore = textsOn(10)
    const d: Drawing = { ...full(), ceiling: { ...full().ceiling, ceilings: full().ceiling?.ceilings ?? [], callouts: [callout], notes: ["Группа 1"] } }
    build(d)
    expect(textsOn(8)).toEqual(expect.arrayContaining(["Выключатель у двери", "Группа 1"]))
    expect(textsOn(9)).toEqual(nineBefore)
    expect(textsOn(10)).toEqual(tenBefore)
  })

  it("SW-36b: метки линий, выключатели и вытяжки не меняют первые девять страниц", () => {
    build(full())
    const before = Array.from({ length: 9 }, (_, i) => textsOn(i + 1))
    const d: Drawing = {
      ...full(),
      switching: { lines: [{ id: "m", targetId: "s", name: "L1" }], exhausts: [{ id: "f", x: 60, y: 60 }], switches: [{ id: "k", at: { x: 100, y: 0 }, angle: 90, keys: [{ lines: ["L1"] }] }] },
    }
    build(d)
    expect(Array.from({ length: 9 }, (_, i) => textsOn(i + 1))).toEqual(before)
    expect(textsOn(10)).toEqual(expect.arrayContaining(["L1"]))
  })

  it("SW-37: габариты страницы включают центры объектов освещения", () => {
    const d: Drawing = { ...room(), ceiling: { ceilings: [], lights: [spot("s", 700, 80)] } }
    const page = pagesOf(d)[9]
    const bare = pagesOf(room())[9]
    if (!page || !bare) throw new Error("нет страницы")
    expect(pageBounds(page, 50).maxX).toBeGreaterThanOrEqual(700)
    expect(pageBounds(bare, 50).maxX).toBeLessThan(700)
  })

  it("SW-38: подложка — стена гипсокартона входит в страницу", () => {
    const d: Drawing = { ...room(), reconstruction: content([drywall("g", 50, 100, 150, 100)]) }
    expect(labels(pagesOf(d)[9])).toContain("Гипсокартон")
  })
})

describe("легенда страницы «Группы включения»", () => {
  it("SW-40: «Кирпич», «Точечный встроенный светильник», «Люстра»; записей «Натяжной потолок» и «Стол» нет", () => {
    const d: Drawing = { ...full(), ceiling: { ceilings: [stretch], lights: [spot("s1", 100, 80), spot("s2", 150, 80), chandelier] } }
    expect(labels(pagesOf(d)[9])).toEqual(["Кирпич", "Точечный встроенный светильник", "Люстра"])
  })

  it("SW-41: без объектов освещения записей видов освещения нет", () => {
    const d: Drawing = { ...room(), furniture: { items: [table], dimensions: [] } }
    expect(labels(pagesOf(d)[9])).toEqual(["Кирпич"])
  })

  it("SW-42: записи освещения есть на страницах «Потолки и освещение» и «Группы включения», в первых семи их нет", () => {
    const pages = pagesOf(full())
    const titles = ["Точечный встроенный светильник", "Люстра"]
    for (const page of pages.slice(0, 7)) expect(labels(page).filter((l) => titles.includes(l))).toEqual([])
    expect(labels(pages[7]).filter((l) => titles.includes(l))).toEqual(titles)
    expect(labels(pages[9]).filter((l) => titles.includes(l))).toEqual(titles)
  })
})
