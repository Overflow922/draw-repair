import { readFileSync } from "node:fs"
import type { jsPDF } from "jspdf"
import { describe, expect, it } from "vitest"
import { content, drawing, drywall, plaster, rectWalls } from "../reconstruction/reconstruction.test-utils"
import { LIGHT_PALETTE } from "../theme"
import type { Drawing, FurnitureItem } from "../types"
import { parsePaint } from "./pdf-paint.test-utils"
import type { PaintOp } from "./pdf-paint.test-utils"
import { buildPdfPages, pagesOf } from "./pdf"

// change add-furniture-kitchen-objects: образцы объектов кухни в легенде страницы «Мебель» (spec furniture-plan «Каталог видов мебели»,
// сценарий «Образцы объектов кухни в легенде»): весь рисунок вида, подобие в области образца 16 × 8 мм, линии без заливки.
// Предметы на плане (масштаб 1:50) больше области образца, поэтому по размеру не путаются с образцами. У посудомойки и раковины
// по одиннадцать линий — они на разных чертежах.

const font = readFileSync(new URL("../assets/pt-sans-regular.ttf", import.meta.url)).toString("base64")
const SEP = new Date(2026, 8, 5, 14, 32, 7)
const build = (d: Drawing): jsPDF => buildPdfPages(pagesOf(d), "cm", 50, "A3", font, d.name, SEP)

const item = (id: string, kind: FurnitureItem["kind"], x: number, y: number, widthCm: number, lengthCm: number): FurnitureItem => ({ id, kind, x, y, widthCm, lengthCm, angleDeg: 0 })
const PLAN = (items: FurnitureItem[]): Drawing => ({
  ...drawing({ walls: rectWalls("k", 0, 0, 420, 520), roughPlaster: [plaster("a", "k1", 1, "a", 0, 420, 20)], reconstruction: content([drywall("g", 20, 30, 220, 30, 10, 270)]) }),
  furniture: { items, dimensions: [] },
})
const MODULES = (): Drawing => PLAN([item("e", "wineCabinet", 100, 260, 30, 62), item("j", "dishwasher", 200, 260, 60, 62), item("h", "hob", 300, 260, 100, 60)])
const SINK = (): Drawing => PLAN([item("r", "sink", 200, 260, 90, 80)])

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

// размер образца в мм: размеры по умолчанию по 0,2 мм на см (вытянутый предмет повёрнут), уменьшенные, только если не помещаются в 16 × 8
function expectSample(doc: jsPDF, lineCount: number, wMm: number, hMm: number): void {
  const samples = sampleOf(doc, lineCount)
  expect(samples).toHaveLength(1)
  const b = boxOf((samples[0]?.subpaths ?? []).flat())
  expect(b.w).toBeCloseTo(wMm, 1)
  expect(b.h).toBeCloseTo(hMm, 1)
  const filled = parsePaint(doc, 6).filter(
    (op) => op.kind === "fill" && op.box !== null && op.box.x >= b.x - 0.05 && op.box.y >= b.y - 0.05 && op.box.x + op.box.w <= b.x + b.w + 0.05 && op.box.y + op.box.h <= b.y + b.h + 0.05,
  )
  expect(filled).toEqual([])
}

describe("легенда: образцы объектов кухни", () => {
  it("KOP-01: образец винного шкафа 30 × 62 — девять линий, повёрнут, 12,4 × 6 мм, заливки нет", () => {
    expectSample(build(MODULES()), 9, 12.4, 6)
  })

  it("KOP-02: образец посудомойки 60 × 62 — одиннадцать линий, повёрнут и уменьшен до высоты 8 мм (≈ 8,27 × 8 мм), заливки нет", () => {
    expectSample(build(MODULES()), 11, (62 * 8) / 60, SAMPLE_H_MM)
  })

  it("KOP-03: образец варочной панели 52 × 30 — семь линий, 10,4 × 6 мм, заливки нет", () => {
    expectSample(build(MODULES()), 7, 10.4, 6)
  })

  it("KOP-04: образец раковины 45 × 40 — одиннадцать линий, 9 × 8 мм, заливки нет", () => {
    expectSample(build(SINK()), 11, 9, SAMPLE_H_MM)
  })
})
