import { readFileSync } from "node:fs"
import type { jsPDF } from "jspdf"
import { describe, expect, it } from "vitest"
import { content, drawing, drywall, plaster, rectWalls, wall } from "../reconstruction/reconstruction.test-utils"
import { LIGHT_PALETTE } from "../theme"
import type { Battery, Communication, Drawing, FurnitureItem } from "../types"
import { LEGEND_COLUMN_CAPACITY, LEGEND_ROW_PITCH_MM, legendEntries } from "./legend"
import { parsePaint } from "./pdf-paint.test-utils"
import type { PaintOp } from "./pdf-paint.test-utils"
import { buildPdfPages, pagesOf } from "./pdf"
import type { PlanPage } from "./pdf"

// change add-furniture-sofa: запись «Диван» в легенде страницы «Мебель» (spec pdf-export «Легенда на странице PDF»,
// spec furniture-plan «Каталог видов мебели», сценарий «Запись легенды по виду»).

const font = readFileSync(new URL("../assets/pt-sans-regular.ttf", import.meta.url)).toString("base64")
const SEP = new Date(2026, 8, 5, 14, 32, 7)
const build = (d: Drawing): jsPDF => buildPdfPages(pagesOf(d), "cm", 50, "A3", font, d.name, SEP)

const item = (id: string, kind: FurnitureItem["kind"], x: number, y: number, widthCm: number, lengthCm: number): FurnitureItem => ({ id, kind, x, y, widthCm, lengthCm, angleDeg: 0 })
const table = (id: string, x: number, y: number): FurnitureItem => item(id, "table", x, y, 80, 160)
const chair = (id: string, x: number, y: number): FurnitureItem => item(id, "chair", x, y, 45, 45)
const sofa = (id: string, x: number, y: number): FurnitureItem => item(id, "sofa", x, y, 200, 90)

const G = (): ReturnType<typeof drywall> => drywall("g", 20, 30, 220, 30, 10, 270)
const PLAN = (): Drawing => drawing({ walls: rectWalls("k", 0, 0, 420, 520), roughPlaster: [plaster("a", "k1", 1, "a", 0, 420, 20)], reconstruction: content([G()]) })
const withItems = (d: Drawing, items: FurnitureItem[]): Drawing => ({ ...d, furniture: { items, dimensions: [] } })

const must = (page: PlanPage | undefined): PlanPage => {
  if (!page) throw new Error("страницы нет")
  return page
}
const labels = (page: PlanPage): string[] => legendEntries(page).map((e) => e.label)

const rgbOf = (hex: string): readonly [number, number, number] => {
  const short = hex.replace("#", "")
  const h = short.length === 3 ? [...short].map((c) => c + c).join("") : short
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as unknown as readonly [number, number, number]
}
const INK = rgbOf(LIGHT_PALETTE.ink)
const near = (a: readonly number[], b: readonly number[]): boolean => a.every((v, i) => Math.abs(v - (b[i] ?? 0)) < 0.01)
type Stroke = Extract<PaintOp, { kind: "stroke" }>
const boxOf = (pts: readonly { x: number; y: number }[]): { x: number; y: number; w: number; h: number } => {
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
}
const inkStrokesOfSize = (doc: jsPDF, page: number, w: number, h: number): Stroke[] =>
  parsePaint(doc, page).filter((op): op is Stroke => {
    if (op.kind !== "stroke" || !near(op.color, INK)) return false
    const first = op.subpaths[0]
    if (!first || first.length < 3) return false
    const b = boxOf(first)
    return Math.abs(b.w - w) < 0.1 && Math.abs(b.h - h) < 0.1
  })

describe("легенда: запись «Диван»", () => {
  it("SP-01: стол, стул и диван — записи в порядке каталога после «Гипсокартона»", () => {
    const page = must(pagesOf(withItems(PLAN(), [sofa("s", 300, 260), chair("c", 200, 260), table("t", 100, 260)]))[5])
    expect(labels(page)).toEqual(["Кирпич", "Штукатурка", "Гипсокартон", "Стол", "Стул", "Диван"])
  })

  it("SP-02: диванов на странице нет — записи «Диван» нет; на других страницах её нет никогда", () => {
    const pages = pagesOf(withItems(PLAN(), [table("t", 200, 260)]))
    expect(labels(must(pages[5]))).not.toContain("Диван")
    const withSofa = pagesOf(withItems(PLAN(), [sofa("s", 200, 260)]))
    withSofa.slice(0, 5).forEach((p) => expect(labels(p)).not.toContain("Диван"))
  })

  it("SP-03: образец дивана — миниатюра рисунка: диван 200×90 уменьшен до 16×7,2 мм, детали в полном размере, линии без заливки", () => {
    const doc = build(withItems(PLAN(), [sofa("s", 200, 260)]))
    const sample = inkStrokesOfSize(doc, 6, 16, 7.2)
    expect(sample).toHaveLength(1)
    const [outer, , , , rail] = sample[0]?.subpaths ?? []
    // TCR (change sofa-sketch-redraw): силуэт, три подушки спинки и планка
    expect(sample[0]?.subpaths).toHaveLength(5)
    const o = boxOf(outer ?? [])
    const s = boxOf(rail ?? [])
    // планка: отступ 14 см от боков и 6 см от низа при масштабе легенды 0,2 мм/см: 2,8 / 1,2 мм
    expect(s.x - o.x).toBeCloseTo(2.8, 2)
    expect(o.y + o.h - (s.y + s.h)).toBeCloseTo(1.2, 2)
    // верхняя сторона спинки начинается на 20 см (подлокотник 18 + скругление 2) — 4 мм правее левого края
    expect(Math.min(...(outer ?? []).filter((p) => Math.abs(p.y - o.y) < 1e-6).map((p) => p.x)) - o.x).toBeCloseTo(4, 2)
    const filled = parsePaint(doc, 6).filter(
      (op) => op.kind === "fill" && op.box !== null && op.box.x >= o.x - 0.05 && op.box.y >= o.y - 0.05 && op.box.x + op.box.w <= o.x + o.w + 0.05 && op.box.y + op.box.h <= o.y + o.h + 0.05,
    )
    expect(filled).toEqual([])
  })

  it("SP-04: все виды каталога вместе с пятью материалами, батареей, стояком, воздуховодом, штукатуркой и гипсокартоном: столбец легенды помещается по высоте на A3", () => {
    const battery: Battery = { id: "b1", wallId: "k1", face: 1, anchor: "a", offsetCm: 100, lengthCm: 70, thicknessCm: 10, gapCm: 3 }
    const materials = ["blocks", "brick", "concrete", "gkl", "wood-long"] as const
    const walls = [...rectWalls("k", 0, 0, 420, 320), ...materials.map((m, i) => wall(`m${i}`, 600, i * 60, 800, i * 60, 10, m))]
    const riser: Communication = { kind: "riser", id: "r1", x: 200, y: 160, diameterCm: 11 }
    const duct: Communication = { kind: "duct", id: "d1", x: 300, y: 200, widthCm: 30, depthCm: 20 }
    const base = drawing({ walls, roughPlaster: [plaster("a", "k1", 1, "a", 0, 420, 20)], reconstruction: content([G()]) })
    // TCR (change add-furniture-tv-wall-cabinet): в каталоге семь видов — 17 записей, 15 в первом столбце легенды и 2 во втором (spec pdf-export «Легенда на странице PDF»)
    // TCR (change add-furniture-bed-nightstand): в каталоге девять видов — 19 записей, 15 в первом столбце легенды и 4 во втором
    // TCR (change add-furniture-wardrobes): в каталоге одиннадцать видов — 21 запись, 15 в первом столбце легенды и 6 во втором
    // TCR (change add-furniture-curtains): в каталоге двенадцать видов — 22 записи, 15 в первом столбце легенды и 7 во втором
    // TCR (change add-furniture-kitchen-cabinet-fridge): в каталоге четырнадцать видов — 24 записи, 15 в первом столбце легенды и 9 во втором
    const items = [
      table("t", 200, 160),
      item("p", "desk", 200, 300, 100, 50),
      chair("c", 100, 100),
      sofa("s", 300, 100),
      item("o", "officeChair", 100, 300, 60, 60),
      item("v", "tv", 300, 300, 91, 11),
      item("w", "wallCabinet", 300, 400, 180, 42),
      item("b", "bed", 500, 400, 160, 200),
      item("n", "nightstand", 700, 400, 30, 60),
      item("k", "slidingWardrobe", 800, 400, 300, 60),
      item("d", "doubleWardrobe", 900, 400, 100, 60),
      item("u", "curtains", 1000, 400, 300, 13),
      item("q", "kitchenCabinet", 1100, 400, 60, 62),
      item("f", "fridge", 1200, 400, 100, 90),
    ]
    const d = { ...withItems(base, items), batteries: [battery], communications: [riser, duct] }
    const entries = legendEntries(must(pagesOf(d)[5]))
    expect(entries.map((e) => e.label).slice(-14)).toEqual(["Стол", "Стул", "Диван", "Письменный стол", "Компьютерное кресло", "Телевизор", "Подвесная тумба", "Кровать", "Прикроватный столик", "Шкаф-купе", "Шкаф двустворчатый", "Шторы", "Кухонный шкаф", "Холодильник двустворчатый"])
    expect(entries).toHaveLength(24)
    expect(Math.min(entries.length, LEGEND_COLUMN_CAPACITY) * LEGEND_ROW_PITCH_MM).toBeLessThanOrEqual(222)
  })
})
