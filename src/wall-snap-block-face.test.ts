import { describe, expect, it } from "vitest"
import { placementSquare, snapRadiusCm, snapStartVertex } from "./wall-snap"
import type { VertexSnap } from "./wall-snap"
import type { Point, Wall } from "./types"
import { W, deepFreeze, expectPoint, expectSameVertices, maxOverlap } from "./wall-snap.test-utils"

// change fix-diagonal-corner-block-snap-and-dimensions (test-plan.md, BS-*): прилипание к грани, продолженной
// блоком диагонального углового стыка (wall-drawing, «Прилипание к грани, продолженной блоком диагонального
// стыка»). Эталоны выведены из спецификации и геометрии сцен, а не из продакшн-кода.
//
// Сцена: A (−100,0)→(0,0) t20, B (10,10)→(10,110) t20 — диагональный стык, блок x ∈ [0,20], y ∈ [−10,10]
// принадлежит B (поздней). Нижняя грань A, y = −10, продолжена кромкой блока до x = 20. Масштаб 1:
// радиус привязки 6 см, зона прилипания = max(6, 10) = 10 см.

const GRID = 10
const T = 20
const TOL = 1e-6

const scene = (): Wall[] => [W(-100, 0, 0, 0, T), W(10, 10, 10, 110, T)]

const start = (p: Point, walls: Wall[] = scene(), t = T, zoom = 1): VertexSnap => snapStartVertex(p, walls, snapRadiusCm(zoom), GRID, t)

const NAN: Point = { x: NaN, y: NaN }

// прилипание к нижней грани A: вершина на грани, квадрат установки под ней
function expectFaceSnap(r: VertexSnap, vertex: Point, square: Point[], walls: Wall[], label = ""): void {
  expect(r.source, label).toBe("wall")
  expect(r.target, label).toBe("face")
  expectPoint(r.point, vertex.x, vertex.y)
  expectPoint(r.normal ?? NAN, 0, -1)
  expectSameVertices(placementSquare(r, square[2].x - square[0].x), square)
  expect(maxOverlap(placementSquare(r, square[2].x - square[0].x), walls), label).toBeLessThanOrEqual(TOL)
}

const isBlockFaceSnap = (r: VertexSnap): boolean =>
  r.source === "wall" && Math.abs(r.point.y + 10) < TOL && r.point.x <= 10 + TOL && r.point.x >= -100 - TOL

describe("курсор над выступающей частью блока", () => {
  it("BS-1: курсор (15, −15) — правая половина блока — прилипает к грани y = −10 вплотную к блоку", () => {
    const walls = deepFreeze(scene())
    const r = start({ x: 15, y: -15 }, walls)
    expectFaceSnap(
      r,
      { x: 10, y: -10 },
      [
        { x: 0, y: -10 },
        { x: 20, y: -10 },
        { x: 20, y: -30 },
        { x: 0, y: -30 },
      ],
      walls,
    )
  })

  it("BS-1a: курсор (10, −15) — середина блока — вершина (10, −10)", () => {
    const walls = scene()
    expectFaceSnap(
      start({ x: 10, y: -15 }, walls),
      { x: 10, y: -10 },
      [
        { x: 0, y: -10 },
        { x: 20, y: -10 },
        { x: 20, y: -30 },
        { x: 0, y: -30 },
      ],
      walls,
    )
  })

  it("BS-1b: курсор (5, −15) — левая половина — вершина (5, −10), квадрат x ∈ [−5, 15] (прежнее поведение)", () => {
    const walls = scene()
    expectFaceSnap(
      start({ x: 5, y: -15 }, walls),
      { x: 5, y: -10 },
      [
        { x: -5, y: -10 },
        { x: 15, y: -10 },
        { x: 15, y: -30 },
        { x: -5, y: -30 },
      ],
      walls,
    )
  })

  it("BS-1c: порядок стен не важен — блок у поздней стены A, результат тот же (10, −10)", () => {
    const [a, b] = scene()
    const walls = [b, a]
    expectFaceSnap(
      start({ x: 15, y: -15 }, walls),
      { x: 10, y: -10 },
      [
        { x: 0, y: -10 },
        { x: 20, y: -10 },
        { x: 20, y: -30 },
        { x: 0, y: -30 },
      ],
      walls,
    )
  })
})

describe("порядок стен", () => {
  it.each([
    [15, -15],
    [20, -15],
  ])("BS-1d: курсор (%d, %d) — результат не зависит от порядка стен A, B", (x, y) => {
    const [a, b] = scene()
    const ab = start({ x, y }, [a, b])
    const ba = start({ x, y }, [b, a])
    expect(ba.source).toBe(ab.source)
    expectPoint(ba.point, ab.point.x, ab.point.y)
    expect(ab.source).toBe("wall")
    expectPoint(ab.point, 10, -10)
  })

  // change wall-body-corners-snap: угол блока (20, −10) — выпуклая вершина контура сцены, цель диагонали
  it("BS-1e: курсор (28, −19) в окне угла блока — результат не зависит от порядка стен A, B", () => {
    const [a, b] = scene()
    const ab = start({ x: 28, y: -19 }, [a, b])
    const ba = start({ x: 28, y: -19 }, [b, a])
    expect(ab.target).toBe("corner")
    expectPoint(ab.point, 20, -20)
    expectPoint(ba.point, 20, -20)
  })
})

describe("граница зоны вдоль грани от края блока", () => {
  it("BS-2: курсор (20, −15) — на краю блока включительно — вершина (10, −10)", () => {
    const walls = scene()
    expectFaceSnap(
      start({ x: 20, y: -15 }, walls),
      { x: 10, y: -10 },
      [
        { x: 0, y: -10 },
        { x: 20, y: -10 },
        { x: 20, y: -30 },
        { x: 0, y: -30 },
      ],
      walls,
    )
  })

  // change wall-body-corners-snap: за краем блока курсор над квадратом у угла блока (20, −10) — диагональное прилипание
  it.each([
    [25, -19],
    [28, -19],
  ])("BS-2a: курсор (%d, %d) — за краем блока в окне угла — квадрат касается угла блока, вершина (20, −20)", (x, y) => {
    const walls = scene()
    const r = start({ x, y }, walls)
    expect(r.target).toBe("corner")
    expectPoint(r.point, 20, -20)
    expect(maxOverlap(placementSquare(r, T), walls)).toBeLessThanOrEqual(TOL)
  })

  it("BS-2b: курсор (30.5, −20) — за зоной от края блока — к грани A не прилипает", () => {
    expect(isBlockFaceSnap(start({ x: 30.5, y: -20 }))).toBe(false)
  })
})
describe("далеко от блока", () => {
  it("BS-3: курсор (60, −16) — далеко за краем блока — прилипания нет, вершина на сетке (60, −20)", () => {
    const r = start({ x: 60, y: -16 })
    expect(r.source).toBe("grid")
    expectPoint(r.point, 60, -20)
  })
})

describe("большая толщина стен", () => {
  // A и B толщиной 195: блок x ∈ [0,195], y ∈ [−97.5, 97.5]; B от (97.5, 97.5)
  const big = (): Wall[] => [W(-1000, 0, 0, 0, 195), W(97.5, 97.5, 97.5, 1000, 195)]
  const bigZoom = 0.42
  const square = [
    { x: 0, y: -97.5 },
    { x: 195, y: -97.5 },
    { x: 195, y: -292.5 },
    { x: 0, y: -292.5 },
  ]

  it("BS-4: курсор под правой половиной блока (150, −150) — квадрат вплотную к блоку, вершина (97.5, −97.5)", () => {
    const walls = big()
    expectFaceSnap(start({ x: 150, y: -150 }, walls, 195, bigZoom), { x: 97.5, y: -97.5 }, square, walls)
  })

  it("BS-4a: курсор у правого края блока (190, −120) — вершина (97.5, −97.5), не сетка", () => {
    const walls = big()
    expectFaceSnap(start({ x: 190, y: -120 }, walls, 195, bigZoom), { x: 97.5, y: -97.5 }, square, walls)
  })

  it("BS-4b: курсор в положении квадрата вплотную (150, −195) — поперечная граница включительно — вершина (97.5, −97.5)", () => {
    const walls = big()
    expectFaceSnap(start({ x: 150, y: -195 }, walls, 195, bigZoom), { x: 97.5, y: -97.5 }, square, walls)
  })

  it("BS-4c: курсор дальше поперечной границы (150, −200) — к грани не прилипает (прежнее правило)", () => {
    expect(isBlockFaceSnap(start({ x: 150, y: -200 }, big(), 195, bigZoom))).toBe(false)
  })
})

describe("грань без блока не меняется", () => {
  it("BS-5: одна стена A, курсор за концом дальше окна и зоны (24, −14) — сетка (20, −10)", () => {
    const r = start({ x: 24, y: -14 }, [W(-100, 0, 0, 0, T)])
    expect(r.source).toBe("grid")
    expectPoint(r.point, 20, -10)
  })

  it("BS-5c: одна стена A, курсор (21, −13) — сразу за окном диагонального прилипания и зоной — сетка (20, −10)", () => {
    const r = start({ x: 21, y: -13 }, [W(-100, 0, 0, 0, T)])
    expect(r.source).toBe("grid")
    expectPoint(r.point, 20, -10)
  })

  it("BS-5a: одна стена A, курсор под гранью в пределах длины (−50, −15) — вершина (−50, −10)", () => {
    const r = start({ x: -50, y: -15 }, [W(-100, 0, 0, 0, T)])
    expect(r.source).toBe("wall")
    expect(r.target).toBe("face")
    expectPoint(r.point, -50, -10)
  })

  it("BS-5b: параллельные стены на диагонали (блока нет) — курсор (15, −15) в окне диагонального прилипания, вершина (10, −10), target corner", () => {
    const r = start({ x: 15, y: -15 }, [W(-100, 0, 0, 0, T), W(10, 10, 110, 10, T)])
    expect(r.source).toBe("wall")
    expect(r.target).toBe("corner")
    expectPoint(r.point, 10, -10)
  })
})
