import { describe, expect, it } from "vitest"
import { chainSegment } from "./wall-chain"
import { startRefOf } from "./wall-angle"
import { placementSquare, snapRadiusCm, snapStartVertex } from "./wall-snap"
import type { VertexSnap } from "./wall-snap"
import type { Point, Wall, WallElement } from "./types"
import { W, deepFreeze, expectPoint, expectSameVertices, maxOverlap, sceneL } from "./wall-snap.test-utils"
import { door, w as wid } from "./doorway/doorway.test-utils"

// change diagonal-corner-snap (test-plan.md, DS-*): до первого клика квадрат установки прилипает
// углом к углу свободного торца (wall-drawing, «Диагональное прилипание к углу свободного торца»).
// Сцена A: стена (−100,0)→(0,0), толщина 20, свободный торец на x = 0, грани y = ±10.
// Зона прилипания Z = max(радиус, полутолщина новой стены) = 10 см при толщине 20 и масштабе 1; диагональ — в дальней части
// квадранта за углом: по каждой оси от угла от Z/2 = 5 см до Z включительно (test-change-request.md, решение пользователя).
// Угол торца K = (0, 10); курсор (a, 10 + b): a — вдоль оси за плоскостью торца, b — за линией грани.
// Эталоны (квадрат, вершина, расстояния) выведены из спецификации и не используют продакшн-геометрию.

const GRID = 10
const R = (zoom = 1): number => snapRadiusCm(zoom)
const TOL = 1e-6

const A = (): Wall[] => [W(-100, 0, 0, 0, 20)]

const start = (p: Point, walls: Wall[], t = 20, zoom = 1, doorways: readonly WallElement[] = []): VertexSnap =>
  snapStartVertex(p, walls, R(zoom), GRID, t, doorways)

const rect = (x0: number, y0: number, x1: number, y1: number): Point[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
]

// вид прилипания как строка: значение "corner" появится вместе с реализацией
const targetOf = (r: VertexSnap): string | undefined => r.target

function expectCorner(r: VertexSnap, vertex: Point, normal: Point, size: number, square: Point[]): void {
  expect(r.source).toBe("wall")
  expect(targetOf(r)).toBe("corner")
  expectPoint(r.point, vertex.x, vertex.y)
  expect(r.normal).toBeDefined()
  expectPoint(r.normal ?? { x: NaN, y: NaN }, normal.x, normal.y)
  expectSameVertices(placementSquare(r, size), square)
}

function expectNotCorner(r: VertexSnap): void {
  expect(targetOf(r)).not.toBe("corner")
}

// прежний результат у конца стены: грань заподлицо с торцом (SNAP-END-3, SNAP-SCALE-1/2/3 — те же 4 см от угла)
function expectFlushFace(r: VertexSnap, x = -10, y = 10): void {
  expect(r.source).toBe("wall")
  expect(targetOf(r)).toBe("face")
  expectPoint(r.point, x, y)
}

describe("DS: диагональное прилипание к углу свободного торца", () => {
  it("DS-1: курсор за торцом и за гранью — квадрат касается угла торца, вершина на линии грани", () => {
    const walls = A()
    const r = start({ x: 8, y: 18 }, walls)
    expectCorner(r, { x: 10, y: 10 }, { x: 0, y: 1 }, 20, rect(0, 10, 20, 30))
    // INV-3: расстояние до конца оси — диагональ √(h1² + h2²)
    expect(Math.hypot(r.point.x - 0, r.point.y - 0)).toBeCloseTo(Math.sqrt(10 * 10 + 10 * 10), 6)
    // INV-2: квадрат не налагается на тело стены
    expect(maxOverlap(placementSquare(r, 20), walls)).toBeLessThan(TOL)
  })

  it("DS-2: второй угол торца — со стороны y < 0", () => {
    const walls = A()
    const r = start({ x: 8, y: -18 }, walls)
    expectCorner(r, { x: 10, y: -10 }, { x: 0, y: -1 }, 20, rect(0, -30, 20, -10))
    expect(maxOverlap(placementSquare(r, 20), walls)).toBeLessThan(TOL)
  })

  it("DS-3: новая стена толще — вершина на hN = 20 за торцом, расстояние √(10² + 20²)", () => {
    const walls = A()
    const r = start({ x: 14, y: 24 }, walls, 40)
    expectCorner(r, { x: 20, y: 10 }, { x: 0, y: 1 }, 40, rect(0, 10, 40, 50))
    expect(Math.hypot(r.point.x, r.point.y)).toBeCloseTo(Math.hypot(10, 20), 6)
    expect(maxOverlap(placementSquare(r, 40), walls)).toBeLessThan(TOL)
  })

  it("DS-4: существующая стена толще — грань на y = 20, вершина (10, 20), расстояние √(20² + 10²)", () => {
    const walls = [W(-100, 0, 0, 0, 40)]
    const r = start({ x: 8, y: 28 }, walls, 20)
    expectCorner(r, { x: 10, y: 20 }, { x: 0, y: 1 }, 20, rect(0, 20, 20, 40))
    expect(Math.hypot(r.point.x, r.point.y)).toBeCloseTo(Math.hypot(20, 10), 6)
    expect(maxOverlap(placementSquare(r, 20), walls)).toBeLessThan(TOL)
  })

  it("DS-5: вершина не зависит от положения курсора в дальней части квадранта за углом", () => {
    for (const p of [
      { x: 8, y: 18 },
      { x: 5, y: 15 },
      { x: 10, y: 20 },
      { x: 6, y: 17.5 },
    ])
      expectCorner(start(p, A()), { x: 10, y: 10 }, { x: 0, y: 1 }, 20, rect(0, 10, 20, 30))
  })

  it("DS-6: полоса стены за торцом — коллинеарное продолжение, а не диагональ", () => {
    const r = start({ x: 5, y: 4 }, A())
    expect(r.source).toBe("wall")
    expect(targetOf(r)).toBe("cap")
    expectPoint(r.point, 10, 0)
  })

  it("DS-7: курсор у грани не за плоскостью торца — грань заподлицо с торцом, как прежде", () => {
    const r = start({ x: -4, y: 14 }, A())
    expect(r.source).toBe("wall")
    expect(targetOf(r)).toBe("face")
    expectPoint(r.point, -10, 10)
  })

  it("DS-8: торец закрыт телом другой стены — диагонали нет", () => {
    // стена A2 продолжает A: у x = 0 нет свободного торца
    const walls = [W(-100, 0, 0, 0, 20), W(0, 0, 100, 0, 20)]
    const r = start({ x: 8, y: 18 }, walls)
    expectNotCorner(r)
    expect(r.source).toBe("wall")
    expect(targetOf(r)).toBe("face")
    expect(r.point.y).toBeCloseTo(10, 6)
  })

  it("DS-9: квадрат налагался бы на тело другой стены — диагонали нет", () => {
    const blocker = W(10, 25, 100, 25, 10) // тело x ∈ [10, 100], y ∈ [20, 30] заходит в квадрат [0, 20] × [10, 30]
    // контроль: без помехи диагональ предлагается
    expectCorner(start({ x: 8, y: 18 }, A()), { x: 10, y: 10 }, { x: 0, y: 1 }, 20, rect(0, 10, 20, 30))
    const walls = [...A(), blocker]
    const r = start({ x: 8, y: 18 }, walls)
    expectNotCorner(r)
    if (r.source === "wall") expect(maxOverlap(placementSquare(r, 20), walls)).toBeLessThan(TOL)
  })

  it("DS-10: наружный угол L из двух стен и внутренний угол — не цели диагонального прилипания", () => {
    // sceneL: стены (0,0)-(300,0) и (0,0)-(0,300), толщина 20; наружный угол (−10, −10), внутренний (10, 10).
    // Курсоры в дальней части зоны угла торца (по 8 см от плоскости торца и от грани, зона 10 см): у свободного
    // торца одиночной стены они дают диагональ (контроль), у стыка двух стен — нет.
    const horizontalAlone = [W(0, 0, 300, 0, 20)]
    expectCorner(start({ x: -8, y: -18 }, horizontalAlone), { x: -10, y: -10 }, { x: 0, y: -1 }, 20, rect(-20, -30, 0, -10))
    const verticalAlone = [W(0, 0, 0, 300, 20)]
    expectCorner(start({ x: -18, y: -8 }, verticalAlone), { x: -10, y: -10 }, { x: -1, y: 0 }, 20, rect(-30, -20, -10, 0))
    expectNotCorner(start({ x: -8, y: -18 }, sceneL()))
    expectNotCorner(start({ x: -18, y: -8 }, sceneL()))
    // и сама биссектриса снаружи угла, как в прежнем сценарии
    expectNotCorner(start({ x: -14, y: -14 }, sceneL()))
    const inner = start({ x: 14, y: 14 }, sceneL())
    expectNotCorner(inner)
    expect(inner.source).toBe("wall")
  })

  it("DS-11: далеко от угла прилипания нет — сетка", () => {
    const r = start({ x: 60, y: 60 }, A())
    expect(r.source).toBe("grid")
    expectPoint(r.point, 60, 60)
  })

  it("DS-12: вершина нарушила бы проём — диагонали нет", () => {
    // стена D над квадратом [0, 20] × [10, 30] (касание грани y = 30), проём на D охватывает x ∈ [−10, 80]
    const walls = [wid(-100, 0, 0, 0, "A"), wid(-50, 40, 150, 40, "D")]
    const opening = door("D", "a", 40)
    expectCorner(start({ x: 8, y: 18 }, walls), { x: 10, y: 10 }, { x: 0, y: 1 }, 20, rect(0, 10, 20, 30))
    const r = start({ x: 8, y: 18 }, walls, 20, 1, [opening])
    expectNotCorner(r)
  })

  it("DS-13: превью — от диагонального начала перпендикулярно стене, длина откладывается от линии грани", () => {
    const walls = A()
    const snap = start({ x: 8, y: 18 }, walls)
    const ref = startRefOf(snap)
    expect(ref).not.toBeNull()
    const seg = chainSegment({
      start: snap.point,
      ref,
      raw: { x: 12, y: 90 },
      walls,
      radiusCm: R(),
      gridStepCm: GRID,
      thicknessCm: 20,
      ortho: true,
      typedAngleDeg: null,
      typedLengthCm: 504,
    })
    expect(seg.dir).not.toBeNull()
    expectPoint(seg.dir ?? { x: NaN, y: NaN }, 0, 1)
    // 504 — внутренний размер: от линии грани y = 10, начало сегмента на этой линии
    expectPoint(seg.end, 10, 514)
    // опора — грань: перпендикуляр наружу, угол к грани 90° (а не 180° к лучу внутрь стены, как у торца)
    expect(ref?.kind).toBe("face")
    expectPoint(ref?.normal ?? { x: NaN, y: NaN }, 0, 1)
    expect(seg.angleDeg).toBeCloseTo(90, 6)
  })

  it("DS-13b: от диагонального начала орто не притягивает к оси стены (как у торца), только перпендикуляр", () => {
    const walls = A()
    const snap = start({ x: 8, y: 18 }, walls)
    const seg = chainSegment({
      start: snap.point,
      ref: startRefOf(snap),
      raw: { x: 60, y: 17 }, // почти параллельно A (≈ 8° к оси), в допуске 15° у опоры-торца
      walls,
      radiusCm: R(),
      gridStepCm: GRID,
      thicknessCm: 20,
      ortho: true,
      typedAngleDeg: null,
      typedLengthCm: null,
    })
    expect(seg.dir).not.toBeNull()
    expect(seg.dir?.y ?? 0).toBeGreaterThan(0.1) // направление не прижато к (1, 0)
  })

  it("DS-14: для второй вершины цепочки диагонали нет (прежние правила)", () => {
    const walls = A()
    const base = {
      walls,
      radiusCm: R(),
      gridStepCm: GRID,
      thicknessCm: 20,
      typedAngleDeg: null,
      typedLengthCm: null,
    }
    const free = chainSegment({ ...base, start: { x: 100, y: 100 }, ref: null, raw: { x: 8, y: 18 }, ortho: false })
    expectNotCorner(free.snap)
    const ray = chainSegment({ ...base, start: { x: 10, y: 100 }, ref: null, raw: { x: 8, y: 18 }, ortho: true })
    expectNotCorner(ray.snap)
  })

  it("DS-15: независимо от ориентации сцены — повороты на 90° и зеркала", () => {
    const rot90 = (p: Point): Point => ({ x: -p.y, y: p.x })
    const turn = (deg: number) => (p: Point): Point => {
      const c = Math.cos((deg * Math.PI) / 180)
      const s = Math.sin((deg * Math.PI) / 180)
      return { x: p.x * c - p.y * s, y: p.x * s + p.y * c }
    }
    const transforms: [string, (p: Point) => Point][] = [
      ["identity", (p) => p],
      ["rot30", turn(30)],
      ["rot60", turn(60)],
      ["rot135", turn(135)],
      ["rot90", rot90],
      ["rot180", (p) => rot90(rot90(p))],
      ["rot270", (p) => rot90(rot90(rot90(p)))],
      ["mirror-x", (p) => ({ x: -p.x, y: p.y })],
      ["mirror-y", (p) => ({ x: p.x, y: -p.y })],
    ]
    for (const [name, tf] of transforms) {
      const a = tf({ x: -100, y: 0 })
      const b = tf({ x: 0, y: 0 })
      const walls = [W(a.x, a.y, b.x, b.y, 20)]
      const r = start(tf({ x: 8, y: 18 }), walls)
      const v = tf({ x: 10, y: 10 })
      const n = tf({ x: 0, y: 1 })
      const sq = rect(0, 10, 20, 30).map(tf)
      expect(targetOf(r), name).toBe("corner")
      expectCorner(r, v, n, 20, sq)
      // зона считается в системе стены (по каждой оси от угла, локально K = (0, 10)), а не по осям мира
      expectCorner(start(tf({ x: 9.5, y: 19.5 }), walls), v, n, 20, sq)
      expectCorner(start(tf({ x: 5, y: 15 }), walls), v, n, 20, sq) // половина зоны включительно
      expectNotCorner(start(tf({ x: 4.99, y: 15 }), walls)) // ближняя часть — грань заподлицо
      expectNotCorner(start(tf({ x: 5, y: 14.99 }), walls))
      expectNotCorner(start(tf({ x: 10.5, y: 19.5 }), walls)) // за зоной вдоль оси
      expectNotCorner(start(tf({ x: 9.5, y: 20.5 }), walls)) // за зоной поперёк
    }
  })

  it("DS-16: свободный торец — начало a стены (стена задана в обратном направлении)", () => {
    const walls = [W(0, 0, -100, 0, 20)]
    const r = start({ x: 8, y: 18 }, walls)
    expectCorner(r, { x: 10, y: 10 }, { x: 0, y: 1 }, 20, rect(0, 10, 20, 30))
    expect(maxOverlap(placementSquare(r, 20), walls)).toBeLessThan(TOL)
    const r2 = start({ x: 8, y: -18 }, walls)
    expectCorner(r2, { x: 10, y: -10 }, { x: 0, y: -1 }, 20, rect(0, -30, 20, -10))
  })

  it("DS-17: T-прилипание к середине грани не меняется", () => {
    const r = start({ x: -50, y: 14 }, A())
    expect(r.source).toBe("wall")
    expect(targetOf(r)).toBe("face")
    expectPoint(r.point, -50, 10)
  })

  it("DS-18: нулевая стена рядом не мешает и не даёт диагонали сама", () => {
    const walls = [W(0, 0, 0, 0, 20), ...A()]
    expectCorner(start({ x: 8, y: 18 }, walls), { x: 10, y: 10 }, { x: 0, y: 1 }, 20, rect(0, 10, 20, 30))
    const onlyDegenerate = start({ x: 8, y: 18 }, [W(0, 0, 0, 0, 20)])
    expectNotCorner(onlyDegenerate)
  })

  it("INV-1: входные стены и проёмы не изменяются", () => {
    const walls = deepFreeze([wid(-100, 0, 0, 0, "A"), wid(-50, 40, 150, 40, "D")])
    const doorways = deepFreeze([door("D", "a", 40)])
    expect(() => start({ x: 8, y: 18 }, walls, 20, 1, doorways)).not.toThrow()
    expect(() => start({ x: 8, y: -18 }, walls)).not.toThrow()
  })
})

describe("DS: границы зоны и квадранта", () => {
  const V = { x: 10, y: 10 }
  const N = { x: 0, y: 1 }
  const corner20 = (r: VertexSnap): void => expectCorner(r, V, N, 20, rect(0, 10, 20, 30))

  it("ближняя часть квадранта — прежняя грань заподлицо с торцом (как SNAP-END-3: 4 см от угла по каждой оси)", () => {
    expectFlushFace(start({ x: 4, y: 14 }, A()))
    expectFlushFace(start({ x: 4.99, y: 18 }, A()))
    expectFlushFace(start({ x: 8, y: 14.99 }, A()))
    // и при отдалённом виде (SNAP-SCALE-1: зона 24 см, половина зоны 12 см)
    expectFlushFace(start({ x: 4, y: 14 }, A(), 20, 0.25))
  })

  it("половина зоны включительно по каждой оси: 5 см — диагональ, 4.99 см — грань", () => {
    corner20(start({ x: 5, y: 18 }, A()))
    corner20(start({ x: 8, y: 15 }, A()))
    expectFlushFace(start({ x: 4.99, y: 18 }, A()))
    expectFlushFace(start({ x: 8, y: 14.99 }, A()))
  })

  it("на плоскости торца x = 0 и чуть за ней — грань заподлицо (ближняя часть)", () => {
    expectFlushFace(start({ x: 0, y: 18 }, A()))
    expectFlushFace(start({ x: 0.01, y: 18 }, A()))
  })

  it("на линии грани y = 10 — полоса, продолжение; чуть за гранью — грань заподлицо", () => {
    const on = start({ x: 6, y: 10 }, A())
    expect(targetOf(on)).toBe("cap")
    expectPoint(on.point, 10, 0)
    expectFlushFace(start({ x: 6, y: 10.01 }, A()))
  })

  it("граница зоны по каждой оси: Z = max(радиус 6, полутолщина 10) = 10 включительно", () => {
    corner20(start({ x: 10, y: 18 }, A()))
    corner20(start({ x: 8, y: 20 }, A()))
    corner20(start({ x: 10, y: 20 }, A()))
  })

  it("за границей зоны на каждой оси диагонали нет — сетка", () => {
    const farAlong = start({ x: 16, y: 18 }, A())
    expect(farAlong.source).toBe("grid")
    const farAcross = start({ x: 8, y: 26 }, A())
    expect(farAcross.source).toBe("grid")
  })

  it("зона зависит от толщины новой стены: Z = 20, половина зоны 10 — (15, 25) диагональ при 40 см и сетка при 20 см", () => {
    expectCorner(start({ x: 15, y: 25 }, A(), 40), { x: 20, y: 10 }, N, 40, rect(0, 10, 40, 50))
    const thin = start({ x: 15, y: 25 }, A(), 20)
    expect(thin.source).toBe("grid")
    // половина зоны при 40 см — 10 см включительно
    expectCorner(start({ x: 10, y: 25 }, A(), 40), { x: 20, y: 10 }, N, 40, rect(0, 10, 40, 50))
    expectNotCorner(start({ x: 9.9, y: 25 }, A(), 40))
    expectNotCorner(start({ x: 15, y: 19.9 }, A(), 40))
  })

  it("зона зависит от масштаба: при zoom 0.25 радиус 24 см — Z = 24, половина зоны 12 см", () => {
    const z = (p: Point): VertexSnap => start(p, A(), 20, 0.25)
    corner20(z({ x: 20, y: 30 }))
    corner20(z({ x: 12, y: 30 }))
    corner20(z({ x: 20, y: 22 }))
    expectNotCorner(z({ x: 11.9, y: 30 }))
    expectNotCorner(z({ x: 20, y: 21.9 }))
  })

  it("DS-B7: сразу за границей зоны (+0.5 см) диагонали нет — по обеим осям, при любой толщине и масштабе", () => {
    expectNotCorner(start({ x: 10.5, y: 18 }, A()))
    expectNotCorner(start({ x: 8, y: 20.5 }, A()))
    expectNotCorner(start({ x: 20.5, y: 25 }, A(), 40))
    expectNotCorner(start({ x: 15, y: 30.5 }, A(), 40))
    expectNotCorner(start({ x: 24.5, y: 30 }, A(), 20, 0.25))
    expectNotCorner(start({ x: 20, y: 34.5 }, A(), 20, 0.25))
    // и по ту же границу изнутри — диагональ
    expectCorner(start({ x: 20, y: 30 }, A(), 40), { x: 20, y: 10 }, N, 40, rect(0, 10, 40, 50))
    corner20(start({ x: 24, y: 30 }, A(), 20, 0.25))
    corner20(start({ x: 20, y: 34 }, A(), 20, 0.25))
  })

  it("DS-B8: курсор вне зоны, но квадрат по сетке касается стены — диагонали нет (прилипание к стене по прежним правилам)", () => {
    // сетка (10, 10): квадрат [0, 20] × [0, 20] касается тела A по x = 0; курсор в 14 см от угла вдоль оси
    expectNotCorner(start({ x: 14, y: 14 }, A()))
    // сетка (0, 20): квадрат [−10, 10] × [10, 30] касается A по y = 10; курсор в 14 см от грани
    expectNotCorner(start({ x: 4, y: 24 }, A()))
    // дальняя часть по обеим осям, но за зоной вдоль оси, с касающимся квадратом по сетке
    expectNotCorner(start({ x: 10.5, y: 18 }, A()))
    expectNotCorner(start({ x: 8, y: 20.5 }, A()))
    // то же с отрицательной стороны и со стеной, заданной в обратном направлении
    expectNotCorner(start({ x: 14, y: -14 }, A()))
    expectNotCorner(start({ x: 14, y: 14 }, [W(0, 0, -100, 0, 20)]))
  })

  it("DS-B9: форма зоны — по каждой оси от угла (по спецификации), а не по евклидову расстоянию", () => {
    // 8 см по обеим осям от угла (0, 10): по каждой оси в зоне 10, евклидово расстояние 11.3 больше
    corner20(start({ x: 8, y: 18 }, A()))
  })
})