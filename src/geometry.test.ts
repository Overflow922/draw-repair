import { describe, expect, it } from "vitest"
import { pointsEqual, snap, visibleWorld, zoomAt } from "./geometry"
import type { Point, Wall } from "./types"

const GRID = 10
const RADIUS = 6

const wall = (ax: number, ay: number, bx: number, by: number): Wall => ({
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
  thicknessCm: 20,
  type: "partition",
})

describe("snap", () => {
  it("привязывается к концу стены в пределах радиуса", () => {
    const walls = [wall(0, 0, 100, 0)]
    expect(snap({ x: -4, y: 3 }, walls, GRID, RADIUS)).toEqual({ x: 0, y: 0 })
  })

  it("T-образный стык: привязывается к линии стены", () => {
    const walls = [wall(0, 0, 100, 0)]
    const p = snap({ x: 55, y: 5 }, walls, GRID, RADIUS)
    expect(p.x).toBeCloseTo(55)
    expect(p.y).toBeCloseTo(0)
  })

  it("стена имеет приоритет над узлом сетки", () => {
    const walls = [wall(0, 0, 100, 0)]
    expect(snap({ x: 9, y: 3 }, walls, GRID, RADIUS)).toEqual({ x: 9, y: 0 })
  })

  it("за пределами радиуса стены привязывается к узлу сетки", () => {
    const walls = [wall(0, 0, 100, 0)]
    expect(snap({ x: 55, y: 7 }, walls, GRID, RADIUS)).toEqual({ x: 60, y: 10 })
  })

  it("без стен рядом привязывается к ближайшему узлу сетки", () => {
    expect(snap({ x: 53, y: 57 }, [wall(0, 200, 100, 200)], GRID, RADIUS)).toEqual({ x: 50, y: 60 })
  })

  it("выбирает ближайшего кандидата среди стен", () => {
    const walls = [wall(0, 0, 100, 0), wall(0, 0, 0, 100)]
    expect(snap({ x: 2, y: 4 }, walls, GRID, RADIUS)).toEqual({ x: 0, y: 4 })
  })
})

describe("snap с орто-привязкой 90°", () => {
  const from: Point = { x: 0, y: 50 }

  it("почти горизонтальное направление притягивается к горизонтали", () => {
    expect(snap({ x: 50.4, y: 51 }, [], GRID, RADIUS, from)).toEqual({ x: 50, y: 50 })
  })

  it("почти вертикальное направление притягивается к вертикали", () => {
    expect(snap({ x: 1, y: 41 }, [], GRID, RADIUS, from)).toEqual({ x: 0, y: 40 })
  })

  it("диагональ не притягивается", () => {
    expect(snap({ x: 33, y: 81 }, [], GRID, RADIUS, from)).toEqual({ x: 30, y: 80 })
  })

  it("привязка к стенам имеет приоритет над орто", () => {
    const walls = [wall(0, 0, 100, 0)]
    expect(snap({ x: 45, y: 1 }, walls, GRID, RADIUS, from)).toEqual({ x: 45, y: 0 })
  })

  it("без орто-точки привязка к сетке как раньше", () => {
    expect(snap({ x: 45.4, y: 46 }, [], GRID, RADIUS)).toEqual({ x: 50, y: 50 })
  })
})

describe("zoomAt", () => {
  it("сохраняет мировую точку под курсором", () => {
    const view = { zoom: 1, pan: { x: 100, y: 50 } }
    const anchor = { x: 80, y: 60 }
    const next = zoomAt(view, 1.1, anchor, 2)
    expect(next.pan.x + anchor.x / (2 * next.zoom)).toBeCloseTo(view.pan.x + anchor.x / 2)
    expect(next.pan.y + anchor.y / (2 * next.zoom)).toBeCloseTo(view.pan.y + anchor.y / 2)
  })

  it("ограничивает масштаб сверху", () => {
    expect(zoomAt({ zoom: 10, pan: { x: 0, y: 0 } }, 1.1, { x: 40, y: 40 }, 2).zoom).toBe(10)
  })

  it("ограничивает масштаб снизу", () => {
    expect(zoomAt({ zoom: 0.1, pan: { x: 0, y: 0 } }, 0.9, { x: 40, y: 40 }, 2).zoom).toBe(0.1)
  })
})

describe("visibleWorld", () => {
  it("возвращает видимый мировой прямоугольник", () => {
    expect(visibleWorld({ zoom: 2, pan: { x: 100, y: 50 } }, 800, 600, 2)).toEqual({
      min: { x: 100, y: 50 },
      max: { x: 300, y: 200 },
    })
  })
})

describe("pointsEqual", () => {
  it("фильтрует совпадающие точки и пропускает различные", () => {
    const p: Point = { x: 5, y: 5 }
    expect(pointsEqual(p, { x: 5, y: 5 })).toBe(true)
    expect(pointsEqual(p, { x: 5.1, y: 5 })).toBe(false)
  })
})
