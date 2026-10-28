import { describe, expect, it } from "vitest"
import type { FurnitureItem, Point } from "../types"
import { itemDrawingInPlan } from "./furniture-render"

// change add-toilet: рисунок унитаза в чертеже строится по его четырём размерам (spec furniture-plan «Унитаз»). Эталоны посчитаны вручную.

const round = (p: Point): Point => ({ x: Math.round(p.x * 1e6) / 1e6, y: Math.round(p.y * 1e6) / 1e6 })

describe("рисунок унитаза в чертеже", () => {
  it("TLR-01: чаша 40 × 55, блок 70 × 25, центр (100, 100), угол 0 — блок x 65–135, y 60–85", () => {
    const t: FurnitureItem = { id: "t", kind: "toilet", x: 100, y: 100, widthCm: 70, lengthCm: 80, angleDeg: 0, toilet: { bowlWidthCm: 40, bowlLengthCm: 55, blockWidthCm: 70, blockDepthCm: 25 } }
    expect(itemDrawingInPlan(t).lines[0].map(round)).toEqual([{ x: 65, y: 60 }, { x: 135, y: 60 }, { x: 135, y: 85 }, { x: 65, y: 85 }, { x: 65, y: 60 }])
  })

  it("TLR-02: размеры унитаза доходят до рисунка: бока чаши 40 см — x 80 и 120, нос на y = 140", () => {
    const t: FurnitureItem = { id: "t", kind: "toilet", x: 100, y: 100, widthCm: 70, lengthCm: 80, angleDeg: 0, toilet: { bowlWidthCm: 40, bowlLengthCm: 55, blockWidthCm: 70, blockDepthCm: 25 } }
    const bowl = itemDrawingInPlan(t).lines[3].map(round)
    expect(bowl[0]).toEqual({ x: 80, y: 85 })
    expect(bowl[bowl.length - 1]).toEqual({ x: 120, y: 85 })
    expect(Math.max(...bowl.map((p) => p.y))).toBe(140)
  })

  it("TLR-03: угол 90 — блок справа (x 116–136), нос чаши слева на x = 64", () => {
    const t: FurnitureItem = { id: "t", kind: "toilet", x: 100, y: 100, widthCm: 70, lengthCm: 72, angleDeg: 90, toilet: { bowlWidthCm: 38, bowlLengthCm: 52, blockWidthCm: 70, blockDepthCm: 20 } }
    const d = itemDrawingInPlan(t)
    expect(Math.min(...d.lines[3].map((p) => p.x))).toBeCloseTo(64, 6)
    expect(Math.max(...d.lines[0].map((p) => p.x))).toBeCloseTo(136, 6)
    expect(Math.min(...d.lines[0].map((p) => p.x))).toBeCloseTo(116, 6)
  })
})
