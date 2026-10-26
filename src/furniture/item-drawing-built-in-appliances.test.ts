import { describe, expect, it } from "vitest"
import type { Point } from "../types"
import { kitchenColumnDrawing, microwaveDrawing, ovenDrawing } from "./built-in-appliance-drawing"
import { itemDrawingInPlan } from "./furniture-render"
import { newItem } from "./item"
import type { ItemDrawingFn } from "./item-drawing"
import { kitchenCabinetDrawing } from "./kitchen-cabinet-drawing"
import { dryerDrawing, washerDrawing } from "./laundry-drawing"
import { crossingCount, inside, pts, size } from "./wardrobe.test-utils"

// change add-furniture-appliances: рисунки кухонной колонны, духового шкафа и микроволновки (spec furniture-plan «Каталог видов
// мебели», сценарии «Рисунок кухонной колонны», «Кухонная колонна другого размера», «Рисунок духового шкафа», «Духовой шкаф другого
// размера», «Рисунок микроволновки», «Микроволновка другого размера», «Фасад техники поворачивается с предметом»).
// Линии: 0 корпус, 1 линия панели, 2 планка ручки, 3 и 4 стойки ручки; колонна — 5–8 половины диагоналей; духовой шкаф — 5 круг,
// 6–8 черты жара; микроволновка — 5 круг, 6 и 7 волны.

const r4 = (v: number): number => Math.round(v * 1e4) / 1e4
const xs = (line: readonly Point[] | undefined): number[] => (line ?? []).map((p) => r4(p.x))
const ys = (line: readonly Point[] | undefined): number[] => (line ?? []).map((p) => r4(p.y))
const ends = (line: readonly Point[] | undefined): number[][] => {
  const p = pts(line)
  return [p[0] ?? [], p.at(-1) ?? []]
}
// все точки окружности на расстоянии r от центра (cx, cy)
const isCircle = (line: readonly Point[] | undefined, cx: number, cy: number, r: number): boolean =>
  (line ?? []).length > 12 && (line ?? []).every((p) => Math.abs(Math.hypot(p.x - cx, p.y - cy) - r) < 1e-9)

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

describe("рисунок кухонной колонны", () => {
  it("BA-01: колонна 60×62 — девять линий, фасад как у кухонного шкафа, X до точки O", () => {
    const d = kitchenColumnDrawing(size(60, 62))
    expect(d.lines).toHaveLength(9)
    expect(d.lines.slice(0, 5).map(pts)).toEqual(kitchenCabinetDrawing(size(60, 62)).lines.map(pts))
    expect(pts(d.lines[5])).toEqual([[0, 5], [30, 33.5]])
    expect(pts(d.lines[6])).toEqual([[60, 5], [30, 33.5]])
    expect(pts(d.lines[7])).toEqual([[60, 62], [30, 33.5]])
    expect(pts(d.lines[8])).toEqual([[0, 62], [30, 33.5]])
  })

  it("BA-02: контур — прямоугольник предмета; рисунок внутри, без пересечений", () => {
    const d = kitchenColumnDrawing(size(60, 62))
    expect(pts(d.outline)).toEqual([[0, 0], [60, 0], [60, 62], [0, 62]])
    expect(inside(d.lines, 60, 62)).toBe(true)
    expect(crossingCount(d.lines)).toBe(0)
  })

  it("BA-03: колонна 90×62 — корпус по ширине, ручка по середине, O = (45; 33,5)", () => {
    const d = kitchenColumnDrawing(size(90, 62))
    expect(pts(d.lines[1])).toEqual([[0, 5], [90, 5]])
    expect(pts(d.lines[2])).toEqual([[32.25, 0], [57.75, 0]])
    expect(d.lines.slice(5).map(pts)).toEqual([
      [[0, 5], [45, 33.5]],
      [[90, 5], [45, 33.5]],
      [[90, 62], [45, 33.5]],
      [[0, 62], [45, 33.5]],
    ])
  })

  it("BA-04: колонна 60×31 — k = 0,5", () => {
    const d = kitchenColumnDrawing(size(60, 31))
    expect(pts(d.lines[0])).toEqual([[0, 1], [60, 1], [60, 31], [0, 31], [0, 1]])
    expect(pts(d.lines[1])).toEqual([[0, 2.5], [60, 2.5]])
    expect(pts(d.lines[2])).toEqual([[23.625, 0], [36.375, 0]])
    expect(pts(d.lines[3])).toEqual([[25.625, 0], [25.625, 1]])
    expect(pts(d.lines[4])).toEqual([[34.375, 0], [34.375, 1]])
    expect(d.lines.slice(5).map(pts)).toEqual([
      [[0, 2.5], [30, 16.75]],
      [[60, 2.5], [30, 16.75]],
      [[60, 31], [30, 16.75]],
      [[0, 31], [30, 16.75]],
    ])
    expect(inside(d.lines, 60, 31)).toBe(true)
    expect(crossingCount(d.lines)).toBe(0)
  })

  it("BA-05: сетка размеров 10–200 × 5–200 — внутри прямоугольника и без пересечений", () => {
    expect(gridProblems(kitchenColumnDrawing)).toEqual([])
  })
})

describe("рисунок духового шкафа", () => {
  it("BA-06: духовой шкаф 60×62 — девять линий, круг справа, три черты жара", () => {
    const d = ovenDrawing(size(60, 62))
    expect(d.lines).toHaveLength(9)
    expect(d.lines.slice(0, 5).map(pts)).toEqual(kitchenCabinetDrawing(size(60, 62)).lines.map(pts))
    expect(isCircle(d.lines[5], 44, 33.5, 13)).toBe(true)
    expect(d.lines.slice(6).map(ends)).toEqual([
      [[41.2, 28], [41.2, 39]],
      [[44, 28], [44, 39]],
      [[46.8, 28], [46.8, 39]],
    ])
    const middle = pts(d.lines[7])
    for (const p of [[44, 28], [43, 30.75], [44, 33.5], [45, 36.25], [44, 39]]) expect(middle).toContainEqual(p)
    expect(Math.min(...xs(d.lines[7]))).toBe(43)
    expect(Math.max(...xs(d.lines[7]))).toBe(45)
  })

  it("BA-07: контур — прямоугольник предмета; рисунок внутри, без пересечений", () => {
    const d = ovenDrawing(size(60, 62))
    expect(pts(d.outline)).toEqual([[0, 0], [60, 0], [60, 62], [0, 62]])
    expect(inside(d.lines, 60, 62)).toBe(true)
    expect(crossingCount(d.lines)).toBe(0)
  })

  it("BA-08: духовой шкаф 45×62 — k = 0,75, cy = 32,875", () => {
    const d = ovenDrawing(size(45, 62))
    expect(pts(d.lines[0])).toEqual([[0, 1.5], [45, 1.5], [45, 62], [0, 62], [0, 1.5]])
    expect(pts(d.lines[1])).toEqual([[0, 3.75], [45, 3.75]])
    expect(pts(d.lines[2])).toEqual([[12.9375, 0], [32.0625, 0]])
    expect(pts(d.lines[3])).toEqual([[15.9375, 0], [15.9375, 1.5]])
    expect(pts(d.lines[4])).toEqual([[29.0625, 0], [29.0625, 1.5]])
    expect(isCircle(d.lines[5], 33, 32.875, 9.75)).toBe(true)
    expect(d.lines.slice(6).map(ends)).toEqual([
      [[30.9, 28.75], [30.9, 37]],
      [[33, 28.75], [33, 37]],
      [[35.1, 28.75], [35.1, 37]],
    ])
    expect(Math.min(...xs(d.lines[7]))).toBe(32.25)
    expect(Math.max(...xs(d.lines[7]))).toBe(33.75)
  })

  it("BA-09: духовой шкаф 60×80 — корпус глубже, значок в середине корпуса, фасад тот же", () => {
    const d = ovenDrawing(size(60, 80))
    expect(pts(d.lines[0])).toEqual([[0, 2], [60, 2], [60, 80], [0, 80], [0, 2]])
    expect(d.lines.slice(1, 5).map(pts)).toEqual(ovenDrawing(size(60, 62)).lines.slice(1, 5).map(pts))
    expect(isCircle(d.lines[5], 44, 42.5, 13)).toBe(true)
    expect(d.lines.slice(6).map(ends)).toEqual([
      [[41.2, 37], [41.2, 48]],
      [[44, 37], [44, 48]],
      [[46.8, 37], [46.8, 48]],
    ])
    expect(inside(d.lines, 60, 80)).toBe(true)
    expect(crossingCount(d.lines)).toBe(0)
  })

  it("BA-10: сетка размеров 10–200 × 5–200 — внутри прямоугольника и без пересечений", () => {
    expect(gridProblems(ovenDrawing)).toEqual([])
  })
})

describe("рисунок микроволновки", () => {
  it("BA-11: микроволновка 60×62 — восемь линий, круг слева, две волны", () => {
    const d = microwaveDrawing(size(60, 62))
    expect(d.lines).toHaveLength(8)
    expect(d.lines.slice(0, 5).map(pts)).toEqual(kitchenCabinetDrawing(size(60, 62)).lines.map(pts))
    expect(isCircle(d.lines[5], 16, 33.5, 13)).toBe(true)
    expect(ends(d.lines[6])).toEqual([[7, 33], [25, 33]])
    expect(ends(d.lines[7])).toEqual([[7, 37], [25, 37]])
    for (const p of [[10, 30], [16, 30], [22, 30]]) expect(pts(d.lines[6])).toContainEqual(p)
    for (const p of [[10, 34], [16, 34], [22, 34]]) expect(pts(d.lines[7])).toContainEqual(p)
    expect(Math.min(...ys(d.lines[6]))).toBe(30)
    expect(Math.max(...ys(d.lines[6]))).toBe(33)
    expect(Math.min(...ys(d.lines[7]))).toBe(34)
    expect(Math.max(...ys(d.lines[7]))).toBe(37)
  })

  it("BA-12: контур — прямоугольник предмета; рисунок внутри, без пересечений", () => {
    const d = microwaveDrawing(size(60, 62))
    expect(pts(d.outline)).toEqual([[0, 0], [60, 0], [60, 62], [0, 62]])
    expect(inside(d.lines, 60, 62)).toBe(true)
    expect(crossingCount(d.lines)).toBe(0)
  })

  it("BA-13: микроволновка 60×31 — k = 0,5, cy = 16,75", () => {
    const d = microwaveDrawing(size(60, 31))
    expect(d.lines.slice(0, 5).map(pts)).toEqual(kitchenCabinetDrawing(size(60, 31)).lines.map(pts))
    expect(isCircle(d.lines[5], 23, 16.75, 6.5)).toBe(true)
    expect(ends(d.lines[6])).toEqual([[18.5, 16.5], [27.5, 16.5]])
    expect(ends(d.lines[7])).toEqual([[18.5, 18.5], [27.5, 18.5]])
    expect(Math.min(...ys(d.lines[6]))).toBe(15)
    expect(Math.min(...ys(d.lines[7]))).toBe(17)
    expect(inside(d.lines, 60, 31)).toBe(true)
    expect(crossingCount(d.lines)).toBe(0)
  })

  it("BA-14: сетка размеров 10–200 × 5–200 — внутри прямоугольника и без пересечений", () => {
    expect(gridProblems(microwaveDrawing)).toEqual([])
  })
})

// сценарий «Техника одного места складывается в рисунок картинки»
describe("техника одного места складывается в рисунок картинки", () => {
  it("BA-16: колонна, духовой шкаф и микроволновка 60×62 — фасады совпадают, круги слева и справа от точки O на её высоте", () => {
    const column = kitchenColumnDrawing(size(60, 62))
    const oven = ovenDrawing(size(60, 62))
    const microwave = microwaveDrawing(size(60, 62))
    expect(oven.lines.slice(0, 5).map(pts)).toEqual(column.lines.slice(0, 5).map(pts))
    expect(microwave.lines.slice(0, 5).map(pts)).toEqual(column.lines.slice(0, 5).map(pts))
    expect(isCircle(microwave.lines[5], 16, 33.5, 13)).toBe(true)
    expect(isCircle(oven.lines[5], 44, 33.5, 13)).toBe(true)
    expect(pts(column.lines[5]).at(-1)).toEqual([30, 33.5])
  })

  it("BA-17: стиральная и сушильная машины 60×60 — корпус и панель совпадают, барабаны x = 16 и 44 на y = 31,5", () => {
    const washer = washerDrawing(size(60, 60))
    const dryer = dryerDrawing(size(60, 60))
    expect(dryer.lines.slice(0, 4).map(pts)).toEqual(washer.lines.slice(0, 4).map(pts))
    expect(isCircle(dryer.lines[4], 16, 31.5, 11.5)).toBe(true)
    expect(isCircle(washer.lines[4], 44, 31.5, 11.5)).toBe(true)
  })
})

describe("фасад встраиваемой техники поворачивается с предметом", () => {
  const meanX = (l: readonly Point[] | undefined): number => (l ?? []).reduce((s, p) => s + p.x, 0) / Math.max(1, (l ?? []).length)

  it.each([["kitchenColumn", 60, 62], ["oven", 60, 62], ["microwave", 60, 62]] as const)(
    "BA-15: %s с углом 90° — ручка справа от центра, корпус левее",
    (kind, w, l) => {
      const item = newItem("k", kind, { x: 0, y: 0 }, { widthCm: w, lengthCm: l, angleDeg: 90 })
      const lines = itemDrawingInPlan(item).lines
      expect(meanX(lines[2])).toBeGreaterThan(meanX(lines[1]))
      expect(meanX(lines[1])).toBeGreaterThan(meanX(lines[0]))
    },
  )
})
