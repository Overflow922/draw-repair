import { describe, expect, it } from "vitest"
import type { Point } from "../types"
import { chairDrawing, tableDrawing } from "./item-drawing"
import type { ItemDrawing, ItemDrawingFn, ItemSize } from "./item-drawing"

// change furniture-line-drawings: рисунки видов (spec furniture-plan «Каталог видов мебели»: рисунок вида, сценарии «Рисунок стола»,
// «Рисунок стола другого размера», «Рисунок стула», «Маленький стул»). Ожидания — числа из спека, не вывод из реализации.

const EPS = 1e-9
const size = (widthCm: number, lengthCm: number): ItemSize => ({ widthCm, lengthCm })
const box = (pts: readonly Point[]) => ({
  minX: Math.min(...pts.map((p) => p.x)),
  maxX: Math.max(...pts.map((p) => p.x)),
  minY: Math.min(...pts.map((p) => p.y)),
  maxY: Math.max(...pts.map((p) => p.y)),
})
const sameDot = (a: Point | undefined, b: Point | undefined): boolean => !!a && !!b && Math.hypot(a.x - b.x, a.y - b.y) < EPS

// точки линии на высоте y (±EPS)
const atY = (pts: readonly Point[], y: number): Point[] => pts.filter((p) => Math.abs(p.y - y) < EPS)

const cross = (o: Point, a: Point, b: Point): number => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
// собственное пересечение отрезков (касание концами не считается)
const crosses = (a: Point, b: Point, c: Point, d: Point): boolean => {
  const d1 = cross(a, b, c)
  const d2 = cross(a, b, d)
  const d3 = cross(c, d, a)
  const d4 = cross(c, d, b)
  return d1 * d2 < -EPS && d3 * d4 < -EPS
}
const segments = (line: readonly Point[]): [Point, Point][] => line.slice(1).map((p, i): [Point, Point] => [line[i] as Point, p])
const lineCrossings = (drawing: ItemDrawing): number => {
  let n = 0
  const segs = drawing.lines.map(segments)
  for (let i = 0; i < segs.length; i++) {
    for (let j = i; j < segs.length; j++) {
      const sa = segs[i] ?? []
      const sb = segs[j] ?? []
      sa.forEach(([a, b], ia) =>
        sb.forEach(([c, d], ib) => {
          if ((i !== j || ib > ia + 1) && crosses(a, b, c, d)) n++
        }),
      )
    }
  }
  return n
}

const SIZES: [string, ItemDrawingFn, ItemSize][] = [
  ["стол 80×160", tableDrawing, size(80, 160)],
  ["стол 100×200", tableDrawing, size(100, 200)],
  ["стол 20×30", tableDrawing, size(20, 30)],
  ["стул 45×45", chairDrawing, size(45, 45)],
  ["стул 30×30", chairDrawing, size(30, 30)],
  ["стул 60×45", chairDrawing, size(60, 45)],
  ["стул 45×100", chairDrawing, size(45, 100)],
]

describe("общие свойства рисунков", () => {
  it.each(SIZES)("ID-01: %s — все точки внутри прямоугольника предмета", (_, draw, s) => {
    const d = draw(s)
    for (const p of [...d.outline, ...d.lines.flat()]) {
      expect(p.x).toBeGreaterThanOrEqual(-EPS)
      expect(p.x).toBeLessThanOrEqual(s.widthCm + EPS)
      expect(p.y).toBeGreaterThanOrEqual(-EPS)
      expect(p.y).toBeLessThanOrEqual(s.lengthCm + EPS)
    }
  })

  it.each(SIZES)("ID-02: %s — линии не пересекаются между собой", (_, draw, s) => {
    expect(lineCrossings(draw(s))).toBe(0)
  })

  it.each(SIZES)("ID-03: %s — силуэт замкнут и первой линией идёт он сам", (_, draw, s) => {
    const d = draw(s)
    const first = d.lines[0] ?? []
    expect(first).toHaveLength(d.outline.length + 1)
    expect(sameDot(first[0], first[first.length - 1])).toBe(true)
    expect(first.slice(0, -1)).toEqual(d.outline)
  })

  it("ID-04: у стола скругление идёт дугой с шагом не больше 5°", () => {
    const o = tableDrawing(size(80, 160)).outline
    const turns = o.map((p, i) => {
      const a = o[(i + o.length - 1) % o.length] as Point
      const b = o[(i + 1) % o.length] as Point
      const t1 = Math.atan2(p.y - a.y, p.x - a.x)
      const t2 = Math.atan2(b.y - p.y, b.x - p.x)
      return Math.abs(((t2 - t1 + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) * (180 / Math.PI)
    })
    expect(Math.max(...turns)).toBeLessThanOrEqual(5 + 1e-6)
  })
})

describe("рисунок стола", () => {
  const radiusAt = (poly: readonly Point[], edgeY: number, edgeX: number): number => Math.min(...atY(poly, edgeY).map((p) => p.x)) - edgeX

  it("ID-10: стол 80×160 — контур на границе предмета со скруглением 10 см, кромка с отступом 6 см со скруглением 5 см", () => {
    const d = tableDrawing(size(80, 160))
    const outer = d.lines[0] ?? []
    const inner = d.lines[1] ?? []
    expect(d.lines).toHaveLength(2)
    expect(box(outer)).toEqual({ minX: 0, maxX: 80, minY: 0, maxY: 160 })
    const b = box(inner)
    expect([b.minX, b.maxX, b.minY, b.maxY].map((v) => Math.round(v * 1e6) / 1e6)).toEqual([6, 74, 6, 154])
    expect(radiusAt(outer, 0, 0)).toBeCloseTo(10, 6)
    expect(radiusAt(inner, 6, 6)).toBeCloseTo(5, 6)
  })

  it("ID-11: стол 100×200 — те же скругление и отступ, контур по сторонам предмета", () => {
    const d = tableDrawing(size(100, 200))
    const outer = d.lines[0] ?? []
    const inner = d.lines[1] ?? []
    expect(box(outer)).toEqual({ minX: 0, maxX: 100, minY: 0, maxY: 200 })
    expect(radiusAt(outer, 0, 0)).toBeCloseTo(10, 6)
    expect(box(inner).minX).toBeCloseTo(6, 6)
    expect(box(inner).maxY).toBeCloseTo(194, 6)
  })

  it("ID-13: заданный коэффициент деталей заменяет вычисляемый — стол 80×40 с коэффициентом 1 сохраняет скругление 10 и кромку 6", () => {
    const d = tableDrawing(size(80, 40), 1)
    expect(radiusAt(d.lines[0] ?? [], 0, 0)).toBeCloseTo(10, 6)
    expect(box(d.lines[1] ?? []).minX).toBeCloseTo(6, 6)
    expect(box(d.lines[1] ?? []).minY).toBeCloseTo(6, 6)
    // без заданного коэффициента тот же стол уменьшил бы детали вдвое (меньшая сторона 40 против 80)
    expect(box(tableDrawing(size(80, 40)).lines[1] ?? []).minX).toBeCloseTo(3, 6)
  })

  it("ID-12: стол меньше размера по умолчанию — детали уменьшаются в отношении меньшей стороны (40/80)", () => {
    const d = tableDrawing(size(40, 80))
    expect(radiusAt(d.lines[0] ?? [], 0, 0)).toBeCloseTo(5, 6)
    expect(box(d.lines[1] ?? []).minX).toBeCloseTo(3, 6)
  })
})

describe("рисунок стула", () => {
  it("ID-20: стул 45×45 — силуэт с дугой 18 см у верхних углов и прямыми нижними углами", () => {
    const d = chairDrawing(size(45, 45))
    expect(box(d.outline)).toEqual({ minX: 0, maxX: 45, minY: 0, maxY: 45 })
    const top = atY(d.outline, 0).map((p) => p.x)
    expect(Math.min(...top)).toBeCloseTo(18, 6)
    expect(Math.max(...top)).toBeCloseTo(27, 6)
    expect(d.outline.some((p) => sameDot(p, { x: 0, y: 45 }))).toBe(true)
    expect(d.outline.some((p) => sameDot(p, { x: 45, y: 45 }))).toBe(true)
  })

  it("ID-21: внутренняя линия спинки и подлокотников — отступ 7 см от боков и верха, концы на нижнем крае", () => {
    const back = chairDrawing(size(45, 45)).lines[1] ?? []
    const b = box(back)
    expect([b.minX, b.maxX, b.minY, b.maxY].map((v) => Math.round(v * 1e6) / 1e6)).toEqual([7, 38, 7, 45])
    expect(sameDot(back[0], { x: 7, y: 45 })).toBe(true)
    expect(sameDot(back[back.length - 1], { x: 38, y: 45 })).toBe(true)
  })

  it("ID-22: сиденье — замкнутое скруглённое: боковые отступы 11 см, сверху 13 см, снизу 4 см", () => {
    const seat = chairDrawing(size(45, 45)).lines[2] ?? []
    const b = box(seat)
    expect([b.minX, b.maxX, b.minY, b.maxY].map((v) => Math.round(v * 1e6) / 1e6)).toEqual([11, 34, 13, 41])
    expect(sameDot(seat[0], seat[seat.length - 1])).toBe(true)
  })

  it("ID-23: спинка — у верхнего края: линия спинки не опускается ниже сиденья сверху", () => {
    const d = chairDrawing(size(45, 45))
    expect(box(d.lines[1] ?? []).minY).toBeLessThan(box(d.lines[2] ?? []).minY)
  })

  it("ID-24: стул 30×30 — детали уменьшены в отношении 30/45, рисунок внутри предмета", () => {
    const d = chairDrawing(size(30, 30))
    const b = box(d.lines[1] ?? [])
    expect(b.minX).toBeCloseTo(7 * (30 / 45), 6)
    expect(b.minY).toBeCloseTo(7 * (30 / 45), 6)
    expect(box(d.lines[2] ?? []).minY).toBeCloseTo(13 * (30 / 45), 6)
  })

  it("ID-25: стул 60×45 — подлокотники по-прежнему 7 см, сиденье растёт вширь", () => {
    const d = chairDrawing(size(60, 45))
    expect(box(d.lines[1] ?? []).minX).toBeCloseTo(7, 6)
    expect(box(d.lines[2] ?? []).maxX).toBeCloseTo(49, 6)
  })
})
