import { readFileSync } from "node:fs"
import type { jsPDF } from "jspdf"
import { describe, expect, it } from "vitest"
import { content, drawing, drywall, plaster, rectWalls } from "../reconstruction/reconstruction.test-utils"
import { LIGHT_PALETTE } from "../theme"
import type { Drawing, FurnitureItem } from "../types"
import { parsePaint } from "./pdf-paint.test-utils"
import type { PaintOp } from "./pdf-paint.test-utils"
import { buildPdfPages, pagesOf } from "./pdf"

// change add-furniture-curtains: образец штор в легенде страницы «Мебель» (spec furniture-plan «Каталог видов мебели», сценарий
// «Образец штор в легенде»): весь рисунок штор, подобие в образце 16 × 8 мм (шторы 300 × 13 → 16 × 0,69 мм), линии без заливки.

const font = readFileSync(new URL("../assets/pt-sans-regular.ttf", import.meta.url)).toString("base64")
const SEP = new Date(2026, 8, 5, 14, 32, 7)
const build = (d: Drawing): jsPDF => buildPdfPages(pagesOf(d), "cm", 50, "A3", font, d.name, SEP)

const item = (id: string, kind: FurnitureItem["kind"], x: number, y: number, widthCm: number, lengthCm: number): FurnitureItem => ({ id, kind, x, y, widthCm, lengthCm, angleDeg: 0 })
const PLAN = (): Drawing => ({
  ...drawing({ walls: rectWalls("k", 0, 0, 420, 520), roughPlaster: [plaster("a", "k1", 1, "a", 0, 420, 20)], reconstruction: content([drywall("g", 20, 30, 220, 30, 10, 270)]) }),
  furniture: { items: [item("u", "curtains", 200, 260, 300, 13)], dimensions: [] },
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

const SAMPLE_W_MM = 16
// лицевая волна образца: во всю ширину 16 мм, высота 6,5 · (3,467 / 13) см · 0,2 мм/см
const WAVE_H_MM = 6.5 * (13 * 80) / 300 / 13 * 0.2
const AREA_H_MM = (13 * 80) / 300 * 0.2

describe("легенда: образец штор", () => {
  it("CP-01: образец — весь рисунок штор 16 × 0,69 мм: линии внутри области образца, заливки нет", () => {
    const doc = build(PLAN())
    const samples = parsePaint(doc, 6).filter((op): op is Stroke => {
      if (op.kind !== "stroke" || !near(op.color, INK)) return false
      const first = op.subpaths[0]
      if (!first || first.length < 3) return false
      const b = boxOf(first)
      return Math.abs(b.w - SAMPLE_W_MM) < 0.1 && Math.abs(b.h - WAVE_H_MM) < 0.05
    })
    expect(samples).toHaveLength(1)
    const subpaths = samples[0]?.subpaths ?? []
    expect(subpaths.length).toBeGreaterThanOrEqual(19)
    const o = boxOf(subpaths[0] ?? [])
    for (const p of subpaths.flat()) {
      expect(p.x).toBeGreaterThanOrEqual(o.x - 0.01)
      expect(p.x).toBeLessThanOrEqual(o.x + SAMPLE_W_MM + 0.01)
      expect(p.y).toBeGreaterThanOrEqual(o.y - 0.01)
      expect(p.y).toBeLessThanOrEqual(o.y + AREA_H_MM + 0.01)
    }
    const filled = parsePaint(doc, 6).filter(
      (op) => op.kind === "fill" && op.box !== null && op.box.x >= o.x - 0.05 && op.box.y >= o.y - 0.05 && op.box.x + op.box.w <= o.x + SAMPLE_W_MM + 0.05 && op.box.y + op.box.h <= o.y + AREA_H_MM + 0.05,
    )
    expect(filled).toEqual([])
  })
})
