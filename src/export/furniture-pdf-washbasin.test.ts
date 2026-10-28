import { readFileSync } from "node:fs"
import type { jsPDF } from "jspdf"
import { describe, expect, it } from "vitest"
import { FURNITURE_KIND_ORDER } from "../furniture/furniture-kinds"
import { content, drawing, drywall, plaster, rectWalls, wall } from "../reconstruction/reconstruction.test-utils"
import { LIGHT_PALETTE } from "../theme"
import type { Battery, Communication, Drawing, FurnitureItem } from "../types"
import { LEGEND_COLUMN_CAPACITY, LEGEND_ROW_PITCH_MM, legendEntries } from "./legend"
import { parsePaint } from "./pdf-paint.test-utils"
import type { PaintOp } from "./pdf-paint.test-utils"
import { buildPdfPages, pagesOf } from "./pdf"

// change add-washbasin: образец умывальника в легенде страницы «Мебель» (spec furniture-plan «Каталог видов мебели», сценарий «Образец
// умывальника в легенде»): весь рисунок вида в области образца 16 × 8 мм, линии без заливки; запись стоит после «Трапа в стену»;
// страница со всеми видами каталога помещается по высоте на A3 (FP-414, 222 мм — наименьшая область чертежа среди A3–A0).
// Умывальник 60 × 48 по 0,2 мм на см — 12 × 9,6 мм, выше области образца, поэтому образец уменьшается до высоты 8 мм (10 × 8 мм).
// Умывальник на плане — 120 × 96 (масштаб 1:50, 24 × 19,2 мм), больше области образца, поэтому по размеру с образцом не путается.

const font = readFileSync(new URL("../assets/pt-sans-regular.ttf", import.meta.url)).toString("base64")
const SEP = new Date(2026, 8, 5, 14, 32, 7)
const build = (d: Drawing): jsPDF => buildPdfPages(pagesOf(d), "cm", 50, "A3", font, d.name, SEP)

const item = (id: string, kind: FurnitureItem["kind"], x: number, y: number, widthCm: number, lengthCm: number): FurnitureItem => ({ id, kind, x, y, widthCm, lengthCm, angleDeg: 0 })
const PLAN = (items: FurnitureItem[]): Drawing => ({
  ...drawing({ walls: rectWalls("k", 0, 0, 420, 520), roughPlaster: [plaster("a", "k1", 1, "a", 0, 420, 20)], reconstruction: content([drywall("g", 20, 30, 220, 30, 10, 270)]) }),
  furniture: { items, dimensions: [] },
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
const BASIN_LINES = 6

describe("легенда: образец умывальника", () => {
  it("WBL-01: образец умывальника 60 × 48 — 6 линий, уменьшен до 10 × 8 мм внутри области 16 × 8 мм, заливки нет", () => {
    const doc = build(PLAN([item("s", "washbasin", 200, 260, 120, 96)]))
    const samples = parsePaint(doc, 6).filter((op): op is Stroke => {
      if (op.kind !== "stroke" || !near(op.color, INK) || op.subpaths.length !== BASIN_LINES) return false
      const b = boxOf(op.subpaths.flat())
      return b.w <= SAMPLE_W_MM && b.h <= SAMPLE_H_MM + 0.01
    })
    expect(samples).toHaveLength(1)
    const b = boxOf((samples[0]?.subpaths ?? []).flat())
    expect(b.w).toBeCloseTo(10, 1)
    expect(b.h).toBeCloseTo(8, 1)
    const filled = parsePaint(doc, 6).filter(
      (op) => op.kind === "fill" && op.box !== null && op.box.x >= b.x - 0.05 && op.box.y >= b.y - 0.05 && op.box.x + op.box.w <= b.x + b.w + 0.05 && op.box.y + op.box.h <= b.y + b.h + 0.05,
    )
    expect(filled).toEqual([])
  })

  it("WBL-02: запись «Умывальник» последняя в легенде страницы со всеми видами, после «Трапа в стену»; все записи помещаются по высоте на A3", () => {
    const battery: Battery = { id: "b1", wallId: "k1", face: 1, anchor: "a", offsetCm: 100, lengthCm: 70, thicknessCm: 10, gapCm: 3 }
    const materials = ["blocks", "brick", "concrete", "gkl", "wood-long"] as const
    const walls = [...rectWalls("k", 0, 0, 420, 320), ...materials.map((m, i) => wall(`m${i}`, 600, i * 60, 800, i * 60, 10, m))]
    const riser: Communication = { kind: "riser", id: "r1", x: 200, y: 160, diameterCm: 11 }
    const duct: Communication = { kind: "duct", id: "d1", x: 300, y: 200, widthCm: 30, depthCm: 20 }
    const base = drawing({ walls, roughPlaster: [plaster("a", "k1", 1, "a", 0, 420, 20)], reconstruction: content([drywall("g", 20, 30, 220, 30, 10, 270)]) })
    const items = FURNITURE_KIND_ORDER.map((kind, i) => item(`i${i}`, kind, 100 + (i % 6) * 60, 60 + Math.floor(i / 6) * 60, 40, 40))
    const d: Drawing = { ...base, furniture: { items, dimensions: [] }, batteries: [battery], communications: [riser, duct] }
    const page = pagesOf(d)[5]
    if (!page) throw new Error("страницы «Мебель» нет")
    const labels = legendEntries(page).map((e) => e.label)
    expect(labels.at(-1)).toBe("Умывальник")
    expect(labels.at(-2)).toBe("Трап в стену")
    expect(labels).toContain("Раковина")
    expect(Math.ceil(labels.length / LEGEND_COLUMN_CAPACITY) * LEGEND_COLUMN_CAPACITY).toBeGreaterThanOrEqual(labels.length)
    expect(LEGEND_COLUMN_CAPACITY * LEGEND_ROW_PITCH_MM).toBeLessThanOrEqual(222)
  })
})
