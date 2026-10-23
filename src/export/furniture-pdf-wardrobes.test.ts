import { readFileSync } from "node:fs"
import type { jsPDF } from "jspdf"
import { describe, expect, it } from "vitest"
import { content, drawing, drywall, plaster, rectWalls } from "../reconstruction/reconstruction.test-utils"
import { LIGHT_PALETTE } from "../theme"
import type { Drawing, FurnitureItem } from "../types"
import { parsePaint } from "./pdf-paint.test-utils"
import type { PaintOp } from "./pdf-paint.test-utils"
import { buildPdfPages, pagesOf } from "./pdf"

// change add-furniture-wardrobes: образцы шкафов в легенде страницы «Мебель» (spec furniture-plan «Каталог видов мебели», сценарий
// «Образец шкафа в легенде»): рисунок — подобие всего рисунка шкафа в образце 16 × 8 мм, линии без заливки.

const font = readFileSync(new URL("../assets/pt-sans-regular.ttf", import.meta.url)).toString("base64")
const SEP = new Date(2026, 8, 5, 14, 32, 7)
const build = (d: Drawing): jsPDF => buildPdfPages(pagesOf(d), "cm", 50, "A3", font, d.name, SEP)

const item = (id: string, kind: FurnitureItem["kind"], x: number, y: number, widthCm: number, lengthCm: number): FurnitureItem => ({ id, kind, x, y, widthCm, lengthCm, angleDeg: 0 })
const PLAN = (): Drawing => ({
  ...drawing({ walls: rectWalls("k", 0, 0, 420, 520), roughPlaster: [plaster("a", "k1", 1, "a", 0, 420, 20)], reconstruction: content([drywall("g", 20, 30, 220, 30, 10, 270)]) }),
  furniture: { items: [item("k", "slidingWardrobe", 200, 260, 300, 60), item("d", "doubleWardrobe", 200, 400, 100, 60)], dimensions: [] },
})

const rgbOf = (hex: string): readonly [number, number, number] => {
  const short = hex.replace("#", "")
  const h = short.length === 3 ? [...short].map((c) => c + c).join("") : short
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as unknown as readonly [number, number, number]
}
const INK = rgbOf(LIGHT_PALETTE.ink)
const near = (a: readonly number[], b: readonly number[]): boolean => a.every((v, i) => Math.abs(v - (b[i] ?? 0)) < 0.01)
type Stroke = Extract<PaintOp, { kind: "stroke" }>
type Pt = { x: number; y: number }
const boxOf = (pts: readonly Pt[]): { x: number; y: number; w: number; h: number } => {
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

describe("легенда: образцы шкафов", () => {
  it.each([
    ["шкаф-купе", 16, 3.2, 93],
    ["двустворчатый шкаф", 13.33, 8, 26],
  ])("WP-01: образец %s — весь рисунок %s × %s мм: контур и остальные линии внутри него, заливки нет", (_name, w, h, lines) => {
    const doc = build(PLAN())
    const sample = inkStrokesOfSize(doc, 6, w, h)
    expect(sample).toHaveLength(1)
    const subpaths = sample[0]?.subpaths ?? []
    expect(subpaths.length).toBeGreaterThanOrEqual(lines - 1)
    const o = boxOf(subpaths[0] ?? [])
    for (const p of subpaths.flat()) {
      expect(p.x).toBeGreaterThanOrEqual(o.x - 0.01)
      expect(p.x).toBeLessThanOrEqual(o.x + o.w + 0.01)
      expect(p.y).toBeGreaterThanOrEqual(o.y - 0.01)
      expect(p.y).toBeLessThanOrEqual(o.y + o.h + 0.01)
    }
    const filled = parsePaint(doc, 6).filter(
      (op) => op.kind === "fill" && op.box !== null && op.box.x >= o.x - 0.05 && op.box.y >= o.y - 0.05 && op.box.x + op.box.w <= o.x + o.w + 0.05 && op.box.y + op.box.h <= o.y + o.h + 0.05,
    )
    expect(filled).toEqual([])
  })
})
