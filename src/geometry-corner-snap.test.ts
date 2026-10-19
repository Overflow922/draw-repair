import { describe, expect, it } from "vitest"
import { snapAlongAxis, snapWithSource } from "./geometry"
import type { Point, Wall } from "./types"
import { moveEndpointBounded } from "./wall-edit"
import { displayPolygons } from "./wall-geometry"
import { moveGesture } from "./ortho-gesture.test-utils"
import { W, expectPoint, maxOverlap } from "./wall-snap.test-utils"

// change wall-body-corners-snap (tasks 4.1): привязка к углам тел стен при перетаскивании конца и перемещении
// (wall-selection, «Привязка к углам тел стен при перетаскивании и перемещении»). Стена A (0,0)→(200,0), толщина 20:
// углы тела (0,±10), (200,±10). Эталоны выведены из спецификации.

const GRID = 10
const R = 12

const A = (): Wall[] => [W(0, 0, 200, 0)]

describe("BCD: конец прилипает к углам тел", () => {
  it("BCD-1: курсор рядом с углом (200, −10) — конец занимает угол точно", () => {
    expectPoint(snapWithSource({ x: 206, y: -14 }, A(), GRID, R).point, 200, -10)
  })

  it.each([
    [{ x: -4, y: -13 }, { x: 0, y: -10 }],
    [{ x: -4, y: 13 }, { x: 0, y: 10 }],
    [{ x: 206, y: -14 }, { x: 200, y: -10 }],
    [{ x: 206, y: 14 }, { x: 200, y: 10 }],
  ])("BCD-2: курсор %o — конец занимает угол %o точно", (cursor, corner) => {
    const r = snapWithSource(cursor, A(), GRID, R)
    expectPoint(r.point, corner.x, corner.y)
    expect(r.axisWall).toBeNull()
  })

  it("BCD-3: угол, закрытый телом другой стены, не цель", () => {
    // тело B (x ∈ [175, 215]) закрывает углы (200, ±10) стены A
    const walls = [W(0, 0, 200, 0), W(195, -50, 195, 50, 40)]
    const r = snapWithSource({ x: 203, y: -12 }, walls, 7, 6)
    expect(r.point).toEqual({ x: 203, y: -14 })
  })

  it("BCD-4: внутренний угол стыка не цель", () => {
    const walls = [W(0, 0, 200, 0), W(0, 0, 0, 200)]
    const r = snapWithSource({ x: 14, y: 14 }, walls, 7, 6)
    expect(r.point).toEqual({ x: 14, y: 14 })
  })

  it("BCD-5: дальше радиуса привязки угла нет", () => {
    const r = snapWithSource({ x: 213, y: -23 }, A(), 7, 6)
    expect(r.point).toEqual({ x: 210, y: -21 })
  })

  it("BCD-6: на равном расстоянии ось раньше угла", () => {
    // курсор (206, −5) равноудалён от конца оси (200, 0) и угла (200, −10)
    const r = snapWithSource({ x: 206, y: -5 }, A(), GRID, R)
    expectPoint(r.point, 200, 0)
  })
})

describe("BCD: орто — проекция угла на ось жеста", () => {
  it("BCD-7: ось горизонтальна — конец на оси, абсцисса угла, ордината угла не влияет", () => {
    const r = snapAlongAxis({ x: 206, y: -4 }, A(), GRID, R, { x: 400, y: -4 }, "x")
    expectPoint(r.point, 200, -4)
  })

  it("BCD-8: угол дальше радиуса от курсора не участвует", () => {
    const r = snapAlongAxis({ x: 240, y: -4 }, A(), GRID, R, { x: 400, y: -4 }, "x")
    expectPoint(r.point, 240, -4)
  })
})

describe("BCD: перемещение стены и запрет наложения", () => {
  it("BCD-9: опорный конец перемещаемой стены совпадает с углом, вся стена сдвинута на тот же вектор", () => {
    const a = A()[0]
    const c = W(300, 100, 400, 100)
    const walls = [a, c]
    moveGesture(walls, [c], c, { x: 350, y: 100 }, [{ x: 262, y: 13 }], false)
    expectPoint(c.a, 210, 10)
    expectPoint(c.b, 310, 10)
  })

  it("BCD-10: привязка к углу не обходит запрет наложения", () => {
    const a = A()[0]
    const c = W(250, -100, 250, -60)
    const walls = [a, c]
    const target = snapWithSource({ x: 204, y: -13 }, [a], GRID, R)
    expectPoint(target.point, 200, -10)
    const p: Point = target.point
    moveEndpointBounded(walls, c, "b", p, { ortho: false })
    for (const piece of displayPolygons(c, walls)) expect(maxOverlap(piece, [a])).toBeLessThan(1e-6)
  })
})
