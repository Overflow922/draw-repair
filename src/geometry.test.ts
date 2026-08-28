import { describe, expect, it } from "vitest"
import { endpointAt, hitWall, moveEndpoint, pointsEqual, snap, visibleWorld, zoomAt } from "./geometry"
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

describe("snap к продолжению линии за концом стены", () => {
  it("тянет к продолжению линии за концом, если конец вне радиуса", () => {
    expect(snap({ x: 356, y: 98 }, [wall(100, 100, 300, 100)], GRID, RADIUS)).toEqual({ x: 356, y: 100 })
  })

  it("конец стены в радиусе приоритетнее продолжения линии", () => {
    expect(snap({ x: 103, y: 3 }, [wall(0, 0, 100, 0)], GRID, RADIUS)).toEqual({ x: 100, y: 0 })
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

describe("hitWall", () => {
  it("попадает в тонкую стену только в пределах допуска", () => {
    const w = wall(0, 0, 100, 0)
    expect(hitWall({ x: 50, y: 9 }, [w], 10)).toBe(w)
    expect(hitWall({ x: 50, y: 11 }, [w], 10)).toBeNull()
  })

  it("попадает в толстую стену по полосе даже вне допуска", () => {
    const w = wall(0, 0, 100, 0)
    w.thicknessCm = 40
    expect(hitWall({ x: 50, y: 19 }, [w], 5)).toBe(w)
    expect(hitWall({ x: 50, y: 21 }, [w], 5)).toBeNull()
  })

  it("выбирает ближайшую из перекрывающихся стен", () => {
    const w1 = wall(0, 0, 100, 0)
    const w2 = wall(50, 0, 50, 100)
    expect(hitWall({ x: 40, y: 6 }, [w1, w2], 10)).toBe(w1)
    expect(hitWall({ x: 40, y: 14 }, [w1, w2], 10)).toBe(w2)
  })
})

describe("endpointAt", () => {
  it("попадает в концы стены", () => {
    const w = wall(0, 0, 100, 0)
    expect(endpointAt({ x: 3, y: 4 }, w, 6)).toBe("a")
    expect(endpointAt({ x: 97, y: -4 }, w, 6)).toBe("b")
  })

  it("не попадает в середину стены", () => {
    expect(endpointAt({ x: 50, y: 0 }, wall(0, 0, 100, 0), 6)).toBeNull()
  })
})

describe("moveEndpoint", () => {
  it("перемещает конец стены", () => {
    const w = wall(0, 0, 100, 0)
    moveEndpoint([w], w, "b", { x: 150, y: 0 })
    expect(w.b).toEqual({ x: 150, y: 0 })
    expect(w.a).toEqual({ x: 0, y: 0 })
  })

  it("тянет совпавшие концы соседних стен", () => {
    const w1 = wall(0, 0, 100, 0)
    const w2 = wall(100, 0, 100, 100)
    const w3 = wall(200, 0, 200, 100)
    moveEndpoint([w1, w2, w3], w1, "b", { x: 120, y: 0 })
    expect(w2.a).toEqual({ x: 120, y: 0 })
    expect(w3.a).toEqual({ x: 200, y: 0 })
  })
})
