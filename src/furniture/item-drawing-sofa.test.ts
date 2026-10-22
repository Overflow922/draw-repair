import { describe, expect, it } from "vitest"
import type { Point } from "../types"
import { sofaDrawing } from "./item-drawing"
import type { ItemSize } from "./item-drawing"

// change add-furniture-sofa: рисунок дивана (spec furniture-plan «Каталог видов мебели», сценарии «Рисунок дивана»,
// «Спинка дивана поворачивается с предметом», «Узкий диван»). Ожидания — числа из спека, не вывод из реализации.

const EPS = 1e-9
const size = (widthCm: number, lengthCm: number): ItemSize => ({ widthCm, lengthCm })
const box = (pts: readonly Point[]) => ({
  minX: Math.min(...pts.map((p) => p.x)),
  maxX: Math.max(...pts.map((p) => p.x)),
  minY: Math.min(...pts.map((p) => p.y)),
  maxY: Math.max(...pts.map((p) => p.y)),
})
const rounded = (v: number): number => Math.round(v * 1e6) / 1e6
const boxOf = (pts: readonly Point[]) => {
  const b = box(pts)
  return [b.minX, b.maxX, b.minY, b.maxY].map(rounded)
}
// точки линии на высоте y (±EPS)
const atY = (pts: readonly Point[], y: number): Point[] => pts.filter((p) => Math.abs(p.y - y) < EPS)

describe("рисунок дивана", () => {
  it("SD-01: диван 200×90 — контур на границе предмета со скруглением 10 см", () => {
    const d = sofaDrawing(size(200, 90))
    expect(boxOf(d.outline)).toEqual([0, 200, 0, 90])
    const top = atY(d.outline, 0).map((p) => p.x)
    expect(Math.min(...top)).toBeCloseTo(10, 6)
    expect(Math.max(...top)).toBeCloseTo(190, 6)
  })

  it("SD-02: сиденье — отступы 16 см от боков, 22 см от верха, 8 см от низа, скругление 6 см", () => {
    const d = sofaDrawing(size(200, 90))
    expect(d.lines).toHaveLength(2)
    const seat = d.lines[1] ?? []
    expect(boxOf(seat)).toEqual([16, 184, 22, 82])
    expect(Math.min(...atY(seat, 22).map((p) => p.x))).toBeCloseTo(22, 6)
  })

  it("SD-03: силуэт замкнут и первой линией идёт он сам", () => {
    const d = sofaDrawing(size(200, 90))
    const first = d.lines[0] ?? []
    expect(first).toHaveLength(d.outline.length + 1)
    expect(first.slice(0, -1)).toEqual(d.outline)
    expect(first[first.length - 1]).toEqual(first[0])
  })

  it("SD-04: спинка (22 см) толще подлокотника (16 см) только сверху, снизу кромка тоньше всех (8 см)", () => {
    const b = box(sofaDrawing(size(200, 90)).lines[1] ?? [])
    expect(b.minY).toBeGreaterThan(b.minX)
    expect(90 - b.maxY).toBeLessThan(b.minX)
  })

  it("SD-05: диван другого размера 240×100 — контур по сторонам предмета, отступы прежние", () => {
    const d = sofaDrawing(size(240, 100))
    expect(boxOf(d.outline)).toEqual([0, 240, 0, 100])
    expect(boxOf(d.lines[1] ?? [])).toEqual([16, 224, 22, 92])
  })

  it("SD-06: узкий диван 200×60 — детали уменьшены в отношении 60/90, рисунок внутри предмета", () => {
    const d = sofaDrawing(size(200, 60))
    const k = 60 / 90
    const seat = d.lines[1] ?? []
    expect(box(seat).minX).toBeCloseTo(16 * k, 6)
    expect(box(seat).minY).toBeCloseTo(22 * k, 6)
    expect(box(seat).maxY).toBeCloseTo(60 - 8 * k, 6)
    for (const p of [...d.outline, ...d.lines.flat()]) {
      expect(p.x).toBeGreaterThanOrEqual(-EPS)
      expect(p.x).toBeLessThanOrEqual(200 + EPS)
      expect(p.y).toBeGreaterThanOrEqual(-EPS)
      expect(p.y).toBeLessThanOrEqual(60 + EPS)
    }
  })

  it("SD-07: заданный коэффициент деталей заменяет вычисляемый", () => {
    const d = sofaDrawing(size(200, 45), 1)
    expect(box(d.lines[1] ?? []).minX).toBeCloseTo(16, 6)
  })
})
