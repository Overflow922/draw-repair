import { describe, expect, it } from "vitest"
import type { Point } from "../types"
import { itemDrawingInPlan } from "./furniture-render"
import { newItem } from "./item"
import { doubleWardrobeDrawing } from "./wardrobe-drawing"
import { crossingCount, inside, pts, size, sweepProblems } from "./wardrobe.test-utils"

// change add-furniture-wardrobes: рисунок двустворчатого шкафа по эскизу (spec furniture-plan «Каталог видов мебели», сценарии «Рисунок
// двустворчатого шкафа», «Пары вешалок двустворчатого шкафа», «Двустворчатый шкаф другого размера», «Фасад шкафа поворачивается с
// предметом»). Линии: 0 контур, 1 линия створок, 2 перегородка, 3–4 ручки, 5 штанга, дальше пары вешалок по четыре отрезка
// (левая линия: верх, низ; правая линия: верх, низ).

const PAIR = 6
const pair = (n: number): number => PAIR + 4 * n

const near = (line: readonly Point[] | undefined, expected: number[][]): void => {
  const got = pts(line)
  expect(got).toHaveLength(expected.length)
  expected.forEach((p, i) => {
    expect(got[i]?.[0]).toBeCloseTo(p[0] ?? NaN, 2)
    expect(got[i]?.[1]).toBeCloseTo(p[1] ?? NaN, 2)
  })
}

describe("рисунок двустворчатого шкафа", () => {
  it("DW-01: шкаф 100×60 — контур, линия створок, перегородка, две ручки, штанга и 20 отрезков вешалок", () => {
    const d = doubleWardrobeDrawing(size(100, 60))
    expect(d.lines).toHaveLength(26)
    expect(pts(d.lines[0])).toEqual([[0, 0], [100, 0], [100, 60], [0, 60], [0, 0]])
    expect(pts(d.lines[1])).toEqual([[0, 3], [100, 3]])
    expect(pts(d.lines[2])).toEqual([[50, 0], [50, 3]])
    expect(pts(d.lines[3])).toEqual([[37, 3], [37, 1], [44, 1], [44, 3]])
    expect(pts(d.lines[4])).toEqual([[56, 3], [56, 1], [63, 1], [63, 3]])
    expect(pts(d.lines[5])).toEqual([[19.5, 30.2], [88, 30.2]])
  })

  it("DW-02: вертикальные пары (19,5, 53, 66,5) — линии по спеке, отрезки y 9,7–28 и 30,2–50,7", () => {
    const d = doubleWardrobeDrawing(size(100, 60))
    const xs = [17.3, 21.7, 50.8, 55.2, 64.3, 68.7]
    const pairIndex = [0, 2, 3]
    pairIndex.forEach((n, k) => {
      const [a, b] = [xs[2 * k] ?? NaN, xs[2 * k + 1] ?? NaN]
      expect([0, 1, 2, 3].map((i) => pts(d.lines[pair(n) + i]))).toEqual([
        [[a, 9.7], [a, 28]],
        [[a, 30.2], [a, 50.7]],
        [[b, 9.7], [b, 28]],
        [[b, 30.2], [b, 50.7]],
      ])
    })
  })

  it("DW-03: пара с центром 34,5 наклонена вправо, с центром 80,5 — влево, числа по спеке", () => {
    const d = doubleWardrobeDrawing(size(100, 60))
    near(d.lines[pair(1)], [[27.07, 10.97], [31.63, 28]])
    near(d.lines[pair(1) + 1], [[32.22, 30.2], [37.68, 50.57]])
    near(d.lines[pair(1) + 2], [[31.32, 9.83], [36.19, 28]])
    near(d.lines[pair(1) + 3], [[36.78, 30.2], [41.93, 49.43]])
    near(d.lines[pair(4)], [[83.68, 9.83], [78.81, 28]])
    near(d.lines[pair(4) + 1], [[78.22, 30.2], [73.07, 49.43]])
    near(d.lines[pair(4) + 2], [[87.93, 10.97], [83.37, 28]])
    near(d.lines[pair(4) + 3], [[82.78, 30.2], [77.32, 50.57]])
  })

  it("DW-04: рисунок внутри прямоугольника, линии не пересекаются; силуэт — прямоугольник предмета", () => {
    const d = doubleWardrobeDrawing(size(100, 60))
    expect(inside(d.lines, 100, 60)).toBe(true)
    expect(crossingCount(d.lines)).toBe(0)
    expect(pts(d.outline)).toEqual([[0, 0], [100, 0], [100, 60], [0, 60]])
  })

  it("DW-05: шкаф 120×60 — положения растянуты в 1,2, детали прежних размеров", () => {
    const d = doubleWardrobeDrawing(size(120, 60))
    expect(pts(d.lines[1])).toEqual([[0, 3], [120, 3]])
    expect(pts(d.lines[2])).toEqual([[60, 0], [60, 3]])
    expect(pts(d.lines[3])).toEqual([[45.1, 3], [45.1, 1], [52.1, 1], [52.1, 3]])
    expect(pts(d.lines[4])).toEqual([[67.9, 3], [67.9, 1], [74.9, 1], [74.9, 3]])
    expect(pts(d.lines[5])).toEqual([[23.4, 30.2], [105.6, 30.2]])
    expect(pts(d.lines[pair(0)])).toEqual([[21.2, 9.7], [21.2, 28]])
    expect(pts(d.lines[pair(0) + 3])).toEqual([[25.6, 30.2], [25.6, 50.7]])
  })

  it("DW-06: шкаф 50×30 — рисунок уменьшен вдвое (s = k = 0,5)", () => {
    const d = doubleWardrobeDrawing(size(50, 30))
    expect(pts(d.lines[1])).toEqual([[0, 1.5], [50, 1.5]])
    expect(pts(d.lines[2])).toEqual([[25, 0], [25, 1.5]])
    expect(pts(d.lines[3])).toEqual([[18.5, 1.5], [18.5, 0.5], [22, 0.5], [22, 1.5]])
    expect(pts(d.lines[4])).toEqual([[28, 1.5], [28, 0.5], [31.5, 0.5], [31.5, 1.5]])
    expect(pts(d.lines[5])).toEqual([[9.75, 15.1], [44, 15.1]])
    expect(pts(d.lines[pair(0)])).toEqual([[8.65, 4.85], [8.65, 14]])
    expect(pts(d.lines[pair(0) + 1])).toEqual([[8.65, 15.1], [8.65, 25.35]])
    expect(pts(d.lines[pair(0) + 2])).toEqual([[10.85, 4.85], [10.85, 14]])
    expect(inside(d.lines, 50, 30)).toBe(true)
    expect(crossingCount(d.lines)).toBe(0)
  })

  it("DW-07: на сетке размеров рисунок внутри прямоугольника и без пересечений", () => {
    expect(sweepProblems(doubleWardrobeDrawing)).toEqual([])
  })

  it("DW-08: образец легенды (габариты 66,7×40, масштаб 1 из аргумента) — подобие рисунка, внутри прямоугольника", () => {
    const d = doubleWardrobeDrawing(size(200 / 3, 40), 1)
    expect(inside(d.lines, 200 / 3, 40)).toBe(true)
    expect(crossingCount(d.lines)).toBe(0)
    expect(pts(d.lines[1])?.[0]?.[1]).toBeCloseTo(2, 3)
  })

  it("DW-09: шкаф с углом 90° — фасад справа от центра, штанга левее", () => {
    const item = newItem("w", "doubleWardrobe", { x: 0, y: 0 }, { widthCm: 100, lengthCm: 60, angleDeg: 90 })
    const lines = itemDrawingInPlan(item).lines
    const meanX = (l: readonly Point[] | undefined): number => (l ?? []).reduce((s, p) => s + p.x, 0) / Math.max(1, (l ?? []).length)
    expect(meanX(lines[1])).toBeGreaterThan(0)
    expect(meanX(lines[5])).toBeLessThan(meanX(lines[1]))
  })
})
