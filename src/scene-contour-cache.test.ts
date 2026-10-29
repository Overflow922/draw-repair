import { describe, expect, it } from "vitest"
import { convexCorners, sceneContour } from "./scene-contour"
import type { Point } from "./types"
import { W } from "./wall-snap.test-utils"

// change render-pan-perf (привязка курсора): контур сцены и его выпуклые вершины кэшируются по значениям стен —
// повтор с теми же значениями не пересчитывает, правка стены на месте даёт актуальный результат

const cornersOf = (walls: ReturnType<typeof W>[]): Point[] => convexCorners(sceneContour(walls)).map((c) => c.point)

describe("SC: кэш контура сцены", () => {
  it("SC-1: те же значения стен — тот же результат, в том числе для новой копии массива", () => {
    const walls = [W(0, 0, 200, 0), W(0, 0, 0, 200)]
    const first = sceneContour(walls)
    expect(sceneContour(walls)).toBe(first)
    expect(sceneContour(walls.map((w) => ({ ...w, a: { ...w.a }, b: { ...w.b } })))).toBe(first)
    expect(convexCorners(first)).toBe(convexCorners(first))
  })

  it("SC-2: стена, сдвинутая на месте, даёт углы по новым значениям", () => {
    const walls = [W(0, 0, 200, 0)]
    expect(cornersOf(walls)).toContainEqual({ x: 200, y: 10 })
    walls[0].b = { x: 300, y: 0 }
    const corners = cornersOf(walls)
    expect(corners).toContainEqual({ x: 300, y: 10 })
    expect(corners).not.toContainEqual({ x: 200, y: 10 })
  })
})
