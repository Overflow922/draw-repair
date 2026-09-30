import { describe, expect, it } from "vitest"
import { faceCornerTol } from "./wall-geometry"
import { moveWalls } from "./geometry"
import type { Wall } from "./types"

// change corner-joint-face-caps, design D1: единый допуск углового стыка на грани
// для перемещения стен и для отрисовки.

const W = (ax: number, ay: number, bx: number, by: number, thicknessCm: number): Wall => ({
  id: `t${ax}${ay}${bx}${by}${thicknessCm}`,
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
  thicknessCm,
  type: "brick",
})

describe("faceCornerTol: единый допуск углового стыка", () => {
  it("CJ-16: равные толщины — диагональ угла √(h₁²+h₂²)", () => {
    expect(faceCornerTol(W(0, 0, 100, 0, 20), W(0, 0, 0, 100, 20))).toBeCloseTo(Math.hypot(10, 10), 5)
    expect(faceCornerTol(W(0, 0, 100, 0, 20), W(0, 0, 0, 100, 20))).toBeGreaterThanOrEqual(Math.hypot(10, 10))
  })

  it("CJ-16: разные толщины — бо́льшее из 1.25·max(h) и диагонали, симметрично", () => {
    const thick = W(0, 0, 100, 0, 40) // h = 20
    const thin = W(0, 0, 0, 100, 10) // h = 5
    expect(faceCornerTol(thick, thin)).toBeCloseTo(25, 5) // 1.25·20 > √(400+25) ≈ 20.6
    expect(faceCornerTol(thin, thick)).toBeCloseTo(25, 5)
    const mid = W(0, 0, 0, 100, 30) // h = 15: √(400+225) = 25 = 1.25·20
    expect(faceCornerTol(thick, mid)).toBeCloseTo(25, 5)
    const a = W(0, 0, 100, 0, 20) // h = 10
    const b = W(0, 0, 0, 100, 16) // h = 8: √(164) ≈ 12.806 > 12.5
    expect(faceCornerTol(a, b)).toBeCloseTo(Math.hypot(10, 8), 5)
  })

  it("CJ-16: перемещение использует ту же границу — внутри допуска конец следует, за ним нет", () => {
    const S = W(0, 0, 200, 0, 40)
    const inside = W(15, 20, 15, 200, 10) // расстояние концов 25 = допуск
    moveWalls([S, inside], [S], { x: 0, y: 30 })
    expect(inside.a).toEqual({ x: 15, y: 50 })
    expect(inside.b).toEqual({ x: 15, y: 200 })
    // за торцом S (не на грани и не на оси): 24.995 ≤ 25 — следует, 25.05 > 25 — нет
    const S2 = W(0, 0, 200, 0, 40)
    const near = W(-5, 24.49, -5, 200, 10)
    moveWalls([S2, near], [S2], { x: 0, y: 30 })
    expect(near.a.x).toBe(-5)
    expect(near.a.y).toBeCloseTo(54.49, 9)
    const S3 = W(0, 0, 200, 0, 40)
    const beyond = W(-5, 24.55, -5, 200, 10)
    moveWalls([S3, beyond], [S3], { x: 0, y: 30 })
    expect(beyond.a).toEqual({ x: -5, y: 24.55 })
  })
})
