import { readFileSync } from "node:fs"
import type { jsPDF, jsPDFOptions } from "jspdf"
import { describe, expect, it, vi } from "vitest"
import { nearestDimAnchor } from "../geometry"
import { content, drawing, drywall, plaster, rectWalls } from "../reconstruction/reconstruction.test-utils"
import { CEILING_ALPHA } from "../ceiling/ceiling-render"
import { LIGHT_PALETTE } from "../theme"
import type { Battery, Callout, Dimension, DimPoint, Drawing, FurnitureItem, StretchCeiling, Unit } from "../types"
import { legendEntries } from "./legend"
import type { PageFormat, PlanPage } from "./pdf"
import { parsePaint } from "./pdf-paint.test-utils"
import type { PaintOp } from "./pdf-paint.test-utils"

// change add-ceiling-plan: восьмая страница PDF — план «Потолки и освещение» и запись легенды «Натяжной потолок»
// (spec pdf-export «Страница плана «Потолки и освещение»», «Легенда на странице PDF»; design D8)
//
//  вид сверху, схематично, не в масштабе. Комната K: стены толщиной 20 см по осям [0,420]×[0,320], внутренняя область
//  [10,410]×[10,310] (400 × 300 см, при 1:50 — 80 × 60 мм). Штукатурка P на стене K1, стена гипсокартона G внутри комнаты
//  (комнату не делит: помещения считаются по стенам «Монтажа»), батарея B на K1, стол T 80 × 160, потолок C с опорной точкой
//  (300, 100)
//
//   ##########################   K1 (верхняя стена), P — штукатурка, B — батарея на ней
//   #yyyPPPPPPPyyy[B]yyyyyyyy#
//   #yyyyyyy+---+yyy -50мм yy#
//   #yyyyyyy|yTy|yyyyyyyyyyyy#   y — полупрозрачная жёлтая заливка поверх подложки, батареи и стола; подпись — поверх неё
//   #yyyyGGGGGGGGGGGGGyyyyyyy#   G — гипсокартон под заливкой, виден сквозь неё
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

const { buildPdfPages, pagesOf } = await import("./pdf")

const font = readFileSync(new URL("../assets/pt-sans-regular.ttf", import.meta.url)).toString("base64")
const SEP = new Date(2026, 8, 5, 14, 32, 7)

const build = (d: Drawing, scale = 50, format: PageFormat = "A3", unit: Unit = "cm"): jsPDF => {
  texts.length = 0
  return buildPdfPages(pagesOf(d), unit, scale, format, font, d.name, SEP)
}
const textsOn = (n: number): string[] => texts.filter((t) => t.page === n).map((t) => t.text)

const table = (): FurnitureItem => ({ id: "t", kind: "table", x: 150, y: 150, widthCm: 80, lengthCm: 160, angleDeg: 0 })
const sink = (): FurnitureItem => ({ id: "s", kind: "sink", x: 350, y: 250, widthCm: 45, lengthCm: 40, angleDeg: 0 })
const ceiling = (id: string, x: number, y: number, dropMm = 50): StretchCeiling => ({ id, at: { x, y }, dropMm })
const battery = (): Battery => ({ id: "b", wallId: "k1", face: 1, anchor: "a", offsetCm: 250, lengthCm: 80, thicknessCm: 10, gapCm: 5 })

const base = (): Drawing =>
  drawing({ walls: rectWalls("k", 0, 0, 420, 320), roughPlaster: [plaster("p", "k1", 1, "a", 60, 200, 20)], reconstruction: content([drywall("g", 60, 250, 300, 250, 10, 270)]) })
const withFurniture = (d: Drawing, items: FurnitureItem[], dimensions: Dimension[] = []): Drawing => ({ ...d, furniture: { items, dimensions } })
const withCeilings = (d: Drawing, ceilings: StretchCeiling[]): Drawing => ({ ...d, ceiling: { ceilings } })
const full = (): Drawing => withCeilings(withFurniture(base(), [table()]), [ceiling("c", 300, 100)])

const rgbOf = (hex: string): readonly number[] => {
  const short = hex.replace("#", "")
  const h = short.length === 3 ? [...short].map((c) => c + c).join("") : short
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
}
const near = (a: readonly number[], b: readonly number[]): boolean => a.every((v, i) => Math.abs(v - (b[i] ?? 0)) < 0.01)
const YELLOW = rgbOf(LIGHT_PALETTE.ceiling)
const GREY = rgbOf(LIGHT_PALETTE.muted)
const INK = rgbOf(LIGHT_PALETTE.ink)
type Fill = Extract<PaintOp, { kind: "fill" }>
type Stroke = Extract<PaintOp, { kind: "stroke" }>
const sized = (pts: readonly { x: number; y: number }[] | undefined, w: number, h: number): boolean => {
  if (!pts || pts.length < 3) return false
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  return Math.abs(Math.max(...xs) - Math.min(...xs) - w) < 0.1 && Math.abs(Math.max(...ys) - Math.min(...ys) - h) < 0.1
}
// заливка помещения 80 × 60 мм цвета натяжного потолка (образец легенды — свой размер)
const roomFillIndex = (ops: PaintOp[]): number => ops.findIndex((op) => op.kind === "fill" && near(op.color, YELLOW) && op.box !== null && Math.abs(op.box.w - 80) < 0.1 && Math.abs(op.box.h - 60) < 0.1)
const strokesOfSize = (ops: PaintOp[], color: readonly number[], w: number, h: number): Stroke[] =>
  ops.filter((op): op is Stroke => op.kind === "stroke" && near(op.color, color) && sized(op.subpaths[0], w, h))
// содержимое страницы PDF как текст операторов
const pageText = (doc: jsPDF, n: number): string => {
  const pages: unknown = Reflect.get(doc.internal, "pages")
  const page: unknown = Array.isArray(pages) ? pages[n] : undefined
  return Array.isArray(page) ? page.join("\n") : ""
}
// число так, как jsPDF пишет компонент цвета: 1 → «1.», 0.84 → «0.84», 0 → «0.»
const pdfNum = (v: number): string => {
  const s = String(Math.round(v * 100) / 100)
  return s.includes(".") ? s : `${s}.`
}
const labels = (page: PlanPage | undefined): string[] => (page ? legendEntries(page).map((e) => e.label) : [])

describe("страница «Потолки и освещение» в PDF", () => {
  it("CP-140: страниц восемь; восьмая — заливка помещения жёлтым, стол серыми линиями без габаритов, подпись «-50мм»", () => {
    const d = full()
    const pages = pagesOf(d)
    expect(pages).toHaveLength(9) // TCR (change add-switching-plan): девять — девятый план «Группы включения»
    expect(pages[7]?.title).toBe("Потолки и освещение")
    const doc = build(d)
    expect(doc.getNumberOfPages()).toBe(9) // TCR (change add-switching-plan): девять — девятый план «Группы включения»
    const ops = parsePaint(doc, 8)
    expect(roomFillIndex(ops)).toBeGreaterThanOrEqual(0)
    // стол 80 × 160 см при 1:50 — 16 × 32 мм: серые линии, без заливки и без чёрных линий
    expect(strokesOfSize(ops, GREY, 16, 32).length).toBeGreaterThan(0)
    expect(strokesOfSize(ops, INK, 16, 32)).toEqual([])
    expect(ops.filter((op): op is Fill => op.kind === "fill" && op.box !== null && Math.abs(op.box.w - 16) < 0.1 && Math.abs(op.box.h - 32) < 0.1)).toEqual([])
    // гипсокартон зелёный — как на «Мебели»
    expect(parsePaint(doc, 6).some((op) => op.kind === "fill" && near(op.color, rgbOf("#6dbd6a")))).toBe(true)
    expect(ops.some((op) => op.kind === "fill" && near(op.color, rgbOf("#6dbd6a")))).toBe(true)
    const shown = textsOn(8)
    expect(shown).toContain("-50мм")
    expect(shown).not.toContain("80")
    expect(shown).not.toContain("160")
  })

  it("CP-141: заливка поверх подложки: после тела батареи и линий стола, полупрозрачная, не заходит на тела стен", () => {
    const d = { ...full(), batteries: [battery()] }
    const doc = build(d)
    const ops = parsePaint(doc, 8)
    const fill = roomFillIndex(ops)
    expect(fill).toBeGreaterThanOrEqual(0)
    // тело батареи 80 × 10 см — 16 × 2 мм (образец легенды — 16 × 4 мм); стол 16 × 32 мм
    const body = ops.findIndex((op) => op.kind === "stroke" && (sized(op.subpaths[0], 16, 2) || sized(op.subpaths[0], 2, 16)))
    expect(body).toBeGreaterThanOrEqual(0)
    expect(fill).toBeGreaterThan(body)
    expect(fill).toBeGreaterThan(Math.max(...strokesOfSize(ops, GREY, 16, 32).map((op) => ops.indexOf(op))))
    // прозрачность: заливка цветом потолка идёт внутри состояния графики с непрозрачностью CEILING_ALPHA
    const content = pageText(doc, 8)
    const yellowFill = content.indexOf(`${YELLOW.map(pdfNum).join(" ")} rg`, content.indexOf("gs"))
    expect(content.lastIndexOf(" gs", yellowFill)).toBeGreaterThan(content.lastIndexOf("Q", yellowFill))
    expect(doc.output()).toContain(`/ca ${CEILING_ALPHA}`)
    // заливка по внутренней области 80 × 60 мм — не по осям стен (84 × 64) и не по внешнему контуру (88 × 68)
    const yellow = ops.filter((op): op is Fill => op.kind === "fill" && near(op.color, YELLOW) && op.box !== null && op.box.w > 50)
    expect(yellow).toHaveLength(1)
  })

  it("CP-142: размеры «Мебели» и «Сантехники» на странице не выводятся", () => {
    // внутренняя вершина V = (10, 10) берётся тем же снапом, что у инструмента «Размер», по стенам подложки страницы
    // (размер «Мебели» — между вершинами V и U = (410, 10), размер «Сантехники» — от V до центра раковины)
    const vertex = (x: number, y: number): DimPoint => {
      const hit = nearestDimAnchor({ x, y }, pagesOf(base())[7]?.walls ?? [], [], 5)
      if (!hit) throw new Error(`нет вершины (${x}, ${y})`)
      return hit.anchor
    }
    const v = vertex(10.5, 10.5)
    const between: Dimension = { from: v, to: vertex(409.5, 10.5), offset: 20 }
    const toSink: Dimension = { from: v, to: { kind: "item", itemId: "s", at: { kind: "center" } }, offset: -40 }
    const d = { ...withFurniture(full(), [table(), sink()], [between]), plumbing: { dimensions: [toSink] } }
    const pages = pagesOf(d)
    expect(pages[5]?.dimensions).toHaveLength(1)
    expect(pages[6]?.dimensions).toHaveLength(1)
    expect(pages[7]?.dimensions).toEqual([])
  })

  it("CP-143: первые семь страниц такие же, как без потолков, выносок и примечаний плана", () => {
    const d = withFurniture(base(), [table()])
    const callout: Callout = { id: "c", target: { x: 300, y: 100 }, at: { x: 380, y: 60 }, text: "Потолок глянцевый" }
    const withPlan: Drawing = { ...d, ceiling: { ceilings: [ceiling("c", 300, 100)], callouts: [callout], notes: ["Светильники — отдельно"] } }
    expect(pagesOf(withPlan).slice(0, 7)).toEqual(pagesOf(d).slice(0, 7))
    const page = pagesOf(withPlan)[7]
    expect(page?.callouts).toEqual([callout])
    expect(page?.notes).toEqual(["Светильники — отдельно"])
  })

  it("CP-144: страница без мебели и потолков остаётся и показывает подложку", () => {
    const d = drawing({ walls: rectWalls("k", 0, 0, 420, 320) })
    const page = pagesOf(d)[7]
    expect(page?.walls).toEqual(pagesOf(d)[5]?.walls)
    expect(page?.ceiling?.ceilings).toEqual([])
    expect(build(d).getNumberOfPages()).toBe(9) // TCR (change add-switching-plan): девять — девятый план «Группы включения»
  })

  it("CP-145: заливка того же жёлтого, что на светлой схеме: страница не зависит от схемы экрана", () => {
    const ops = parsePaint(build(full()), 8)
    const fill = ops[roomFillIndex(ops)]
    expect(fill?.kind === "fill" && near(fill.color, YELLOW)).toBe(true)
  })

  it("CP-146: недействующий потолок (вне помещений) на странице не выводится", () => {
    const d = withCeilings(base(), [ceiling("out", 900, 900)])
    expect(pagesOf(d)[7]?.ceiling?.ceilings).toEqual([])
    build(d)
    expect(textsOn(8)).not.toContain("-50мм")
  })
})

describe("легенда страницы «Потолки и освещение»", () => {
  it("CP-150: «Кирпич», «Штукатурка», «Гипсокартон», «Натяжной потолок»; записей «Стол» и «Раковина» нет", () => {
    const d = withCeilings(withFurniture(base(), [table(), sink()]), [ceiling("c", 300, 100), ceiling("c2", 100, 100, 80)])
    expect(labels(pagesOf(d)[7])).toEqual(["Кирпич", "Штукатурка", "Гипсокартон", "Натяжной потолок"])
  })

  it("CP-151: «Натяжной потолок» только на своей странице", () => {
    expect(pagesOf(full()).map((p) => labels(p).includes("Натяжной потолок"))).toEqual([false, false, false, false, false, false, false, true, false]) // TCR (change add-switching-plan): девять — девятый план «Группы включения»
  })

  it("CP-152: недействующий потолок записи не даёт", () => {
    expect(labels(pagesOf(withCeilings(base(), [ceiling("out", 900, 900)]))[7])).not.toContain("Натяжной потолок")
  })

  it("CP-153: «Гипсокартон» на «Реконструкции», «Мебели», «Сантехнике» и «Потолках и освещении»", () => {
    expect(pagesOf(full()).map((p) => labels(p).includes("Гипсокартон"))).toEqual([false, false, false, false, true, true, true, true, true]) // TCR (change add-switching-plan): девять — девятый план «Группы включения»
  })

  it("CP-154: «Стол» только на странице «Мебель»", () => {
    expect(pagesOf(full()).map((p) => labels(p).includes("Стол"))).toEqual([false, false, false, false, false, true, false, false, false]) // TCR (change add-switching-plan): девять — девятый план «Группы включения»
  })

  it("CP-155: образец «Натяжной потолок» — жёлтая заливка с тёмным контуром", () => {
    const ops = parsePaint(build(full()), 8)
    const sample = ops.findIndex((op) => op.kind === "fill" && near(op.color, YELLOW) && op.box !== null && op.box.w < 20)
    expect(sample).toBeGreaterThanOrEqual(0)
    const outline = ops.slice(sample + 1).find((op) => op.kind === "stroke")
    expect(outline?.kind === "stroke" && near(outline.color, INK)).toBe(true)
  })
})
