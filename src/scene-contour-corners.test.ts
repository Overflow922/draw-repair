import { describe, expect, it } from "vitest"
import { convexCorners, sceneContour } from "./scene-contour"
import type { Point, Wall } from "./types"
import { W, sceneL, sceneT } from "./wall-snap.test-utils"

// change wall-body-corners-snap (tasks 2.1): углы тела стены — выпуклые вершины контура сцены
// (design D1, D4). Эталоны выведены из геометрии раскладок с толщиной 20 см и не используют продакшн-расчёт.

const cornersOf = (walls: Wall[]): Point[] => convexCorners(sceneContour(walls)).map((c) => c.point)

const keyed = (ps: Point[]): string[] => ps.map((p) => `${Math.round(p.x * 1e6) / 1e6 + 0},${Math.round(p.y * 1e6) / 1e6 + 0}`).sort()

describe("BC: выпуклые углы сцены", () => {
  it("BC-1: одиночная стена — четыре угла, по два на торце", () => {
    expect(keyed(cornersOf([W(0, 0, 200, 0)]))).toEqual(keyed([
      { x: 0, y: -10 },
      { x: 0, y: 10 },
      { x: 200, y: -10 },
      { x: 200, y: 10 },
    ]))
  })

  it("BC-2: L со сходящимися осями — наружный угол стыка и по два свободных угла на торцах", () => {
    const corners = keyed(cornersOf([W(0, 0, 200, 0), W(0, 0, 0, 200)]))
    expect(corners).toEqual(keyed([
      { x: -10, y: -10 },
      { x: 200, y: -10 },
      { x: 200, y: 10 },
      { x: -10, y: 200 },
      { x: 10, y: 200 },
    ]))
  })

  it("BC-3: внутренний (вогнутый) угол стыка не возвращается", () => {
    const corners = cornersOf(sceneL())
    expect(corners.some((c) => Math.abs(c.x - 10) < 1e-6 && Math.abs(c.y - 10) < 1e-6)).toBe(false)
  })

  it("BC-4: угол торца, лежащий внутри тела другой стены, не возвращается", () => {
    // стена B упирается торцом в тело A: её углы на торце закрыты A
    const corners = cornersOf(sceneT())
    expect(corners.some((c) => Math.abs(c.x - 140) < 1e-6 && Math.abs(c.y - 10) < 1e-6)).toBe(false)
    expect(corners.some((c) => Math.abs(c.x - 160) < 1e-6 && Math.abs(c.y - 10) < 1e-6)).toBe(false)
  })

  it("BC-5: каждый угол возвращается один раз", () => {
    const corners = keyed(cornersOf(sceneL()))
    expect(new Set(corners).size).toBe(corners.length)
  })

  it("BC-6: угол несёт две открытые грани, расходящиеся наружу", () => {
    const [corner] = convexCorners(sceneContour([W(0, 0, 200, 0)])).filter((c) => c.point.x === 0 && c.point.y === -10)
    expect(corner.edges.map((e) => `${e.normal.x},${e.normal.y}`).sort()).toEqual(["-1,0", "0,-1"].sort())
  })
})
