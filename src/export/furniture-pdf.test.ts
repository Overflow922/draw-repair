import { readFileSync } from "node:fs"
import type { jsPDF } from "jspdf"
import { describe, expect, it } from "vitest"
import { conflictColor, tableColors } from "../furniture/furniture-render"
import { drywallColors } from "../reconstruction/reconstruction-render"
import { content, drawing, drywall, plaster, rectWalls, wall } from "../reconstruction/reconstruction.test-utils"
import type { Battery, Communication, Drawing, Table } from "../types"
import { LEGEND_ROW_PITCH_MM, legendEntries } from "./legend"
import type { PageFormat } from "./page-format"
import { parsePaint } from "./pdf-paint.test-utils"
import type { PaintOp } from "./pdf-paint.test-utils"
import { buildPdfPages, pageBounds, pagesOf } from "./pdf"
import type { PlanPage } from "./pdf"

// change furniture-plan-table: шестая страница PDF — план «Мебель» и записи легенды
// (spec pdf-export «Страница плана «Мебель»», «Легенда на странице PDF»)

const font = readFileSync(new URL("../assets/pt-sans-regular.ttf", import.meta.url)).toString("base64")
const SEP = new Date(2026, 8, 5, 14, 32, 7)

const build = (d: Drawing, scale = 50, format: PageFormat = "A3"): jsPDF => buildPdfPages(pagesOf(d), "cm", scale, format, font, d.name, SEP)

const table = (id: string, x: number, y: number, angleDeg = 0): Table => ({ id, x, y, widthCm: 80, lengthCm: 160, angleDeg })
const withTables = (d: Drawing, tables: Table[]): Drawing => ({ ...d, furniture: { tables, dimensions: [] } })
const ROOM = (): ReturnType<typeof rectWalls> => rectWalls("k", 0, 0, 420, 520)
const G = (): ReturnType<typeof drywall> => drywall("g", 20, 30, 220, 30, 10, 270)
const PLAN = (): Drawing => drawing({ walls: ROOM(), roughPlaster: [plaster("a", "k1", 1, "a", 0, 420, 20)], reconstruction: content([G()]) })

const rgbOf = (hex: string): readonly [number, number, number] => {
  const h = hex.replace("#", "")
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as unknown as readonly [number, number, number]
}
const near = (a: readonly number[], b: readonly number[]): boolean => a.every((v, i) => Math.abs(v - (b[i] ?? 0)) < 0.01)
const fillsOf = (doc: jsPDF, page: number, color: readonly number[]): Extract<PaintOp, { kind: "fill" }>[] =>
  parsePaint(doc, page).filter((op): op is Extract<PaintOp, { kind: "fill" }> => op.kind === "fill" && near(op.color, color))
const TABLE_COLOR = rgbOf(tableColors("light").fill)
const GREEN = rgbOf(drywallColors("light").fill)
const labels = (page: PlanPage): string[] => legendEntries(page).map((e) => e.label)
const must = (page: PlanPage | undefined): PlanPage => {
  if (!page) throw new Error("страницы нет")
  return page
}

describe("страница «Мебель» в PDF", () => {
  it("FP-400: страниц шесть; шестая — «Мебель» со столом цвета стола и зелёным гипсокартоном; на остальных стола нет", () => {
    const d = withTables(PLAN(), [table("t", 200, 260)])
    const pages = pagesOf(d)
    expect(pages).toHaveLength(6)
    expect(must(pages[5]).title).toBe("Мебель")
    const doc = build(d)
    expect(doc.getNumberOfPages()).toBe(6)
    expect(fillsOf(doc, 6, TABLE_COLOR).length).toBeGreaterThan(0)
    expect(fillsOf(doc, 6, GREEN).length).toBeGreaterThan(0)
    for (let i = 1; i <= 5; i++) expect(fillsOf(doc, i, TABLE_COLOR)).toEqual([])
  })

  it("FP-401: стол 80×160 с углом 90 при масштабе 1:50 — прямоугольник 32 мм по горизонтали и 16 мм по вертикали", () => {
    const doc = build(withTables(PLAN(), [table("t", 200, 260, 90)]), 50)
    // образец легенды — тоже цвета стола; стол чертежа — самая большая заливка
    const biggest = fillsOf(doc, 6, TABLE_COLOR).map((f) => f.box).filter((b): b is NonNullable<typeof b> => b !== null).sort((a, b) => b.w * b.h - a.w * a.h)[0]
    expect(biggest?.w).toBeCloseTo(32, 1)
    expect(biggest?.h).toBeCloseTo(16, 1)
  })

  it("FP-402: стол без угла — 16 мм по горизонтали и 32 мм по вертикали", () => {
    const doc = build(withTables(PLAN(), [table("t", 200, 260, 0)]), 50)
    const biggest = fillsOf(doc, 6, TABLE_COLOR).map((f) => f.box).filter((b): b is NonNullable<typeof b> => b !== null).sort((a, b) => b.w * b.h - a.w * a.h)[0]
    expect(biggest?.w).toBeCloseTo(16, 1)
    expect(biggest?.h).toBeCloseTo(32, 1)
  })

  it("FP-403: стол пересекает стену — стол нарисован, красной подсветки нет", () => {
    const doc = build(withTables(PLAN(), [table("t", 0, 260)]))
    expect(fillsOf(doc, 6, TABLE_COLOR).length).toBeGreaterThan(0)
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
    expect(pagesOf(d)).toHaveLength(6)
    expect(build(d).getNumberOfPages()).toBe(6)
  })
})

describe("легенда страницы «Мебель»", () => {
  const withObjects = (tables: Table[]): Drawing => withTables(PLAN(), tables)

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
