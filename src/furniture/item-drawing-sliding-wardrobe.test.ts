import { describe, expect, it } from "vitest"
import type { Point } from "../types"
import { itemDrawingInPlan } from "./furniture-render"
import { newItem } from "./item"
import { slidingWardrobeDrawing } from "./wardrobe-drawing"
import { crossingCount, inside, pts, size, sweepProblems } from "./wardrobe.test-utils"

// change add-furniture-wardrobes: рисунок шкафа-купе по эскизу (spec furniture-plan «Каталог видов мебели», сценарии «Рисунок шкафа-купе»,
// «Пары вешалок шкафа-купе», «Шкаф-купе другого размера», «Короткий шкаф-купе», «Фасад шкафа поворачивается с предметом»).
// Линии: 0 контур, 1–2 линии направляющих, 3–5 перегородки верхнего ряда, 6–8 нижнего, 9–10 ручки, 11–12 штанги, дальше пары вешалок
// по четыре отрезка (левая линия: верх, низ; правая линия: верх, низ).

const PAIR = 13
const pair = (n: number): number => PAIR + 4 * n

describe("рисунок шкафа-купе", () => {
  it("SW-01: шкаф-купе 300×60 — контур, две линии направляющих, шесть перегородок, две ручки, две штанги и 80 отрезков вешалок", () => {
    const d = slidingWardrobeDrawing(size(300, 60))
    expect(d.lines).toHaveLength(93)
    expect(pts(d.lines[0])).toEqual([[0, 0], [300, 0], [300, 60], [0, 60], [0, 0]])
    expect(pts(d.lines[1])).toEqual([[0, 3.75], [300, 3.75]])
    expect(pts(d.lines[2])).toEqual([[0, 7.5], [300, 7.5]])
    expect(d.lines.slice(3, 9).map(pts)).toEqual([
      [[71, 0], [71, 3.75]],
      [[150, 0], [150, 3.75]],
      [[229, 0], [229, 3.75]],
      [[79, 3.75], [79, 7.5]],
      [[210.5, 3.75], [210.5, 7.5]],
      [[289.5, 3.75], [289.5, 7.5]],
    ])
    expect(d.lines.slice(9, 11).map(pts)).toEqual([
      [[3, 3.75], [3, 1.75], [6.5, 1.75], [6.5, 3.75]],
      [[283, 3.75], [283, 1.75], [286.5, 1.75], [286.5, 3.75]],
    ])
    expect(d.lines.slice(11, 13).map(pts)).toEqual([
      [[2.5, 33], [146.5, 33]],
      [[152, 33], [296.5, 33]],
    ])
  })

  it("SW-02: вертикальная пара с центром 9,5 — линии x = 7,3 и 11,7, отрезки y 12,5–30,8 и 33–53,5", () => {
    const d = slidingWardrobeDrawing(size(300, 60))
    expect([0, 1, 2, 3].map((i) => pts(d.lines[pair(0) + i]))).toEqual([
      [[7.3, 12.5], [7.3, 30.8]],
      [[7.3, 33], [7.3, 53.5]],
      [[11.7, 12.5], [11.7, 30.8]],
      [[11.7, 33], [11.7, 53.5]],
    ])
  })

  it("SW-03: пара с центром 24,5 наклонена вправо, пара с центром 70,5 — влево", () => {
    const d = slidingWardrobeDrawing(size(300, 60))
    const near = (line: readonly Point[] | undefined, expected: number[][]): void => {
      const got = pts(line)
      expected.forEach((p, i) => {
        expect(got[i]?.[0]).toBeCloseTo(p[0] ?? NaN, 2)
        expect(got[i]?.[1]).toBeCloseTo(p[1] ?? NaN, 2)
      })
    }
    near(d.lines[pair(1)], [[17.07, 13.77], [21.63, 30.8]])
    near(d.lines[pair(1) + 1], [[22.22, 33], [27.68, 53.37]])
    near(d.lines[pair(1) + 2], [[21.32, 12.63], [26.19, 30.8]])
    near(d.lines[pair(1) + 3], [[26.78, 33], [31.93, 52.23]])
    const left = d.lines[pair(4)] ?? []
    expect((left[0]?.x ?? 0) > (left[1]?.x ?? 0)).toBe(true)
  })

  it("SW-04: двадцать пар, наклон вправо у 2-й, 8-й, 11-й и 17-й, влево у 5-й, 14-й и 19-й, остальные вертикальные", () => {
    const d = slidingWardrobeDrawing(size(300, 60))
    const leans = Array.from({ length: 20 }, (_, n) => {
      const upper = d.lines[pair(n)] ?? []
      return Math.sign((upper[1]?.x ?? 0) - (upper[0]?.x ?? 0))
    })
    expect(leans).toEqual([0, 1, 0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, 1, 0, -1, 0])
  })

  it("SW-05: рисунок внутри прямоугольника, линии не пересекаются; силуэт — прямоугольник предмета", () => {
    const d = slidingWardrobeDrawing(size(300, 60))
    expect(inside(d.lines, 300, 60)).toBe(true)
    expect(crossingCount(d.lines)).toBe(0)
    expect(pts(d.outline)).toEqual([[0, 0], [300, 0], [300, 60], [0, 60]])
  })

  it("SW-06: шкаф-купе 400×60 — положения растянуты в 4/3, детали прежних размеров", () => {
    const d = slidingWardrobeDrawing(size(400, 60))
    expect(pts(d.lines[1])).toEqual([[0, 3.75], [400, 3.75]])
    expect(d.lines.slice(3, 9).map((l) => pts(l)[0]?.[0])).toEqual([94.6667, 200, 305.3333, 105.3333, 280.6667, 386])
    expect(pts(d.lines[11])).toEqual([[3.3333, 33], [195.3333, 33]])
    expect(pts(d.lines[12])).toEqual([[202.6667, 33], [395.3333, 33]])
    expect(pts(d.lines[9])).toEqual([[4.5833, 3.75], [4.5833, 1.75], [8.0833, 1.75], [8.0833, 3.75]])
    expect(pts(d.lines[pair(0)])).toEqual([[10.4667, 12.5], [10.4667, 30.8]])
    expect(pts(d.lines[pair(0) + 3])).toEqual([[14.8667, 33], [14.8667, 53.5]])
  })

  it("SW-07: шкаф-купе 150×60 — рисунок уменьшен вдвое (s = k = 0,5)", () => {
    const d = slidingWardrobeDrawing(size(150, 60))
    expect(pts(d.lines[1])).toEqual([[0, 1.875], [150, 1.875]])
    expect(pts(d.lines[2])).toEqual([[0, 3.75], [150, 3.75]])
    expect(d.lines.slice(3, 9).map(pts)).toEqual([
      [[35.5, 0], [35.5, 1.875]],
      [[75, 0], [75, 1.875]],
      [[114.5, 0], [114.5, 1.875]],
      [[39.5, 1.875], [39.5, 3.75]],
      [[105.25, 1.875], [105.25, 3.75]],
      [[144.75, 1.875], [144.75, 3.75]],
    ])
    expect(pts(d.lines[9])).toEqual([[1.5, 1.875], [1.5, 0.875], [3.25, 0.875], [3.25, 1.875]])
    expect(pts(d.lines[10])).toEqual([[141.5, 1.875], [141.5, 0.875], [143.25, 0.875], [143.25, 1.875]])
    expect(pts(d.lines[11])).toEqual([[1.25, 16.5], [73.25, 16.5]])
    expect(pts(d.lines[12])).toEqual([[76, 16.5], [148.25, 16.5]])
    expect(pts(d.lines[pair(0)])).toEqual([[3.65, 6.25], [3.65, 15.4]])
    expect(pts(d.lines[pair(0) + 1])).toEqual([[3.65, 16.5], [3.65, 26.75]])
    expect(pts(d.lines[pair(0) + 2])).toEqual([[5.85, 6.25], [5.85, 15.4]])
  })

  it("SW-08: шкаф-купе 300×90 — те же детали, нижние 30 см свободны", () => {
    const tall = slidingWardrobeDrawing(size(300, 90))
    const base = slidingWardrobeDrawing(size(300, 60))
    expect(tall.lines.slice(1)).toEqual(base.lines.slice(1))
    expect(pts(tall.lines[0])).toEqual([[0, 0], [300, 0], [300, 90], [0, 90], [0, 0]])
  })

  it("SW-09: шкаф-купе 300×30 — положения прежние, остальные числа вдвое меньше (s = 1, k = 0,5)", () => {
    const d = slidingWardrobeDrawing(size(300, 30))
    expect(pts(d.lines[1])).toEqual([[0, 1.875], [300, 1.875]])
    expect(pts(d.lines[3])).toEqual([[71, 0], [71, 1.875]])
    expect(pts(d.lines[11])).toEqual([[2.5, 16.5], [146.5, 16.5]])
    expect(pts(d.lines[pair(0)])).toEqual([[8.4, 6.25], [8.4, 15.4]])
    expect(pts(d.lines[pair(0) + 3])).toEqual([[10.6, 16.5], [10.6, 26.75]])
    expect(inside(d.lines, 300, 30)).toBe(true)
    expect(crossingCount(d.lines)).toBe(0)
  })

  it("SW-10: на сетке размеров рисунок внутри прямоугольника и без пересечений", () => {
    expect(sweepProblems(slidingWardrobeDrawing)).toEqual([])
  })

  it("SW-11: масштаб деталей из аргумента не превышает 1 и не выводит рисунок из прямоугольника образца", () => {
    const d = slidingWardrobeDrawing(size(80, 16), 1)
    expect(inside(d.lines, 80, 16)).toBe(true)
    expect(crossingCount(d.lines)).toBe(0)
    expect(pts(d.lines[pair(0)])?.[0]?.[1]).toBeCloseTo(3.3333, 3)
  })

  it("SW-12: шкаф-купе с углом 90° — фасад справа от центра, вешалки левее", () => {
    const item = newItem("w", "slidingWardrobe", { x: 0, y: 0 }, { widthCm: 300, lengthCm: 60, angleDeg: 90 })
    const lines = itemDrawingInPlan(item).lines
    const meanX = (l: readonly Point[] | undefined): number => (l ?? []).reduce((s, p) => s + p.x, 0) / Math.max(1, (l ?? []).length)
    expect(meanX(lines[1])).toBeGreaterThan(0)
    expect(meanX(lines[pair(0)])).toBeLessThan(meanX(lines[1]))
  })
})
