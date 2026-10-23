import { describe, expect, it } from "vitest"
import type { Point } from "../types"
import { tvDrawing } from "./item-drawing"
import type { ItemSize } from "./item-drawing"

// change add-furniture-tv-wall-cabinet: рисунок телевизора по эскизу (spec furniture-plan «Каталог видов мебели», сценарии
// «Рисунок телевизора», «Телевизор другой ширины», «Телевизор другой длины», «Узкий и маленький телевизор»). Ожидания — числа из спеки.

const EPS = 1e-6
const size = (widthCm: number, lengthCm: number): ItemSize => ({ widthCm, lengthCm })
const rounded = (v: number): number => Math.round(v * 1e6) / 1e6
const pts = (line: readonly Point[] | undefined): number[][] => (line ?? []).map((p) => [rounded(p.x), rounded(p.y)])

const cross = (o: Point, a: Point, b: Point): number => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
const crosses = (a: Point, b: Point, c: Point, d: Point): boolean => cross(a, b, c) * cross(a, b, d) < -EPS && cross(c, d, a) * cross(c, d, b) < -EPS
const segments = (line: readonly Point[]): [Point, Point][] => line.slice(1).flatMap((p, i): [Point, Point][] => (line[i] ? [[line[i] as Point, p]] : []))
const crossingCount = (lines: readonly (readonly Point[])[]): number => {
  let n = 0
  lines.forEach((la, i) => {
    lines.forEach((lb, j) => {
      if (j < i) return
      segments(la).forEach(([a, b], ia) =>
        segments(lb).forEach(([c, d], ib) => {
          if ((i !== j || ib > ia + 1) && crosses(a, b, c, d)) n++
        }),
      )
    })
  })
  return n
}

const inside = (lines: readonly (readonly Point[])[], w: number, l: number): boolean =>
  lines.flat().every((p) => p.x >= -EPS && p.x <= w + EPS && p.y >= -EPS && p.y <= l + EPS)

describe("рисунок телевизора", () => {
  it("TV-01: телевизор 91×11 — экран, задняя стенка, четыре отрезка шейки и подставка, других линий нет", () => {
    const d = tvDrawing(size(91, 11))
    expect(d.lines).toHaveLength(7)
    expect(pts(d.lines[0])).toEqual([[0, 0], [91, 0], [91, 3], [0, 3], [0, 0]])
    expect(pts(d.lines[1])).toEqual([[5, 3], [9.5, 6], [81.5, 6], [86, 3]])
    expect(d.lines.slice(2, 6).map(pts)).toEqual([
      [[26, 6], [26, 8.5]],
      [[29.5, 6], [29.5, 8.5]],
      [[61.5, 6], [61.5, 8.5]],
      [[65, 6], [65, 8.5]],
    ])
    expect(pts(d.lines[6])).toEqual([[24.5, 8.5], [66.5, 8.5], [66.5, 11], [24.5, 11], [24.5, 8.5]])
  })

  it("TV-02: контур для обводки — прямоугольник предмета, в линии рисунка он не входит", () => {
    const d = tvDrawing(size(91, 11))
    expect(pts(d.outline)).toEqual([[0, 0], [91, 0], [91, 11], [0, 11]])
    expect(d.lines.some((l) => l.some((p) => p.x === 91 && p.y === 11))).toBe(false)
  })

  it("TV-03: рисунок внутри прямоугольника, линии не пересекаются", () => {
    const d = tvDrawing(size(91, 11))
    expect(inside(d.lines, 91, 11)).toBe(true)
    expect(crossingCount(d.lines)).toBe(0)
  })

  it("TV-04: телевизор 120×11 — экран по всей ширине, шейка и подставка по центру x = 60", () => {
    const d = tvDrawing(size(120, 11))
    expect(pts(d.lines[0])).toEqual([[0, 0], [120, 0], [120, 3], [0, 3], [0, 0]])
    expect(pts(d.lines[1])).toEqual([[5, 3], [9.5, 6], [110.5, 6], [115, 3]])
    expect(d.lines.slice(2, 6).map((l) => rounded(l[0]?.x ?? NaN))).toEqual([40.5, 44, 76, 79.5])
    expect(pts(d.lines[6])).toEqual([[39, 8.5], [81, 8.5], [81, 11], [39, 11], [39, 8.5]])
  })

  it("TV-05: телевизор 91×20 — детали те же, от экрана вниз; нижние 9 см не заняты", () => {
    const d = tvDrawing(size(91, 20))
    expect(pts(d.lines[6])).toEqual([[24.5, 8.5], [66.5, 8.5], [66.5, 11], [24.5, 11], [24.5, 8.5]])
    expect(Math.max(...d.lines.flat().map((p) => p.y))).toBe(11)
    expect(pts(d.outline)).toEqual([[0, 0], [91, 0], [91, 20], [0, 20]])
  })

  it("TV-06: телевизор 60×11 — детали уменьшены в отношении 60/91, подставка 42·60/91 ≈ 27,7 см внутри", () => {
    const d = tvDrawing(size(60, 11))
    const k = 60 / 91
    const base = d.lines[6] ?? []
    expect(rounded((base[1]?.x ?? 0) - (base[0]?.x ?? 0))).toBeCloseTo(42 * k, 5)
    expect(rounded(d.lines[0]?.[2]?.y ?? 0)).toBeCloseTo(3 * k, 5)
    expect(inside(d.lines, 60, 11)).toBe(true)
    expect(crossingCount(d.lines)).toBe(0)
  })

  it("TV-07: телевизор 45,5×5,5 — все детали уменьшены вдвое", () => {
    const d = tvDrawing(size(45.5, 5.5))
    expect(pts(d.lines[0])).toEqual([[0, 0], [45.5, 0], [45.5, 1.5], [0, 1.5], [0, 0]])
    expect(pts(d.lines[6])).toEqual([[12.25, 4.25], [33.25, 4.25], [33.25, 5.5], [12.25, 5.5], [12.25, 4.25]])
    expect(inside(d.lines, 45.5, 5.5)).toBe(true)
    expect(crossingCount(d.lines)).toBe(0)
  })

  it("TV-08: масштаб деталей 1 из аргумента задаёт детали в полном размере при любых габаритах", () => {
    const d = tvDrawing(size(80, 9.7), 1)
    expect(pts(d.lines[0])).toEqual([[0, 0], [80, 0], [80, 3], [0, 3], [0, 0]])
    expect(pts(d.lines[6])).toEqual([[19, 8.5], [61, 8.5], [61, 11], [19, 11], [19, 8.5]])
  })
})
