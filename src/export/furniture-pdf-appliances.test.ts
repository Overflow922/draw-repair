import { readFileSync } from "node:fs"
import type { jsPDF } from "jspdf"
import { describe, expect, it } from "vitest"
import { content, drawing, drywall, plaster, rectWalls } from "../reconstruction/reconstruction.test-utils"
import { LIGHT_PALETTE } from "../theme"
import type { Drawing, FurnitureItem } from "../types"
import { parsePaint } from "./pdf-paint.test-utils"
import type { PaintOp } from "./pdf-paint.test-utils"
import { buildPdfPages, pagesOf } from "./pdf"

// change add-furniture-appliances: образцы встраиваемой техники в легенде страницы «Мебель» (spec furniture-plan «Каталог видов мебели»,
// сценарий «Образцы встраиваемой техники в легенде»): весь рисунок вида, подобие в области образца 16 × 8 мм, линии без заливки.
// Предметы на плане (масштаб 1:50) выше области образца, поэтому по размеру не путаются с образцами. У колонны и духового шкафа по девять
// линий, у стиральной и сушильной машин по шесть — они на разных чертежах.

const font = readFileSync(new URL("../assets/pt-sans-regular.ttf", import.meta.url)).toString("base64")
const SEP = new Date(2026, 8, 5, 14, 32, 7)
const build = (d: Drawing): jsPDF => buildPdfPages(pagesOf(d), "cm", 50, "A3", font, d.name, SEP)

const item = (id: string, kind: FurnitureItem["kind"], x: number, y: number, widthCm: number, lengthCm: number): FurnitureItem => ({ id, kind, x, y, widthCm, lengthCm, angleDeg: 0 })
const PLAN = (items: FurnitureItem[]): Drawing => ({
  ...drawing({ walls: rectWalls("k", 0, 0, 420, 520), roughPlaster: [plaster("a", "k1", 1, "a", 0, 420, 20)], reconstruction: content([drywall("g", 20, 30, 220, 30, 10, 270)]) }),
  furniture: { items, dimensions: [] },
})
const COLUMN_SET = (): Drawing => PLAN([item("k", "kitchenColumn", 100, 260, 60, 62), item("m", "microwave", 200, 260, 60, 62), item("w", "washer", 300, 260, 60, 60)])
const OVEN_SET = (): Drawing => PLAN([item("o", "oven", 100, 260, 60, 62), item("d", "dryer", 300, 260, 60, 60)])

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

describe("легенда: образцы встраиваемой техники", () => {
  it("APP-01: образец кухонной колонны 60 × 62 — девять линий, повёрнут и уменьшен до высоты 8 мм (≈ 8,27 × 8 мм), заливки нет", () => {
    expectSample(build(COLUMN_SET()), 9, (62 * 8) / 60, SAMPLE_H_MM)
  })

  it("APP-02: образец духового шкафа 60 × 62 — девять линий, ≈ 8,27 × 8 мм, заливки нет", () => {
    expectSample(build(OVEN_SET()), 9, (62 * 8) / 60, SAMPLE_H_MM)
  })

  it("APP-03: образец микроволновки 60 × 62 — восемь линий, ≈ 8,27 × 8 мм, заливки нет", () => {
    expectSample(build(COLUMN_SET()), 8, (62 * 8) / 60, SAMPLE_H_MM)
  })

  it("APP-04: образец стиральной машины 60 × 60 — шесть линий, уменьшен до 8 × 8 мм, заливки нет", () => {
    expectSample(build(COLUMN_SET()), 6, SAMPLE_H_MM, SAMPLE_H_MM)
  })

  it("APP-05: образец сушильной машины 60 × 60 — шесть линий, 8 × 8 мм, заливки нет", () => {
    expectSample(build(OVEN_SET()), 6, SAMPLE_H_MM, SAMPLE_H_MM)
  })
})
