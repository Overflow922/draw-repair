import { describe, expect, it } from "vitest"
import { chainEndSquare, snapRadiusCm, snapVertex, squareOnSide } from "./wall-snap"
import type { VertexSnap } from "./wall-snap"
import type { Point, Wall } from "./types"
import { W, deepFreeze, expectSameVertices, maxOverlap, sceneL, sceneS } from "./wall-snap.test-utils"

// change fix-wall-snap-overlap, ревизия 4 (design D6a): квадрат на свободном конце
// предварительного сегмента — квадрат установки у грани/торца, если конец прилип к стене,
// иначе последний блок будущей стены вдоль сегмента.

const GRID = 10

const unitDir = (from: Point, to: Point): Point => {
  const l = Math.hypot(to.x - from.x, to.y - from.y)
  return { x: (to.x - from.x) / l, y: (to.y - from.y) / l }
}

// второй конец цепочки: привязка с orthoFrom = начало, направление — от начала к концу
function chainEnd(start: Point, cursor: Point, walls: Wall[], zoom = 1): { snap: VertexSnap; dir: Point } {
  const snap = snapVertex(cursor, walls, snapRadiusCm(zoom), GRID, 20, start)
  return { snap, dir: unitDir(start, snap.point) }
}

describe("chainEndSquare: прилипший второй конец", () => {
  it("CE-ANGLE-1: подход к грани под углом — квадрат по грани снаружи, не по сегменту", () => {
    const walls = sceneS()
    const { snap, dir } = chainEnd({ x: 20, y: -60 }, { x: 50, y: -13 }, walls)
    expect(snap.source).toBe("wall")
    const sq = chainEndSquare(snap.point, dir, snap, 20)
    expectSameVertices(sq, [
      { x: 40, y: -10 },
      { x: 60, y: -10 },
      { x: 60, y: -30 },
      { x: 40, y: -30 },
    ])
    expect(maxOverlap(sq, walls)).toBeLessThanOrEqual(1e-6)
    // блок вдоль сегмента в той же точке налагается — тест различает варианты
    expect(maxOverlap(squareOnSide(snap.point, { x: -dir.x, y: -dir.y }, 20), walls)).toBeGreaterThan(1)
  })

  it("CE-PERP-1: перпендикулярный подход — квадрат совпадает с последним блоком", () => {
    const walls = sceneS()
    const { snap, dir } = chainEnd({ x: 50, y: -100 }, { x: 50, y: -13 }, walls)
    const expected = [
      { x: 40, y: -10 },
      { x: 60, y: -10 },
      { x: 60, y: -30 },
      { x: 40, y: -30 },
    ]
    expectSameVertices(chainEndSquare(snap.point, dir, snap, 20), expected)
    expectSameVertices(squareOnSide(snap.point, { x: -dir.x, y: -dir.y }, 20), expected)
  })

  it("CE-EQ-1: конец — отдельный объект с теми же (±1e-12) координатами — квадрат установки", () => {
    const walls = sceneS()
    const { snap, dir } = chainEnd({ x: 20, y: -60 }, { x: 50, y: -13 }, walls)
    const expected = [
      { x: 40, y: -10 },
      { x: 60, y: -10 },
      { x: 60, y: -30 },
      { x: 40, y: -30 },
    ]
    expectSameVertices(chainEndSquare({ x: snap.point.x, y: snap.point.y }, dir, snap, 20), expected)
    expectSameVertices(chainEndSquare({ x: snap.point.x + 1e-12, y: snap.point.y }, dir, snap, 20), expected)
  })

  it("CE-CAP-1: подход вдоль оси к свободному торцу — квадрат снаружи плоскости торца", () => {
    const walls = sceneS()
    const { snap, dir } = chainEnd({ x: 200, y: 0 }, { x: 106, y: 0 }, walls)
    expect(snap.point).toEqual({ x: 100, y: 0 })
    expectSameVertices(chainEndSquare(snap.point, dir, snap, 20), [
      { x: 100, y: -10 },
      { x: 100, y: 10 },
      { x: 120, y: 10 },
      { x: 120, y: -10 },
    ])
  })
})

describe("chainEndSquare: последний блок вдоль сегмента", () => {
  const block = [
    { x: 30, y: 40 },
    { x: 50, y: 40 },
    { x: 50, y: 60 },
    { x: 30, y: 60 },
  ]

  it("CE-GRID-1: конец не прилип (сетка) — блок со стороны начала сегмента", () => {
    const grid: VertexSnap = { point: { x: 50, y: 50 }, source: "grid" }
    expectSameVertices(chainEndSquare({ x: 50, y: 50 }, { x: 1, y: 0 }, grid, 20), block)
  })

  it("CE-NULL-1: привязки нет — блок со стороны начала сегмента", () => {
    expectSameVertices(chainEndSquare({ x: 50, y: 50 }, { x: 1, y: 0 }, null, 20), block)
  })

  it("CE-TYPED-1: точная длина — конец не совпадает с прилипшей точкой, блок по сегменту", () => {
    const stuck: VertexSnap = { point: { x: 50, y: -10 }, source: "wall" }
    Object.defineProperty(stuck, "normal", { value: { x: 0, y: -1 }, enumerable: false })
    expectSameVertices(chainEndSquare({ x: 50, y: -20 }, { x: 0, y: 1 }, stuck, 20), [
      { x: 40, y: -40 },
      { x: 60, y: -40 },
      { x: 60, y: -20 },
      { x: 40, y: -20 },
    ])
  })

  it("CE-DIAG-DIR-1: диагональный сегмент — блок повёрнут по сегменту", () => {
    expectSameVertices(chainEndSquare({ x: 0, y: 0 }, { x: 0.6, y: 0.8 }, null, 20), [
      { x: -8, y: 6 },
      { x: 8, y: -6 },
      { x: -4, y: -22 },
      { x: -20, y: -10 },
    ])
  })

  it("CE-TOL-1: конец в 1e-3 от прилипшей точки — уже последний блок", () => {
    const stuck: VertexSnap = { point: { x: 50, y: -10 }, source: "wall" }
    Object.defineProperty(stuck, "normal", { value: { x: 0, y: -1 }, enumerable: false })
    expectSameVertices(chainEndSquare({ x: 50, y: -10.001 }, { x: 0, y: 1 }, stuck, 20), [
      { x: 40, y: -30.001 },
      { x: 60, y: -30.001 },
      { x: 60, y: -10.001 },
      { x: 40, y: -10.001 },
    ])
  })

  it("CE-TOL-X-1: конец в 1e-3 от прилипшей точки по X — уже последний блок", () => {
    // горизонтальный сегмент с точной длиной к вертикальной грани: расхождение только по x
    const stuck: VertexSnap = { point: { x: -10, y: 50 }, source: "wall" }
    Object.defineProperty(stuck, "normal", { value: { x: -1, y: 0 }, enumerable: false })
    expectSameVertices(chainEndSquare({ x: -10.001, y: 50 }, { x: 1, y: 0 }, stuck, 20), [
      { x: -30.001, y: 40 },
      { x: -30.001, y: 60 },
      { x: -10.001, y: 40 },
      { x: -10.001, y: 60 },
    ])
  })

  it("CE-PURE-2: ветка последнего блока не мутирует входы", () => {
    const end = deepFreeze({ x: 50, y: 50 })
    const dir = deepFreeze({ x: 1, y: 0 })
    const grid = deepFreeze<VertexSnap>({ point: { x: 50, y: 50 }, source: "grid" })
    expect(() => chainEndSquare(end, dir, null, 20)).not.toThrow()
    expect(() => chainEndSquare(end, dir, grid, 20)).not.toThrow()
  })

  it("CE-PURE-1: входы не мутируются", () => {
    const snap = deepFreeze(snapVertex({ x: 50, y: -13 }, sceneS(), snapRadiusCm(1), GRID, 20))
    if (snap.normal) Object.freeze(snap.normal)
    const end = deepFreeze({ x: 50, y: -10 })
    const dir = deepFreeze({ x: 0, y: 1 })
    expect(() => chainEndSquare(end, dir, snap, 20)).not.toThrow()
  })
})

describe("Инвариант: квадрат второго конца не налагается при любом направлении сегмента", () => {
  // сцена ручной проверки: прямоугольник, почти вертикальная стена, тонкая T-стена 10 см
  const manual = (): Wall[] => [
    W(50, 50, 350, 50),
    W(350, 50, 350, 250),
    W(350, 250, 50, 250),
    W(50, 250, 60, 60),
    W(200, 60, 200, 180, 10),
  ]
  const starts: Point[] = [
    { x: -60, y: -40 },
    { x: 150, y: -60 },
    { x: 450, y: 150 },
    { x: 200, y: 330 },
    { x: 120, y: 150 },
    { x: 280, y: 150 },
  ]
  const cases: [string, Wall[]][] = [
    ["ручная", manual()],
    ["L", sceneL()],
  ]
  for (const [name, walls] of cases)
    it(`INV-CHAIN-END-1: сцена ${name}`, () => {
      let stuck = 0
      for (const start of starts)
        for (let x = -20; x <= 380; x += 4)
          for (let y = -20; y <= 320; y += 4) {
            const { snap, dir } = chainEnd(start, { x, y }, walls)
            if (snap.source !== "wall") continue
            stuck++
            expect(maxOverlap(chainEndSquare(snap.point, dir, snap, 20), walls)).toBeLessThanOrEqual(1e-6)
          }
      expect(stuck).toBeGreaterThan(0)
    }, 300_000)
})
