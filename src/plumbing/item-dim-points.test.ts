import { describe, expect, it } from "vitest"
import { dimPointPoint, dimensionGeometry, measureDimension, nearestDimAnchor } from "../geometry"
import type { Dimension, DimPoint, FurnitureItem, ItemPoint, Point, Wall } from "../types"

// change add-plumbing-plan: точки замера на приборах (spec dimension-tool «Точки замера на приборах»; design D4)
//
//  вид сверху, схематично, не в масштабе. Стены W1 (ось y = −10) и W2 (ось x = −10) толщиной 20 см сходятся углом:
//  внутренняя вершина контура V = (0, 0). Раковина S 45 × 40, угол 0, центр C = (107.5, 20)
//
//   V###########################################  y = 0
//   #|<------------- 107,5 ------------->|
//   #|                         +----------:----------+
//   #|                         |          C          |
//   #                          +---------------------+
//   #                          ^ угол (85, 40)

const W1: Wall = { id: "w1", a: { x: -20, y: -10 }, b: { x: 400, y: -10 }, thicknessCm: 20, type: "brick" }
const W2: Wall = { id: "w2", a: { x: -10, y: -20 }, b: { x: -10, y: 400 }, thicknessCm: 20, type: "brick" }
const walls = [W1, W2]

const sink = (extra: Partial<FurnitureItem> = {}): FurnitureItem => ({ id: "s", kind: "sink", x: 107.5, y: 20, widthCm: 45, lengthCm: 40, angleDeg: 0, ...extra })

const center = (itemId = "s"): ItemPoint => ({ kind: "item", itemId, at: { kind: "center" } })
const corner = (u: 1 | -1, v: 1 | -1, itemId = "s"): ItemPoint => ({ kind: "item", itemId, at: { kind: "corner", u, v } })

// вершина V берётся тем же снапом, что у инструмента «Размер»
function vertexV(): DimPoint {
  const hit = nearestDimAnchor({ x: 0.5, y: 0.5 }, walls, [], 5)
  if (!hit) throw new Error("нет вершины V")
  expect(hit.point.x).toBeCloseTo(0)
  expect(hit.point.y).toBeCloseTo(0)
  return hit.anchor
}

const near = (p: Point | null, x: number, y: number): void => {
  expect(p).not.toBeNull()
  expect(p?.x).toBeCloseTo(x)
  expect(p?.y).toBeCloseTo(y)
}

describe("позиции точек прибора", () => {
  it("IP-01: центр и четыре угла прибора с углом 0", () => {
    const items = [sink()]
    near(dimPointPoint(center(), walls, [], [], items), 107.5, 20)
    near(dimPointPoint(corner(-1, -1), walls, [], [], items), 85, 0)
    near(dimPointPoint(corner(1, -1), walls, [], [], items), 130, 0)
    near(dimPointPoint(corner(1, 1), walls, [], [], items), 130, 40)
    near(dimPointPoint(corner(-1, 1), walls, [], [], items), 85, 40)
  })

  it("IP-02: у прибора с углом 90 углы берутся в системе прибора (u — ось ширины, теперь вдоль Y)", () => {
    const items = [sink({ x: 20, y: 107.5, angleDeg: 90 })]
    near(dimPointPoint(center(), walls, [], [], items), 20, 107.5)
    // u = (0, 1), v = (−1, 0): угол u = −1, v = −1 — центр − 22,5·u − 20·v
    near(dimPointPoint(corner(-1, -1), walls, [], [], items), 40, 85)
  })

  it("IP-03: нет прибора с этим идентификатором — точки нет", () => {
    expect(dimPointPoint(center(), walls, [], [], [])).toBeNull()
    expect(dimPointPoint(center("x"), walls, [], [], [sink()])).toBeNull()
  })
})

describe("снап «Размера»", () => {
  it("IP-04: пять точек у прибора — у каждой отметка снапа, клик задаёт точку именно в ней", () => {
    const items = [sink()]
    const cases: [Point, ItemPoint][] = [
      [{ x: 107, y: 21 }, center()],
      [{ x: 86, y: 1 }, corner(-1, -1)],
      [{ x: 129, y: 1 }, corner(1, -1)],
      [{ x: 129, y: 39 }, corner(1, 1)],
      [{ x: 86, y: 39 }, corner(-1, 1)],
    ]
    for (const [p, anchor] of cases) {
      const hit = nearestDimAnchor(p, walls, [], 3, [], items)
      expect(hit?.anchor).toEqual(anchor)
    }
  })

  it("IP-05: без списка приборов (план «Мебель» и другие планы) точек прибора нет", () => {
    const hit = nearestDimAnchor({ x: 107, y: 21 }, walls, [], 3, [])
    expect(hit).toBeNull()
  })

  it("IP-06: вершина контура выигрывает у угла прибора на том же расстоянии", () => {
    // угол прибора u = −1, v = −1 ровно в V = (0, 0)
    const items = [sink({ x: 22.5, y: 20 })]
    const hit = nearestDimAnchor({ x: 0.5, y: 0.5 }, walls, [], 3, [], items)
    expect(hit?.anchor.kind).toBeUndefined()
  })

  it("IP-07: среди точек одного прибора центр идёт раньше углов", () => {
    // прибор 10 × 10, центр (200, 200), угол (195, 195); клик посередине между ними
    const items = [sink({ x: 200, y: 200, widthCm: 10, lengthCm: 10 })]
    const hit = nearestDimAnchor({ x: 197.5, y: 197.5 }, walls, [], 5, [], items)
    expect(hit?.anchor).toEqual(center())
  })
})

describe("направление и число — правило батареи", () => {
  const dim = (from: DimPoint, to: DimPoint): Dimension => ({ from, to, offset: -30 })

  it("IP-08: от угла помещения до оси раковины — 107,5 вдоль оси ширины (X)", () => {
    const m = measureDimension(dim(vertexV(), center()), walls, [], [], [sink()])
    expect(m?.valueCm).toBeCloseTo(107.5)
    near(m?.direction ?? null, 1, 0)
  })

  it("IP-09: от угла помещения до угла раковины (85, 40) — 85 вдоль X", () => {
    const m = measureDimension(dim(vertexV(), corner(-1, 1)), walls, [], [], [sink()])
    expect(m?.valueCm).toBeCloseTo(85)
    near(m?.direction ?? null, 1, 0)
  })

  it("IP-10: равные проекции — ось ширины", () => {
    const m = measureDimension(dim(vertexV(), center()), walls, [], [], [sink({ x: 50, y: 50 })])
    expect(m?.valueCm).toBeCloseTo(50)
    near(m?.direction ?? null, 1, 0)
  })

  it("IP-11: большая проекция поперёк — ось длины", () => {
    const m = measureDimension(dim(vertexV(), center()), walls, [], [], [sink({ x: 30, y: 60 })])
    expect(m?.valueCm).toBeCloseTo(60)
    near(m?.direction ?? null, 0, 1)
  })

  it("IP-12: повёрнутый на 90° прибор — линия вдоль оси ширины прибора, то есть оси Y чертежа", () => {
    const m = measureDimension(dim(vertexV(), center()), walls, [], [], [sink({ x: 20, y: 107.5, angleDeg: 90 })])
    expect(m?.valueCm).toBeCloseTo(107.5)
    near(m?.direction ?? null, 0, 1)
  })

  it("IP-13: точки на двух приборах — оси задаёт прибор первой точки", () => {
    // первый прибор повёрнут на 45°: его оси — диагонали чертежа
    const a = sink({ id: "a", x: 0, y: 0, angleDeg: 45 })
    const b = sink({ id: "b", x: 100, y: 0 })
    const m = measureDimension(dim(center("a"), center("b")), walls, [], [], [a, b])
    expect(m?.valueCm).toBeCloseTo(100 / Math.SQRT2)
    near(m?.direction ?? null, Math.SQRT1_2, Math.SQRT1_2)
  })

  it("IP-14: линия размера параллельна выбранному направлению, выносные — от точек замера", () => {
    const g = dimensionGeometry(dim(vertexV(), center()), walls, [], [], [sink()])
    expect(g?.valueCm).toBeCloseTo(107.5)
    expect(g?.p1.y).toBeCloseTo(g?.p2.y ?? NaN)
    expect((g?.p2.x ?? 0) - (g?.p1.x ?? 0)).toBeCloseTo(107.5)
  })
})

describe("размер следует за прибором", () => {
  const d: () => Dimension = () => ({ from: vertexV(), to: center(), offset: -30 })

  it("IP-15: раковину сдвинули на 20 см вдоль X — число 127,5", () => {
    expect(measureDimension(d(), walls, [], [], [sink({ x: 127.5 })])?.valueCm).toBeCloseTo(127.5)
  })

  it("IP-16: угол остаётся тем же углом после изменения ширины 45 → 60", () => {
    const dim: Dimension = { from: vertexV(), to: corner(-1, 1), offset: -30 }
    near(dimPointPoint(corner(-1, 1), walls, [], [], [sink({ widthCm: 60 })]), 77.5, 40)
    expect(measureDimension(dim, walls, [], [], [sink({ widthCm: 60 })])?.valueCm).toBeCloseTo(77.5)
  })

  it("IP-17: пока прибора нет, геометрии размера нет", () => {
    expect(dimensionGeometry(d(), walls, [], [], [])).toBeNull()
  })
})
