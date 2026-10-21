import { describe, expect, it } from "vitest"
import type { FurnitureItem } from "../types"
import { centerSources, guideTrack, snapCenter } from "./center-snap"
import type { Side } from "./room-sides"

// change furniture-center-snap: прилипание центра предмета к линиям центровки (spec furniture-plan «Центровка предметов»,
// «Риска центровки мебели»)

const chair = (id: string, x: number, y: number): FurnitureItem => ({ id, kind: "chair", x, y, widthCm: 45, lengthCm: 45, angleDeg: 0 })
const side = (ax: number, ay: number, bx: number, by: number): Side => ({ a: { x: ax, y: ay }, b: { x: bx, y: by } })
const RADIUS = 8.75 // масштаб 1: 17,5 px

describe("центровка по предмету", () => {
  it("FCS-001: напротив другого предмета центр прилипает к линии x = 100", () => {
    const lines = centerSources([], [chair("a", 100, 50)], new Set())
    expect(snapCenter({ x: 103, y: 250 }, lines, RADIUS).center).toEqual({ x: 100, y: 250 })
  })

  it("FCS-002: рядом две линии разных предметов — центр в точке пересечения", () => {
    const lines = centerSources([], [chair("a", 100, 50), chair("d", 300, 250)], new Set())
    const snapped = snapCenter({ x: 102, y: 248 }, lines, RADIUS)
    expect(snapped.center).toEqual({ x: 100, y: 250 })
    expect(snapped.hits).toHaveLength(2)
  })

  it("FCS-003: предмет из исключённых линий не даёт", () => {
    const lines = centerSources([], [chair("a", 100, 50)], new Set(["a"]))
    expect(lines).toEqual([])
    expect(snapCenter({ x: 103, y: 250 }, lines, RADIUS)).toEqual({ center: { x: 103, y: 250 }, hits: [] })
  })

  it("FCS-004: в радиусе 8 см прилипает, в 10 см нет (масштаб 1)", () => {
    const lines = centerSources([], [chair("a", 100, 0)], new Set())
    expect(snapCenter({ x: 108, y: 300 }, lines, RADIUS).center.x).toBe(100)
    expect(snapCenter({ x: 110, y: 300 }, lines, RADIUS)).toEqual({ center: { x: 110, y: 300 }, hits: [] })
  })

  it("FCS-005: при масштабе 0,25 радиус 35 см: 30 см прилипает", () => {
    const lines = centerSources([], [chair("a", 100, 0)], new Set())
    expect(snapCenter({ x: 130, y: 300 }, lines, 35).center.x).toBe(100)
  })
})

describe("центровка по стороне помещения", () => {
  it("FCS-010: по центру горизонтальной стороны — линия x = 200", () => {
    const lines = centerSources([side(0, 0, 400, 0)], [], new Set())
    expect(snapCenter({ x: 193, y: 80 }, lines, RADIUS).center).toEqual({ x: 200, y: 80 })
  })

  it("FCS-011: наклонная сторона — центр проецируется на прямую x + y = 300", () => {
    const lines = centerSources([side(0, 0, 300, 300)], [], new Set())
    const { center } = snapCenter({ x: 95, y: 200 }, lines, RADIUS)
    expect(center.x).toBeCloseTo(97.5, 9)
    expect(center.y).toBeCloseTo(202.5, 9)
  })

  it("FCS-012: сторона нулевой длины линии не даёт", () => {
    expect(centerSources([side(5, 5, 5, 5)], [], new Set())).toEqual([])
  })
})

describe("риска", () => {
  it("FCS-020: от источника через центр с выступом 6 px по обе стороны (k = 2 px/см → 3 см)", () => {
    const lines = centerSources([], [chair("a", 100, 50)], new Set())
    const [hit] = snapCenter({ x: 103, y: 250 }, lines, RADIUS).hits
    if (!hit) throw new Error("прилипания нет")
    const track = guideTrack(hit, { x: 100, y: 250 }, 2, 6)
    expect(track.from.x).toBeCloseTo(100, 9)
    expect(track.from.y).toBeCloseTo(47, 9)
    expect(track.to.x).toBeCloseTo(100, 9)
    expect(track.to.y).toBeCloseTo(253, 9)
  })
})
