import { describe, expect, it } from "vitest"
import { chainSegment } from "./wall-chain"
import { startRefOf } from "./wall-angle"
import { placementSquare, snapRadiusCm, snapStartVertex } from "./wall-snap"
import type { VertexSnap } from "./wall-snap"
import type { Point, Wall, WallElement } from "./types"
import { W, deepFreeze, expectPoint, expectSameVertices, maxOverlap, sceneL } from "./wall-snap.test-utils"
import { door, w as wid } from "./doorway/doorway.test-utils"

// change widen-corner-snap-window (test-plan.md, CW-*): окно диагонального прилипания к углу свободного торца
// равно области квадрата установки — строго за плоскостью торца и за линией грани, не дальше толщины новой
// стены T от угла по каждой оси включительно; от радиуса привязки и масштаба не зависит
// (wall-drawing, «Диагональное прилипание к углу свободного торца»).
// Сцена A: стена (−100,0)→(0,0), толщина 20, свободный торец на x = 0, грани y = ±10. Угол K = (0, 10),
// курсор (a, 10 + b): a — за плоскостью торца, b — за линией грани. Эталоны выведены из спецификации:
// вершина (10, 10), квадрат [0, 20] × [10, 30].

const GRID = 10
const R = (zoom = 1): number => snapRadiusCm(zoom)
const TOL = 1e-6

const A = (): Wall[] => [W(-100, 0, 0, 0, 20)]

const start = (p: Point, walls: Wall[] = A(), t = 20, zoom = 1, doorways: readonly WallElement[] = []): VertexSnap =>
  snapStartVertex(p, walls, R(zoom), GRID, t, doorways)

const rect = (x0: number, y0: number, x1: number, y1: number): Point[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
]

const NAN: Point = { x: NaN, y: NaN }

function expectCorner(r: VertexSnap, vertex: Point, normal: Point, size: number, square: Point[], label = ""): void {
  expect(r.source, label).toBe("wall")
  expect(r.target, label).toBe("corner")
  expectPoint(r.point, vertex.x, vertex.y)
  expectPoint(r.normal ?? NAN, normal.x, normal.y)
  expectSameVertices(placementSquare(r, size), square)
}

const corner20 = (r: VertexSnap, label = ""): void => expectCorner(r, { x: 10, y: 10 }, { x: 0, y: 1 }, 20, rect(0, 10, 20, 30), label)

const notCorner = (r: VertexSnap, label = ""): void => expect(r.target, label).not.toBe("corner")

describe("CW-1: внутри окна — диагональное прилипание, вершина не зависит от положения курсора", () => {
  it("бывшая ближняя часть квадранта и вся область квадрата установки даёт одну и ту же вершину и квадрат", () => {
    const inside: Point[] = [
      { x: 4, y: 14 },
      { x: 4.99, y: 18 },
      { x: 8, y: 14.99 },
      { x: 0.5, y: 18 },
      { x: 8, y: 10.5 },
      { x: 5, y: 15 },
      { x: 4.99, y: 15 },
      { x: 5, y: 14.99 },
      { x: 10, y: 20 },
      { x: 15, y: 25 },
      { x: 19.9, y: 29.9 },
    ]
    for (const p of inside) corner20(start(p), `(${p.x}, ${p.y})`)
  })

  it("диагональное прилипание приоритетнее грани заподлицо той же стены (в окне вершина на линии грани за торцом, а не (−10, 10))", () => {
    const r = start({ x: 4, y: 14 })
    expect(r.target).toBe("corner")
    expectPoint(r.point, 10, 10)
  })
})

describe("CW-2: верхняя граница окна — T включительно, сразу за ней диагонали нет", () => {
  it("на границе T по каждой оси и в дальнем углу окна — диагональ", () => {
    corner20(start({ x: 20, y: 18 }))
    corner20(start({ x: 8, y: 30 }))
    corner20(start({ x: 20, y: 30 }))
  })

  it("на 0.5 см за границей по любой из осей — не диагональ, сетка", () => {
    for (const p of [
      { x: 20.5, y: 18 },
      { x: 8, y: 30.5 },
      { x: 20.5, y: 30.5 },
      { x: 30, y: 18 },
      { x: 8, y: 40 },
    ]) {
      const r = start(p)
      notCorner(r, `(${p.x}, ${p.y})`)
      expect(r.source, `(${p.x}, ${p.y})`).toBe("grid")
    }
  })
})

describe("CW-3: нижняя граница окна — строго за плоскостью торца и строго за линией грани", () => {
  it("на плоскости торца под гранью — грань заподлицо с торцом, не диагональ", () => {
    for (const p of [
      { x: 0, y: 18 },
      { x: 0, y: 10.5 },
      { x: -1, y: 18 },
    ]) {
      const r = start(p)
      expect(r.source).toBe("wall")
      expect(r.target).toBe("face")
      expectPoint(r.point, -10, 10)
    }
  })

  it("на линии грани за торцом — коллинеарное продолжение (торец), не диагональ", () => {
    const r = start({ x: 8, y: 10 })
    expect(r.source).toBe("wall")
    expect(r.target).toBe("cap")
    expectPoint(r.point, 10, 0)
  })

  it("чуть за плоскостью торца и чуть за линией грани — уже диагональ", () => {
    corner20(start({ x: 0.01, y: 18 }))
    corner20(start({ x: 6, y: 10.01 }))
    corner20(start({ x: 0.01, y: 10.01 }))
  })
})

describe("CW-4: окно зависит только от толщины новой стены", () => {
  const corner40 = (r: VertexSnap, label = ""): void => expectCorner(r, { x: 20, y: 10 }, { x: 0, y: 1 }, 40, rect(0, 10, 40, 50), label)

  it("T = 40: окно 40 × 40 включительно", () => {
    for (const p of [
      { x: 4, y: 14 },
      { x: 30, y: 40 },
      { x: 40, y: 50 },
      { x: 40, y: 20 },
      { x: 15, y: 25 },
    ])
      corner40(start(p, A(), 40), `(${p.x}, ${p.y})`)
  })

  it("T = 40: сразу за границей 40 см по любой оси — не диагональ", () => {
    notCorner(start({ x: 40.5, y: 30 }, A(), 40))
    notCorner(start({ x: 30, y: 50.5 }, A(), 40))
  })

  it("та же точка (30, 40) — диагональ при 40 см и не диагональ при 20 см", () => {
    corner40(start({ x: 30, y: 40 }, A(), 40))
    notCorner(start({ x: 30, y: 40 }, A(), 20))
  })

  it("существующая стена толще: окно считается от угла (грань y = 20), размер окна — толщина новой стены", () => {
    const walls = [W(-100, 0, 0, 0, 40)]
    expectCorner(start({ x: 18, y: 38 }, walls, 20), { x: 10, y: 20 }, { x: 0, y: 1 }, 20, rect(0, 20, 20, 40))
    expectCorner(start({ x: 20, y: 40 }, walls, 20), { x: 10, y: 20 }, { x: 0, y: 1 }, 20, rect(0, 20, 20, 40))
    notCorner(start({ x: 20.5, y: 38 }, walls, 20))
  })
})

describe("CW-5: окно не зависит от радиуса привязки и масштаба вида", () => {
  it("при любом масштабе — те же границы 0 < a ≤ 20, 0 < b ≤ 20", () => {
    for (const zoom of [0.25, 0.5, 1, 2, 4]) {
      for (const p of [
        { x: 4, y: 14 },
        { x: 15, y: 25 },
        { x: 20, y: 30 },
        { x: 20, y: 18 },
      ])
        corner20(start(p, A(), 20, zoom), `zoom ${zoom} (${p.x}, ${p.y})`)
      for (const p of [
        { x: 20.5, y: 18 },
        { x: 8, y: 30.5 },
        { x: 24, y: 30 },
        { x: 20, y: 34 },
      ])
        notCorner(start(p, A(), 20, zoom), `zoom ${zoom} (${p.x}, ${p.y})`)
    }
  })

  it("CW-5b: за окном при отдалённом виде курсор у торца — грань заподлицо с торцом, а не диагональ", () => {
    // zoom 0.25: радиус 24 см > T; курсор в 21 см за плоскостью торца и 1 см за гранью
    const r = start({ x: 21, y: 11 }, A(), 20, 0.25)
    expect(r.source).toBe("wall")
    expect(r.target).toBe("face")
    expectPoint(r.point, -10, 10)
  })
})

describe("CW-6: окно считается в системе стены — повороты, зеркала, обратное направление, обе стороны", () => {
  const turn = (deg: number) => (p: Point): Point => {
    const c = Math.cos((deg * Math.PI) / 180)
    const s = Math.sin((deg * Math.PI) / 180)
    return { x: p.x * c - p.y * s, y: p.x * s + p.y * c }
  }
  const rot90 = turn(90)
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
  const inWindow: Point[] = [
    { x: 4, y: 14 },
    { x: 0.01, y: 18 },
    { x: 20, y: 18 },
    { x: 8, y: 30 },
    { x: 20, y: 30 },
    { x: 6, y: 10.01 },
  ]
  const outside: Point[] = [
    { x: 0, y: 18 },
    { x: 8, y: 10 },
    { x: 20.5, y: 18 },
    { x: 8, y: 30.5 },
    { x: -4, y: 14 },
  ]

  it("первый угол торца (грань y = 10): границы 0 и T в любой ориентации сцены", () => {
    for (const [name, tf] of transforms) {
      const a = tf({ x: -100, y: 0 })
      const b = tf({ x: 0, y: 0 })
      const walls = [W(a.x, a.y, b.x, b.y, 20)]
      const v = tf({ x: 10, y: 10 })
      const n = normalOf(tf, { x: 0, y: 1 })
      const sq = rect(0, 10, 20, 30).map(tf)
      for (const p of inWindow) expectCorner(start(tf(p), walls), v, n, 20, sq, `${name} (${p.x}, ${p.y})`)
      for (const p of outside) notCorner(start(tf(p), walls), `${name} (${p.x}, ${p.y})`)
    }
  })

  // нормаль — вектор: для поворотов/зеркал берём разность образов
  function normalOf(tf: (p: Point) => Point, n: Point): Point {
    const o = tf({ x: 0, y: 0 })
    const m = tf(n)
    return { x: m.x - o.x, y: m.y - o.y }
  }

  it("второй угол торца (грань y = −10) — те же границы", () => {
    const sq = rect(0, -30, 20, -10)
    const v = { x: 10, y: -10 }
    const n = { x: 0, y: -1 }
    for (const p of [
      { x: 4, y: -14 },
      { x: 0.01, y: -18 },
      { x: 20, y: -18 },
      { x: 8, y: -30 },
      { x: 20, y: -30 },
    ])
      expectCorner(start(p), v, n, 20, sq, `(${p.x}, ${p.y})`)
    for (const p of [
      { x: 0, y: -18 },
      { x: 8, y: -10 },
      { x: 20.5, y: -18 },
      { x: 8, y: -30.5 },
    ])
      notCorner(start(p), `(${p.x}, ${p.y})`)
  })

  it("стена задана в обратном направлении (свободный торец — начало a): те же границы", () => {
    const walls = [W(0, 0, -100, 0, 20)]
    for (const p of inWindow) corner20(start(p, walls), `(${p.x}, ${p.y})`)
    for (const p of outside) notCorner(start(p, walls), `(${p.x}, ${p.y})`)
  })

  it("вертикальная стена: окно за её нижним торцом", () => {
    // стена (0, 0)→(0, 200): свободный торец a на y = 0, наружу вдоль оси — y < 0; грань x = 10
    const walls = [W(0, 0, 0, 200, 20)]
    expectCorner(start({ x: 14, y: -4 }, walls), { x: 10, y: -10 }, { x: 1, y: 0 }, 20, rect(10, -20, 30, 0))
    expectCorner(start({ x: 30, y: -20 }, walls), { x: 10, y: -10 }, { x: 1, y: 0 }, 20, rect(10, -20, 30, 0))
    notCorner(start({ x: 30.5, y: -8 }, walls))
    notCorner(start({ x: 14, y: 0 }, walls))
  })
})

describe("CW-7: окно не отменяет прежние условия прилипания", () => {
  it("CW-7a: курсор в полосе стены за торцом — коллинеарное продолжение", () => {
    const r = start({ x: 5, y: 4 })
    expect(r.target).toBe("cap")
    expectPoint(r.point, 10, 0)
  })

  it("CW-7b: курсор под гранью, не за плоскостью торца — грань заподлицо с торцом", () => {
    for (const p of [
      { x: -4, y: 14 },
      { x: -10, y: 18 },
    ]) {
      const r = start(p)
      expect(r.target).toBe("face")
      expectPoint(r.point, -10, 10)
    }
  })

  it("CW-7c: торец закрыт телом другой стены — диагонали нет, глубоко в окне тоже", () => {
    const walls = [W(-100, 0, 0, 0, 20), W(0, 0, 100, 0, 20)]
    for (const p of [
      { x: 4, y: 14 },
      { x: 15, y: 25 },
    ]) {
      const r = start(p, walls)
      notCorner(r, `(${p.x}, ${p.y})`)
      if (r.source === "wall") expect(maxOverlap(placementSquare(r, 20), walls)).toBeLessThan(TOL)
    }
    // что именно получается вместо отклонённого угла — прежние правила: грань второй стены / сетка
    const near = start({ x: 4, y: 14 }, walls)
    expect(near.target).toBe("face")
    expectPoint(near.point, 4, 10)
    expect(start({ x: 15, y: 25 }, walls).source).toBe("grid")
  })

  it("CW-7d: квадрат налагался бы на тело другой стены — диагонали нет, наложения нет", () => {
    // тело x ∈ [10, 100], y ∈ [20, 30] заходит в квадрат [0, 20] × [10, 30]
    const blocker = W(10, 25, 100, 25, 10)
    corner20(start({ x: 12, y: 19 }, A()))
    const walls = [...A(), blocker]
    for (const p of [
      { x: 12, y: 19 },
      { x: 4, y: 14 },
      { x: 18, y: 12 },
    ]) {
      const r = start(p, walls)
      notCorner(r, `(${p.x}, ${p.y})`)
      if (r.source === "wall") expect(maxOverlap(placementSquare(r, 20), walls)).toBeLessThan(TOL)
    }
    // вместо отклонённого угла — прежние правила: грань соседа (квадрат под ним) или грань A заподлицо с торцом
    for (const p of [
      { x: 12, y: 19 },
      { x: 18, y: 12 },
    ]) {
      const r = start(p, walls)
      expect(r.target).toBe("face")
      expectPoint(r.point, 20, 20)
      expectPoint(r.normal ?? NAN, 0, -1)
    }
    const flush = start({ x: 4, y: 14 }, walls)
    expect(flush.target).toBe("face")
    expectPoint(flush.point, -10, 10)
  })

  it("CW-7e: стык двух стен (наружный и внутренний угол L) — не цель, в окне относительно торца тоже", () => {
    const walls = sceneL()
    for (const p of [
      { x: -4, y: -14 },
      { x: -14, y: -4 },
      { x: -15, y: -15 },
      { x: -18, y: -8 },
      { x: 14, y: 14 },
      { x: 15, y: 15 },
    ])
      notCorner(start(p, walls), `(${p.x}, ${p.y})`)
  })

  it("CW-7f: вершина нарушила бы проём — диагонали нет", () => {
    const walls = [wid(-100, 0, 0, 0, "A"), wid(-50, 40, 150, 40, "D")]
    const opening = door("D", "a", 40)
    for (const p of [
      { x: 8, y: 18 },
      { x: 4, y: 14 },
    ]) {
      corner20(start(p, walls), `(${p.x}, ${p.y})`)
      notCorner(start(p, walls, 20, 1, [opening]), `(${p.x}, ${p.y})`)
    }
  })

  it("CW-7g: для второй вершины цепочки диагонали нет, курсор в окне", () => {
    const base = { walls: A(), radiusCm: R(), gridStepCm: GRID, thicknessCm: 20, typedAngleDeg: null, typedLengthCm: null }
    for (const raw of [
      { x: 4, y: 14 },
      { x: 15, y: 25 },
    ]) {
      notCorner(chainSegment({ ...base, start: { x: 100, y: 100 }, ref: null, raw, ortho: false }).snap)
      notCorner(chainSegment({ ...base, start: { x: 10, y: 100 }, ref: null, raw, ortho: true }).snap)
    }
  })

  it("нулевая стена рядом не мешает и не даёт диагонали сама", () => {
    corner20(start({ x: 15, y: 25 }, [W(0, 0, 0, 0, 20), ...A()]))
    notCorner(start({ x: 15, y: 25 }, [W(0, 0, 0, 0, 20)]))
  })
})

describe("CW-12: угол и цель другой стены — выбор по ближайшей точке приставления", () => {
  // вторая стена (40, 0)→(40, 100) толщиной 10: грань x = 35; масштаб 0.25 (радиус 24 см)
  const two = (): Wall[] => [...A(), W(40, 0, 40, 100, 10)]
  const zoom = 0.25

  it("курсор ближе к углу торца A, чем к грани второй стены — угол", () => {
    corner20(start({ x: 20, y: 20 }, two(), 20, zoom))
    corner20(start({ x: 18, y: 14 }, two(), 20, zoom))
    corner20(start({ x: 14, y: 14 }, two(), 20, zoom))
  })

  it("курсор в окне, но ближе к грани второй стены — прилипание к этой грани, а не угол", () => {
    const r = start({ x: 20, y: 28 }, two(), 20, zoom)
    expect(r.source).toBe("wall")
    expect(r.target).toBe("face")
    expectPoint(r.point, 35, 28)
    expectPoint(r.normal ?? NAN, -1, 0)
  })

  it("результат не зависит от порядка стен в массиве", () => {
    const reversed = [...two()].reverse()
    corner20(start({ x: 20, y: 20 }, reversed, 20, zoom))
    const r = start({ x: 20, y: 28 }, reversed, 20, zoom)
    expect(r.target).toBe("face")
    expectPoint(r.point, 35, 28)
  })
})

describe("CW-8: развёртка по окну — инварианты", () => {
  it("диагональ ⇔ 0 < a ≤ 20 и 0 < b ≤ 20; в окне результат один и тот же и не налагается на стену", () => {
    const walls = A()
    let corners = 0
    for (let a = -5; a <= 30; a += 0.5)
      for (let b = -5; b <= 30; b += 0.5) {
        const r = start({ x: a, y: 10 + b }, walls)
        const inside = a > 0 && a <= 20 && b > 0 && b <= 20
        expect(r.target === "corner", `(${a}, ${10 + b})`).toBe(inside)
        if (!inside) continue
        corners++
        corner20(r, `(${a}, ${10 + b})`)
        expect(maxOverlap(placementSquare(r, 20), walls)).toBeLessThan(TOL)
      }
    expect(corners).toBe(40 * 40)
  })
})

describe("CW-9: начальная вершина — квадрат по сетке касается стены", () => {
  it("курсор в окне, где квадрат по сетке касался бы стены, — диагональ (раньше грань заподлицо)", () => {
    // узел сетки (10, 10): квадрат [0, 20] × [0, 20] касается тела по x = 0
    corner20(start({ x: 14, y: 14 }))
    // узел сетки (0, 20): квадрат [−10, 10] × [10, 30] касается грани y = 10
    corner20(start({ x: 4, y: 24 }))
    // со стеной, заданной в обратном направлении, и с отрицательной стороны
    corner20(start({ x: 14, y: 14 }, [W(0, 0, -100, 0, 20)]))
    expectCorner(start({ x: 14, y: -14 }), { x: 10, y: -10 }, { x: 0, y: -1 }, 20, rect(0, -30, 20, -10))
  })

  it("курсор за окном — диагонали нет", () => {
    notCorner(start({ x: 20.5, y: 18 }))
    notCorner(start({ x: 8, y: 30.5 }))
  })
})

describe("CW-10: чистота и детерминированность", () => {
  it("входные стены и проёмы не изменяются; повторный вызов даёт тот же результат", () => {
    const walls = deepFreeze([wid(-100, 0, 0, 0, "A"), wid(-50, 40, 150, 40, "D")])
    const doorways = deepFreeze([door("D", "a", 40)])
    const first = start({ x: 15, y: 25 }, walls, 20, 1, doorways)
    const again = start({ x: 15, y: 25 }, walls, 20, 1, doorways)
    expect(again.point).toEqual(first.point)
    expect(again.target).toEqual(first.target)
    const free = deepFreeze(A())
    const r1 = start({ x: 4, y: 14 }, free)
    const r2 = start({ x: 4, y: 14 }, free)
    expect(r2.point).toEqual(r1.point)
    expect(r2.target).toBe("corner")
  })
})

describe("CW-11: превью цепочки от диагонального начала", () => {
  it("начало из дальнего угла окна и из ближнего — одна и та же точка, опора и сегмент", () => {
    const walls = A()
    const far = start({ x: 18, y: 28 }, walls)
    const near = start({ x: 2, y: 12 }, walls)
    expect(far.target).toBe("corner")
    expectPoint(far.point, near.point.x, near.point.y)
    const segment = (snap: VertexSnap): ReturnType<typeof chainSegment> =>
      chainSegment({
        start: snap.point,
        ref: startRefOf(snap),
        raw: { x: 12, y: 90 },
        walls,
        radiusCm: R(),
        gridStepCm: GRID,
        thicknessCm: 20,
        ortho: true,
        typedAngleDeg: null,
        typedLengthCm: 504,
      })
    const sFar = segment(far)
    const sNear = segment(near)
    expectPoint(sFar.end, sNear.end.x, sNear.end.y)
    expectPoint(sFar.end, 10, 514)
    expect(sFar.angleDeg).toBeCloseTo(90, 6)
    expect(startRefOf(far)?.kind).toBe("face")
  })
})
