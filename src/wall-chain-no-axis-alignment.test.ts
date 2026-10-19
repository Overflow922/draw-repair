import { describe, expect, it } from "vitest"
import { chainSegment } from "./wall-chain"
import type { ChainInput, ChainSegment } from "./wall-chain"
import { snapRadiusCm } from "./wall-snap"
import type { Wall } from "./types"
import { W, deepFreeze, expectPoint } from "./wall-snap.test-utils"

// change remove-wall-tracking (wall-drawing «Привязка к сетке», «Прилипание конца при заданном направлении»):
// концы осей существующих стен не выравнивают свободный конец — его определяют стены и сетка.

const GRID = 10
const R = snapRadiusCm(1)

function segment(over: Partial<ChainInput> & Pick<ChainInput, "start" | "raw" | "walls">): ChainSegment {
  return chainSegment({
    ref: null,
    radiusCm: R,
    gridStepCm: GRID,
    thicknessCm: 20,
    ortho: false,
    typedAngleDeg: null,
    typedLengthCm: null,
    ...over,
  })
}

// стена A: ось заканчивается в N = (103, 0) — вне узлов сетки; тело далеко от курсоров ниже
const wallsWithOffGridNode = (): Wall[] => deepFreeze([W(0, 0, 103, 0)])

describe("конец оси существующей стены не выравнивает свободный конец", () => {
  it("NT-1: направление не задано — обе координаты по сетке, а не по вертикали N", () => {
    const seg = segment({ start: { x: 500, y: 300 }, raw: { x: 106, y: 207 }, walls: wallsWithOffGridNode() })
    expectPoint(seg.end, 110, 210)
  })

  it("NT-2: направление не задано — горизонталь N конец не подтягивает", () => {
    const seg = segment({ start: { x: 500, y: 300 }, raw: { x: 304, y: 83 }, walls: deepFreeze([W(0, 83, 103, 83)]) })
    expectPoint(seg.end, 300, 80)
  })

  it("NT-3: орто-луч — длина кратна шагу сетки, а не пересечению с вертикалью N", () => {
    const seg = segment({ start: { x: 0, y: 300 }, raw: { x: 106, y: 296 }, ortho: true, walls: wallsWithOffGridNode() })
    expect(seg.dir).not.toBeNull()
    expectPoint(seg.end, 110, 300)
  })

  it("NT-4: введённый угол — конец на луче, длина по сетке, вертикаль N не участвует", () => {
    const seg = segment({ start: { x: 0, y: 300 }, raw: { x: 106, y: 300 }, typedAngleDeg: 0, walls: wallsWithOffGridNode() })
    expect(seg.end.y).toBeCloseTo(300, 9)
    expect(seg.end.x % GRID).toBeCloseTo(0, 9)
  })
})
