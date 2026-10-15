import { describe, expect, it } from "vitest"
import { chainSegment } from "./wall-chain"
import type { ChainInput, ChainSegment } from "./wall-chain"
import { startRefOf } from "./wall-angle"
import type { StartRef } from "./wall-angle"
import { snapRadiusCm, snapStartVertex } from "./wall-snap"
import { displayPolygons } from "./wall-geometry"
import type { Point, Wall } from "./types"
import { W, expectPoint } from "./wall-snap.test-utils"

// change fix-corner-snap-parallel-start (wall-drawing, «Диагональное прилипание к углу свободного торца»):
// торец новой стены ложится на сторону квадрата — у параллельной стене начало в середине стороны в плоскости торца.
// Сцена A: стена (−100,0)→(0,0), толщина 20, свободный торец x = 0, грани y = ±10. Угол K = (0, 10).

const GRID = 10
const R = snapRadiusCm(1)
const RAD = Math.PI / 180

const A = (): Wall[] => [W(-100, 0, 0, 0, 20)]

// начало цепочки так, как его фиксирует первый клик: прилипание + опора
function startAt(cursor: Point, walls: Wall[], thicknessCm = 20): { start: Point; ref: StartRef | null } {
  const snap = snapStartVertex(cursor, walls, R, GRID, thicknessCm)
  return { start: snap.point, ref: startRefOf(snap) }
}

function segment(
  cursor: Point,
  raw: Point,
  walls: Wall[],
  over: Partial<ChainInput> = {},
): ChainSegment {
  const { start, ref } = startAt(cursor, walls, over.thicknessCm)
  return chainSegment({ start, ref, raw, walls, radiusCm: R, gridStepCm: GRID, thicknessCm: 20, ortho: true, typedAngleDeg: null, typedLengthCm: null, ...over })
}

// курсор в окне угла (8, 18): квадрат x ∈ [0,20], y ∈ [10,30], вершина (10,10)
const TOP = { x: 8, y: 18 }
const BOTTOM = { x: 8, y: -18 }

const bbox = (polys: Point[][]): { x0: number; x1: number; y0: number; y1: number } => {
  const pts = polys.flat()
  return {
    x0: Math.min(...pts.map((p) => p.x)),
    x1: Math.max(...pts.map((p) => p.x)),
    y0: Math.min(...pts.map((p) => p.y)),
    y1: Math.max(...pts.map((p) => p.y)),
  }
}

describe("CP: начало параллельной стены от угла свободного торца", () => {
  it("CP-1: вдоль оси A вправо — торец на стороне квадрата в плоскости торца, начало (0, 20)", () => {
    const seg = segment(TOP, { x: 200, y: 22 }, A())
    expectPoint(seg.start, 0, 20)
    expect(seg.dir?.x).toBeCloseTo(1, 9)
    expect(seg.dir?.y).toBeCloseTo(0, 9)
    expectPoint(seg.end, 200, 20)
  })

  it("CP-2: второй угол торца — начало (0, −20)", () => {
    const seg = segment(BOTTOM, { x: 200, y: -22 }, A())
    expectPoint(seg.start, 0, -20)
    expectPoint(seg.end, 200, -20)
  })

  it("CP-3: новая стена толщиной 40 — начало (0, 30)", () => {
    const seg = segment({ x: 14, y: 24 }, { x: 200, y: 32 }, A(), { thicknessCm: 40 })
    expectPoint(seg.start, 0, 30)
    expectPoint(seg.end, 200, 30)
  })

  it("CP-4: перпендикуляр к грани — начало остаётся в вершине (10, 10)", () => {
    const seg = segment(TOP, { x: 12, y: 150 }, A())
    expectPoint(seg.start, 10, 10)
    expect(seg.dir?.x).toBeCloseTo(0, 9)
    expect(seg.dir?.y).toBeCloseTo(1, 9)
  })

  it("CP-5: орто — отклонение 10° от оси A притягивается к параллели и переносит начало", () => {
    const raw = { x: 200, y: 10 + 190 * Math.tan(10 * RAD) }
    const seg = segment(TOP, raw, A())
    expectPoint(seg.start, 0, 20)
    expect(seg.dir?.y).toBeCloseTo(0, 9)
  })

  it("CP-6: орто — отклонение 20° не притягивается, начало остаётся в вершине", () => {
    const raw = { x: 200, y: 10 + 190 * Math.tan(20 * RAD) }
    const seg = segment(TOP, raw, A())
    expectPoint(seg.start, 10, 10)
  })

  it("CP-7: орто выключено — свободное направление, даже близкое к параллели, начала не меняет", () => {
    const seg = segment(TOP, { x: 200, y: 10 + 190 * Math.tan(10 * RAD) }, A(), { ortho: false })
    expectPoint(seg.start, 10, 10)
  })

  it("CP-8: введённый угол к грани параллельного направления не даёт — начало остаётся в вершине", () => {
    const seg = segment(TOP, { x: 200, y: 60 }, A(), { ortho: false, typedAngleDeg: 1 })
    expectPoint(seg.start, 10, 10)
  })

  it("CP-9: направление к стене A (влево) начала не переносит", () => {
    const seg = segment(TOP, { x: -150, y: 12 }, A())
    expectPoint(seg.start, 10, 10)
  })

  it("CP-10: введённая длина параллельной стены — от нового начала", () => {
    const seg = segment(TOP, { x: 200, y: 22 }, A(), { typedLengthCm: 150 })
    expectPoint(seg.start, 0, 20)
    expectPoint(seg.end, 150, 20)
  })

  it("CP-11: без направления (сегмент нулевой длины) начало — вершина прилипания", () => {
    const seg = segment(TOP, { x: 10, y: 10 }, A())
    expectPoint(seg.start, 10, 10)
  })
})

describe("CP: тело параллельной стены не склеивается с A", () => {
  const cases: [string, number, number][] = [
    ["20/20", 20, 20],
    ["A тоньше (20/40)", 20, 40],
    ["A толще (40/20)", 40, 20],
  ]
  for (const [name, aT, nT] of cases) {
    it(`CP-12: толщины ${name} — тело y ∈ [10 ± …], от x = 0, A не изменена`, () => {
      const a = W(-100, 0, 0, 0, aT)
      const hA = aT / 2
      const seg = segment({ x: 4, y: hA + 4 }, { x: 200, y: hA + nT / 2 + 2 }, [a], { thicknessCm: nT })
      expectPoint(seg.start, 0, hA + nT / 2)
      const wall = W(seg.start.x, seg.start.y, 300, seg.start.y, nT)
      const aAlone = bbox(displayPolygons(a, [a]))
      const walls = [a, wall]
      expect(bbox(displayPolygons(a, walls))).toEqual(aAlone)
      const body = bbox(displayPolygons(wall, walls))
      expect(body.x0).toBeCloseTo(0, 6)
      expect(body.x1).toBeCloseTo(300, 6)
      expect(body.y0).toBeCloseTo(hA, 6)
      expect(body.y1).toBeCloseTo(hA + nT, 6)
    })
  }
})
