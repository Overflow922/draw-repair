import { describe, expect, it } from "vitest"
import type { Point } from "../types"
import { deskDrawing } from "./item-drawing"
import type { ItemSize } from "./item-drawing"

// change add-furniture-desk-office-chair: рисунок письменного стола по эскизу (spec furniture-plan «Каталог видов мебели», сценарии
// «Рисунок письменного стола», «Письменный стол другого размера», «Узкий письменный стол»). Ожидания — числа из спека.

const EPS = 1e-6
const size = (widthCm: number, lengthCm: number): ItemSize => ({ widthCm, lengthCm })
const rounded = (v: number): number => Math.round(v * 1e6) / 1e6
const boxOf = (pts: readonly Point[]): number[] =>
  [Math.min(...pts.map((p) => p.x)), Math.max(...pts.map((p) => p.x)), Math.min(...pts.map((p) => p.y)), Math.max(...pts.map((p) => p.y))].map(rounded)
const lengthOf = (line: readonly Point[]): number => line.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - (line[i]?.x ?? 0), p.y - (line[i]?.y ?? 0)), 0)
const at = (p: Point | undefined, x: number, y: number): boolean => !!p && Math.abs(p.x - x) < EPS && Math.abs(p.y - y) < EPS

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

// штрихи ножки: все линии, лежащие в габаритах ножки (x0..x1 по x)
const strokesIn = (lines: readonly (readonly Point[])[], x0: number, x1: number): (readonly Point[])[] =>
  lines.slice(1, -1).filter((l) => l.every((p) => p.x >= x0 - EPS && p.x <= x1 + EPS))

describe("рисунок письменного стола", () => {
  it("DK-01: стол 100×50 — контур со скруглением 2 см и замкнутая первая линия", () => {
    const d = deskDrawing(size(100, 50))
    expect(boxOf(d.outline)).toEqual([0, 100, 0, 50])
    expect(d.outline.some((p) => at(p, 0, 0))).toBe(false)
    expect(d.outline.some((p) => at(p, 2, 0))).toBe(true)
    expect(d.outline.some((p) => at(p, 0, 2))).toBe(true)
    expect(d.lines[0]).toEqual([...d.outline, d.outline[0]])
  })

  it("DK-02: сплошная линия последняя, от (10; 46) до (90; 46)", () => {
    const d = deskDrawing(size(100, 50))
    const front = d.lines[d.lines.length - 1] ?? []
    expect(front).toHaveLength(2)
    expect(at(front[0], 10, 46)).toBe(true)
    expect(at(front[1], 90, 46)).toBe(true)
  })

  it("DK-03: ножки — пунктир по контуру прямоугольников x 3,5–6,5 и 93,5–96,5, y 4–46: по 36 штрихов, штрих 1,5 см", () => {
    const d = deskDrawing(size(100, 50))
    const left = strokesIn(d.lines, 3.5, 6.5)
    const right = strokesIn(d.lines, 93.5, 96.5)
    expect(left).toHaveLength(36)
    expect(right).toHaveLength(36)
    expect(boxOf(left.flat())).toEqual([3.5, 6.5, 4, 46])
    expect(boxOf(right.flat())).toEqual([93.5, 96.5, 4, 46])
    for (const stroke of [...left, ...right]) expect(lengthOf(stroke)).toBeCloseTo(1.5, 6)
    expect(d.lines).toHaveLength(1 + 72 + 1)
  })

  it("DK-04: пунктир идёт с левого верхнего угла и не прерывается на углах: второй штрих (6; 4)–(6,5; 4)–(6,5; 5)", () => {
    const left = strokesIn(deskDrawing(size(100, 50)).lines, 3.5, 6.5)
    const first = left[0] ?? []
    expect(at(first[0], 3.5, 4)).toBe(true)
    expect(at(first[first.length - 1], 5, 4)).toBe(true)
    const second = left[1] ?? []
    expect(second).toHaveLength(3)
    expect(at(second[0], 6, 4)).toBe(true)
    expect(at(second[1], 6.5, 4)).toBe(true)
    expect(at(second[2], 6.5, 5)).toBe(true)
  })

  it("DK-05: стол 140×70 — контур 140×70, ножки шириной 3 см с теми же отступами и длиной 62 см, линия от x = 10 до x = 130 на y = 66", () => {
    const d = deskDrawing(size(140, 70))
    expect(boxOf(d.outline)).toEqual([0, 140, 0, 70])
    expect(boxOf(strokesIn(d.lines, 3.5, 6.5).flat())).toEqual([3.5, 6.5, 4, 66])
    expect(boxOf(strokesIn(d.lines, 133.5, 136.5).flat())).toEqual([133.5, 136.5, 4, 66])
    const front = d.lines[d.lines.length - 1] ?? []
    expect(at(front[0], 10, 66)).toBe(true)
    expect(at(front[1], 130, 66)).toBe(true)
  })

  it("DK-06: стол 60×25 — детали уменьшены в отношении 25/50, рисунок внутри прямоугольника, линии не пересекаются", () => {
    const d = deskDrawing(size(60, 25))
    expect(boxOf(d.outline)).toEqual([0, 60, 0, 25])
    expect(boxOf(strokesIn(d.lines, 1.75, 3.25).flat())).toEqual([1.75, 3.25, 2, 23])
    const front = d.lines[d.lines.length - 1] ?? []
    expect(at(front[0], 5, 23)).toBe(true)
    expect(at(front[1], 55, 23)).toBe(true)
    const [x0, x1, y0, y1] = boxOf(d.lines.flat())
    expect([x0, y0].every((v) => (v ?? -1) >= -EPS)).toBe(true)
    expect(x1).toBeLessThanOrEqual(60 + EPS)
    expect(y1).toBeLessThanOrEqual(25 + EPS)
    expect(crossingCount(d.lines)).toBe(0)
  })

  it("DK-07: стол 100×50 — линии не пересекаются", () => {
    expect(crossingCount(deskDrawing(size(100, 50)).lines)).toBe(0)
  })
})
