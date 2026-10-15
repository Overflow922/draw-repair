import { describe, expect, it } from "vitest"
import { chainSegment } from "./wall-chain"
import type { ChainInput, ChainSegment } from "./wall-chain"
import { startRefOf } from "./wall-angle"
import { displayPolygons } from "./wall-geometry"
import { placementSquare, snapOnRay, snapRadiusCm, snapStartVertex, snapVertex } from "./wall-snap"
import type { VertexSnap } from "./wall-snap"
import type { Point, Wall } from "./types"
import { W, clipConvex, deepFreeze, expectPoint, expectSameVertices, maxOverlap, polygonArea } from "./wall-snap.test-utils"

// change cap-flush-snap (wall-drawing, «Прилипание к свободному торцу заподлицо с гранью»): у свободного торца
// стены, толще новой, квадрат установки имеет три позиции вдоль торца — центр и заподлицо с каждой гранью.
// Сцена A: стена (−100,0)→(0,0), толщина 40, свободный торец на x = 0, грани y = ±20; новая стена 20 см.
// Эталоны выведены из спецификации: заподлицо с гранью y = 20 — квадрат [0, 20] × [0, 20], вершина (10, 10).

const GRID = 10
const R = (zoom = 1): number => snapRadiusCm(zoom)
const TOL = 1e-6
const NAN: Point = { x: NaN, y: NaN }

const A = (): Wall[] => [W(-100, 0, 0, 0, 40)]

const start = (p: Point, walls: Wall[] = A(), t = 20): VertexSnap => snapStartVertex(p, walls, R(), GRID, t)

const rect = (x0: number, y0: number, x1: number, y1: number): Point[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
]

function expectCapAt(r: VertexSnap, vertex: Point, square: Point[], label = ""): void {
  expect(r.source, label).toBe("wall")
  expect(r.target, label).toBe("cap")
  expectPoint(r.point, vertex.x, vertex.y)
  expectPoint(r.normal ?? NAN, 1, 0)
  expectSameVertices(placementSquare(r, 20), square)
}

const flushPlus = (r: VertexSnap, label = ""): void => expectCapAt(r, { x: 10, y: 10 }, rect(0, 0, 20, 20), label)
const flushMinus = (r: VertexSnap, label = ""): void => expectCapAt(r, { x: 10, y: -10 }, rect(0, -20, 20, 0), label)
const centre = (r: VertexSnap, label = ""): void => expectCapAt(r, { x: 10, y: 0 }, rect(0, -10, 20, 10), label)

describe("CF-1: три позиции на торце, выбор по проекции курсора", () => {
  it("курсор ближе к грани y = 20 — заподлицо с ней, квадрат не налагается на тело", () => {
    for (const p of [
      { x: 6, y: 18 },
      { x: 6, y: 20 },
      { x: 6, y: 12 },
      { x: 1, y: 6 },
    ])
      flushPlus(start(p), `(${p.x}, ${p.y})`)
    expect(maxOverlap(placementSquare(start({ x: 6, y: 18 }), 20), A())).toBeLessThan(TOL)
  })

  it("курсор ближе к грани y = −20 — заподлицо с ней", () => {
    for (const p of [
      { x: 6, y: -18 },
      { x: 6, y: -12 },
      { x: 1, y: -6 },
    ])
      flushMinus(start(p), `(${p.x}, ${p.y})`)
  })

  it("курсор у оси — центр", () => {
    for (const p of [
      { x: 6, y: 0 },
      { x: 6, y: 3 },
      { x: 6, y: -3 },
      { x: 6, y: 4.9 },
      { x: 6, y: -4.9 },
    ])
      centre(start(p), `(${p.x}, ${p.y})`)
  })

  it("равное расстояние до центра и грани — центр", () => {
    centre(start({ x: 6, y: 5 }))
    centre(start({ x: 6, y: -5 }))
  })

  it("чуть дальше середины — заподлицо с гранью", () => {
    flushPlus(start({ x: 6, y: 5.1 }))
    flushMinus(start({ x: 6, y: -5.1 }))
  })

  it("та же привязка без стартовой логики сетки (snapVertex)", () => {
    flushPlus(snapVertex({ x: 6, y: 18 }, A(), R(), GRID, 20))
    centre(snapVertex({ x: 6, y: 3 }, A(), R(), GRID, 20))
  })
})

describe("CF-2: торец a и наклонная стена — те же позиции в системе стены", () => {
  it("стена задана в обратном направлении: свободный торец — начало a", () => {
    const walls = [W(0, 0, -100, 0, 40)]
    flushPlus(start({ x: 6, y: 18 }, walls))
    flushMinus(start({ x: 6, y: -18 }, walls))
  })

  it("вертикальная стена: заподлицо с гранью x = 20 за нижним торцом", () => {
    const walls = [W(0, 0, 0, 200, 40)]
    const r = start({ x: 18, y: -6 }, walls)
    expect(r.target).toBe("cap")
    expectPoint(r.point, 10, -10)
    expectPoint(r.normal ?? NAN, 0, -1)
    expectSameVertices(placementSquare(r, 20), rect(0, -20, 20, 0))
  })

  it("наклонная стена: вершина смещена вдоль торца, квадрат не налагается", () => {
    const k = Math.SQRT1_2
    const walls = deepFreeze([W(-100 * k, -100 * k, 0, 0, 40)])
    // ось (k, k), нормаль торца (k, k), вдоль торца (−k, k): заподлицо с гранью — +10 вдоль торца
    const r = start({ x: 6 * k + 18 * -k, y: 6 * k + 18 * k }, walls)
    expect(r.target).toBe("cap")
    expectPoint(r.point, 10 * k - 10 * k, 10 * k + 10 * k)
    expect(maxOverlap(placementSquare(r, 20), walls)).toBeLessThan(TOL)
  })
})

describe("CF-3: позиция одна, если новая стена не тоньше существующей", () => {
  it("равная и большая толщина — только центр, курсор у самой грани", () => {
    for (const t of [20, 40]) {
      const walls = [W(-100, 0, 0, 0, 20)]
      const r = snapStartVertex({ x: 4, y: 9 }, walls, R(), GRID, t)
      expect(r.target).toBe("cap")
      expectPoint(r.point, t / 2, 0)
    }
  })

  it("новая стена тоньше, но заметно: позиции ±d с d = hW − newHalf для другой толщины", () => {
    const r = start({ x: 4, y: 18 }, A(), 10)
    expect(r.target).toBe("cap")
    expectPoint(r.point, 5, 15)
    expectSameVertices(placementSquare(r, 10), rect(0, 10, 10, 20))
  })
})

describe("CF-4: недоступная позиция выпадает, выбирается ближайшая из остальных", () => {
  // тело x ∈ [14, 18], y ∈ [14, 18] заходит в квадрат [0, 20] × [0, 20], но не в квадрат по центру
  const blocker = (): Wall => W(16, 14, 16, 18, 4)

  it("без помехи — заподлицо, с помехой — не заподлицо и без наложения", () => {
    flushPlus(start({ x: 6, y: 12 }))
    const walls = deepFreeze([...A(), blocker()])
    const r = start({ x: 6, y: 12 }, walls)
    expect(r.target === "cap" && Math.abs(r.point.y - 10) < TOL).toBe(false)
    if (r.source === "wall") expect(maxOverlap(placementSquare(r, 20), walls)).toBeLessThan(TOL)
  })

  it("помеха на стороне заподлицо — выбран центр", () => {
    const walls = deepFreeze([...A(), blocker()])
    centre(start({ x: 6, y: 12 }, walls))
  })

  it("торец закрыт телом другой стены — позиций торца нет", () => {
    const walls = [...A(), W(0, 0, 100, 0, 40)]
    for (const p of [
      { x: 6, y: 18 },
      { x: 6, y: 3 },
    ])
      expect(start(p, walls).target).not.toBe("cap")
  })
})

describe("CF-5: прежние правила вне зоны центра/заподлицо не меняются", () => {
  it("диагональ за углом: квадрат [0, 20] × [20, 40], вершина (10, 20)", () => {
    for (const p of [
      { x: 8, y: 28 },
      { x: 20, y: 40 },
      { x: 0.5, y: 22 },
    ]) {
      const r = start(p)
      expect(r.target, `(${p.x}, ${p.y})`).toBe("corner")
      expectPoint(r.point, 10, 20)
      expectSameVertices(placementSquare(r, 20), rect(0, 20, 20, 40))
    }
  })

  it("грань заподлицо с торцом сбоку не за плоскостью торца", () => {
    const r = start({ x: -4, y: 28 })
    expect(r.target).toBe("face")
    expectPoint(r.point, -10, 20)
  })

  it("конец при заданном направлении упирается в плоскость торца где угодно вдоль торца", () => {
    const r = snapOnRay({ x: 6, y: 15 }, A(), R(), GRID, 20, { x: 200, y: 15 }, { x: -1, y: 0 })
    expect(r.target).toBe("cap")
    expectPoint(r.point, 0, 15)
  })

  it("далеко за торцом на продолжении полосы — прилипания к торцу нет", () => {
    const r = snapVertex({ x: 40, y: 18 }, A(), R(), GRID, 20)
    expect(r.target).not.toBe("cap")
  })
})

function segment(over: Partial<ChainInput> & Pick<ChainInput, "start" | "ref" | "raw" | "walls">): ChainSegment {
  return chainSegment({ radiusCm: R(), gridStepCm: GRID, thicknessCm: 20, ortho: false, typedAngleDeg: null, typedLengthCm: null, ...over })
}

describe("CF-6: вторая вершина цепочки без заданного направления", () => {
  it("конец у торца — те же позиции", () => {
    const walls = deepFreeze(A())
    const seg = segment({ start: { x: 100, y: 100 }, ref: null, raw: { x: 6, y: 18 }, walls })
    expect(seg.snap.target).toBe("cap")
    expectPoint(seg.end, 10, 10)
    const mid = segment({ start: { x: 100, y: 100 }, ref: null, raw: { x: 6, y: 2 }, walls })
    expectPoint(mid.end, 10, 0)
  })
})

describe("CF-7: стена от вершины заподлицо — стык без выемки и уступа", () => {
  const covered = (poly: Point[], pieces: Point[][]): number =>
    pieces.reduce((s, pc) => {
      const inter = clipConvex(poly, pc)
      return s + (inter.length >= 3 ? Math.abs(polygonArea(inter)) : 0)
    }, 0)

  const wallOf = (a: Point, b: Point, t = 20): Wall => ({ ...W(0, 0, 1, 0, t), a: { ...a }, b: { ...b } })

  const a0 = deepFreeze(A()[0])

  function bodies(N: Wall): { a: Point[][]; n: Point[][] } {
    const walls = [a0, N]
    return { a: displayPolygons(a0, walls), n: displayPolygons(N, walls) }
  }

  it("CF-7a: вдоль оси A — тело доходит до плоскости торца, грань y = 20 продолжает грань A, A не изменена", () => {
    const first = start({ x: 6, y: 18 })
    flushPlus(first)
    const N = wallOf(first.point, { x: 110, y: 10 })
    const { a, n } = bodies(N)
    const alone = displayPolygons(a0, [a0])
    expect(a).toHaveLength(alone.length)
    alone.forEach((pc, i) => expectSameVertices(a[i], pc))
    const overlap = n.reduce((s, pc) => s + covered(pc, a), 0)
    expect(overlap).toBeLessThanOrEqual(TOL)
    const xs = n.flat().map((p) => p.x)
    const ys = n.flat().map((p) => p.y)
    expect(Math.min(...xs)).toBeCloseTo(0, 6)
    expect(Math.max(...ys)).toBeCloseTo(20, 6)
    expect(Math.min(...ys)).toBeCloseTo(0, 6)
    // квадрат установки целиком покрыт телом
    expect(covered(rect(0, 0, 20, 20), n)).toBeCloseTo(400, 6)
  })

  it("CF-7b: вершина не зависит от направления — при любом повороте тело не налагается на A и доходит до торца", () => {
    const first = start({ x: 6, y: 18 })
    flushPlus(first)
    for (const deg of [0, 45, -45, 90, -90]) {
      const rad = (deg * Math.PI) / 180
      const raw = { x: first.point.x + 150 * Math.cos(rad), y: first.point.y + 150 * Math.sin(rad) }
      const seg = segment({ start: first.point, ref: startRefOf(first), raw, walls: A() })
      const { a, n } = bodies(wallOf(first.point, seg.end))
      expect(n.reduce((s, pc) => s + covered(pc, a), 0), `${deg}°`).toBeLessThanOrEqual(TOL)
    }
  })
})

describe("CF-8: чистота и детерминированность", () => {
  it("входные стены не изменяются; повторный вызов даёт тот же результат", () => {
    const walls = deepFreeze(A())
    const r1 = start({ x: 6, y: 18 }, walls)
    const r2 = start({ x: 6, y: 18 }, walls)
    expect(r2.point).toEqual(r1.point)
    expect(r2.target).toBe("cap")
  })
})
