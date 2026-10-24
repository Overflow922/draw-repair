import { describe, expect, it } from "vitest"
import type { Point } from "../types"
import { itemDrawingInPlan } from "./furniture-render"
import { newItem } from "./item"
import type { ItemDrawingFn } from "./item-drawing"
import { hobDrawing, sinkDrawing } from "./kitchen-inset-drawing"
import { crossingCount, inside, pts, size } from "./wardrobe.test-utils"

// change add-furniture-kitchen-objects: рисунки врезных объектов кухни (spec furniture-plan «Каталог видов мебели», сценарии
// «Рисунок варочной панели», «Варочная панель другого размера», «Рисунок раковины», «Раковина другого размера», «Фасад объекта
// кухни поворачивается с предметом»).
// Панель: 0 контур, 1 и 2 большая конфорка (внешняя, внутренняя), 3 и 4 малая конфорка, 5 и 6 ручки (верхняя, нижняя).
// Раковина: 0 бортик, 1 чаша, 2–4 рифление слева (сверху вниз), 5–7 рифление справа, 8 и 9 шайба (внешняя, внутренняя), 10 рычаг.

const r4 = (v: number): number => Math.round(v * 1e4) / 1e4
// габарит линии: [min x, min y, max x, max y]
const box = (line: readonly Point[] | undefined): number[] => {
  const ps = line ?? []
  return [Math.min(...ps.map((p) => p.x)), Math.min(...ps.map((p) => p.y)), Math.max(...ps.map((p) => p.x)), Math.max(...ps.map((p) => p.y))].map(r4)
}
const LEVER_END_Y = r4(34.4 - Math.sqrt(6.75))

function gridProblems(drawing: ItemDrawingFn): string[] {
  const problems: string[] = []
  for (const w of [10, 25, 45, 52, 60, 90, 200]) {
    for (const l of [5, 12, 30, 40, 62, 100, 200]) {
      const d = drawing(size(w, l))
      if (!inside(d.lines, w, l)) problems.push(`${w}×${l}: выходит за прямоугольник`)
      if (crossingCount(d.lines) > 0) problems.push(`${w}×${l}: линии пересекаются`)
    }
  }
  return problems
}

describe("рисунок варочной панели", () => {
  it("KI-01: панель 52×30 — семь линий с числами из спеки", () => {
    const d = hobDrawing(size(52, 30))
    expect(d.lines).toHaveLength(7)
    expect(box(d.lines[0])).toEqual([0, 0, 52, 30])
    expect(pts(d.lines[0])).toContainEqual([0, 1.5])
    expect(pts(d.lines[0])).toContainEqual([1.5, 0])
    expect(pts(d.lines[0])).toContainEqual([52, 28.5])
    expect(box(d.lines[1])).toEqual([5.7, 6.7, 22.3, 23.3])
    expect(box(d.lines[2])).toEqual([8, 9, 20, 21])
    expect(box(d.lines[3])).toEqual([29.4, 9.4, 40.6, 20.6])
    expect(box(d.lines[4])).toEqual([31.2, 11.2, 38.8, 18.8])
    expect(box(d.lines[5])).toEqual([46.3, 10.8, 48.7, 13.2])
    expect(box(d.lines[6])).toEqual([46.3, 16.8, 48.7, 19.2])
  })

  it("KI-02: контур для обводки — контур панели; линии замкнуты; рисунок внутри, без пересечений", () => {
    const d = hobDrawing(size(52, 30))
    expect(pts(d.lines[0])).toEqual([...pts(d.outline), pts(d.outline)[0]])
    for (const line of d.lines) expect(pts(line).at(-1)).toEqual(pts(line)[0])
    expect(inside(d.lines, 52, 30)).toBe(true)
    expect(crossingCount(d.lines)).toBe(0)
  })

  it("KI-03: панель 70×30 — конфорки на прежних местах, ручки у правого края", () => {
    const d = hobDrawing(size(70, 30))
    expect(box(d.lines[1])).toEqual([5.7, 6.7, 22.3, 23.3])
    expect(box(d.lines[3])).toEqual([29.4, 9.4, 40.6, 20.6])
    expect(box(d.lines[5])).toEqual([64.3, 10.8, 66.7, 13.2])
    expect(box(d.lines[6])).toEqual([64.3, 16.8, 66.7, 19.2])
  })

  it("KI-04: панель 26×15 — k = 0,5", () => {
    const d = hobDrawing(size(26, 15))
    expect(pts(d.lines[0])).toContainEqual([0, 0.75])
    expect(pts(d.lines[0])).toContainEqual([0.75, 0])
    expect(box(d.lines[1])).toEqual([2.85, 3.35, 11.15, 11.65])
    expect(box(d.lines[2])).toEqual([4, 4.5, 10, 10.5])
    expect(box(d.lines[3])).toEqual([14.7, 4.7, 20.3, 10.3])
    expect(box(d.lines[4])).toEqual([15.6, 5.6, 19.4, 9.4])
    expect(box(d.lines[5])).toEqual([23.15, 5.4, 24.35, 6.6])
    expect(box(d.lines[6])).toEqual([23.15, 8.4, 24.35, 9.6])
    expect(inside(d.lines, 26, 15)).toBe(true)
    expect(crossingCount(d.lines)).toBe(0)
  })

  it("KI-05: сетка размеров 10–200 × 5–200 — внутри прямоугольника и без пересечений", () => {
    expect(gridProblems(hobDrawing)).toEqual([])
  })
})

describe("рисунок раковины", () => {
  it("KI-06: раковина 45×40 — одиннадцать линий с числами из спеки", () => {
    const d = sinkDrawing(size(45, 40))
    expect(d.lines).toHaveLength(11)
    expect(box(d.lines[0])).toEqual([0, 0, 45, 40])
    expect(pts(d.lines[0])).toContainEqual([0, 3])
    expect(pts(d.lines[0])).toContainEqual([3, 0])
    const bowl = pts(d.lines[1])
    expect(box(d.lines[1])).toEqual([3.8, 4.7, 41.2, 30])
    expect(bowl[0]).toEqual([21, 30])
    expect(bowl.at(-1)).toEqual([24, 30])
    expect(bowl).toContainEqual([3.8, 27.5])
    expect(bowl).toContainEqual([6.3, 4.7])
    expect(bowl.filter(([x, y]) => y === 30 && x !== undefined && x > 21 && x < 24)).toEqual([])
    expect(d.lines.slice(2, 8).map(pts)).toEqual([
      [[5.4, 32.1], [13.9, 32.1]],
      [[5.4, 34.4], [13.9, 34.4]],
      [[5.4, 36.6], [13.9, 36.6]],
      [[31.1, 32.1], [39.6, 32.1]],
      [[31.1, 34.4], [39.6, 34.4]],
      [[31.1, 36.6], [39.6, 36.6]],
    ])
    expect(box(d.lines[8])).toEqual([19.5, 31.4, 25.5, 37.4])
    expect(box(d.lines[9])).toEqual([21.5, 33.4, 23.5, 35.4])
    const lever = pts(d.lines[10])
    expect(lever.slice(0, 2)).toEqual([[21, LEVER_END_Y], [21, 18.8]])
    expect(lever.slice(-2)).toEqual([[24, 18.8], [24, LEVER_END_Y]])
    expect(lever).toContainEqual([22.5, 17.3])
  })

  it("KI-07: контур для обводки — бортик; концы рычага лежат на внешней окружности шайбы; рисунок внутри, без пересечений", () => {
    const d = sinkDrawing(size(45, 40))
    expect(pts(d.lines[0])).toEqual([...pts(d.outline), pts(d.outline)[0]])
    expect(pts(d.lines[8])).toContainEqual([21, LEVER_END_Y])
    expect(pts(d.lines[8])).toContainEqual([24, LEVER_END_Y])
    expect(inside(d.lines, 45, 40)).toBe(true)
    expect(crossingCount(d.lines)).toBe(0)
  })

  it("KI-08: раковина 60×50 — чаша растянута, рифление и смеситель у задней стороны", () => {
    const d = sinkDrawing(size(60, 50))
    expect(box(d.lines[1])).toEqual([3.8, 4.7, 56.2, 40])
    expect(pts(d.lines[1])[0]).toEqual([28.5, 40])
    expect(pts(d.lines[1]).at(-1)).toEqual([31.5, 40])
    expect(pts(d.lines[2])).toEqual([[5.4, 42.1], [13.9, 42.1]])
    expect(pts(d.lines[4])).toEqual([[5.4, 46.6], [13.9, 46.6]])
    expect(pts(d.lines[5])).toEqual([[46.1, 42.1], [54.6, 42.1]])
    expect(box(d.lines[8])).toEqual([27, 41.4, 33, 47.4])
    expect(pts(d.lines[10]).slice(0, 2)).toEqual([[28.5, r4(44.4 - Math.sqrt(6.75))], [28.5, 28.8]])
    expect(pts(d.lines[10])).toContainEqual([30, 27.3])
  })

  it("KI-09: раковина 22,5×20 — k = 0,5", () => {
    const d = sinkDrawing(size(22.5, 20))
    expect(pts(d.lines[0])).toContainEqual([0, 1.5])
    expect(pts(d.lines[0])).toContainEqual([1.5, 0])
    expect(box(d.lines[1])).toEqual([1.9, 2.35, 20.6, 15])
    expect(d.lines.slice(2, 8).map(pts)).toEqual([
      [[2.7, 16.05], [6.95, 16.05]],
      [[2.7, 17.2], [6.95, 17.2]],
      [[2.7, 18.3], [6.95, 18.3]],
      [[15.55, 16.05], [19.8, 16.05]],
      [[15.55, 17.2], [19.8, 17.2]],
      [[15.55, 18.3], [19.8, 18.3]],
    ])
    expect(box(d.lines[8])).toEqual([9.75, 15.7, 12.75, 18.7])
    expect(box(d.lines[9])).toEqual([10.75, 16.7, 11.75, 17.7])
    expect(inside(d.lines, 22.5, 20)).toBe(true)
    expect(crossingCount(d.lines)).toBe(0)
  })

  it("KI-10: сетка размеров 10–200 × 5–200 — внутри прямоугольника и без пересечений", () => {
    expect(gridProblems(sinkDrawing)).toEqual([])
  })
})

describe("фасад врезного объекта кухни поворачивается с предметом", () => {
  const mean = (l: readonly Point[] | undefined, axis: "x" | "y"): number => (l ?? []).reduce((s, p) => s + p[axis], 0) / Math.max(1, (l ?? []).length)

  it("KI-11: раковина с углом 90° — чаша (у фасада) справа от рифления (у задней стороны)", () => {
    const lines = itemDrawingInPlan(newItem("s", "sink", { x: 0, y: 0 }, { widthCm: 45, lengthCm: 40, angleDeg: 90 })).lines
    expect(mean(lines[1], "x")).toBeGreaterThan(mean(lines[2], "x"))
  })

  it("KI-12: варочная панель с углом 90° — ручки (у правого края) ниже большой конфорки (у левого)", () => {
    const lines = itemDrawingInPlan(newItem("h", "hob", { x: 0, y: 0 }, { widthCm: 52, lengthCm: 30, angleDeg: 90 })).lines
    expect(mean(lines[5], "y")).toBeGreaterThan(mean(lines[1], "y"))
  })
})
