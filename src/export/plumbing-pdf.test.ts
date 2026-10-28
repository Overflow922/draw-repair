import { readFileSync } from "node:fs"
import type { jsPDF, jsPDFOptions } from "jspdf"
import { describe, expect, it, vi } from "vitest"
import { nearestDimAnchor } from "../geometry"
import { drywallColors } from "../reconstruction/reconstruction-render"
import { content, drawing, drywall, plaster } from "../reconstruction/reconstruction.test-utils"
import { LIGHT_PALETTE } from "../theme"
import type { Callout, Dimension, DimPoint, Drawing, FurnitureItem, Unit, Wall } from "../types"
import { legendEntries } from "./legend"
import type { PageFormat, PlanPage } from "./pdf"
import { parsePaint } from "./pdf-paint.test-utils"
import type { PaintOp } from "./pdf-paint.test-utils"

// change add-plumbing-plan: седьмая страница PDF — план «Сантехника» и записи легенды
// (spec pdf-export «Страница плана «Сантехника»», «Легенда на странице PDF»; design D8)
//
//  вид сверху, схематично, не в масштабе. Стены W1 (ось y = −10) и W2 (ось x = −10) толщиной 20 см сходятся углом:
//  внутренняя вершина контура V = (0, 0). Раковина S 45 × 40, угол 0, центр C = (107.5, 20); стол T далеко справа
//
//   V#############################################################
//   #|<------------- 107,5 ------------->|
//   #|                         +----------:----------+       +------+
//   #|                         |    S     C          |       |  T   |
//   #                          +---------------------+       +------+

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

const build = (d: Drawing, scale = 50, format: PageFormat = "A3", unit: Unit = "cm"): jsPDF => {
  texts.length = 0
  return buildPdfPages(pagesOf(d), unit, scale, format, font, d.name, SEP)
}
const textsOn = (n: number): string[] => texts.filter((t) => t.page === n).map((t) => t.text)

const W1: Wall = { id: "w1", a: { x: -20, y: -10 }, b: { x: 600, y: -10 }, thicknessCm: 20, type: "brick" }
const W2: Wall = { id: "w2", a: { x: -10, y: -20 }, b: { x: -10, y: 400 }, thicknessCm: 20, type: "brick" }
const sink = (): FurnitureItem => ({ id: "s", kind: "sink", x: 107.5, y: 20, widthCm: 45, lengthCm: 40, angleDeg: 0 })
const item = (id: string, kind: FurnitureItem["kind"], x: number): FurnitureItem => ({ id, kind, x, y: 150, widthCm: 60, lengthCm: 80, angleDeg: 0 })
const table = (): FurnitureItem => ({ id: "t", kind: "table", x: 450, y: 200, widthCm: 80, lengthCm: 160, angleDeg: 0 })

const G = (): ReturnType<typeof drywall> => drywall("g", 300, 300, 500, 300, 10, 270)
const base = (): Drawing => drawing({ walls: [W1, W2], roughPlaster: [plaster("p", "w1", 1, "a", 200, 400, 20)], reconstruction: content([G()]) })

// вершина V берётся тем же снапом, что у инструмента «Размер», по стенам подложки страницы (у остатков обмера свои id)
const vertexV = (): DimPoint => {
  const hit = nearestDimAnchor({ x: 0.5, y: 0.5 }, pagesOf(base())[6]?.walls ?? [], [], 5)
  if (!hit) throw new Error("нет вершины V")
  return hit.anchor
}
const toCenter = (): Dimension => ({ from: vertexV(), to: { kind: "item", itemId: "s", at: { kind: "center" } }, offset: -30 })
const withFurniture = (d: Drawing, items: FurnitureItem[], dimensions: Dimension[] = []): Drawing => ({ ...d, furniture: { items, dimensions } })

const rgbOf = (hex: string): readonly [number, number, number] => {
  const short = hex.replace("#", "")
  const h = short.length === 3 ? [...short].map((c) => c + c).join("") : short
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as unknown as readonly [number, number, number]
}
const near = (a: readonly number[], b: readonly number[]): boolean => a.every((v, i) => Math.abs(v - (b[i] ?? 0)) < 0.01)
const INK = rgbOf(LIGHT_PALETTE.ink)
const GREEN = rgbOf(drywallColors("light").fill)
type Stroke = Extract<PaintOp, { kind: "stroke" }>
const boxOf = (pts: readonly { x: number; y: number }[]): { w: number; h: number } => {
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
}
// штрихи цвета контуров, у которых внешний (первый) контур имеет габариты w × h мм
const inkStrokesOfSize = (doc: jsPDF, page: number, w: number, h: number): Stroke[] =>
  parsePaint(doc, page).filter((op): op is Stroke => {
    if (op.kind !== "stroke" || !near(op.color, INK)) return false
    const first = op.subpaths[0]
    if (!first || first.length < 3) return false
    const b = boxOf(first)
    return Math.abs(b.w - w) < 0.1 && Math.abs(b.h - h) < 0.1
  })
const fillsOfSize = (doc: jsPDF, page: number, w: number, h: number): number =>
  parsePaint(doc, page).filter((op) => op.kind === "fill" && op.box !== null && Math.abs(op.box.w - w) < 0.1 && Math.abs(op.box.h - h) < 0.1).length
const greenFills = (doc: jsPDF, page: number): number => parsePaint(doc, page).filter((op) => op.kind === "fill" && near(op.color, GREEN)).length
const labels = (page: PlanPage | undefined): string[] => (page ? legendEntries(page).map((e) => e.label) : [])

describe("страница «Сантехника» в PDF", () => {
  it("PP-01: страниц семь; седьмая — «Сантехника»: раковина линиями без заливки, зелёный гипсокартон, стола нет", () => {
    const d = withFurniture(base(), [table(), sink()])
    const pages = pagesOf(d)
    expect(pages).toHaveLength(10) // TCR (change add-ceiling-plan): восемь — восьмой план «Потолки и освещение» // TCR (change add-switching-plan): девять — девятый план «Группы включения» // TCR (change split-ceiling-pdf-pages): десять — вторая страница плана «Потолки и освещение»
    expect(pages[6]?.title).toBe("Сантехника")
    expect(pages[6]?.furniture?.items.map((t) => t.id)).toEqual(["s"])
    const doc = build(d)
    expect(doc.getNumberOfPages()).toBe(10) // TCR (change add-ceiling-plan): восемь — восьмой план «Потолки и освещение» // TCR (change add-switching-plan): девять — девятый план «Группы включения» // TCR (change split-ceiling-pdf-pages): десять — вторая страница плана «Потолки и освещение»
    // раковина 45 × 40 см при 1:50 — 9 × 8 мм; стол 80 × 160 — 16 × 32 мм
    expect(inkStrokesOfSize(doc, 7, 9, 8).length).toBeGreaterThan(0)
    expect(fillsOfSize(doc, 7, 9, 8)).toBe(0)
    expect(inkStrokesOfSize(doc, 7, 16, 32)).toEqual([])
    expect(inkStrokesOfSize(doc, 6, 16, 32).length).toBeGreaterThan(0)
    expect(greenFills(doc, 7)).toBeGreaterThan(0)
  })

  it("PP-02: единица — мм: у раковины габариты «450» и «400» и размер плана «1075» до её центра", () => {
    const d = { ...withFurniture(base(), [sink()]), plumbing: { dimensions: [toCenter()] } }
    build(d, 50, "A3", "mm")
    const shown = textsOn(7)
    expect(shown).toContain("450")
    expect(shown).toContain("400")
    expect(shown).toContain("1075")
    expect(textsOn(6)).not.toContain("1075")
  })

  it("PP-03: размеры «Мебели» на странице «Сантехника» не выводятся", () => {
    const furnitureDim: Dimension = { from: vertexV(), to: vertexV(), offset: 40 }
    const d = withFurniture(base(), [sink()], [furnitureDim])
    expect(pagesOf(d)[5]?.dimensions).toHaveLength(1)
    expect(pagesOf(d)[6]?.dimensions).toEqual([])
  })

  it("PP-04: размер к прибору, которого нет на «Мебели», на странице не выводится", () => {
    const d = { ...withFurniture(base(), []), plumbing: { dimensions: [toCenter()] } }
    expect(pagesOf(d)[6]?.dimensions).toEqual([])
    build(d, 50, "A3", "mm")
    expect(textsOn(7)).not.toContain("1075")
  })

  it("PP-05: первые шесть страниц такие же, как без размеров, выносок и примечаний «Сантехники»", () => {
    const d = withFurniture(base(), [sink()])
    const callout: Callout = { id: "c", target: { x: 107.5, y: 20 }, at: { x: 200, y: 200 }, text: "Раковина: ХВС, ГВС, К" }
    const withPlumbing = { ...d, plumbing: { dimensions: [toCenter()], callouts: [callout], notes: ["Выводы на высоте 500"] } }
    expect(pagesOf(withPlumbing).slice(0, 6)).toEqual(pagesOf(d).slice(0, 6))
    const page = pagesOf(withPlumbing)[6]
    expect(page?.callouts).toEqual([callout])
    expect(page?.notes).toEqual(["Выводы на высоте 500"])
  })

  it("PP-06: страница без приборов и объектов плана остаётся и показывает подложку", () => {
    const d = drawing({ walls: [W1, W2] })
    const page = pagesOf(d)[6]
    expect(page?.walls).toHaveLength(2)
    expect(page?.walls).toEqual(pagesOf(d)[5]?.walls)
    expect(page?.furniture?.items).toEqual([])
    expect(build(d).getNumberOfPages()).toBe(10) // TCR (change add-ceiling-plan): восемь — восьмой план «Потолки и освещение» // TCR (change add-switching-plan): девять — девятый план «Группы включения» // TCR (change split-ceiling-pdf-pages): десять — вторая страница плана «Потолки и освещение»
  })
})

describe("легенда страницы «Сантехника»", () => {
  it("PP-10b: тропический душ — прибор страницы «Сантехника»: его запись есть в легенде седьмой страницы (change add-plumbing-tropical-shower)", () => {
    const shower: FurnitureItem = { id: "h", kind: "tropicalShower", x: 150, y: 80, widthCm: 40, lengthCm: 30, angleDeg: 0 }
    const d = withFurniture(base(), [table(), sink(), shower])
    expect(labels(pagesOf(d)[6])).toEqual(["Кирпич", "Штукатурка", "Гипсокартон", "Раковина", "Тропический душ"])
  })

  it("PP-10c: трап в стену — прибор страницы «Сантехника»: его запись есть в легенде седьмой страницы (change add-wall-shower-drain)", () => {
    const drain: FurnitureItem = { id: "t", kind: "wallShowerDrain", x: 100, y: 205, widthCm: 70, lengthCm: 8, angleDeg: 0 }
    const d = withFurniture(base(), [table(), sink(), drain])
    expect(labels(pagesOf(d)[6])).toEqual(["Кирпич", "Штукатурка", "Гипсокартон", "Раковина", "Трап в стену"])
  })

  it("PP-10: «Кирпич», «Штукатурка», «Гипсокартон», «Раковина», «Стиральная машина»; стола и кухонного шкафа нет", () => {
    const d = withFurniture(base(), [table(), item("w", "washer", 200), item("k", "kitchenCabinet", 300), sink()])
    expect(labels(pagesOf(d)[6])).toEqual(["Кирпич", "Штукатурка", "Гипсокартон", "Раковина", "Стиральная машина"])
  })

  it("PP-11: «Гипсокартон» на «Реконструкции», «Мебели» и «Сантехнике», но не на первых четырёх страницах", () => {
    const pages = pagesOf(base())
    expect(pages.map((p) => labels(p).includes("Гипсокартон"))).toEqual([false, false, false, false, true, true, true, true, true, true]) // TCR (change add-ceiling-plan): восемь — восьмой план «Потолки и освещение» // TCR (change add-switching-plan): девять — девятый план «Группы включения» // TCR (change split-ceiling-pdf-pages): десять — вторая страница плана «Потолки и освещение» с гипсокартоном подложки
  })

  it("PP-12: стен гипсокартона нет — записи «Гипсокартон» на «Сантехнике» нет", () => {
    expect(labels(pagesOf(drawing({ walls: [W1, W2] }))[6])).not.toContain("Гипсокартон")
  })

  it("PP-13: «Стол» только на странице «Мебель», на «Сантехнике» его нет", () => {
    const pages = pagesOf(withFurniture(base(), [table(), sink()]))
    expect(pages.map((p) => labels(p).includes("Стол"))).toEqual([false, false, false, false, false, true, false, false, false, false]) // TCR (change add-ceiling-plan): восемь — восьмой план «Потолки и освещение» // TCR (change add-switching-plan): девять — девятый план «Группы включения» // TCR (change split-ceiling-pdf-pages): десять — вторая страница плана «Потолки и освещение» без мебели
  })
})
