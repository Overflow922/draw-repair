import { readFileSync } from "node:fs"
import type { jsPDF } from "jspdf"
import { describe, expect, it } from "vitest"
import { conflictColor } from "../furniture/furniture-render"
import { drywallColors } from "../reconstruction/reconstruction-render"
import { content, drawing, drywall, plaster, rectWalls, wall } from "../reconstruction/reconstruction.test-utils"
import { LIGHT_PALETTE } from "../theme"
import type { Battery, Communication, Drawing, FurnitureItem } from "../types"
import { LEGEND_ROW_PITCH_MM, legendEntries } from "./legend"
import type { PageFormat } from "./page-format"
import { parsePaint } from "./pdf-paint.test-utils"
import type { PaintOp } from "./pdf-paint.test-utils"
import { buildPdfPages, pageBounds, pagesOf } from "./pdf"
import type { PlanPage } from "./pdf"

// change furniture-plan-table: шестая страница PDF — план «Мебель» и записи легенды
// (spec pdf-export «Страница плана «Мебель»», «Легенда на странице PDF»)
// TCR (change furniture-items-catalog): стол стал предметом мебели (Table → FurnitureItem, tables → items, table*.ts → item*.ts) с видом «table»; меняются только имена и вид в данных, утверждения о поведении не менялись

const font = readFileSync(new URL("../assets/pt-sans-regular.ttf", import.meta.url)).toString("base64")
const SEP = new Date(2026, 8, 5, 14, 32, 7)

const build = (d: Drawing, scale = 50, format: PageFormat = "A3"): jsPDF => buildPdfPages(pagesOf(d), "cm", scale, format, font, d.name, SEP)

const table = (id: string, x: number, y: number, angleDeg = 0): FurnitureItem => ({ id, kind: "table", x, y, widthCm: 80, lengthCm: 160, angleDeg })
const withTables = (d: Drawing, items: FurnitureItem[]): Drawing => ({ ...d, furniture: { items, dimensions: [] } })
const ROOM = (): ReturnType<typeof rectWalls> => rectWalls("k", 0, 0, 420, 520)
const G = (): ReturnType<typeof drywall> => drywall("g", 20, 30, 220, 30, 10, 270)
const PLAN = (): Drawing => drawing({ walls: ROOM(), roughPlaster: [plaster("a", "k1", 1, "a", 0, 420, 20)], reconstruction: content([G()]) })

const rgbOf = (hex: string): readonly [number, number, number] => {
  const short = hex.replace("#", "")
  const h = short.length === 3 ? [...short].map((c) => c + c).join("") : short
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as unknown as readonly [number, number, number]
}
const near = (a: readonly number[], b: readonly number[]): boolean => a.every((v, i) => Math.abs(v - (b[i] ?? 0)) < 0.01)
const fillsOf = (doc: jsPDF, page: number, color: readonly number[]): Extract<PaintOp, { kind: "fill" }>[] =>
  parsePaint(doc, page).filter((op): op is Extract<PaintOp, { kind: "fill" }> => op.kind === "fill" && near(op.color, color))
// TCR (change furniture-line-drawings): предмет — линии рисунка цвета контуров светлой схемы без заливки (цвет вида в спеке снят):
// FP-400…FP-403 ищут обводку предмета (внешний контур рисунка заданных габаритов), а не заливку цвета стола
const INK = rgbOf(LIGHT_PALETTE.ink)
const GREEN = rgbOf(drywallColors("light").fill)
type Stroke = Extract<PaintOp, { kind: "stroke" }>
const boxOf = (pts: readonly { x: number; y: number }[]): { x: number; y: number; w: number; h: number } => {
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
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
const labels = (page: PlanPage): string[] => legendEntries(page).map((e) => e.label)
const must = (page: PlanPage | undefined): PlanPage => {
  if (!page) throw new Error("страницы нет")
  return page
}

describe("страница «Мебель» в PDF", () => {
  it("FP-400: страниц шесть; шестая — «Мебель» со столом линиями без заливки и зелёным гипсокартоном; на остальных стола нет", () => {
    const d = withTables(PLAN(), [table("t", 200, 260)])
    const pages = pagesOf(d)
    expect(pages).toHaveLength(11) // TCR (change add-plumbing-plan): семь — седьмой план «Сантехника» // TCR (change add-ceiling-plan): восемь — восьмой план «Потолки и освещение» // TCR (change add-switching-plan): девять — девятый план «Группы включения» // TCR (change split-ceiling-pdf-pages): десять — вторая страница плана «Потолки и освещение» // TCR (change add-electrical-plan): одиннадцать — страница плана «Электрооборудование»
    expect(must(pages[5]).title).toBe("Мебель")
    const doc = build(d)
    expect(doc.getNumberOfPages()).toBe(11) // TCR (change add-plumbing-plan): семь // TCR (change add-ceiling-plan): восемь — восьмой план «Потолки и освещение» // TCR (change add-switching-plan): девять — девятый план «Группы включения» // TCR (change split-ceiling-pdf-pages): десять — вторая страница плана «Потолки и освещение» // TCR (change add-electrical-plan): одиннадцать — страница плана «Электрооборудование»
    expect(inkStrokesOfSize(doc, 6, 16, 32).length).toBeGreaterThan(0)
    expect(fillsOfSize(doc, 6, 16, 32)).toBe(0)
    expect(fillsOf(doc, 6, GREEN).length).toBeGreaterThan(0)
    for (let i = 1; i <= 5; i++) expect(inkStrokesOfSize(doc, i, 16, 32)).toEqual([])
  })

  it("FP-401: стол 80×160 с углом 90 при масштабе 1:50 — габариты рисунка 32 мм по горизонтали и 16 мм по вертикали, скругление 2 мм, кромка 1,2 мм", () => {
    const doc = build(withTables(PLAN(), [table("t", 200, 260, 90)]), 50)
    const s = inkStrokesOfSize(doc, 6, 32, 16)
    expect(s).toHaveLength(1)
    const [outer, inner] = s[0]?.subpaths ?? []
    const o = boxOf(outer ?? [])
    // скругление: на верхней стороне контур начинается на 2 мм правее левого края
    const topLeft = Math.min(...(outer ?? []).filter((p) => Math.abs(p.y - o.y) < 1e-6).map((p) => p.x)) - o.x
    expect(topLeft).toBeCloseTo(2, 2)
    const i = boxOf(inner ?? [])
    expect(i.x - o.x).toBeCloseTo(1.2, 2)
    expect(i.y - o.y).toBeCloseTo(1.2, 2)
    expect(i.w).toBeCloseTo(32 - 2.4, 2)
  })

  it("FP-402: стол без угла — 16 мм по горизонтали и 32 мм по вертикали", () => {
    const doc = build(withTables(PLAN(), [table("t", 200, 260, 0)]), 50)
    expect(inkStrokesOfSize(doc, 6, 16, 32)).toHaveLength(1)
  })

  it("FP-403: стол пересекает стену — стол нарисован, красной подсветки нет", () => {
    const doc = build(withTables(PLAN(), [table("t", 0, 260)]))
    expect(inkStrokesOfSize(doc, 6, 16, 32).length).toBeGreaterThan(0)
    const [r, g, b] = (conflictColor("light").match(/[\d.]+/g) ?? []).map(Number)
    const red = [(r ?? 0) / 255, (g ?? 0) / 255, (b ?? 0) / 255]
    expect(fillsOf(doc, 6, red)).toEqual([])
  })

  it("FP-404: повёрнутый стол, выступающий за габариты подложки, входит в габариты страницы", () => {
    const without = pageBounds(must(pagesOf(PLAN())[5]), 50)
    const outside = withTables(PLAN(), [table("t", 700, 260, 90)])
    const b = pageBounds(must(pagesOf(outside)[5]), 50)
    // правый край стола: 700 + 160/2 = 780 см
    expect(b.maxX).toBeGreaterThanOrEqual(780)
    expect(b.maxX).toBeGreaterThan(without.maxX)
  })

  it("FP-405: первые пять страниц с столами и без — те же", () => {
    const base = pagesOf(PLAN()).slice(0, 5)
    const tabled = pagesOf(withTables(PLAN(), [table("t", 200, 260)])).slice(0, 5)
    expect(tabled).toEqual(base)
  })

  it("FP-406: страница без объектов и столов пуста, но остаётся в документе", () => {
    const d = drawing({})
    expect(pagesOf(d)).toHaveLength(11) // TCR (change add-plumbing-plan): семь // TCR (change add-ceiling-plan): восемь — восьмой план «Потолки и освещение» // TCR (change add-switching-plan): девять — девятый план «Группы включения» // TCR (change split-ceiling-pdf-pages): десять — вторая страница плана «Потолки и освещение» // TCR (change add-electrical-plan): одиннадцать — страница плана «Электрооборудование»
    expect(build(d).getNumberOfPages()).toBe(11) // TCR (change add-plumbing-plan): семь // TCR (change add-ceiling-plan): восемь — восьмой план «Потолки и освещение» // TCR (change add-switching-plan): девять — девятый план «Группы включения» // TCR (change split-ceiling-pdf-pages): десять — вторая страница плана «Потолки и освещение» // TCR (change add-electrical-plan): одиннадцать — страница плана «Электрооборудование»
  })
})

describe("легенда страницы «Мебель»", () => {
  const withObjects = (items: FurnitureItem[]): Drawing => withTables(PLAN(), items)

  it("FP-410: «Кирпич», «Штукатурка», «Гипсокартон», «Стол» в этом порядке", () => {
    expect(labels(must(pagesOf(withObjects([table("t", 200, 260)]))[5]))).toEqual(["Кирпич", "Штукатурка", "Гипсокартон", "Стол"])
  })

  it("FP-411: «Стол» только на странице «Мебель»", () => {
    const pages = pagesOf(withObjects([table("t", 200, 260)]))
    pages.slice(0, 5).forEach((p) => expect(labels(p)).not.toContain("Стол"))
  })

  it("FP-412: столов нет — записи «Стол» нет", () => {
    expect(labels(must(pagesOf(withObjects([]))[5]))).not.toContain("Стол")
  })

  // change furniture-line-drawings (spec pdf-export «Легенда на странице PDF», сценарий «Образец вида мебели — рисунок»)
  const chair = (id: string, x: number, y: number): FurnitureItem => ({ id, kind: "chair", x, y, widthCm: 45, lengthCm: 45, angleDeg: 0 })

  it("FP-415: стол и стул — записи «Стол», «Стул» в порядке каталога после «Гипсокартона»", () => {
    expect(labels(must(pagesOf(withObjects([chair("c", 300, 260), table("t", 200, 260)]))[5]))).toEqual(["Кирпич", "Штукатурка", "Гипсокартон", "Стол", "Стул"])
  })

  it("FP-416: образцы стола и стула — миниатюры рисунков: стол 16×8 мм повёрнут вдоль образца, стул 8×8 мм, линии без заливки", () => {
    const doc = build(withObjects([table("t", 200, 260), chair("c", 300, 260)]))
    const tableSample = inkStrokesOfSize(doc, 6, 16, 8)
    expect(tableSample).toHaveLength(1)
    // детали в масштабе легенды 0,2 мм/см и не уменьшаются вместе с габаритами: скругление 10 см — 2 мм, кромка 6 см — 1,2 мм
    const [outer, inner] = tableSample[0]?.subpaths ?? []
    const o = boxOf(outer ?? [])
    const i = boxOf(inner ?? [])
    expect(i.x - o.x).toBeCloseTo(1.2, 2)
    expect(i.y - o.y).toBeCloseTo(1.2, 2)
    expect(Math.min(...(outer ?? []).filter((p) => Math.abs(p.y - o.y) < 1e-6).map((p) => p.x)) - o.x).toBeCloseTo(2, 2)
    const chairSample = inkStrokesOfSize(doc, 6, 8, 8)
    expect(chairSample).toHaveLength(1)
    expect(chairSample[0]?.subpaths).toHaveLength(3)
    // подлокотники 7 см — 1,4 мм от боков (линия спинки — второй подконтур)
    const chairOuter = boxOf(chairSample[0]?.subpaths[0] ?? [])
    expect(boxOf(chairSample[0]?.subpaths[1] ?? []).x - chairOuter.x).toBeCloseTo(1.4, 2)
    // под образцами заливки нет: ни одной заливки, чей габарит лежит в габарите образца (образцы других записей — другие строки)
    const within = (inner: { x: number; y: number; w: number; h: number }, outerBox: { x: number; y: number; w: number; h: number }): boolean =>
      inner.x >= outerBox.x - 0.05 && inner.y >= outerBox.y - 0.05 && inner.x + inner.w <= outerBox.x + outerBox.w + 0.05 && inner.y + inner.h <= outerBox.y + outerBox.h + 0.05
    const tableBox = o
    const chairBox = boxOf(chairSample[0]?.subpaths[0] ?? [])
    const filled = parsePaint(doc, 6).filter((op) => op.kind === "fill" && op.box !== null && (within(op.box, tableBox) || within(op.box, chairBox)))
    expect(filled).toEqual([])
  })

  it("FP-413: «Гипсокартон» на «Реконструкции» и «Мебели», в первых четырёх страницах нет; без стен ГКЛ записи нет", () => {
    const pages = pagesOf(withObjects([]))
    pages.slice(0, 4).forEach((p) => expect(labels(p)).not.toContain("Гипсокартон"))
    expect(labels(must(pages[4]))).toContain("Гипсокартон")
    expect(labels(must(pages[5]))).toContain("Гипсокартон")
    const none = pagesOf(withTables(drawing({ walls: ROOM() }), [table("t", 200, 260)]))
    expect(labels(must(none[5]))).not.toContain("Гипсокартон")
  })

  it("FP-414: одиннадцать записей помещаются по высоте на A3 (222 мм — наименьшая область чертежа среди A3–A0)", () => {
    const battery: Battery = { id: "b1", wallId: "k1", face: 1, anchor: "a", offsetCm: 100, lengthCm: 70, thicknessCm: 10, gapCm: 3 }
    const materials = ["blocks", "brick", "concrete", "gkl", "wood-long"] as const
    const walls = [...rectWalls("k", 0, 0, 420, 320), ...materials.map((m, i) => wall(`m${i}`, 600, i * 60, 800, i * 60, 10, m))]
    const riser: Communication = { kind: "riser", id: "r1", x: 200, y: 160, diameterCm: 11 }
    const duct: Communication = { kind: "duct", id: "d1", x: 300, y: 200, widthCm: 30, depthCm: 20 }
    const base = drawing({ walls, roughPlaster: [plaster("a", "k1", 1, "a", 0, 420, 20)], reconstruction: content([G()]) })
    const d = { ...withTables(base, [table("t", 200, 160)]), batteries: [battery], communications: [riser, duct] }
    const entries = legendEntries(must(pagesOf(d)[5]))
    expect(entries).toHaveLength(11)
    expect(entries.length * LEGEND_ROW_PITCH_MM).toBeLessThanOrEqual(222)
  })
})
