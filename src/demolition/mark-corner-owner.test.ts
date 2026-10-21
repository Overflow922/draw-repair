import { describe, expect, it } from "vitest"
import type { Point } from "../types"
import { pointInPolygon } from "../wall-geometry"
import { mk, wall } from "./demolition.test-utils"
import { effectiveMarks } from "./mark-model"
import { markRegion } from "./mark-region"

// change demolition-corner-owner (spec demolition-plan «Угловой квадрат сносит его владелец»): угловой квадрат L-угла
// со сходящимися осями при пометке обеих стен сносит стена, нарисованная позже; помечена одна — сосед остаётся целым.

const V = (): ReturnType<typeof wall> => wall(0, 400, 0, 0, "V", "brick", 20)
const W = (): ReturnType<typeof wall> => wall(0, 0, 500, 0, "W", "brick", 20)
const BOTH = { V: 400, W: 500 }

// область сноса целой стены id при пометках marked (id → длина); по умолчанию помечена только она
function regionOf(walls: ReturnType<typeof wall>[], id: string, marked: Record<string, number>): Point[][] {
  const resolved = effectiveMarks(Object.entries(marked).map(([wallId, len]) => mk(`m-${wallId}`, wallId, "a", 0, len)), walls)
  const r = resolved.find((x) => x.wall.id === id)
  return markRegion(r!, walls, resolved)
}

const covers = (region: Point[][], p: Point): boolean => region.some((poly) => pointInPolygon(p, poly))
const bbox = (region: Point[][]): [number, number, number, number] => {
  const pts = region.flat()
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
}
const SQUARE: Point[] = [{ x: -9, y: -9 }, { x: 9, y: -9 }, { x: -9, y: 9 }, { x: 9, y: 9 }, { x: 0, y: 0 }]

describe("угловой квадрат L-угла", () => {
  it("CO-1: обе стены помечены — владелец (W нарисована позже) сносит угловой квадрат", () => {
    const region = regionOf([V(), W()], "W", BOTH)
    expect(bbox(region)).toEqual([-10, 500, -10, 10])
    for (const p of SQUARE) expect(covers(region, p)).toBe(true)
  })

  it("CO-2: невладелец V заканчивается у ближней грани W (y ≥ 10)", () => {
    const region = regionOf([V(), W()], "V", BOTH)
    expect(bbox(region)).toEqual([-10, 10, 10, 400])
    expect(covers(region, { x: 0, y: 9 })).toBe(false)
  })

  it("CO-3: обе стены помечены — угловой квадрат снесён, области не пересекаются", () => {
    const walls = [V(), W()]
    const rv = regionOf(walls, "V", BOTH)
    const rw = regionOf(walls, "W", BOTH)
    for (const p of SQUARE) {
      expect(covers(rv, p) || covers(rw, p)).toBe(true)
      expect(covers(rv, p) && covers(rw, p)).toBe(false)
    }
  })

  it("CO-4: порядок стен определяет владельца — V нарисована позже", () => {
    const walls = [W(), V()]
    expect(bbox(regionOf(walls, "V", BOTH))).toEqual([-10, 10, -10, 400])
    expect(bbox(regionOf(walls, "W", BOTH))).toEqual([10, 500, -10, 10])
  })

  it("CO-5: помечена одна W — сосед V остаётся целым, область W начинается у его грани (x ≥ 10)", () => {
    const region = regionOf([V(), W()], "W", { W: 500 })
    expect(bbox(region)).toEqual([10, 500, -10, 10])
    expect(covers(region, { x: -9, y: 9 })).toBe(false)
  })

  it("CO-6: участок W не у угла не меняется", () => {
    const walls = [V(), W()]
    const resolved = effectiveMarks([mk("m", "W", "a", 100, 190), mk("v", "V", "a", 0, 400)], walls)
    const r = resolved.find((x) => x.wall.id === "W")
    expect(bbox(markRegion(r!, walls, resolved))).toEqual([100, 190, -10, 10])
  })

  it("CO-7: Т-примыкание не затронуто — V между T и B, область между ближними гранями", () => {
    const walls = [
      wall(0, 0, 0, 1113, "V", "brick", 25),
      wall(0, 0, 312, 0, "T", "brick", 25),
      wall(-300, 1113, 300, 1113, "B", "brick", 25),
    ]
    const [, , , maxY] = bbox(regionOf(walls, "V", { V: 1113, B: 600 }))
    expect(maxY).toBeCloseTo(1100.5, 6)
  })

  it("CO-8: участок соседа не у угла не отдаёт квадрат — V помечена 100–300, W целая", () => {
    const walls = [V(), W()]
    const resolved = effectiveMarks([mk("m", "W", "a", 0, 500), mk("v", "V", "a", 100, 300)], walls)
    const r = resolved.find((x) => x.wall.id === "W")
    expect(bbox(markRegion(r!, walls, resolved))).toEqual([10, 500, -10, 10])
  })
})
