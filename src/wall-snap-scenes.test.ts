import { describe, expect, it } from "vitest"
import { snapRadiusCm, snapVertex } from "./wall-geometry"
import type { VertexSnap } from "./wall-geometry"
import type { Point, Wall } from "./types"
import {
  W,
  deepFreeze,
  expectPoint,
  maxOverlap,
  sceneAcute,
  sceneL,
  sceneLX,
  sceneN,
  sceneS,
  sceneT,
  squareOnNormal,
  strictlyInsideAnyBody,
} from "./wall-snap.test-utils"

// change fix-wall-snap-overlap: привязка с учётом всей сцены (test-plan.md).
// snapVertex импортируется из ./wall-geometry — реэкспорт сохраняется (design D8),
// поэтому поведение наблюдаемо и до появления модуля wall-snap.

const GRID = 10
const R = (zoom: number): number => snapRadiusCm(zoom)

const snap = (p: Point, walls: Wall[], zoom = 1, t = 20, orthoFrom?: Point): VertexSnap =>
  snapVertex(p, walls, R(zoom), GRID, t, orthoFrom)

function expectWall(r: VertexSnap, x: number, y: number, nx?: number, ny?: number): void {
  expect(r.source).toBe("wall")
  expectPoint(r.point, x, y)
  if (nx !== undefined && ny !== undefined) {
    expect(r.normal).toBeDefined()
    expectPoint(r.normal ?? { x: NaN, y: NaN }, nx, ny)
  }
}

// квадрат прилипшего результата по нормали не налагается на тела, вершина не внутри тела
function expectNoOverlap(r: VertexSnap, walls: Wall[], t: number): void {
  expect(r.normal).toBeDefined()
  const n = r.normal ?? { x: 0, y: 0 }
  expect(Math.hypot(n.x, n.y)).toBeCloseTo(1, 9)
  expect(maxOverlap(squareOnNormal(r.point, n, t), walls)).toBeLessThanOrEqual(1e-6)
  expect(strictlyInsideAnyBody(r.point, walls)).toBe(false)
}

describe("Внутренний угол", () => {
  it("SNAP-IN-1: ядро стыка — прилипание к грани вплотную к соседу, тай-брейк по порядку массива", () => {
    const [a, b] = sceneL()
    expectWall(snap({ x: 5, y: 5 }, [a, b]), 20, 10, 0, 1)
    expectWall(snap({ x: 5, y: 5 }, [b, a]), 10, 20, 1, 0)
  })

  it("SNAP-IN-2: биссектриса вне тел — квадрат не заходит в соседа", () => {
    expectWall(snap({ x: 12, y: 12 }, sceneL()), 20, 10, 0, 1)
  })

  it("SNAP-IN-3: граница сжатия у вогнутой вершины включительно; дальше угла — без изменений", () => {
    const walls = sceneL()
    expectWall(snap({ x: 19, y: 14 }, walls), 20, 10)
    expectWall(snap({ x: 20, y: 14 }, walls), 20, 10)
    expectWall(snap({ x: 40, y: 14 }, walls), 40, 10)
  })

  it("SNAP-IN-THICK-1: разные толщины — вплотную к толстой стене при любой толщине новой", () => {
    const walls = sceneLX() // внутренний угол (20,10)
    expectWall(snap({ x: 24, y: 12 }, walls, 1, 10), 25, 10, 0, 1)
    expectWall(snap({ x: 40, y: 14 }, walls, 1, 60), 50, 10, 0, 1)
  })
})

describe("Наружный угол", () => {
  it("SNAP-OUT-1: наружная грань B до края — продолжение A за угол", () => {
    const walls = sceneL()
    expectWall(snap({ x: -15, y: -5 }, walls), -10, 0, -1, 0)
    expectWall(snap({ x: -15, y: -8 }, walls), -10, 0, -1, 0)
    expectWall(snap({ x: -15, y: 0 }, walls), -10, 0, -1, 0)
  })

  it("SNAP-OUT-2: наружная грань A до края — продолжение B за угол", () => {
    expectWall(snap({ x: -5, y: -15 }, sceneL()), 0, -10, 0, -1)
  })

  it("SNAP-OUT-3: снаружи угла вне зон граней — нет прилипания углом к углу", () => {
    expect(snap({ x: -24, y: -26 }, sceneL())).toEqual({ point: { x: -20, y: -30 }, source: "grid" })
  })
})

describe("Стык и торцы", () => {
  it("SNAP-JOINT-1: курсор в теле у стыка — не точка оси стыка, а открытая грань", () => {
    const r = snap({ x: 3, y: -3 }, sceneL())
    expectWall(r, 3, -10, 0, -1)
    expect(r.point).not.toEqual({ x: 0, y: 0 })
  })

  it("SNAP-JOINT-2: отдалённый вид — зона стыка не перехватывает прилипание к грани", () => {
    const r = snap({ x: -12, y: -12 }, sceneL(), 0.25)
    expectWall(r, 0, -10, 0, -1)
  })

  it("SNAP-CAP-CLOSED-1: закрытый торец C (T-стык) не даёт продолжения", () => {
    const r = snap({ x: 150, y: 5 }, sceneT())
    expectWall(r, 130, 10, 0, 1) // равные участки — меньший параметр
    expect(r.point).not.toEqual({ x: 150, y: 10 })
  })

  it("SNAP-CAP-N1: свободный торец — продолжение на оси с наружной нормалью торца", () => {
    const r = snap({ x: 106, y: 3 }, sceneS())
    expect(r).toEqual({ point: { x: 100, y: 0 }, source: "wall" })
    expectWall(r, 100, 0, 1, 0)
  })

  it("SNAP-SCALE-1: угловое прилипание у торца при отдалённом виде", () => {
    expectWall(snap({ x: 104, y: -14 }, sceneS(), 0.25), 90, -10, 0, -1)
  })

  it("SNAP-SCALE-2: выбор грань/торец одинаков при масштабах 0.25, 0.6, 1, 4", () => {
    for (const z of [0.25, 0.6, 1, 4]) {
      expectWall(snap({ x: 104, y: -14 }, sceneS(), z), 90, -10, 0, -1)
      expectWall(snap({ x: 104, y: 6 }, sceneS(), z), 100, 0, 1, 0)
    }
  })

  it("SNAP-SCALE-3: граница полосы при R > h — ровно на полосе торец, за ней грань", () => {
    expectWall(snap({ x: 104, y: -10 }, sceneS(), 0.25), 100, 0, 1, 0)
    expectWall(snap({ x: 104, y: -10.001 }, sceneS(), 0.25), 90, -10, 0, -1)
  })

  it("SNAP-END-5: край участка у свободного торца — сжатие на полутолщину новой стены", () => {
    expectWall(snap({ x: 95, y: -14 }, sceneS()), 90, -10, 0, -1)
  })
})

describe("Примыкающая стена", () => {
  it("SNAP-T-STOP-1: квадрат скользит по грани A и останавливается вплотную к C", () => {
    const walls = sceneT()
    expectWall(snap({ x: 135, y: 14 }, walls), 130, 10, 0, 1)
    expectWall(snap({ x: 125, y: 14 }, walls), 125, 10, 0, 1)
    expectWall(snap({ x: 165, y: 14 }, walls), 170, 10, 0, 1)
  })

  it("SNAP-T-STOP-2: в углу между A и C — грань C вплотную к A", () => {
    expectWall(snap({ x: 135, y: 20 }, sceneT()), 140, 20, -1, 0)
  })

  it("SNAP-NOROOM-1: просвет короче квадрата — нет прилипания, соседние грани с наложением отброшены", () => {
    expect(snap({ x: 112, y: 14 }, sceneN()).source).toBe("grid")
  })

  it("SNAP-FIT-1: просвет ровно равен стороне квадрата — единственная точка; толще — нет прилипания к A", () => {
    const walls = [W(0, 0, 300, 0), W(100, 10, 100, 200), W(130, 10, 130, 200)] // просвет [110,120]
    expectWall(snap({ x: 115, y: 13 }, walls, 1, 10), 115, 10, 0, 1)
    // 12 см: на A места нет, квадраты у граней C1/C2 (x = 110 / 120) налагаются на соседа
    expect(snap({ x: 115, y: 13 }, walls, 1, 12).source).toBe("grid")
  })

  it("SNAP-FALLBACK-1: ближняя грань целиком закрыта — дальняя грань той же стены", () => {
    const walls = [W(0, 0, 100, 0), W(0, 20, 100, 20)]
    expectWall(snap({ x: 50, y: 4 }, walls), 50, -10, 0, -1)
  })

  it("SNAP-ACUTE-1: острый угол 60° — прилипший квадрат не налагается, прилипание у грани есть", () => {
    const walls = sceneAcute()
    let stuckToA = 0
    for (let r = 2; r <= 60; r += 1)
      for (let deg = 1; deg < 60; deg += 2) {
        const a = (deg * Math.PI) / 180
        const res = snap({ x: r * Math.cos(a), y: r * Math.sin(a) }, walls)
        if (res.source !== "wall") continue
        expectNoOverlap(res, walls, 20)
        if (res.normal && Math.abs(res.normal.y - 1) < 1e-9) stuckToA++
      }
    expect(stuckToA).toBeGreaterThan(0)
  })
})

describe("Непрямые углы", () => {
  it("SNAP-ACUTE-2: острый угол 60° — квадрат у грани A вплотную к D (сжатие h + 2h·cot θ)", () => {
    // вогнутая вершина на грани A: (10√3, 10); сжатие 10 + 20·cot 60° = 10 + 20/√3
    const x = 10 * Math.sqrt(3) + 10 + 20 / Math.sqrt(3) // ≈ 38.8675
    expectWall(snap({ x: 35, y: 13 }, sceneAcute()), x, 10, 0, 1)
  })

  it("SNAP-OBTUSE-1: тупой угол 120° — сжатие ровно h (cot θ < 0 не уменьшает отступ)", () => {
    const walls = [W(0, 0, 300, 0), W(0, 0, -150, 150 * Math.sqrt(3))]
    // вогнутая вершина на грани A: (10/√3, 10); сжатие h = 10
    expectWall(snap({ x: 12, y: 13 }, walls), 10 / Math.sqrt(3) + 10, 10, 0, 1)
  })

  it("SNAP-ACUTE-3: острый угол, A в обратном направлении, новая 10 — отступ по толщине новой стены", () => {
    const walls = [W(300, 0, 0, 0), W(0, 0, 150, 150 * Math.sqrt(3))]
    // та же вогнутая вершина (10√3, 10), теперь на конце участка грани «−» в параметре A;
    // сжатие 5 + 2·5·cot 60° = 5 + 10/√3
    expectWall(snap({ x: 26, y: 12 }, walls, 1, 10), 10 * Math.sqrt(3) + 5 + 10 / Math.sqrt(3), 10, 0, 1)
  })

  it("SNAP-OBTUSE-2: тупой угол, A в обратном направлении — сжатие ровно h", () => {
    const walls = [W(300, 0, 0, 0), W(0, 0, -150, 150 * Math.sqrt(3))]
    expectWall(snap({ x: 12, y: 13 }, walls), 10 / Math.sqrt(3) + 10, 10, 0, 1)
  })

  it("SNAP-ACUTE-4: острый угол — квадрат у грани второй стены D вплотную к A", () => {
    const u = { x: 0.5, y: Math.sqrt(3) / 2 } // ось D
    const n = { x: Math.sqrt(3) / 2, y: -0.5 } // наружная нормаль внутренней грани D
    const at = (s: number, m: number): Point => ({ x: u.x * s + n.x * m, y: u.y * s + n.y * m })
    const s = 10 * Math.sqrt(3) + 10 + 20 / Math.sqrt(3)
    const expected = at(s, 10)
    expectWall(snap(at(35, 12), sceneAcute()), expected.x, expected.y, n.x, n.y)
  })
})

describe("Детерминированность", () => {
  it("SNAP-DET-3: повтор в той же точке после других точек — тот же результат с той же нормалью", () => {
    const walls = sceneL()
    const p = { x: -12, y: -12 }
    const first = snap(p, walls, 0.25)
    snap({ x: 5, y: 5 }, walls, 0.25)
    snap({ x: 150, y: 40 }, walls, 0.25)
    const again = snap(p, walls, 0.25)
    expect(again).toEqual(first)
    expect(again.normal).toEqual(first.normal)
  })
})

describe("Вершины цепочки", () => {
  it("SNAP-CHAIN-1: второй конец не уходит в точку оси стыка", () => {
    const r = snap({ x: -12, y: -12 }, sceneL(), 0.25, 20, { x: -100, y: -12 })
    expectWall(r, 0, -10)
    expect(r.point).not.toEqual({ x: 0, y: 0 })
  })

  it("SNAP-CHAIN-2: второй конец у грани при перпендикулярном подходе — последний блок без наложения", () => {
    const walls = sceneS()
    const r = snap({ x: 50, y: -13 }, walls, 1, 20, { x: 50, y: -100 })
    expectWall(r, 50, -10)
    // последний блок [p − 20·v, p], v = (0,1) — направление от начала к концу
    const p = r.point
    const block = [
      { x: p.x - 10, y: p.y - 20 },
      { x: p.x + 10, y: p.y - 20 },
      { x: p.x + 10, y: p.y },
      { x: p.x - 10, y: p.y },
    ]
    expect(maxOverlap(block, walls)).toBeLessThanOrEqual(1e-6)
  })

  it("SNAP-CHAIN-3: второй конец у свободного торца вдоль оси — последний блок без наложения", () => {
    const walls = sceneS()
    const r = snap({ x: 106, y: 0 }, walls, 1, 20, { x: 200, y: 0 })
    expectWall(r, 100, 0)
    const p = r.point // v = (−1,0): блок [p, p + 20·(1,0)]
    const block = [
      { x: p.x, y: p.y - 10 },
      { x: p.x + 20, y: p.y - 10 },
      { x: p.x + 20, y: p.y + 10 },
      { x: p.x, y: p.y + 10 },
    ]
    expect(maxOverlap(block, walls)).toBeLessThanOrEqual(1e-6)
  })
})

describe("Инвариант: квадрат не налагается на тела стен", () => {
  // окна вокруг характерных мест сцены L ∪ T(сдвиг 600): углы, стык, торцы, T-примыкание
  const walls = [...sceneL(), ...sceneT(600)]
  const windows: [number, number][] = [
    [0, 0], // ядро и внутренний угол L
    [-15, -15], // наружный угол L
    [300, 0], // свободный торец A
    [0, 300], // свободный торец B
    [750, 10], // T-примыкание
    [600, 0], // свободный торец A2
    [750, 200], // свободный торец C
  ]
  const HALF = 30
  const STEP = 3

  for (const zoom of [0.25, 1, 4])
    it(`INV-NOOVERLAP-1: масштаб ${zoom}, толщины 10/20/40`, () => {
      let total = 0
      let stuck = 0
      for (const t of [10, 20, 40])
        for (const [cx, cy] of windows)
          for (let x = cx - HALF; x <= cx + HALF; x += STEP)
            for (let y = cy - HALF; y <= cy + HALF; y += STEP) {
              const r = snap({ x, y }, walls, zoom, t)
              total++
              if (r.source !== "wall") continue
              stuck++
              expectNoOverlap(r, walls, t)
            }
      // защита от реализации «никогда не прилипать»: окна у стен, прилипание частое
      expect(stuck / total).toBeGreaterThanOrEqual(0.25)
    }, 120_000)
})

describe("Инвариант: второй конец прилипает по тем же правилам", () => {
  // «тот же порядок прилипания ко всем вершинам цепочки» и «стены приоритетнее орто»:
  // если хоть один из вызовов (с орто и без) прилип к стене — результаты совпадают
  const scenes: [string, Wall[], [number, number][]][] = [
    ["L", sceneL(), [[0, 0], [-15, -15], [300, 0]]],
    ["T", sceneT(), [[150, 10], [0, 0]]],
    ["N", sceneN(), [[112, 10]]],
  ]
  for (const [name, walls, windows] of scenes)
    it(`INV-CHAIN-SAME-1: сцена ${name}, масштабы 0.25 и 1`, () => {
      for (const zoom of [0.25, 1])
        for (const [cx, cy] of windows)
          for (let x = cx - 30; x <= cx + 30; x += 3)
            for (let y = cy - 30; y <= cy + 30; y += 3) {
              const p = { x, y }
              const first = snap(p, walls, zoom)
              const chain = snap(p, walls, zoom, 20, { x: cx + 137, y: cy + 41 })
              if (first.source !== "wall" && chain.source !== "wall") continue
              expect(chain).toEqual(first)
              expect(chain.normal).toEqual(first.normal)
              expect(strictlyInsideAnyBody(chain.point, walls)).toBe(false)
            }
    }, 60_000)
})

describe("Контракт результата", () => {
  it("INV-SHAPE-1: normal неперечислима — toEqual видит только {point, source}", () => {
    const r = snap({ x: 50, y: 14 }, sceneS())
    expect(r).toEqual({ point: { x: 50, y: 10 }, source: "wall" })
    expect(Object.keys(r).sort()).toEqual(["point", "source"])
    expectPoint(r.normal ?? { x: NaN, y: NaN }, 0, 1)
  })

  it("INV-PURE-2: сцены L и T не мутируются", () => {
    const l = deepFreeze(sceneL())
    const t = deepFreeze(sceneT())
    expect(() => {
      snap({ x: 5, y: 5 }, l)
      snap({ x: -12, y: -12 }, l, 0.25)
      snap({ x: 150, y: 5 }, t)
      snap({ x: 135, y: 20 }, t, 1, 20, { x: 0, y: 0 })
    }).not.toThrow()
  })
})
