import { describe, expect, it } from "vitest"
import type { Point } from "../types"
import { itemDrawingInPlan } from "./furniture-render"
import { newItem } from "./item"
import type { ItemDrawingFn } from "./item-drawing"
import { dryerDrawing, washerDrawing } from "./laundry-drawing"
import { crossingCount, inside, pts, size } from "./wardrobe.test-utils"

// change add-furniture-appliances: рисунки стиральной и сушильной машин (spec furniture-plan «Каталог видов мебели», сценарии
// «Рисунок стиральной машины», «Стиральная машина другого размера», «Рисунок сушильной машины», «Сушильная машина другого размера»,
// «Фасад техники поворачивается с предметом»).
// Линии: 0 корпус, 1 и 2 кнопки, 3 дисплей, 4 барабан; стиральная машина — 5 линия воды; сушильная машина — 5 спираль.

const r4 = (v: number): number => Math.round(v * 1e4) / 1e4
const xs = (line: readonly Point[] | undefined): number[] => (line ?? []).map((p) => r4(p.x))
const ys = (line: readonly Point[] | undefined): number[] => (line ?? []).map((p) => r4(p.y))
const ends = (line: readonly Point[] | undefined): number[][] => {
  const p = pts(line)
  return [p[0] ?? [], p.at(-1) ?? []]
}
const isCircle = (line: readonly Point[] | undefined, cx: number, cy: number, r: number): boolean =>
  (line ?? []).length > 12 && (line ?? []).every((p) => Math.abs(Math.hypot(p.x - cx, p.y - cy) - r) < 1e-9)
const near = (line: readonly Point[] | undefined, x: number, y: number): boolean =>
  (line ?? []).some((p) => Math.abs(p.x - x) < 0.01 && Math.abs(p.y - y) < 0.01)

function gridProblems(drawing: ItemDrawingFn): string[] {
  const problems: string[] = []
  for (const w of [10, 25, 30, 47, 60, 90, 200]) {
    for (const l of [5, 12, 31, 60, 100, 200]) {
      const d = drawing(size(w, l))
      if (!inside(d.lines, w, l)) problems.push(`${w}×${l}: выходит за прямоугольник`)
      if (crossingCount(d.lines) > 0) problems.push(`${w}×${l}: линии пересекаются`)
    }
  }
  return problems
}

describe("рисунок стиральной машины", () => {
  it("LD-01: стиральная машина 60×60 — шесть линий: корпус, кнопки, дисплей, барабан справа, линия воды", () => {
    const d = washerDrawing(size(60, 60))
    expect(d.lines).toHaveLength(6)
    expect(pts(d.lines[0])).toEqual([[0, 3], [60, 3], [60, 60], [0, 60], [0, 3]])
    expect(pts(d.lines[1])).toEqual([[2, 3], [2, 0], [7, 0], [7, 3]])
    expect(pts(d.lines[2])).toEqual([[9, 3], [9, 0], [14, 0], [14, 3]])
    const display = pts(d.lines[3])
    expect(display.slice(0, 2)).toEqual([[19, 3], [19, 1]])
    expect(display.slice(-2)).toEqual([[56.5, 1], [56.5, 3]])
    expect(display).toContainEqual([20, 0])
    expect(display).toContainEqual([55.5, 0])
    expect(Math.min(...ys(d.lines[3]))).toBe(0)
    expect(isCircle(d.lines[4], 44, 31.5, 11.5)).toBe(true)
    expect(ends(d.lines[5])).toEqual([[32.5, 31.5], [55.5, 31.5]])
    for (const x of [35.375, 41.125, 46.875, 52.625]) expect(pts(d.lines[5])).toContainEqual([x, 33.1])
    for (const x of [38.25, 44, 49.75]) expect(pts(d.lines[5])).toContainEqual([x, 31.5])
    expect(Math.min(...ys(d.lines[5]))).toBe(31.5)
    expect(Math.max(...ys(d.lines[5]))).toBe(33.1)
  })

  it("LD-02: контур — прямоугольник предмета; рисунок внутри, без пересечений (концы линии воды на барабане)", () => {
    const d = washerDrawing(size(60, 60))
    expect(pts(d.outline)).toEqual([[0, 0], [60, 0], [60, 60], [0, 60]])
    expect(inside(d.lines, 60, 60)).toBe(true)
    expect(crossingCount(d.lines)).toBe(0)
    for (const p of ends(d.lines[5])) expect(Math.hypot((p[0] ?? 0) - 44, (p[1] ?? 0) - 31.5)).toBeCloseTo(11.5, 9)
  })

  it("LD-03: стиральная машина 90×60 — кнопки те же, дисплей до 86,5, барабан (59; 31,5)", () => {
    const d = washerDrawing(size(90, 60))
    expect(pts(d.lines[1])).toEqual([[2, 3], [2, 0], [7, 0], [7, 3]])
    expect(pts(d.lines[2])).toEqual([[9, 3], [9, 0], [14, 0], [14, 3]])
    expect(Math.min(...xs(d.lines[3]))).toBe(19)
    expect(Math.max(...xs(d.lines[3]))).toBe(86.5)
    expect(isCircle(d.lines[4], 59, 31.5, 11.5)).toBe(true)
    expect(ends(d.lines[5])).toEqual([[47.5, 31.5], [70.5, 31.5]])
  })

  it("LD-04: стиральная машина 45×45 — k = 0,75, cy = 23,625", () => {
    const d = washerDrawing(size(45, 45))
    expect(pts(d.lines[0])).toEqual([[0, 2.25], [45, 2.25], [45, 45], [0, 45], [0, 2.25]])
    expect(pts(d.lines[1])).toEqual([[1.5, 2.25], [1.5, 0], [5.25, 0], [5.25, 2.25]])
    expect(pts(d.lines[2])).toEqual([[6.75, 2.25], [6.75, 0], [10.5, 0], [10.5, 2.25]])
    const display = pts(d.lines[3])
    expect(display.slice(0, 2)).toEqual([[14.25, 2.25], [14.25, 0.75]])
    expect(display.slice(-2)).toEqual([[42.375, 0.75], [42.375, 2.25]])
    expect(display).toContainEqual([15, 0])
    expect(isCircle(d.lines[4], 33, 23.625, 8.625)).toBe(true)
    expect(ends(d.lines[5])).toEqual([[24.375, 23.625], [41.625, 23.625]])
    expect(Math.max(...ys(d.lines[5]))).toBe(24.825)
    expect(inside(d.lines, 45, 45)).toBe(true)
    expect(crossingCount(d.lines)).toBe(0)
  })

  it("LD-05: сетка размеров 10–200 × 5–200 — внутри прямоугольника и без пересечений", () => {
    expect(gridProblems(washerDrawing)).toEqual([])
  })
})

describe("рисунок сушильной машины", () => {
  it("LD-06: сушильная машина 60×60 — корпус как у стиральной, барабан слева, спираль", () => {
    const d = dryerDrawing(size(60, 60))
    expect(d.lines).toHaveLength(6)
    expect(d.lines.slice(0, 4).map(pts)).toEqual(washerDrawing(size(60, 60)).lines.slice(0, 4).map(pts))
    expect(isCircle(d.lines[4], 16, 31.5, 11.5)).toBe(true)
    expect(ends(d.lines[5])).toEqual([[14, 31.5], [16, 43]])
    expect(near(d.lines[5], 16, 34.5556)).toBe(true)
    expect(near(d.lines[5], 9.7778, 31.5)).toBe(true)
    expect(near(d.lines[5], 5.5556, 31.5)).toBe(true)
  })

  it("LD-07: спираль — два с четвертью витка против часовой стрелки, радиус растёт от 2 до 11,5", () => {
    const spiral = dryerDrawing(size(60, 60)).lines[5] ?? []
    const radii = spiral.map((p) => Math.hypot(p.x - 16, p.y - 31.5))
    expect(radii.every((r, i) => i === 0 || r > (radii[i - 1] ?? 0))).toBe(true)
    // на экране (ось Y вниз) против часовой стрелки: угол atan2 убывает
    let turned = 0
    spiral.forEach((p, i) => {
      const q = spiral[i - 1]
      if (!q) return
      let da = Math.atan2(p.y - 31.5, p.x - 16) - Math.atan2(q.y - 31.5, q.x - 16)
      if (da > Math.PI) da -= 2 * Math.PI
      if (da < -Math.PI) da += 2 * Math.PI
      turned += da
    })
    expect((turned * 180) / Math.PI).toBeCloseTo(-810, 6)
  })

  it("LD-08: контур — прямоугольник предмета; рисунок внутри, без пересечений", () => {
    const d = dryerDrawing(size(60, 60))
    expect(pts(d.outline)).toEqual([[0, 0], [60, 0], [60, 60], [0, 60]])
    expect(inside(d.lines, 60, 60)).toBe(true)
    expect(crossingCount(d.lines)).toBe(0)
  })

  it("LD-09: сушильная машина 60×80 — корпус глубже, барабан в середине корпуса", () => {
    const d = dryerDrawing(size(60, 80))
    expect(pts(d.lines[0])).toEqual([[0, 3], [60, 3], [60, 80], [0, 80], [0, 3]])
    expect(isCircle(d.lines[4], 16, 41.5, 11.5)).toBe(true)
    expect(ends(d.lines[5])).toEqual([[14, 41.5], [16, 53]])
  })

  it("LD-10: сушильная машина 30×30 — k = 0,5, cy = 15,75", () => {
    const d = dryerDrawing(size(30, 30))
    expect(pts(d.lines[0])).toEqual([[0, 1.5], [30, 1.5], [30, 30], [0, 30], [0, 1.5]])
    expect(isCircle(d.lines[4], 8, 15.75, 5.75)).toBe(true)
    expect(ends(d.lines[5])).toEqual([[7, 15.75], [8, 21.5]])
    expect(inside(d.lines, 30, 30)).toBe(true)
    expect(crossingCount(d.lines)).toBe(0)
  })

  it("LD-11: сетка размеров 10–200 × 5–200 — внутри прямоугольника и без пересечений", () => {
    expect(gridProblems(dryerDrawing)).toEqual([])
  })
})

describe("панель управления машин поворачивается с предметом", () => {
  const meanX = (l: readonly Point[] | undefined): number => (l ?? []).reduce((s, p) => s + p.x, 0) / Math.max(1, (l ?? []).length)

  it.each([["washer", 60, 60], ["dryer", 60, 60]] as const)("LD-12: %s с углом 90° — панель справа от центра, барабан левее", (kind, w, l) => {
    const item = newItem("k", kind, { x: 0, y: 0 }, { widthCm: w, lengthCm: l, angleDeg: 90 })
    const lines = itemDrawingInPlan(item).lines
    expect(meanX(lines[3])).toBeGreaterThan(meanX(lines[4]))
    expect(meanX(lines[3])).toBeGreaterThan(item.x)
  })
})
