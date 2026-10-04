import { describe, expect, it } from "vitest"
import { displayPolygons, faceCornerTol, hitWall } from "./wall-geometry"
import { DIAG20, wall } from "./move-joints.test-utils"
import type { Point, Wall } from "./types"

// change fix-wall-move-joints, design D1: порог углового стыка на грани —
// max(1.25·max(h), √(h₁² + h₂²) + 1 см), единый для перемещения и отрисовки.

function inPoly(p: Point, poly: Point[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const yi = poly[i].y
    const yj = poly[j].y
    if (yi > p.y !== yj > p.y && p.x < ((poly[j].x - poly[i].x) * (p.y - yi)) / (yj - yi) + poly[i].x) inside = !inside
  }
  return inside
}

const owners = (p: Point, scene: Wall[]): Wall[] => scene.filter((w) => displayPolygons(w, scene).some((pc) => inPoly(p, pc)))

describe("faceCornerTol: запас 1 см к диагонали угла", () => {
  it("FM-1: равные толщины 20 — диагональ + 1", () => {
    const a = wall(0, 0, 100, 0, "a")
    const b = wall(0, 0, 0, 100, "b")
    expect(faceCornerTol(a, b)).toBeCloseTo(DIAG20 + 1, 6)
  })

  it("FM-1: 20 и 16 — диагональ √164 + 1 больше 1.25·h", () => {
    const a = wall(0, 0, 100, 0, "a", 20)
    const b = wall(0, 0, 0, 100, "b", 16)
    expect(faceCornerTol(a, b)).toBeCloseTo(Math.hypot(10, 8) + 1, 6)
  })

  it("FM-1: 40 и 10 — 1.25·h = 25 больше диагонали + 1 (≈21.6), запас не прибавляется к 1.25·h", () => {
    const thick = wall(0, 0, 100, 0, "t", 40)
    const thin = wall(0, 0, 0, 100, "s", 10)
    expect(faceCornerTol(thick, thin)).toBeCloseTo(25, 6)
    expect(faceCornerTol(thin, thick)).toBeCloseTo(25, 6)
  })

  it("FM-1: 40 и 30 — диагональ 25 + 1 = 26 больше 1.25·h = 25", () => {
    const thick = wall(0, 0, 100, 0, "t", 40)
    const mid = wall(0, 0, 0, 100, "m", 30)
    expect(faceCornerTol(thick, mid)).toBeCloseTo(26, 6)
    expect(faceCornerTol(mid, thick)).toBeCloseTo(26, 6)
  })
})

describe("Замыкание углового стыка на грани: дрейф в пределах запаса", () => {
  // S повернута к (200, −60): у упёртой U под торцом просвет, у торца S выемка —
  // обе зоны залиты, только если стык распознан как угловой на грани
  const GAP: Point = { x: 15, y: 8 } // продолжение U до внутренней грани S
  const NOTCH: Point = { x: 0.8, y: 6 } // продолжение S до наружной грани U

  it("FM-7: конец U смещён на 0.18 см (14.27 > диагонали 14.14) — угол закрыт, при любом порядке", () => {
    const S = wall(0, 0, 200, -60, "S")
    const U = wall(10, 10.18, 10, 200, "U")
    for (const scene of [
      [S, U],
      [U, S],
    ]) {
      expect(owners(GAP, scene)).toEqual([U])
      expect(owners(NOTCH, scene)).toEqual([S])
      expect(hitWall(GAP, scene, 0.1)).toBe(U)
    }
  })

  it("FM-8: конец U дальше диагонали + 1 см (≈15.32) — не угловой стык, зоны замыкания не залиты", () => {
    const S = wall(0, 0, 200, -60, "S")
    const U = wall(10, 11.6, 10, 200, "U")
    for (const scene of [
      [S, U],
      [U, S],
    ]) {
      expect(owners(GAP, scene)).toEqual([])
      expect(owners(NOTCH, scene)).toEqual([])
    }
  })
})
