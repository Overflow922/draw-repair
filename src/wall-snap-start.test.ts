import { describe, expect, it } from "vitest"
import { chainSegment } from "./wall-chain"
import { snapRadiusCm, snapStartVertex, snapVertex } from "./wall-snap"
import type { VertexSnap } from "./wall-snap"
import { displayPolygons } from "./wall-geometry"
import type { Point, Wall } from "./types"
import {
  W,
  clipConvex,
  deepFreeze,
  expectPoint,
  maxOverlap,
  sceneL,
  sceneN,
  sceneS,
  sceneT,
  squareOnNormal,
  strictlyInsideAnyBody,
} from "./wall-snap.test-utils"

// change fix-grid-square-touching-wall: до первого клика квадрат по сетке не касается
// тел стен — положения курсора, где касался бы, дают прилипание (test-plan GS-01..GS-11).

const GRID = 10
const NEW = 20
const R08 = snapRadiusCm(0.8) // 7.5 см: зона прилипания max(7.5, 10) = 10 см
const TOUCH_TOL = 1e-6

const start = (p: Point, walls: Wall[], radius = R08, thickness = NEW): VertexSnap =>
  snapStartVertex(p, walls, radius, GRID, thickness)

// квадрат по сетке по спецификации: по осям экрана, вершина в центре
function gridSquare(p: Point, size: number): Point[] {
  const h = size / 2
  return [
    { x: p.x - h, y: p.y - h },
    { x: p.x + h, y: p.y - h },
    { x: p.x + h, y: p.y + h },
    { x: p.x - h, y: p.y + h },
  ]
}

function pointSegmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t))
}

// общая точка выпуклых многоугольников с допуском: пересечение (включая границу)
// либо расстояние между контурами не больше допуска
function touches(a: Point[], b: Point[]): boolean {
  if (clipConvex(a, b).length > 0) return true
  for (const [p, poly] of [
    ...a.map((p): [Point, Point[]] => [p, b]),
    ...b.map((p): [Point, Point[]] => [p, a]),
  ])
    for (let i = 0; i < poly.length; i++)
      if (pointSegmentDistance(p, poly[i], poly[(i + 1) % poly.length]) <= TOUCH_TOL) return true
  return false
}

const touchesAnyBody = (square: Point[], walls: Wall[]): boolean =>
  walls.some((w) => displayPolygons(w, walls).some((piece) => touches(square, piece)))

function expectStuckWithoutOverlap(snap: VertexSnap, walls: Wall[]): void {
  expect(snap.source).toBe("wall")
  const normal = snap.normal
  expect(normal).toBeDefined()
  if (!normal) return
  expect(maxOverlap(squareOnNormal(snap.point, normal, NEW), walls)).toBeLessThanOrEqual(1e-6)
  expect(strictlyInsideAnyBody(snap.point, walls)).toBe(false)
}

const vertical20 = (): Wall[] => deepFreeze([W(0, 0, 0, 200, 20)]) // грань x = 10

describe("квадрат по сетке у грани — прилипание (GS-01..GS-03, GS-11)", () => {
  it("GS-01: узел сетки в полутолщине от грани — вершина на грани, зазора нет", () => {
    const walls = vertical20()
    const snap = start({ x: 22, y: 100 }, walls)
    expect(snap.source).toBe("wall")
    expectPoint(snap.point, 10, 100)
    expectPoint(snap.normal ?? { x: NaN, y: NaN }, 1, 0)
    expect(snap.target).toBe("face")
    expectStuckWithoutOverlap(snap, walls)
    // квадрат касается грани: его сторона лежит на x = 10
    const sq = squareOnNormal(snap.point, { x: 1, y: 0 }, NEW)
    expect(Math.min(...sq.map((q) => q.x))).toBeCloseTo(10, 6)
  })

  it.each([20.01, 22, 24.99])("GS-02: вся полоса курсора с узлом x = 20 прилипает (x = %s)", (x) => {
    const snap = start({ x, y: 100 }, vertical20())
    expect(snap.source).toBe("wall")
    expectPoint(snap.point, 10, 100)
  })

  it("GS-03: грань вне линий сетки — квадрат по сетке налагался бы, вершина на грани без наложения", () => {
    const walls = deepFreeze([W(0, 0, 0, 200, 25)]) // грань x = 12.5
    const snap = start({ x: 24, y: 100 }, walls)
    expectPoint(snap.point, 12.5, 100)
    expect(snap.target).toBe("face")
    expectStuckWithoutOverlap(snap, walls)
  })

  it("GS-11: вне полосы у конца стены — прилипание к грани стороны курсора, не к торцу", () => {
    const walls = vertical20()
    const snap = start({ x: 22, y: -3 }, walls)
    expect(snap.target).toBe("face")
    expectPoint(snap.normal ?? { x: NaN, y: NaN }, 1, 0)
    expect(snap.point.x).toBeCloseTo(10, 6)
    expectStuckWithoutOverlap(snap, walls)
  })
})

describe("выбор ближайшей цели (GS-14, GS-16, GS-17)", () => {
  it("GS-14: L-угол — квадрат по сетке у наружной грани A, вершина на ближайшей цели", () => {
    // курсор над горизонтальной стеной A у угла: узел (10, −20), квадрат касается грани A y = −10;
    // грань вертикальной B — дальняя цель
    const walls = deepFreeze(sceneL())
    const snap = start({ x: 10.37, y: -22.39 }, walls)
    expect(snap.source).toBe("wall")
    expectPoint(snap.point, 10.37, -10)
    expectPoint(snap.normal ?? { x: NaN, y: NaN }, 0, -1)
    expect(snap.target).toBe("face")
    expectStuckWithoutOverlap(snap, walls)
  })

  it("GS-16: T-стык — квадрат по сетке касается обеих стен, ближайшая цель — грань второй по массиву", () => {
    // узел (130, 20): квадрат касается грани A y = 10 и грани B x = 140;
    // до грани B 12.63 см, до грани A 14.61 см
    const walls = deepFreeze(sceneT())
    const sq = gridSquare({ x: 130, y: 20 }, NEW)
    expect(walls.map((w) => displayPolygons(w, walls).some((pc) => touches(sq, pc)))).toEqual([true, true])
    const snap = start({ x: 127.37, y: 24.61 }, walls)
    expect(snap.source).toBe("wall")
    expectPoint(snap.point, 140, 24.61)
    expectPoint(snap.normal ?? { x: NaN, y: NaN }, -1, 0)
    expect(snap.target).toBe("face")
    expectStuckWithoutOverlap(snap, walls)
  })

  it("GS-17: цель — у касаемой стены, не первой среди касаемых (торец за соседом без места)", () => {
    // узел (120, 210): квадрат касается тела B (углом) и торца C; у грани B места нет
    // (квадрат налёг бы на C), цель — свободный торец C
    const walls = deepFreeze(sceneN())
    const sq = gridSquare({ x: 120, y: 210 }, NEW)
    expect(walls.map((w) => displayPolygons(w, walls).some((pc) => touches(sq, pc)))).toEqual([false, true, true])
    const snap = start({ x: 115.37, y: 210.61 }, walls)
    expect(snap.source).toBe("wall")
    expectPoint(snap.point, 125, 200)
    expectPoint(snap.normal ?? { x: NaN, y: NaN }, 0, 1)
    expect(snap.target).toBe("cap")
    expectStuckWithoutOverlap(snap, walls)
  })
})

describe("расширенная зона только у касаемой стены (GS-18)", () => {
  // A — горизонтальная 0..100, B — вертикальная x = 115 (тело 105..125, y 10..100)
  const twoWalls = (): Wall[] => deepFreeze([W(0, 0, 100, 0), W(115, 10, 115, 100)])
  const touched = (walls: Wall[], node: Point): boolean[] =>
    walls.map((w) => displayPolygons(w, walls).some((pc) => touches(gridSquare(node, NEW), pc)))

  it("GS-18a: квадрат касается только A — грань A, хотя грань B ближе к курсору", () => {
    const walls = twoWalls()
    const p = { x: 93.37, y: 23.61 }
    expect(snapVertex(p, walls, R08, GRID, NEW)).toEqual({ point: { x: 90, y: 20 }, source: "grid" })
    expect(touched(walls, { x: 90, y: 20 })).toEqual([true, false])
    const snap = start(p, walls)
    expect(snap.source).toBe("wall")
    expectPoint(snap.point, 90, 10)
    expectPoint(snap.normal ?? { x: NaN, y: NaN }, 0, 1)
    expect(snap.target).toBe("face")
    expectStuckWithoutOverlap(snap, walls)
  })

  it("GS-18b: квадрат касается только торца A — грань A, а не торец B", () => {
    const walls = twoWalls()
    const p = { x: 113.37, y: -12.39 }
    expect(snapVertex(p, walls, R08, GRID, NEW)).toEqual({ point: { x: 110, y: -10 }, source: "grid" })
    expect(touched(walls, { x: 110, y: -10 })).toEqual([true, false])
    const snap = start(p, walls)
    expect(snap.source).toBe("wall")
    expectPoint(snap.point, 90, -10)
    expectPoint(snap.normal ?? { x: NaN, y: NaN }, 0, -1)
    expect(snap.target).toBe("face")
    expectStuckWithoutOverlap(snap, walls)
  })
})

describe("квадрат по сетке у свободного торца (GS-04)", () => {
  it("GS-04: курсор в полосе за торцом дальше зоны — продолжение по оси без зазора", () => {
    const walls = deepFreeze([W(-100, 0, 0, 0, 20)])
    const snap = start({ x: 12, y: 0 }, walls)
    expect(snap.source).toBe("wall")
    expectPoint(snap.point, 0, 0)
    expect(snap.target).toBe("cap")
    expectPoint(snap.normal ?? { x: NaN, y: NaN }, 1, 0)
    expectStuckWithoutOverlap(snap, walls)
  })
})

describe("квадрат по сетке не касается стен — сетка (GS-05..GS-07)", () => {
  it("GS-05: узел сетки на 10 см от грани — вершина в узле", () => {
    const snap = start({ x: 27, y: 100 }, vertical20())
    expect(snap).toEqual({ point: { x: 30, y: 100 }, source: "grid" })
  })

  it("GS-06: зазор 1 см между квадратом по сетке и гранью — вершина в узле", () => {
    // новая стена 18 см: полтолщины и зона 9 см, квадрат вокруг (20, 100) — 11..29
    const snap = start({ x: 22, y: 100 }, vertical20(), R08, 18)
    expect(snap).toEqual({ point: { x: 20, y: 100 }, source: "grid" })
  })

  it("GS-12: зазор 0.01 см между квадратом по сетке и гранью — вершина в узле", () => {
    // новая стена 19.98 см: квадрат вокруг (20, 100) — 10.01..29.99
    const snap = start({ x: 22, y: 100 }, vertical20(), R08, 19.98)
    expect(snap).toEqual({ point: { x: 20, y: 100 }, source: "grid" })
  })

  it("GS-13: наклонная стена — квадрат по сетке внутри габаритов тела, но без касания, — вершина в узле", () => {
    // тело: |x − y| ≤ 10·√2; квадрат вокруг (80, 40) ближе всего на |80 − 40| − 20 = 20 > 14.14
    const walls = deepFreeze([W(0, 0, 120, 120, 20)])
    expect(touchesAnyBody(gridSquare({ x: 80, y: 40 }, NEW), walls)).toBe(false)
    const snap = start({ x: 81, y: 41 }, walls)
    expect(snap).toEqual({ point: { x: 80, y: 40 }, source: "grid" })
  })

  it("GS-07: касание без цели прилипания — вершина в узле сетки", () => {
    const walls = deepFreeze(sceneN()) // открытый участок грани между примыкающими — 5 см
    const p = { x: 112.5, y: 22 }
    expect(touchesAnyBody(gridSquare({ x: 110, y: 20 }, NEW), walls)).toBe(true)
    const snap = start(p, walls, snapRadiusCm(1))
    expect(snap).toEqual({ point: { x: 110, y: 20 }, source: "grid" })
  })
})

describe("свободный конец сегмента не затронут (GS-08)", () => {
  it("GS-08: после первого клика свободный конец у грани не прилипает по расширенной зоне", () => {
    const walls = vertical20()
    const seg = chainSegment({
      start: { x: 100, y: 60 },
      ref: null,
      raw: { x: 22, y: 60 },
      walls,
      radiusCm: R08,
      gridStepCm: GRID,
      thicknessCm: NEW,
      ortho: false,
      typedAngleDeg: null,
      typedLengthCm: null,
    })
    expect(seg.snap.source).toBe("grid")
    expect(seg.end.x).toBeCloseTo(20, 6)
  })
})

// развёртка курсора по окрестности стен (вне тел), test-plan GS-09/GS-10/GS-15.
// sceneN не входит: в ней есть законные положения «касание без цели» (GS-07),
// где квадрат по сетке касается тел по спецификации.
const SCENES: [string, () => Wall[]][] = [
  ["одиночная", sceneS],
  ["L-угол", sceneL],
  ["T-стык", sceneT],
  ["толщина 25", () => [W(0, 0, 0, 200, 25)]],
  ["наклонная 45°", () => [W(0, 0, 120, 120, 20)]],
]
const ZOOMS = [0.25, 0.8, 1, 4]
const STEP = 5
const MARGIN = 40

function sweep(walls: Wall[]): Point[] {
  const xs = walls.flatMap((w) => [w.a.x, w.b.x])
  const ys = walls.flatMap((w) => [w.a.y, w.b.y])
  const points: Point[] = []
  for (let x = Math.min(...xs) - MARGIN; x <= Math.max(...xs) + MARGIN; x += STEP)
    for (let y = Math.min(...ys) - MARGIN; y <= Math.max(...ys) + MARGIN; y += STEP) {
      // смещение от узлов сетки: курсор не совпадает с узлами и гранями
      const p = { x: x + 1.3, y: y + 2.1 }
      const inside = walls.some((w) => displayPolygons(w, walls).some((pc) => clipConvex(gridSquare(p, 1e-3), pc).length >= 3))
      if (!inside) points.push(p)
    }
  return points
}

describe.each(SCENES)("инварианты развёртки — сцена %s (GS-09, GS-10)", (_name, make) => {
  const walls = deepFreeze(make())
  const points = sweep(walls)

  it.each(ZOOMS)("GS-09: масштаб %s — квадрат по сетке не касается тел, прилипший не налагается", (zoom) => {
    const radius = snapRadiusCm(zoom)
    const failures: string[] = []
    for (const p of points) {
      const snap = start(p, walls, radius)
      if (snap.source === "grid") {
        if (touchesAnyBody(gridSquare(snap.point, NEW), walls))
          failures.push(`сетка касается: курсор (${p.x}, ${p.y}) → (${snap.point.x}, ${snap.point.y})`)
        continue
      }
      const normal = snap.normal
      if (!normal) {
        failures.push(`нет нормали: курсор (${p.x}, ${p.y})`)
        continue
      }
      if (maxOverlap(squareOnNormal(snap.point, normal, NEW), walls) > 1e-6 || strictlyInsideAnyBody(snap.point, walls))
        failures.push(`наложение: курсор (${p.x}, ${p.y}) → (${snap.point.x}, ${snap.point.y})`)
    }
    expect(failures.slice(0, 5)).toEqual([])
  })

  it.each(ZOOMS)("GS-10: масштаб %s — в обычной зоне результат совпадает с snapVertex", (zoom) => {
    const radius = snapRadiusCm(zoom)
    let compared = 0
    for (const p of points) {
      const base = snapVertex(p, walls, radius, GRID, NEW)
      if (base.source !== "wall") continue
      compared++
      const snap = start(p, walls, radius)
      expect(snap.source).toBe("wall")
      expectPoint(snap.point, base.point.x, base.point.y)
      expect(snap.normal).toEqual(base.normal)
      expect(snap.target).toBe(base.target)
    }
    expect(compared).toBeGreaterThan(0)
  })

  it.each(ZOOMS)("GS-15: масштаб %s — расширение только при касании квадрата по сетке", (zoom) => {
    const radius = snapRadiusCm(zoom)
    const failures: string[] = []
    let clear = 0
    for (const p of points) {
      const base = snapVertex(p, walls, radius, GRID, NEW)
      if (base.source !== "grid") continue
      const touching = touchesAnyBody(gridSquare(base.point, NEW), walls)
      const snap = start(p, walls, radius)
      if (!touching) {
        clear++
        if (snap.source !== "grid" || snap.point.x !== base.point.x || snap.point.y !== base.point.y)
          failures.push(`без касания не сетка: курсор (${p.x}, ${p.y}) → (${snap.point.x}, ${snap.point.y})`)
      } else if (snap.source === "grid") {
        failures.push(`касание осталось на сетке: курсор (${p.x}, ${p.y})`)
      }
    }
    expect(failures.slice(0, 5)).toEqual([])
    expect(clear).toBeGreaterThan(0)
  })

  it("детерминированность: повторный вызов даёт тот же результат", () => {
    for (const p of points.slice(0, 200)) {
      const a = start(p, walls)
      const b = start(p, walls)
      expect(b).toEqual(a)
      expect(b.normal).toEqual(a.normal)
      expect(b.target).toBe(a.target)
    }
  })
})
