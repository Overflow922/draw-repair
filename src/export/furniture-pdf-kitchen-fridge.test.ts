import { readFileSync } from "node:fs"
import type { jsPDF } from "jspdf"
import { describe, expect, it } from "vitest"
import { content, drawing, drywall, plaster, rectWalls } from "../reconstruction/reconstruction.test-utils"
import { LIGHT_PALETTE } from "../theme"
import type { Drawing, FurnitureItem } from "../types"
import { parsePaint } from "./pdf-paint.test-utils"
import type { PaintOp } from "./pdf-paint.test-utils"
import { buildPdfPages, pagesOf } from "./pdf"

// change add-furniture-kitchen-cabinet-fridge: образцы кухонного шкафа и холодильника в легенде страницы «Мебель» (spec furniture-plan «Каталог
// видов мебели», сценарий «Образцы кухонного шкафа и холодильника в легенде»): весь рисунок вида, подобие в области образца 16 × 8 мм, линии без заливки.

const font = readFileSync(new URL("../assets/pt-sans-regular.ttf", import.meta.url)).toString("base64")
const SEP = new Date(2026, 8, 5, 14, 32, 7)
const build = (d: Drawing): jsPDF => buildPdfPages(pagesOf(d), "cm", 50, "A3", font, d.name, SEP)

const item = (id: string, kind: FurnitureItem["kind"], x: number, y: number, widthCm: number, lengthCm: number): FurnitureItem => ({ id, kind, x, y, widthCm, lengthCm, angleDeg: 0 })
const PLAN = (): Drawing => ({
  ...drawing({ walls: rectWalls("k", 0, 0, 420, 520), roughPlaster: [plaster("a", "k1", 1, "a", 0, 420, 20)], reconstruction: content([drywall("g", 20, 30, 220, 30, 10, 270)]) }),
  furniture: { items: [item("q", "kitchenCabinet", 100, 260, 60, 62), item("f", "fridge", 300, 260, 100, 90)], dimensions: [] },
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
const SAMPLE_H_MM = 8

function sampleOf(doc: jsPDF, lineCount: number): Stroke[] {
  return parsePaint(doc, 6).filter((op): op is Stroke => {
    if (op.kind !== "stroke" || !near(op.color, INK) || op.subpaths.length !== lineCount) return false
    const b = boxOf(op.subpaths.flat())
    return b.w <= SAMPLE_W_MM && b.h <= SAMPLE_H_MM + 0.01
  })
}

describe("легенда: образцы кухонного шкафа и холодильника", () => {
  it("KP-01: образец шкафа — пять линий, весь рисунок в области 16 × 8 мм, высота образца 8 мм, заливки нет", () => {
    const doc = build(PLAN())
    const samples = sampleOf(doc, 5)
    expect(samples).toHaveLength(1)
    const b = boxOf((samples[0]?.subpaths ?? []).flat())
    expect(b.h).toBeGreaterThan(7.9)
    const filled = parsePaint(doc, 6).filter(
      (op) => op.kind === "fill" && op.box !== null && op.box.x >= b.x - 0.05 && op.box.y >= b.y - 0.05 && op.box.x + op.box.w <= b.x + b.w + 0.05 && op.box.y + op.box.h <= b.y + b.h + 0.05,
    )
    expect(filled).toEqual([])
  })

  it("KP-02: образец холодильника — тридцать линий, весь рисунок в области 16 × 8 мм, высота образца 8 мм", () => {
    const samples = sampleOf(build(PLAN()), 30)
    expect(samples).toHaveLength(1)
    const b = boxOf((samples[0]?.subpaths ?? []).flat())
    expect(b.h).toBeGreaterThan(7.9)
    expect(b.w).toBeLessThanOrEqual(SAMPLE_W_MM)
  })
})
