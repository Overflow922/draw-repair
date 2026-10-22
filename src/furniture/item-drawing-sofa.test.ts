import { describe, expect, it } from "vitest"
import type { Point } from "../types"
import { sofaDrawing } from "./item-drawing"
import type { ItemSize } from "./item-drawing"

// change sofa-sketch-redraw: рисунок дивана по эскизу (spec furniture-plan «Каталог видов мебели», сценарии «Рисунок дивана»,
// «Диван другой глубины», «Узкий диван»). Ожидания — числа из спека, не вывод из реализации.

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
const atY = (pts: readonly Point[], y: number): Point[] => pts.filter((p) => Math.abs(p.y - y) < EPS)
const atX = (pts: readonly Point[], x: number): Point[] => pts.filter((p) => Math.abs(p.x - x) < EPS)

describe("рисунок дивана", () => {
  it("SD-01: диван 200×80 — контур на границе предмета, спинка от верха, подлокотники на 4 см ниже", () => {
    const d = sofaDrawing(size(200, 80))
    expect(boxOf(d.outline)).toEqual([0, 200, 0, 80])
    const top = atY(d.outline, 0).map((p) => p.x)
    expect(Math.min(...top)).toBeCloseTo(20, 6)
    expect(Math.max(...top)).toBeCloseTo(180, 6)
    const armTop = atY(d.outline, 4).map((p) => p.x)
    expect(Math.min(...armTop)).toBeCloseTo(2, 6)
    expect(Math.max(...armTop)).toBeCloseTo(198, 6)
    expect(armTop.filter((x) => x > 18 && x < 182)).toEqual([])
    // верх подлокотника — прямая от скругления до спинки: в точке x = 18 контур выходит на y = 4 и уходит вверх к скруглению спинки
    expect(armTop.map(rounded)).toEqual(expect.arrayContaining([18, 182]))
    const bottom = atY(d.outline, 80).map((p) => p.x)
    expect(Math.min(...bottom)).toBeCloseTo(3, 6)
    expect(Math.max(...bottom)).toBeCloseTo(197, 6)
  })

  it("SD-02: линий пять — силуэт, три подушки спинки и планка", () => {
    expect(sofaDrawing(size(200, 80)).lines).toHaveLength(5)
  })

  it("SD-03: силуэт замкнут и первой линией идёт он сам", () => {
    const d = sofaDrawing(size(200, 80))
    const first = d.lines[0] ?? []
    expect(first).toHaveLength(d.outline.length + 1)
    expect(first.slice(0, -1)).toEqual(d.outline)
    expect(first[first.length - 1]).toEqual(first[0])
  })

  it("SD-04: три подушки спинки между подлокотниками одной ширины 164/3, от y = 0 до линии сиденья y = 57", () => {
    const d = sofaDrawing(size(200, 80))
    const w = 164 / 3
    for (const i of [0, 1, 2]) {
      expect(boxOf(d.lines[1 + i] ?? [])).toEqual(
        [18 + i * w, 18 + (i + 1) * w, 0, 57].map(rounded),
      )
    }
  })

  it("SD-05: переднее ребро подушки — дуга, поднятая на 5 см (вершина y = 52 посередине подушки)", () => {
    const w = 164 / 3
    const cushion = sofaDrawing(size(200, 80)).lines[1] ?? []
    const mid = atX(cushion, 18 + w / 2).filter((p) => p.y > 40)
    expect(mid.map((p) => rounded(p.y))).toEqual([52])
    expect(atY(cushion, 57).map((p) => rounded(p.x)).sort((a, b) => a - b)).toEqual(
      [18, rounded(18 + w)],
    )
  })

  it("SD-06: верхние углы подушек скруглены радиусом 2 см", () => {
    const cushion = sofaDrawing(size(200, 80)).lines[1] ?? []
    const top = atY(cushion, 0).map((p) => p.x)
    expect(Math.min(...top)).toBeCloseTo(20, 6)
    expect(Math.max(...top)).toBeCloseTo(18 + 164 / 3 - 2, 6)
  })

  it("SD-07: планка — x 14–186, y 57–74", () => {
    const rail = sofaDrawing(size(200, 80)).lines[4] ?? []
    expect(boxOf(rail)).toEqual([14, 186, 57, 74])
    expect(rail[rail.length - 1]).toEqual(rail[0])
  })

  it("SD-08: диван 200×90 — линия сиденья y = 67, дуга до y = 62, планка y 67–84, прочие детали прежние", () => {
    const d = sofaDrawing(size(200, 90))
    expect(boxOf(d.outline)).toEqual([0, 200, 0, 90])
    expect(boxOf(d.lines[1] ?? [])).toEqual([18, rounded(18 + 164 / 3), 0, 67])
    const mid = atX(d.lines[1] ?? [], 18 + 82 / 3).filter((p) => p.y > 50)
    expect(mid.map((p) => rounded(p.y))).toEqual([62])
    expect(boxOf(d.lines[4] ?? [])).toEqual([14, 186, 67, 84])
    expect(Math.min(...atY(d.outline, 4).map((p) => p.x))).toBeCloseTo(2, 6)
  })

  it("SD-09: диван другой ширины 240×80 — подушки равны, планка по-прежнему с отступом 14 см", () => {
    const d = sofaDrawing(size(240, 80))
    expect(boxOf(d.outline)).toEqual([0, 240, 0, 80])
    const w = (240 - 36) / 3
    expect(boxOf(d.lines[2] ?? [])).toEqual([18 + w, 18 + 2 * w, 0, 57].map(rounded))
    expect(boxOf(d.lines[4] ?? [])).toEqual([14, 226, 57, 74])
  })

  it("SD-10: узкий диван 200×60 — детали уменьшены в отношении 60/80, рисунок внутри предмета", () => {
    const d = sofaDrawing(size(200, 60))
    const k = 60 / 80
    expect(boxOf(d.lines[1] ?? [])).toEqual(
      [18 * k, 18 * k + (200 - 36 * k) / 3, 0, 60 - 23 * k].map(rounded),
    )
    expect(boxOf(d.lines[4] ?? [])).toEqual([14 * k, 200 - 14 * k, 60 - 23 * k, 60 - 6 * k].map(rounded))
    for (const p of [...d.outline, ...d.lines.flat()]) {
      expect(p.x).toBeGreaterThanOrEqual(-EPS)
      expect(p.x).toBeLessThanOrEqual(200 + EPS)
      expect(p.y).toBeGreaterThanOrEqual(-EPS)
      expect(p.y).toBeLessThanOrEqual(60 + EPS)
    }
  })

  it("SD-11: заданный коэффициент деталей заменяет вычисляемый", () => {
    const d = sofaDrawing(size(200, 45), 1)
    expect(box(d.lines[4] ?? []).minX).toBeCloseTo(14, 6)
  })
})
