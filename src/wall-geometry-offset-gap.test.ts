import { describe, expect, it } from "vitest"
import { displayPolygons } from "./wall-geometry"
import { edgeLengthCm } from "./wall-length"
import type { Point, Wall } from "./types"
import { W, deepFreeze, expectSameVertices } from "./wall-snap.test-utils"

// change cap-flush-snap (wall-joints, «Коллинеарный стык со сдвигом осей»): поздняя стена продолжает раннюю
// с зазором, но оси сдвинуты поперёк больше чем на 1 см — торец поздней плоский, в плоскости торца ранней.
// Сцена: A (−100,0)→(0,0) толщиной 40; поздняя N толщиной 20 от (10, y) до (110, y).

const A = (): Wall => W(-100, 0, 0, 0, 40)
const N = (y: number): Wall => W(10, y, 110, y, 20)

const rect = (x0: number, y0: number, x1: number, y1: number): Point[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
]

describe("OG-1: сдвиг осей больше 1 см — плоский торец в плоскости торца ранней стены", () => {
  it("сдвиг 10 см: тело — прямоугольник [0, 110] × [0, 20], A не изменена", () => {
    const a = A()
    const n = N(10)
    const walls = deepFreeze([a, n])
    const body = displayPolygons(n, walls)
    expect(body).toHaveLength(1)
    expectSameVertices(body[0], rect(0, 0, 110, 20))
    const alone = displayPolygons(a, [a])
    const withN = displayPolygons(a, walls)
    expect(withN).toHaveLength(alone.length)
    alone.forEach((pc, i) => expectSameVertices(withN[i], pc))
  })

  it("сдвиг в другую сторону — зеркальный прямоугольник", () => {
    const a = A()
    const n = N(-10)
    expectSameVertices(displayPolygons(n, [a, n])[0], rect(0, -20, 110, 0))
  })

  it("сдвиг чуть больше 1 см — уже плоский торец", () => {
    const a = A()
    const n = N(1.01)
    expectSameVertices(displayPolygons(n, [a, n])[0], rect(0, -8.99, 110, 11.01))
  })

  it("стена задана в обратном направлении (конец поздней — b): тот же прямоугольник", () => {
    const a = A()
    const n = W(110, 10, 10, 10, 20)
    expectSameVertices(displayPolygons(n, [a, n])[0], rect(0, 0, 110, 20))
  })

  it("превью (позднейшая стена вне массива): те же правила", () => {
    const a = A()
    expectSameVertices(displayPolygons(N(10), [a])[0], rect(0, 0, 110, 20))
  })
})

describe("OG-2: длина кромка-кромка при сдвиге осей", () => {
  it("выступ — расстояние вдоль оси до плоскости торца: 100 + 10 = 110", () => {
    const a = A()
    const n = N(10)
    expect(edgeLengthCm(n, [a, n])).toBeCloseTo(110, 6)
  })
})

describe("OG-3: сдвиг не больше 1 см — прежний стык", () => {
  it("сдвиг 1 см: торец центрирован на конце оси A (прежняя форма)", () => {
    const a = A()
    const n = N(1)
    const body = displayPolygons(n, [a, n])[0]
    expectSameVertices(body, [
      { x: 0, y: 10 },
      { x: 110, y: 11 },
      { x: 110, y: -9 },
      { x: 0, y: -10 },
    ])
  })

  it("на оси: тело — прямоугольник от плоскости торца", () => {
    const a = A()
    const n = N(0)
    expectSameVertices(displayPolygons(n, [a, n])[0], rect(0, -10, 110, 10))
    expect(edgeLengthCm(n, [a, n])).toBeCloseTo(110, 6)
  })
})
