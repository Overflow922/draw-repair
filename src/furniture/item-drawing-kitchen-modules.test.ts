import { describe, expect, it } from "vitest"
import type { Point } from "../types"
import { itemDrawingInPlan } from "./furniture-render"
import { newItem } from "./item"
import type { ItemDrawingFn } from "./item-drawing"
import { kitchenCabinetDrawing } from "./kitchen-cabinet-drawing"
import { dishwasherDrawing, wineCabinetDrawing } from "./kitchen-module-drawing"
import { crossingCount, inside, pts, size } from "./wardrobe.test-utils"

// change add-furniture-kitchen-objects: рисунки встроенных объектов кухни (spec furniture-plan «Каталог видов мебели», сценарии
// «Рисунок винного шкафа», «Винный шкаф другого размера», «Рисунок посудомойки», «Посудомойка другого размера», «Фасад объекта
// кухни поворачивается с предметом»).
// Линии: 0 корпус, 1 линия панели, 2 планка ручки, 3 и 4 стойки ручки; винный шкаф — 5 венчик, 6 бутылка, 7 и 8 края этикетки;
// посудомойка — 5 чаша бокала, 6 ножка, 7 подставка, 8 вилка, 9 и 10 средние зубцы.

const xs = (line: readonly Point[] | undefined): number[] => (line ?? []).map((p) => Math.round(p.x * 1e4) / 1e4)
const ys = (line: readonly Point[] | undefined): number[] => (line ?? []).map((p) => Math.round(p.y * 1e4) / 1e4)

function gridProblems(drawing: ItemDrawingFn): string[] {
  const problems: string[] = []
  for (const w of [10, 25, 30, 47, 60, 90, 200]) {
    for (const l of [5, 12, 31, 62, 100, 200]) {
      const d = drawing(size(w, l))
      if (!inside(d.lines, w, l)) problems.push(`${w}×${l}: выходит за прямоугольник`)
      if (crossingCount(d.lines) > 0) problems.push(`${w}×${l}: линии пересекаются`)
    }
  }
  return problems
}

describe("рисунок винного шкафа", () => {
  it("KM-01: винный шкаф 30×62 — девять линий с числами из спеки", () => {
    const d = wineCabinetDrawing(size(30, 62))
    expect(d.lines).toHaveLength(9)
    expect(pts(d.lines[0])).toEqual([[0, 2], [30, 2], [30, 62], [0, 62], [0, 2]])
    expect(pts(d.lines[1])).toEqual([[0, 5], [30, 5]])
    expect(pts(d.lines[2])).toEqual([[8, 0], [22, 0]])
    expect(pts(d.lines[3])).toEqual([[10.5, 0], [10.5, 2]])
    expect(pts(d.lines[4])).toEqual([[19.5, 0], [19.5, 2]])
    expect(pts(d.lines[5])).toEqual([[13, 12], [17, 12], [17, 14], [13, 14], [13, 12]])
    const bottle = pts(d.lines[6])
    expect(bottle.slice(0, 4)).toEqual([[13.6, 14], [13.6, 21], [10.8, 27], [10.8, 52]])
    expect(bottle.slice(-4)).toEqual([[19.2, 52], [19.2, 27], [16.4, 21], [16.4, 14]])
    expect(bottle).toContainEqual([13.8, 55])
    expect(bottle).toContainEqual([16.2, 55])
    expect(Math.max(...ys(d.lines[6]))).toBe(55)
    expect(pts(d.lines[7])).toEqual([[10.8, 34], [19.2, 34]])
    expect(pts(d.lines[8])).toEqual([[10.8, 46], [19.2, 46]])
  })

  it("KM-02: контур для обводки — прямоугольник предмета; рисунок внутри, без пересечений", () => {
    const d = wineCabinetDrawing(size(30, 62))
    expect(pts(d.outline)).toEqual([[0, 0], [30, 0], [30, 62], [0, 62]])
    expect(inside(d.lines, 30, 62)).toBe(true)
    expect(crossingCount(d.lines)).toBe(0)
  })

  it("KM-03: винный шкаф 45×62 — ручка и бутылка тех же размеров по середине ширины", () => {
    const d = wineCabinetDrawing(size(45, 62))
    expect(pts(d.lines[1])).toEqual([[0, 5], [45, 5]])
    expect(pts(d.lines[2])).toEqual([[15.5, 0], [29.5, 0]])
    expect(Math.min(...xs(d.lines[6]))).toBe(18.3)
    expect(Math.max(...xs(d.lines[6]))).toBe(26.7)
  })

  it("KM-04: винный шкаф 30×31 — k = 0,5, все числа вдвое меньше", () => {
    const d = wineCabinetDrawing(size(30, 31))
    expect(pts(d.lines[0])).toEqual([[0, 1], [30, 1], [30, 31], [0, 31], [0, 1]])
    expect(pts(d.lines[1])).toEqual([[0, 2.5], [30, 2.5]])
    expect(pts(d.lines[2])).toEqual([[11.5, 0], [18.5, 0]])
    expect(pts(d.lines[3])).toEqual([[12.75, 0], [12.75, 1]])
    expect(pts(d.lines[4])).toEqual([[17.25, 0], [17.25, 1]])
    expect(pts(d.lines[5])).toEqual([[14, 6], [16, 6], [16, 7], [14, 7], [14, 6]])
    expect(Math.min(...xs(d.lines[6]))).toBe(12.9)
    expect(Math.max(...xs(d.lines[6]))).toBe(17.1)
    expect(Math.max(...ys(d.lines[6]))).toBe(27.5)
    expect(pts(d.lines[7])).toEqual([[12.9, 17], [17.1, 17]])
    expect(pts(d.lines[8])).toEqual([[12.9, 23], [17.1, 23]])
    expect(inside(d.lines, 30, 31)).toBe(true)
    expect(crossingCount(d.lines)).toBe(0)
  })

  it("KM-05: сетка размеров 10–200 × 5–200 — внутри прямоугольника и без пересечений", () => {
    expect(gridProblems(wineCabinetDrawing)).toEqual([])
  })
})

describe("рисунок посудомойки", () => {
  it("KM-06: посудомойка 60×62 — одиннадцать линий, фасад как у кухонного шкафа", () => {
    const d = dishwasherDrawing(size(60, 62))
    expect(d.lines).toHaveLength(11)
    expect(d.lines.slice(0, 5).map(pts)).toEqual(kitchenCabinetDrawing(size(60, 62)).lines.map(pts))
    const cup = pts(d.lines[5])
    expect(cup.slice(0, 2)).toEqual([[16.5, 14], [29.5, 14]])
    expect(cup).toContainEqual([23, 30])
    expect(cup.at(-1)).toEqual([16.5, 14])
    expect(Math.max(...ys(d.lines[5]))).toBe(30)
    expect(pts(d.lines[6])).toEqual([[23, 30], [23, 44]])
    const base = pts(d.lines[7])
    expect(base.slice(0, 2)).toEqual([[17.5, 46], [28.5, 46]])
    expect(base).toContainEqual([23, 44.5])
    expect(base.at(-1)).toEqual([17.5, 46])
    const fork = pts(d.lines[8])
    expect(fork.slice(0, 4)).toEqual([[35.5, 14], [35.5, 22], [38.1, 27.5], [38.1, 45]])
    expect(fork.slice(-4)).toEqual([[39.9, 45], [39.9, 27.5], [42.5, 22], [42.5, 14]])
    expect(fork).toContainEqual([39, 45.9])
    expect(pts(d.lines[9])).toEqual([[37.8, 14], [37.8, 22]])
    expect(pts(d.lines[10])).toEqual([[40.2, 14], [40.2, 22]])
  })

  it("KM-07: контур для обводки — прямоугольник предмета; рисунок внутри, без пересечений", () => {
    const d = dishwasherDrawing(size(60, 62))
    expect(pts(d.outline)).toEqual([[0, 0], [60, 0], [60, 62], [0, 62]])
    expect(inside(d.lines, 60, 62)).toBe(true)
    expect(crossingCount(d.lines)).toBe(0)
  })

  it("KM-08: посудомойка 45×62 — k = 0,75", () => {
    const d = dishwasherDrawing(size(45, 62))
    expect(pts(d.lines[0])).toEqual([[0, 1.5], [45, 1.5], [45, 62], [0, 62], [0, 1.5]])
    expect(pts(d.lines[1])).toEqual([[0, 3.75], [45, 3.75]])
    expect(pts(d.lines[2])).toEqual([[12.9375, 0], [32.0625, 0]])
    expect(pts(d.lines[3])).toEqual([[15.9375, 0], [15.9375, 1.5]])
    expect(pts(d.lines[4])).toEqual([[29.0625, 0], [29.0625, 1.5]])
    expect(pts(d.lines[5]).slice(0, 2)).toEqual([[12.375, 10.5], [22.125, 10.5]])
    expect(pts(d.lines[5])).toContainEqual([17.25, 22.5])
    expect(Math.min(...xs(d.lines[8]))).toBe(26.625)
    expect(Math.max(...xs(d.lines[8]))).toBe(31.875)
  })

  it("KM-09: посудомойка 60×80 — корпус глубже, остальные линии те же", () => {
    const d = dishwasherDrawing(size(60, 80))
    expect(pts(d.lines[0])).toEqual([[0, 2], [60, 2], [60, 80], [0, 80], [0, 2]])
    expect(d.lines.slice(1).map(pts)).toEqual(dishwasherDrawing(size(60, 62)).lines.slice(1).map(pts))
  })

  it("KM-10: сетка размеров 10–200 × 5–200 — внутри прямоугольника и без пересечений", () => {
    expect(gridProblems(dishwasherDrawing)).toEqual([])
  })
})

describe("фасад встроенного объекта кухни поворачивается с предметом", () => {
  const meanX = (l: readonly Point[] | undefined): number => (l ?? []).reduce((s, p) => s + p.x, 0) / Math.max(1, (l ?? []).length)

  it.each([["wineCabinet", 30, 62], ["dishwasher", 60, 62]] as const)("KM-11: %s с углом 90° — ручка справа от центра, корпус левее", (kind, w, l) => {
    const item = newItem("k", kind, { x: 0, y: 0 }, { widthCm: w, lengthCm: l, angleDeg: 90 })
    const lines = itemDrawingInPlan(item).lines
    expect(meanX(lines[2])).toBeGreaterThan(meanX(lines[1]))
    expect(meanX(lines[1])).toBeGreaterThan(meanX(lines[0]))
  })
})
