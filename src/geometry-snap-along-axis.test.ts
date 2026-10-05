import { describe, expect, it } from "vitest"
import { snapAlongAxis } from "./geometry"
import type { Axis } from "./ortho-axis"
import type { Point, Wall } from "./types"

// change ortho-axis-lock, wall-selection «Орто без боковой составляющей» (design D3): привязка
// вдоль заданной оси жеста через опорную точку при любом положении курсора — без конуса 15°.

const W = (ax: number, ay: number, bx: number, by: number): Wall => ({
  id: `s${ax}_${ay}_${bx}_${by}`,
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
  thicknessCm: 20,
  type: "brick",
})

const GRID = 10
const R = 5

describe("snapAlongAxis: точка на оси жеста", () => {
  it("SA-1: опорная точка вне сетки, вертикальная ось — x как у опорной, y по сетке", () => {
    expect(snapAlongAxis({ x: 7, y: -23 }, [], GRID, R, { x: 5, y: 15 }, "y").point).toEqual({ x: 5, y: -20 })
  })

  it("SA-2: линия вертикальной стены в радиусе — пересечение горизонтали с линией стены", () => {
    const wall = W(100, -100, 100, 100)
    const s = snapAlongAxis({ x: 97, y: 18 }, [wall], GRID, R, { x: 0, y: 15 }, "x")
    expect(s.point).toEqual({ x: 100, y: 15 })
    expect(s.axisWall).toBe(wall)
  })

  it("SA-3: параллельная оси стена рядом игнорируется — точка на оси по сетке", () => {
    const s = snapAlongAxis({ x: 150, y: 17 }, [W(0, 19, 300, 19)], GRID, R, { x: 0, y: 15 }, "x")
    expect(s.point).toEqual({ x: 150, y: 15 })
    expect(s.axisWall).toBeNull()
  })

  it("SA-5: курсор под 30° от опорной точки — точка всё равно на горизонтали (не по обеим координатам)", () => {
    expect(snapAlongAxis({ x: 52, y: 30 }, [], GRID, R, { x: 0, y: 0 }, "x").point).toEqual({ x: 50, y: 0 })
  })

  it("SA-6: ось задана явно — курсор почти на вертикали не меняет горизонтальную ось", () => {
    expect(snapAlongAxis({ x: 3, y: 100 }, [], GRID, R, { x: 0, y: 0 }, "x").point).toEqual({ x: 0, y: 0 })
    expect(snapAlongAxis({ x: 100, y: 3 }, [], GRID, R, { x: 0, y: 0 }, "y").point).toEqual({ x: 0, y: 0 })
  })

  it("SA-7: конец стены в радиусе — его проекция на ось", () => {
    const s = snapAlongAxis({ x: 201, y: 16 }, [W(180, 20, 203, 20)], GRID, R, { x: 0, y: 15 }, "x")
    expect(s.point).toEqual({ x: 203, y: 15 })
    expect(s.axisWall).toBeNull()
  })
})

describe("snapAlongAxis: инвариант оси (INV-SNAP)", () => {
  const through: Point = { x: 3.7, y: 15.3 }
  const scenes: Wall[][] = [[], [W(0, 19, 300, 19)], [W(100, -100, 100, 100)], [W(180, 20, 203, 20)], [W(0, 10, 300, 30)]]
  // курсоры под 0°, 30°, 45°, 60°, 90° и в обратных направлениях от опорной точки
  const cursors: Point[] = [0, 30, 45, 60, 90, 135, 210, 300].map((deg) => {
    const r = (deg * Math.PI) / 180
    return { x: through.x + 120 * Math.cos(r), y: through.y + 120 * Math.sin(r) }
  })
  const axes: Axis[] = ["x", "y"]

  it("координата поперёк оси точно равна координате опорной точки", () => {
    for (const walls of scenes)
      for (const cursor of cursors)
        for (const axis of axes) {
          const p = snapAlongAxis(cursor, walls, GRID, R, through, axis).point
          if (axis === "x") expect(p.y).toBe(through.y)
          else expect(p.x).toBe(through.x)
        }
  })
})
