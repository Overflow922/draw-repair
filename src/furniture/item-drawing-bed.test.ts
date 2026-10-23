import { describe, expect, it } from "vitest"
import type { Point } from "../types"
import { itemDrawingInPlan } from "./furniture-render"
import { newItem } from "./item"
import { bedDrawing } from "./item-drawing"
import type { ItemSize } from "./item-drawing"

// change add-furniture-bed-nightstand: рисунок кровати по эскизу (spec furniture-plan «Каталог видов мебели», сценарии «Рисунок кровати»,
// «Кровать другого размера», «Узкая кровать»). Ожидания — числа из спеки. Линии: 0 контур, 1 матрас, 2–3 подушки, 4 верхняя кромка
// одеяла, 5 нижняя кромка, 6–8 складки.

const EPS = 1e-9
const size = (widthCm: number, lengthCm: number): ItemSize => ({ widthCm, lengthCm })
const rounded = (v: number): number => Math.round(v * 1e6) / 1e6
const pts = (line: readonly Point[] | undefined): number[][] => (line ?? []).map((p) => [rounded(p.x), rounded(p.y)])
const box = (line: readonly Point[] | undefined): number[] => {
  const xs = (line ?? []).map((p) => p.x)
  const ys = (line ?? []).map((p) => p.y)
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map(rounded)
}
const first = (line: readonly Point[] | undefined): number[] => pts(line?.slice(0, 1))[0] ?? []
const last = (line: readonly Point[] | undefined): number[] => pts(line?.slice(-1))[0] ?? []

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

describe("рисунок кровати", () => {
  it("BED-01: кровать 160×200 — контур, матрас, две подушки, две кромки одеяла и три складки, других линий нет", () => {
    const d = bedDrawing(size(160, 200))
    expect(d.lines).toHaveLength(9)
    expect(box(d.lines[0])).toEqual([0, 0, 160, 200])
    expect(box(d.lines[1])).toEqual([3.5, 3.5, 156.5, 196.5])
    expect(box(d.lines[2])).toEqual([10, 157, 75, 194])
    expect(box(d.lines[3])).toEqual([85, 157, 150, 194])
  })

  it("BED-02: верхняя кромка одеяла — дуга (3,5; 116)–(156,5; 116), провис 2,5 см с вершиной (80; 118,5)", () => {
    const top = bedDrawing(size(160, 200)).lines[4]
    expect(first(top)).toEqual([3.5, 116])
    expect(last(top)).toEqual([156.5, 116])
    expect(box(top)).toEqual([3.5, 116, 156.5, 118.5])
    expect(pts(top?.filter((p) => rounded(p.y) === 118.5))).toEqual([[80, 118.5]])
  })

  it("BED-03: нижняя кромка одеяла — от (3,5; 150) дугой к (8,5; 155), прямо к (151,5; 155), дугой к (156,5; 150)", () => {
    const bottom = bedDrawing(size(160, 200)).lines[5]
    expect(first(bottom)).toEqual([3.5, 150])
    expect(last(bottom)).toEqual([156.5, 150])
    expect(box(bottom)).toEqual([3.5, 150, 156.5, 155])
    const straight = pts(bottom?.filter((p) => rounded(p.y) === 155))
    expect(straight[0]).toEqual([8.5, 155])
    expect(straight[straight.length - 1]).toEqual([151.5, 155])
  })

  it("BED-04: три складки — отрезки по спеке", () => {
    const d = bedDrawing(size(160, 200))
    expect(d.lines.slice(6).map(pts)).toEqual([
      [[5, 142], [24, 153]],
      [[69, 125], [113, 151]],
      [[104, 128], [150, 152]],
    ])
  })

  it("BED-05: рисунок внутри прямоугольника, линии не пересекаются; силуэт — скруглённый контур", () => {
    const d = bedDrawing(size(160, 200))
    expect(inside(d.lines, 160, 200)).toBe(true)
    expect(crossingCount(d.lines)).toBe(0)
    expect(box(d.outline)).toEqual([0, 0, 160, 200])
    expect(d.lines[0]).toEqual([...d.outline, d.outline[0]])
  })

  it("BED-06: кровать 180×200 — подушки шириной 75, складки привязаны к середине и правому краю", () => {
    const d = bedDrawing(size(180, 200))
    expect(box(d.lines[2])).toEqual([10, 157, 85, 194])
    expect(box(d.lines[3])).toEqual([95, 157, 170, 194])
    expect(d.lines.slice(6).map(pts)).toEqual([
      [[5, 142], [24, 153]],
      [[79, 125], [123, 151]],
      [[124, 128], [170, 152]],
    ])
    expect(inside(d.lines, 180, 200)).toBe(true)
    expect(crossingCount(d.lines)).toBe(0)
  })

  it("BED-07: кровать 160×220 — подушки и одеяло привязаны к нижнему краю", () => {
    const d = bedDrawing(size(160, 220))
    expect(box(d.lines[0])).toEqual([0, 0, 160, 220])
    expect(box(d.lines[2])).toEqual([10, 177, 75, 214])
    expect(first(d.lines[4])).toEqual([3.5, 136])
    expect(box(d.lines[5])[3]).toBe(175)
    expect(inside(d.lines, 160, 220)).toBe(true)
    expect(crossingCount(d.lines)).toBe(0)
  })

  it("BED-08: кровать 90×200 — детали уменьшены в отношении 90/160, рисунок внутри, линии не пересекаются", () => {
    const d = bedDrawing(size(90, 200))
    const k = 90 / 160
    expect(box(d.lines[1])).toEqual([rounded(3.5 * k), rounded(3.5 * k), rounded(90 - 3.5 * k), rounded(200 - 3.5 * k)])
    expect(box(d.lines[2])).toEqual([rounded(10 * k), rounded(200 - 43 * k), rounded(10 * k + (90 - 30 * k) / 2), rounded(200 - 6 * k)])
    expect(inside(d.lines, 90, 200)).toBe(true)
    expect(crossingCount(d.lines)).toBe(0)
  })

  it("BED-09: масштаб деталей 1 из аргумента задаёт детали в полном размере при любых габаритах", () => {
    const d = bedDrawing(size(120, 100), 1)
    expect(box(d.lines[1])).toEqual([3.5, 3.5, 116.5, 96.5])
    expect(box(d.lines[2])).toEqual([10, 57, 10 + 45, 94])
  })

  it("BED-10: кровать с углом 90° — подушки слева от центра на экране", () => {
    const item = newItem("b", "bed", { x: 0, y: 0 }, { widthCm: 160, lengthCm: 200, angleDeg: 90 })
    const lines = itemDrawingInPlan(item).lines
    const centre = (l: readonly Point[]): Point => {
      const [x0, y0, x1, y1] = box(l)
      return { x: ((x0 ?? 0) + (x1 ?? 0)) / 2, y: ((y0 ?? 0) + (y1 ?? 0)) / 2 }
    }
    // подушки (центры (42,5; 175,5) и (117,5; 175,5)) относительно центра (80; 100): (−37,5; 75,5) и (37,5; 75,5);
    // после поворота на 90° — влево на 75,5, выше и ниже центра на 37,5
    const near = (p: Point, x: number, y: number): boolean => Math.hypot(p.x - x, p.y - y) < 1e-3
    expect(lines.some((l) => near(centre(l), -75.5, -37.5))).toBe(true)
    expect(lines.some((l) => near(centre(l), -75.5, 37.5))).toBe(true)
  })
})
