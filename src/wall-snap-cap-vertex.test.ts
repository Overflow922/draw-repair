import { describe, expect, it } from "vitest"
import { chainSegment } from "./wall-chain"
import type { ChainInput, ChainSegment } from "./wall-chain"
import { startRefOf } from "./wall-angle"
import { displayPolygons } from "./wall-geometry"
import { chainEndSquare, placementSquare, snapOnRay, snapRadiusCm, snapStartVertex, snapVertex } from "./wall-snap"
import type { VertexSnap } from "./wall-snap"
import type { Point, Wall } from "./types"
import {
  W,
  clipConvex,
  deepFreeze,
  expectPoint,
  expectSameVertices,
  maxOverlap,
  polygonArea,
  sceneS,
} from "./wall-snap.test-utils"

// change cap-snap-vertex-at-square-center (test-plan.md): прилипание к свободному торцу
// без заданного направления фиксирует вершину в центре квадрата установки; квадрат
// остаётся приставленным к плоскости торца; луч по-прежнему упирается в плоскость торца;
// стык закрывают существующие правила; конец оси у торца начала — не узел трекинга.

const GRID = 10
const R = (zoom = 1): number => snapRadiusCm(zoom)
const RAD = Math.PI / 180
const TOL = 1e-6

const start = (p: Point, walls: Wall[], t = 20, zoom = 1): VertexSnap => snapStartVertex(p, walls, R(zoom), GRID, t)
const free = (p: Point, walls: Wall[], t = 20, zoom = 1): VertexSnap => snapVertex(p, walls, R(zoom), GRID, t)

function segment(over: Partial<ChainInput> & Pick<ChainInput, "start" | "ref" | "raw" | "walls">): ChainSegment {
  return chainSegment({
    radiusCm: R(),
    gridStepCm: GRID,
    thicknessCm: 20,
    ortho: false,
    typedAngleDeg: null,
    typedLengthCm: null,
    ...over,
  })
}

function expectCap(r: VertexSnap, x: number, y: number, nx: number, ny: number): void {
  expect(r.source).toBe("wall")
  expect(r.target).toBe("cap")
  expectPoint(r.point, x, y)
  expect(r.normal).toBeDefined()
  expectPoint(r.normal ?? { x: NaN, y: NaN }, nx, ny)
}

const rect = (x0: number, y0: number, x1: number, y1: number): Point[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
]

const pt = (p: Point): Point => ({ x: p.x, y: p.y })
const wallOf = (a: Point, b: Point, t = 20): Wall => ({ ...W(0, 0, 1, 0, t), a: pt(a), b: pt(b) })

// площадь части poly, покрытой кусками (куски одной стены не пересекаются)
const covered = (poly: Point[], pieces: Point[][]): number =>
  pieces.reduce((s, pc) => {
    const inter = clipConvex(poly, pc)
    return s + (inter.length >= 3 ? Math.abs(polygonArea(inter)) : 0)
  }, 0)

const overlapArea = (p: Point[][], q: Point[][]): number => p.reduce((s, pc) => s + covered(pc, q), 0)

const insideAny = (p: Point, pieces: Point[][]): boolean => covered(rect(p.x - 0.01, p.y - 0.01, p.x + 0.01, p.y + 0.01), pieces) > 3e-4

// вертикальная стена A с торцом на y = 0 (наружу — (0, −1)), толщина tA
const wallA = (tA = 20): Wall => W(0, 100, 0, 0, tA)

// стык новой стены N со стеной A по отображаемым телам: без наложения, A как нарисована
function expectCleanJoint(A: Wall, N: Wall): { a: Point[][]; n: Point[][] } {
  const walls = deepFreeze([A, N])
  const a = displayPolygons(A, walls)
  const n = displayPolygons(N, walls)
  expect(overlapArea(n, a)).toBeLessThanOrEqual(TOL)
  const alone = displayPolygons(A, [A])
  expect(a).toHaveLength(alone.length)
  alone.forEach((pc, i) => expectSameVertices(a[i], pc))
  return { a, n }
}

describe("вершина у свободного торца — центр квадрата установки", () => {
  it("CV-START-1: начало у торца — вершина на оси на полтолщины новой стены за плоскостью торца", () => {
    const walls = deepFreeze(sceneS())
    expectCap(start({ x: 106, y: 3 }, walls), 110, 0, 1, 0)
    expectCap(free({ x: 106, y: 3 }, walls), 110, 0, 1, 0)
  })

  it("CV-SHAPE-1: контракт результата {point, source} сохранён у вершины торца", () => {
    const r = start({ x: 106, y: 3 }, deepFreeze(sceneS()))
    expect(r).toEqual({ point: { x: 110, y: 0 }, source: "wall" })
    expect(Object.keys(r).sort()).toEqual(["point", "source"])
  })

  it("CV-SQ-1: квадрат установки по-прежнему приставлен к плоскости торца и не налагается", () => {
    const walls = deepFreeze(sceneS())
    const r = start({ x: 106, y: 3 }, walls)
    const sq = placementSquare(r, 20)
    expectSameVertices(sq, rect(100, -10, 120, 10))
    expect(maxOverlap(sq, walls)).toBeLessThanOrEqual(TOL)
  })

  it("CV-THICK-1: смещение — полтолщины НОВОЙ стены, квадрат у плоскости торца", () => {
    const walls = deepFreeze(sceneS())
    const thin = start({ x: 104, y: 2 }, walls, 10)
    expectCap(thin, 105, 0, 1, 0)
    expectSameVertices(placementSquare(thin, 10), rect(100, -5, 110, 5))
    const fat = start({ x: 106, y: 3 }, walls, 40)
    expectCap(fat, 120, 0, 1, 0)
    expectSameVertices(placementSquare(fat, 40), rect(100, -20, 140, 20))
    // толстая существующая стена, новая 20: смещение по новой, не по существующей
    const thickWall = deepFreeze([W(0, 0, 100, 0, 40)])
    const r = start({ x: 106, y: 3 }, thickWall, 20)
    expectCap(r, 110, 0, 1, 0)
    expectSameVertices(placementSquare(r, 20), rect(100, -10, 120, 10))
  })

  it("CV-CAP-A: начальный торец a — смещение наружу от a", () => {
    expectCap(start({ x: -6, y: 3 }, deepFreeze(sceneS())), -10, 0, -1, 0)
  })

  it("CV-SLANT-1: торец наклонной стены — вершина на продолжении оси", () => {
    const u = { x: Math.cos(30 * RAD), y: Math.sin(30 * RAD) }
    const walls = deepFreeze([W(0, 0, 100 * u.x, 100 * u.y)])
    const r = start({ x: 106 * u.x, y: 106 * u.y }, walls)
    expectCap(r, 110 * u.x, 110 * u.y, u.x, u.y)
    expect(maxOverlap(placementSquare(r, 20), walls)).toBeLessThanOrEqual(TOL)
  })

  it("CV-CONT-1: продолжение полосы за торцом вне радиуса от точки торца — центр квадрата", () => {
    expectCap(free({ x: 110, y: 5 }, deepFreeze(sceneS())), 110, 0, 1, 0)
  })

  it("CV-GRID-1: квадрат по сетке у свободного торца — вершина (10, 0)", () => {
    const walls = deepFreeze([W(-100, 0, 0, 0, 20)])
    const r = start({ x: 12, y: 0 }, walls, 20, 0.8)
    expectCap(r, 10, 0, 1, 0)
    expectSameVertices(placementSquare(r, 20), rect(0, -10, 20, 10))
  })
})

describe("зона торца считается от плоскости торца, не от вершины", () => {
  it("CV-REACH-1: масштаб 1, новая 20 — граница reach включительно", () => {
    const walls = deepFreeze(sceneS())
    expect(free({ x: 110, y: 3 }, walls)).toEqual({ point: { x: 110, y: 0 }, source: "wall" })
    expect(free({ x: 110, y: 3 }, walls).target).toBe("cap")
    // за границей — сетка; та же точка, другой источник
    expect(free({ x: 110.5, y: 3 }, walls)).toEqual({ point: { x: 110, y: 0 }, source: "grid" })
  })

  it("CV-REACH-2: отдалённый вид — reach = радиус 24", () => {
    const walls = deepFreeze(sceneS())
    expect(free({ x: 124, y: 2 }, walls, 20, 0.25)).toEqual({ point: { x: 110, y: 0 }, source: "wall" })
    expect(free({ x: 124.5, y: 2 }, walls, 20, 0.25)).toEqual({ point: { x: 120, y: 0 }, source: "grid" })
  })

  it("CV-REACH-3: толстая новая — reach = newHalf = 20", () => {
    const walls = deepFreeze(sceneS())
    expect(free({ x: 120, y: 3 }, walls, 40)).toEqual({ point: { x: 120, y: 0 }, source: "wall" })
    expect(free({ x: 121, y: 3 }, walls, 40)).toEqual({ point: { x: 120, y: 0 }, source: "grid" })
  })

  it("CV-BAND-1: граница полосы — на полосе торец, за ней грань", () => {
    const walls = deepFreeze(sceneS())
    expectCap(free({ x: 104, y: -10 }, walls), 110, 0, 1, 0)
    const face = free({ x: 104, y: -10.001 }, walls)
    expect(face.target).toBe("face")
    expectPoint(face.point, 90, -10)
  })
})

describe("квадрат и выбор цели считаются от плоскости торца, не от вершины", () => {
  it("CV-OVL-1: квадрат у плоскости торца налагался бы на соседа — торец не цель", () => {
    // квадрат 40 у торца S: x ∈ [100, 140], y ∈ [−20, 20] — налагается на тело C (x 105..115, y ≥ 15)
    const walls = deepFreeze([W(0, 0, 100, 0, 20), W(110, 15, 110, 80, 10)])
    for (const r of [free({ x: 104, y: 3 }, walls, 40), start({ x: 104, y: 3 }, walls, 40)]) {
      expect(r.target).not.toBe("cap")
      if (r.source === "wall") expect(maxOverlap(placementSquare(r, 40), walls)).toBeLessThanOrEqual(TOL)
    }
  })

  it("CV-RANK-1: ближайшая цель — по точке приставления квадрата, а не по сдвинутой вершине", () => {
    // курсор (111, 7): до плоскости торца S (100, 0) — 13.04, до грани B y = 18 — 11; до вершины торца (110, 0) — 7.07
    const walls = deepFreeze([W(0, 0, 100, 0, 20), W(80, 28, 160, 28, 20)])
    for (const r of [free({ x: 111, y: 7 }, walls, 20, 0.5), start({ x: 111, y: 7 }, walls, 20, 0.5)]) {
      expect(r.target).toBe("face")
      expectPoint(r.point, 111, 18)
      expectPoint(r.normal ?? { x: NaN, y: NaN }, 0, -1)
    }
  })
})

describe("свободный конец без заданного направления у торца", () => {
  it("CV-END-1: подход вдоль оси — конец в центре квадрата, квадрат у плоскости торца", () => {
    const walls = deepFreeze(sceneS())
    const seg = segment({ start: { x: 200, y: 0 }, ref: null, raw: { x: 106, y: 0 }, walls })
    expectPoint(seg.end, 110, 0)
    expect(seg.snap.target).toBe("cap")
    expect(seg.dir).not.toBeNull()
    const sq = chainEndSquare(seg.end, seg.dir ?? { x: NaN, y: NaN }, seg.snap, 20)
    expectSameVertices(sq, rect(100, -10, 120, 10))
    expect(maxOverlap(sq, walls)).toBeLessThanOrEqual(TOL)
  })

  it("CV-END-PERP: подход перпендикулярно оси — конец в центре квадрата, стык без наложения", () => {
    const S = sceneS()[0]
    const walls = deepFreeze([S])
    const from = { x: 110, y: -200 }
    const seg = segment({ start: from, ref: null, raw: { x: 106, y: 3 }, walls })
    expectPoint(seg.end, 110, 0)
    const sq = chainEndSquare(seg.end, seg.dir ?? { x: NaN, y: NaN }, seg.snap, 20)
    expectSameVertices(sq, rect(100, -10, 120, 10))
    const N = wallOf(from, seg.end)
    const scene = deepFreeze([S, N])
    const n = displayPolygons(N, scene)
    expect(overlapArea(n, displayPolygons(S, scene))).toBeLessThanOrEqual(TOL)
    expect(covered(sq, n)).toBeCloseTo(400, 6)
  })
})

describe("конец при заданном направлении упирается в плоскость торца", () => {
  it("CV-RAY-OFFAXIS: луч вдоль оси со смещением — конец (100, 5), не центр квадрата", () => {
    const walls = deepFreeze(sceneS())
    const r = snapOnRay({ x: 106, y: 5 }, walls, R(), GRID, 20, { x: 200, y: 5 }, { x: -1, y: 0 })
    expect(r).toEqual({ point: { x: 100, y: 5 }, source: "wall" })
    expect(r.target).toBe("cap")
    expectSameVertices(placementSquare(r, 20), rect(100, -5, 120, 15))
    expectSameVertices(chainEndSquare(r.point, { x: -1, y: 0 }, r, 20), rect(100, -5, 120, 15))
  })

  it("CV-RAY-AXIS: луч по оси — конец в плоскости торца (100, 0)", () => {
    const walls = deepFreeze(sceneS())
    const r = snapOnRay({ x: 106, y: 0 }, walls, R(), GRID, 20, { x: 200, y: 0 }, { x: -1, y: 0 })
    expect(r).toEqual({ point: { x: 100, y: 0 }, source: "wall" })
    expectSameVertices(placementSquare(r, 20), rect(100, -10, 120, 10))
  })

  it("CV-RAY-CHAIN: орто-сегмент к торцу — конец (100, 0), квадрат — последний блок", () => {
    const walls = deepFreeze(sceneS())
    const seg = segment({ start: { x: 200, y: 0 }, ref: null, raw: { x: 106, y: 2 }, walls, ortho: true })
    expectPoint(seg.end, 100, 0)
    expectSameVertices(chainEndSquare(seg.end, seg.dir ?? { x: NaN, y: NaN }, seg.snap, 20), rect(100, -10, 120, 10))
  })
})

describe("стык с вершиной в центре квадрата (геометрия правил стыков, без привязки)", () => {
  // Опора дизайна D7: вершина (0, −t/2) у торца A закрывается существующими правилами стыков
  it("CV-GEO-90: поворот 90° — квадрат покрыт, торец заподлицо с наружной гранью A", () => {
    for (const sx of [1, -1]) {
      const { n } = expectCleanJoint(wallA(), wallOf({ x: 0, y: -10 }, { x: 100 * sx, y: -10 }))
      expect(covered(rect(-10, -20, 10, 0), n)).toBeCloseTo(400, 6)
      const xs = n.flat().map((p) => p.x * sx)
      expect(Math.min(...xs)).toBeCloseTo(-10, 6)
    }
  })

  it("CV-GEO-SWEEP: любой угол от продолжения до 120° в обе стороны — без наложения, тело доходит до торца", () => {
    for (const deg of [0, 15, 30, 45, 60, 75, 89, 90, 91, 105, 120])
      for (const side of [1, -1]) {
        const a = side * deg * RAD
        const dir = { x: Math.sin(a), y: -Math.cos(a) } // поворот наружной нормали (0, −1)
        const P = { x: 0, y: -10 }
        const { n } = expectCleanJoint(wallA(), wallOf(P, { x: P.x + 150 * dir.x, y: P.y + 150 * dir.y }))
        expect(insideAny({ x: 0, y: -0.5 }, n)).toBe(true)
      }
  })
})

describe("стык после привязки начала у торца (интеграция)", () => {
  function firstClick(t = 20, walls: Wall[] = [wallA()]): { snap: VertexSnap; walls: Wall[] } {
    const frozen = deepFreeze(walls)
    return { snap: start({ x: 2, y: -4 }, frozen, t), walls: frozen }
  }

  it("CV-JOINT-90: орто вправо от торца — квадрат первый блок, без наложения, A не изменилась", () => {
    const { snap, walls } = firstClick()
    expectCap(snap, 0, -10, 0, -1)
    const seg = segment({ start: snap.point, ref: startRefOf(snap), raw: { x: 100, y: -14 }, walls, ortho: true })
    expectPoint(seg.end, 100, -10)
    const { n } = expectCleanJoint(walls[0], wallOf(snap.point, seg.end))
    const sq = placementSquare(snap, 20)
    expectSameVertices(sq, rect(-10, -20, 10, 0))
    expect(covered(sq, n)).toBeCloseTo(400, 6)
    expect(Math.min(...n.flat().map((p) => p.x))).toBeCloseTo(-10, 6)
  })

  it("CV-JOINT-180: продолжение по оси — квадрат покрыт, тела соприкасаются в плоскости торца", () => {
    const { snap, walls } = firstClick()
    expectCap(snap, 0, -10, 0, -1)
    const seg = segment({ start: snap.point, ref: startRefOf(snap), raw: { x: 3, y: -150 }, walls, ortho: true })
    expectPoint(seg.end, 0, -150)
    const { n } = expectCleanJoint(walls[0], wallOf(snap.point, seg.end))
    expect(covered(placementSquare(snap, 20), n)).toBeCloseTo(400, 6)
    expect(insideAny({ x: 0, y: -0.5 }, n)).toBe(true)
  })

  // Независимость вершины от направления структурна: начало фиксируется кликом до выбора
  // направления (chainSegment получает его на вход); здесь — чистота стыка от этой вершины.
  it("CV-JOINT-SWEEP: от вершины у торца стык чистый при любом направлении", () => {
    const { snap, walls } = firstClick()
    expectCap(snap, 0, -10, 0, -1)
    for (const deg of [0, 45, 90, 120])
      for (const side of [1, -1]) {
        const a = side * deg * RAD
        const raw = { x: snap.point.x + 150 * Math.sin(a), y: snap.point.y - 150 * Math.cos(a) }
        const seg = segment({ start: snap.point, ref: startRefOf(snap), raw, walls })
        const { n } = expectCleanJoint(walls[0], wallOf(snap.point, seg.end))
        expect(insideAny({ x: 0, y: -0.5 }, n)).toBe(true)
      }
  })

  it("CV-LEN-1: введённая длина — от вершины в центре квадрата", () => {
    const { snap, walls } = firstClick()
    expectCap(snap, 0, -10, 0, -1)
    const seg = segment({ start: snap.point, ref: startRefOf(snap), raw: { x: 60, y: -14 }, walls, ortho: true, typedLengthCm: 100 })
    expectPoint(seg.end, 100, -10)
  })

  it("CV-JOINT-THIN: новая тоньше A — квадрат покрыт, без наложения", () => {
    const { snap, walls } = firstClick(10)
    expectCap(snap, 0, -5, 0, -1)
    const { n } = expectCleanJoint(walls[0], wallOf(snap.point, { x: 100, y: -5 }, 10))
    expect(covered(rect(-5, -10, 5, 0), n)).toBeCloseTo(100, 6)
  })

  it("CV-JOINT-THICK: новая толще A — без наложения (выступ квадрата вне объёма)", () => {
    const { snap, walls } = firstClick(30)
    expectCap(snap, 0, -15, 0, -1)
    expectCleanJoint(walls[0], wallOf(snap.point, { x: 100, y: -15 }, 30))
  })
})

describe("трекинг: конец оси у торца начала — не узел", () => {
  const zoom = 0.5 // радиус привязки 12 см > полтолщины 10

  it("CV-TRK-1: начало у торца A — горизонталь конца оси A не подтягивает конец", () => {
    const walls = deepFreeze([wallA()])
    const snap = start({ x: 2, y: -4 }, walls, 20, zoom)
    expectCap(snap, 0, -10, 0, -1)
    const seg = segment({ start: snap.point, ref: startRefOf(snap), raw: { x: 80, y: -8 }, walls, radiusCm: R(zoom) })
    expect(seg.tracks).toEqual([])
    expectPoint(seg.end, 80, -10)
  })

  it("CV-TRK-FAR: дальний конец оси стены примыкания остаётся узлом", () => {
    const walls = deepFreeze([wallA()])
    const snap = start({ x: 2, y: -4 }, walls, 20, zoom)
    expectCap(snap, 0, -10, 0, -1)
    const seg = segment({ start: snap.point, ref: startRefOf(snap), raw: { x: 80, y: 93 }, walls, radiusCm: R(zoom) })
    expectPoint(seg.end, 80, 100)
    expect(seg.tracks).toHaveLength(1)
    expectPoint(seg.tracks[0].from, 0, 100)
  })

  it("CV-TRK-CTRL: без опоры то же начало — конец оси A узел, трекинг срабатывает", () => {
    const walls = deepFreeze([wallA()])
    const seg = segment({ start: { x: 0, y: -10 }, ref: null, raw: { x: 80, y: -8 }, walls, radiusCm: R(zoom) })
    expectPoint(seg.end, 80, 0)
    expect(seg.tracks).toHaveLength(1)
    expectPoint(seg.tracks[0].from, 0, 0)
  })

  it("CV-TRK-FACE: опора-грань не исключает узлы — конец оси A остаётся узлом", () => {
    const walls = deepFreeze([wallA()])
    const snap = start({ x: 14, y: 30 }, walls, 20, zoom)
    expect(snap.target).toBe("face")
    const seg = segment({ start: snap.point, ref: startRefOf(snap), raw: { x: 80, y: -8 }, walls, radiusCm: R(zoom) })
    expectPoint(seg.end, 80, 0)
    expect(seg.tracks).toHaveLength(1)
    expectPoint(seg.tracks[0].from, 0, 0)
  })
})
