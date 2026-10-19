import { describe, expect, it } from "vitest"
import { chainSegment } from "./wall-chain"
import { startRefOf } from "./wall-angle"
import { placementSquare, snapRadiusCm, snapStartVertex } from "./wall-snap"
import type { VertexSnap } from "./wall-snap"
import type { Point, Wall } from "./types"
import { displayPolygons } from "./wall-geometry"
import { W, deepFreeze, expectPoint, expectSameVertices, maxOverlap, sceneAcute } from "./wall-snap.test-utils"

// change wall-body-corners-snap (tasks 3.1, 3.3): диагональное прилипание к углу тела стены
// (wall-drawing, «Диагональное прилипание к углу тела стены»). Сцена L: A (0,0)→(200,0) и B (0,0)→(0,200),
// толщина 20 см, торцы закрыты телом соседа; наружный угол стыка (−10, −10), внутренний (10, 10).
// Эталоны выведены из спецификации и не используют продакшн-геометрию.

const GRID = 10
const R = snapRadiusCm(1)

const L = (): Wall[] => [W(0, 0, 200, 0), W(0, 0, 0, 200)]

const start = (p: Point, walls: Wall[], t = 20, zoom = 1): VertexSnap => snapStartVertex(p, walls, snapRadiusCm(zoom), GRID, t)

const rect = (x0: number, y0: number, x1: number, y1: number): Point[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
]

function expectCorner(r: VertexSnap, vertex: Point, square: Point[]): void {
  expect(r.source).toBe("wall")
  expect(r.target).toBe("corner")
  expectPoint(r.point, vertex.x, vertex.y)
  expectSameVertices(placementSquare(r, 20), square)
}

describe("BCS: прилипание к наружному углу стыка", () => {
  it("BCS-1: курсор за наружным углом ближе к вершине (−10, −20) — квадрат касается угла, вершина на ребре стены B", () => {
    expectCorner(start({ x: -16, y: -18 }, L()), { x: -10, y: -20 }, rect(-30, -30, -10, -10))
  })

  it("BCS-2: курсор ближе ко второй вершине — (−20, −10) на ребре стены A", () => {
    expectCorner(start({ x: -18, y: -16 }, L()), { x: -20, y: -10 }, rect(-30, -30, -10, -10))
  })

  it("BCS-3: на равных расстояниях — вершина на ребре стены, стоящей раньше в массиве", () => {
    // A стоит раньше: вершина на линии её ребра y = −10, то есть (−20, −10)
    expectCorner(start({ x: -17, y: -17 }, L()), { x: -20, y: -10 }, rect(-30, -30, -10, -10))
    // порядок массива обратный — выбор зеркален
    expectCorner(start({ x: -17, y: -17 }, [...L()].reverse()), { x: -10, y: -20 }, rect(-30, -30, -10, -10))
  })

  it("BCS-4: граница окна — включительно, дальше окна прилипания к углу нет", () => {
    expectCorner(start({ x: -30, y: -18 }, L()), { x: -20, y: -10 }, rect(-30, -30, -10, -10))
    expect(start({ x: -30.5, y: -18 }, L()).target).not.toBe("corner")
    expectCorner(start({ x: -18, y: -30 }, L()), { x: -10, y: -20 }, rect(-30, -30, -10, -10))
    expect(start({ x: -18, y: -30.5 }, L()).target).not.toBe("corner")
  })

  it("BCS-5: окно не зависит от масштаба вида", () => {
    expectCorner(start({ x: -30, y: -18 }, L(), 20, 0.25), { x: -20, y: -10 }, rect(-30, -30, -10, -10))
    expect(start({ x: -30.5, y: -18 }, L(), 20, 4).target).not.toBe("corner")
  })

  it("BCS-6: окно — толщина новой стены, при 40 см квадрат 40 × 40", () => {
    const r = start({ x: -30, y: -50 }, L(), 40)
    expect(r.target).toBe("corner")
    expectSameVertices(placementSquare(r, 40), rect(-50, -50, -10, -10))
  })

  it("BCS-7: курсор на плоскости ребра или на самом ребре — угла нет", () => {
    expect(start({ x: -10, y: -18 }, L()).target).not.toBe("corner")
    expect(start({ x: -18, y: -10 }, L()).target).not.toBe("corner")
  })

  it("BCS-8: тела стен квадрат касается только в углу, наложения нет", () => {
    const walls = L()
    for (const cursor of [{ x: -16, y: -18 }, { x: -18, y: -16 }, { x: -12, y: -29 }, { x: -29, y: -12 }]) {
      const r = start(cursor, walls)
      expect(r.target).toBe("corner")
      expect(maxOverlap(placementSquare(r, 20), walls)).toBeLessThan(1e-6)
    }
  })

  it("BCS-9: входные стены не мутируются", () => {
    const walls = deepFreeze(L())
    expect(() => start({ x: -16, y: -18 }, walls)).not.toThrow()
  })
})

describe("BCS: углы, которые целью не являются", () => {
  it("BCS-10: внутренний (вогнутый) угол стыка — прилипания к углу нет", () => {
    expect(start({ x: 16, y: 18 }, L()).target).not.toBe("corner")
    expect(start({ x: 18, y: 16 }, L()).target).not.toBe("corner")
  })

  it("BCS-11: угол торца, закрытый телом другой стены, — прилипания к углу нет", () => {
    // стена B начинается на оси A: углы её торца (90, 0) и (110, 0) внутри тела A
    const walls = [W(0, 0, 200, 0), W(100, 0, 100, 100)]
    for (const cursor of [{ x: 84, y: 12 }, { x: 116, y: 12 }, { x: 84, y: -12 }, { x: 116, y: -12 }])
      expect(start(cursor, walls).target).not.toBe("corner")
  })

  it("BCS-12: квадрат, налагавшийся бы на тело третьей стены, не предлагается", () => {
    const walls = [...L(), W(-40, -20, -20, -20)]
    // квадрат x ∈ [−30, −10], y ∈ [−30, −10] пересекает тело третьей стены (y ∈ [−30, −10], x ∈ [−40, −20])
    expect(start({ x: -16, y: -18 }, walls).target).not.toBe("corner")
  })

  it("BCS-13: свободные торцы — прежнее прилипание к углу торца", () => {
    const r = start({ x: 208, y: 18 }, L())
    expect(r.target).toBe("corner")
    expectPoint(r.point, 210, 10)
  })
})

describe("BCS: косой стык", () => {
  it("BCS-14: у острого стыка квадрат установки не налагается на тела", () => {
    const walls = sceneAcute()
    for (let x = -40; x <= 40; x += 2) {
      for (let y = -40; y <= 40; y += 2) {
        const r = start({ x, y }, walls)
        if (r.source === "wall") expect(maxOverlap(placementSquare(r, 20), walls)).toBeLessThan(1e-6)
      }
    }
  })
})

describe("BCS: начало, превью и фиксация", () => {
  it("BCS-15: начало стены — вершина прилипания, превью и зафиксированная стена начинаются в ней", () => {
    const walls = L()
    const snap = start({ x: -16, y: -18 }, walls)
    const ref = startRefOf(snap)
    expect(ref).not.toBeNull()
    expect(ref?.parallel).toBeUndefined()
    // стена от вершины (−10, −20) перпендикулярно ребру, на котором лежит вершина (влево)
    const seg = chainSegment({
      start: snap.point,
      ref,
      raw: { x: -100, y: -20 },
      walls,
      radiusCm: R,
      gridStepCm: GRID,
      thicknessCm: 20,
      typedAngleDeg: null,
      typedLengthCm: null,
      ortho: false,
    })
    expectPoint(seg.start, -10, -20)
    // зафиксированная стена и превью — одна и та же стена от начала; её тело не налагается на существующие
    const placed: Wall = { ...W(seg.start.x, seg.start.y, seg.end.x, seg.end.y) }
    const body = displayPolygons(placed, [...walls, placed])[0]
    expect(maxOverlap(body, walls)).toBeLessThan(1e-6)
  })

  it("BCS-16: направление вдоль оси существующей стены орто-привязкой не предлагается", () => {
    const walls = L()
    const snap = start({ x: -16, y: -18 }, walls)
    const seg = chainSegment({
      start: snap.point,
      ref: startRefOf(snap),
      raw: { x: 100, y: -23 },
      walls,
      radiusCm: R,
      gridStepCm: GRID,
      thicknessCm: 20,
      typedAngleDeg: null,
      typedLengthCm: null,
      ortho: true,
    })
    expectPoint(seg.start, -10, -20)
  })
})
