import { describe, expect, it } from "vitest"
import type { Point } from "../types"
import { officeChairDrawing } from "./item-drawing"
import type { ItemDrawing, ItemSize } from "./item-drawing"
import { itemDrawingInPlan } from "./furniture-render"
import { newItem } from "./item"

// change add-furniture-desk-office-chair: рисунок компьютерного кресла по эскизу (spec furniture-plan «Каталог видов мебели»,
// сценарии «Рисунок компьютерного кресла», «Спинка кресла поворачивается с предметом», «Маленькое кресло», «Большое кресло»).
// Ожидания — числа из спека, не вывод из реализации.

const EPS = 1e-6
const size = (widthCm: number, lengthCm: number): ItemSize => ({ widthCm, lengthCm })
const rounded = (v: number): number => Math.round(v * 1e6) / 1e6
const boxOf = (pts: readonly Point[]): number[] =>
  [Math.min(...pts.map((p) => p.x)), Math.max(...pts.map((p) => p.x)), Math.min(...pts.map((p) => p.y)), Math.max(...pts.map((p) => p.y))].map(rounded)
const near = (a: Point | undefined, x: number, y: number): boolean => !!a && Math.hypot(a.x - x, a.y - y) < 1e-3
const centroid = (pts: readonly Point[]): Point => ({
  x: (Math.min(...pts.map((p) => p.x)) + Math.max(...pts.map((p) => p.x))) / 2,
  y: (Math.min(...pts.map((p) => p.y)) + Math.max(...pts.map((p) => p.y))) / 2,
})

const cross = (o: Point, a: Point, b: Point): number => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
const crosses = (a: Point, b: Point, c: Point, d: Point): boolean => cross(a, b, c) * cross(a, b, d) < -EPS && cross(c, d, a) * cross(c, d, b) < -EPS
const segments = (line: readonly Point[]): [Point, Point][] => line.slice(1).flatMap((p, i): [Point, Point][] => (line[i] ? [[line[i] as Point, p]] : []))
const crossingCount = (d: ItemDrawing): number => {
  let n = 0
  d.lines.forEach((la, i) => {
    d.lines.forEach((lb, j) => {
      if (j < i) return
      segments(la).forEach(([a, b], ia) =>
        segments(lb).forEach(([c, e], ib) => {
          if ((i !== j || ib > ia + 1) && crosses(a, b, c, e)) n++
        }),
      )
    })
  })
  return n
}

// линия рисунка с данным габаритным прямоугольником
const lineWithBox = (d: ItemDrawing, expected: number[]): Point[] | undefined =>
  d.lines.find((l) => boxOf(l).every((v, i) => Math.abs(v - (expected[i] ?? NaN)) < 1e-3))

// колёсики: центры из спека и точки начала спиц
const CASTERS: { centre: Point; from: Point | null }[] = [
  { centre: { x: 30, y: 3 }, from: null },
  { centre: { x: 4, y: 23 }, from: { x: 9, y: 24.3 } },
  { centre: { x: 56, y: 23 }, from: { x: 51, y: 24.3 } },
  { centre: { x: 14, y: 55.5 }, from: { x: 17, y: 50 } },
  { centre: { x: 46, y: 55.5 }, from: { x: 43, y: 50 } },
]
// вектор вдоль спицы к колёсику (у верхнего — вверх) и поперёк
const axes = (c: { centre: Point; from: Point | null }) => {
  const dx = c.from ? c.centre.x - c.from.x : 0
  const dy = c.from ? c.centre.y - c.from.y : -1
  const len = Math.hypot(dx, dy)
  return { u: { x: dx / len, y: dy / len }, v: { x: -dy / len, y: dx / len } }
}

describe("рисунок компьютерного кресла", () => {
  it("OC-01: кресло 60×60 — всего 19 линий, силуэт — тело x 11,5–48,5, y 5,5–50", () => {
    const d = officeChairDrawing(size(60, 60))
    expect(d.lines).toHaveLength(2 + 2 + 1 + 4 + 5 + 5)
    expect(boxOf(d.outline)).toEqual([11.5, 48.5, 5.5, 50])
  })

  it("OC-02: тело — две ломаные, верх от (11,5; 19,5) до (48,5; 19,5) с углами радиуса 10, низ от (11,5; 43,5) до (48,5; 43,5) с углами радиуса 5", () => {
    const d = officeChairDrawing(size(60, 60))
    const top = lineWithBox(d, [11.5, 48.5, 5.5, 19.5])
    const bottom = lineWithBox(d, [11.5, 48.5, 43.5, 50])
    expect(top).toBeDefined()
    expect(bottom).toBeDefined()
    expect(near(top?.[0], 11.5, 19.5) && near(top?.[top.length - 1], 48.5, 19.5)).toBe(true)
    expect(top?.some((p) => near(p, 11.5, 15.5)) && top?.some((p) => near(p, 21.5, 5.5)) && top?.some((p) => near(p, 38.5, 5.5))).toBe(true)
    expect(near(bottom?.[0], 11.5, 43.5) && near(bottom?.[bottom.length - 1], 48.5, 43.5)).toBe(true)
    expect(bottom?.some((p) => near(p, 11.5, 45)) && bottom?.some((p) => near(p, 16.5, 50)) && bottom?.some((p) => near(p, 43.5, 50))).toBe(true)
  })

  it("OC-03: подлокотники x 9–14 и 46–51, y 19,5–43,5 со скруглёнными концами радиуса 2,5", () => {
    const d = officeChairDrawing(size(60, 60))
    for (const box of [[9, 14, 19.5, 43.5], [46, 51, 19.5, 43.5]]) {
      const arm = lineWithBox(d, box)
      expect(arm).toBeDefined()
      expect(arm?.some((p) => near(p, (box[0] ?? 0) + 2.5, 19.5)) && arm?.some((p) => near(p, (box[0] ?? 0) + 2.5, 43.5))).toBe(true)
      expect(arm?.some((p) => near(p, box[0] ?? 0, 19.5))).toBe(false)
    }
  })

  it("OC-04: линия сиденья — дуга от (14; 22) до (46; 22) с вершиной на y = 16,5", () => {
    const seat = officeChairDrawing(size(60, 60)).lines.find((l) => boxOf(l).join() === [14, 46, 16.5, 22].join())
    expect(seat).toBeDefined()
    expect(near(seat?.[0], 46, 22) && near(seat?.[seat.length - 1], 14, 22)).toBe(true)
    expect(seat?.some((p) => near(p, 30, 16.5))).toBe(true)
  })

  it("OC-05: колёсики — квадраты 4,4 с центрами из спека (верхний по осям, остальные поперёк спицы) и окружности радиуса 1,4", () => {
    const d = officeChairDrawing(size(60, 60))
    for (const c of CASTERS) {
      const { u, v } = axes(c)
      const expected = [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([a, b]) => ({
        x: c.centre.x + 2.2 * ((a ?? 0) * u.x + (b ?? 0) * v.x),
        y: c.centre.y + 2.2 * ((a ?? 0) * u.y + (b ?? 0) * v.y),
      }))
      const square = d.lines.find((l) => l.length === 5 && expected.every((e) => l.some((p) => near(p, e.x, e.y))))
      expect(square, `квадрат ${c.centre.x}; ${c.centre.y}`).toBeDefined()
      const wheel = d.lines.find((l) => l.length > 20 && Math.abs(centroid(l).x - c.centre.x) < 1e-3 && Math.abs(centroid(l).y - c.centre.y) < 1e-3)
      expect(wheel, `окружность ${c.centre.x}; ${c.centre.y}`).toBeDefined()
      for (const p of wheel ?? []) expect(Math.hypot(p.x - c.centre.x, p.y - c.centre.y)).toBeCloseTo(1.4, 6)
    }
  })

  it("OC-06: четыре спицы — от (9; 24,3), (51; 24,3), (17; 50), (43; 50) к середине ближней стороны квадрата колёсика; у верхнего колёсика спицы нет", () => {
    const d = officeChairDrawing(size(60, 60))
    const spokes = d.lines.filter((l) => l.length === 2)
    expect(spokes).toHaveLength(4)
    for (const c of CASTERS) {
      if (!c.from) continue
      const { u } = axes(c)
      const spoke = spokes.find((s) => near(s[0], c.from?.x ?? NaN, c.from?.y ?? NaN))
      expect(spoke, `спица от ${c.from.x}; ${c.from.y}`).toBeDefined()
      expect(near(spoke?.[1], c.centre.x - 2.2 * u.x, c.centre.y - 2.2 * u.y)).toBe(true)
    }
  })

  it("OC-07: весь рисунок внутри прямоугольника 60×60, линии не пересекаются", () => {
    const d = officeChairDrawing(size(60, 60))
    const [x0, x1, y0, y1] = boxOf(d.lines.flat())
    expect([x0, y0].every((v) => (v ?? -1) >= -EPS)).toBe(true)
    expect([x1, y1].every((v) => (v ?? 61) <= 60 + EPS)).toBe(true)
    expect(crossingCount(d)).toBe(0)
  })

  it("OC-08: кресло 30×30 — все детали уменьшены в отношении 30/60, рисунок внутри прямоугольника, линии не пересекаются", () => {
    const d = officeChairDrawing(size(30, 30))
    expect(boxOf(d.outline)).toEqual([5.75, 24.25, 2.75, 25])
    expect(lineWithBox(d, [4.5, 7, 9.75, 21.75])).toBeDefined()
    const [x0, x1, y0, y1] = boxOf(d.lines.flat())
    expect([x0, y0].every((v) => (v ?? -1) >= -EPS)).toBe(true)
    expect([x1, y1].every((v) => (v ?? 31) <= 30 + EPS)).toBe(true)
    expect(crossingCount(d)).toBe(0)
  })

  it("OC-09: кресло 80×100 — фигура того же размера, что у 60×60, со сдвигом на (10; 20), внутри прямоугольника", () => {
    const d = officeChairDrawing(size(80, 100))
    expect(boxOf(d.outline)).toEqual([21.5, 58.5, 25.5, 70])
    expect(lineWithBox(d, [19, 24, 39.5, 63.5])).toBeDefined()
    const [x0, x1, y0, y1] = boxOf(d.lines.flat())
    expect([x0, y0].every((v) => (v ?? -1) >= -EPS)).toBe(true)
    expect(x1).toBeLessThanOrEqual(80 + EPS)
    expect(y1).toBeLessThanOrEqual(100 + EPS)
  })

  it("OC-10: кресло с углом 90° — верх (верхнее колёсико) справа от центра, подлокотники сверху и снизу", () => {
    const item = newItem("o", "officeChair", { x: 0, y: 0 }, { widthCm: 60, lengthCm: 60, angleDeg: 90 })
    const lines = itemDrawingInPlan(item).lines
    // верхнее колёсико: (30; 3) относительно центра (30; 30) — вверх на 27; после поворота на 90° — вправо на 27
    expect(lines.some((l) => l.length === 5 && near(centroid(l), 27, 0))).toBe(true)
    // подлокотники: центры (11,5; 31,5) и (48,5; 31,5) относительно центра — после поворота над и под ним
    expect(lines.some((l) => near(centroid(l), -1.5, -18.5))).toBe(true)
    expect(lines.some((l) => near(centroid(l), -1.5, 18.5))).toBe(true)
  })
})
