import { describe, expect, it } from "vitest"
import type { SectionLine } from "../types"
import { rectOverlapsPolygon } from "./section-figure-collide"
import { boxPolygon, figureObstacles, figureRect } from "./section-figure-obstacles"
import type { SectionEntry } from "./section-scene"

// change move-section-figure: препятствия фигуры разреза (spec section-view «Перемещение фигуры разреза»)

const title = { width: 30, height: 14 }

const entry = (id: string, label: string, x: number, floorY: number, pinned = false): SectionEntry => {
  const line: SectionLine = {
    id,
    label,
    view: "right",
    points: [{ x: 200, y: -100 + x }, { x: 200, y: 100 + x }],
    ...(pinned ? { figureAt: { x, y: floorY } } : null),
  }
  return {
    line,
    shown: line,
    figure: { lineId: id, label, view: "right", width: 100, height: 50, pieces: [] },
    placement: { lineId: id, label, view: "right", x, floorY, width: 100, height: 50 },
    shapes: [],
  }
}

const blocks = (poly: readonly { x: number; y: number }[], r: { minX: number; minY: number; maxX: number; maxY: number }): boolean => rectOverlapsPolygon(r, poly)
const anyBlocks = (polys: readonly (readonly { x: number; y: number }[])[], r: { minX: number; minY: number; maxX: number; maxY: number }): boolean =>
  polys.some((p) => blocks(p, r))

describe("занятое место фигуры", () => {
  it("MSF-40: рамка включает название над фигурой", () => {
    expect(figureRect(entry("a", "A", 400, 100).placement, title)).toEqual({ minX: 400, maxX: 500, minY: 100 - 50 - 14, maxY: 100 })
  })

  it("MSF-41: название шире узкой фигуры расширяет рамку", () => {
    const narrow = { ...entry("a", "A", 400, 100).placement, width: 10 }
    expect(figureRect(narrow, title).maxX).toBe(430)
  })
})

describe("препятствия фигуры", () => {
  it("MSF-42: переставленная другая фигура вместе с названием — препятствие, своя фигура — нет", () => {
    const a = entry("a", "A", 400, 100, true)
    const b = entry("b", "B", 800, 100, true)
    const polys = figureObstacles({ entries: [a, b], lineId: "a", title, plan: [] })
    const overB = { minX: 790, minY: 100 - 50 - 14 - 5, maxX: 820, maxY: 100 - 50 - 10 }
    expect(anyBlocks(polys, overB)).toBe(true)
    expect(anyBlocks(polys, { minX: 410, minY: 60, maxX: 440, maxY: 90 })).toBe(false)
  })

  it("MSF-46: автоматическая фигура упором не служит — она сама уступает место переставленной", () => {
    const a = entry("a", "A", 400, 100, true)
    const b = entry("b", "B", 800, 100)
    const polys = figureObstacles({ entries: [a, b], lineId: "a", title, plan: [] })
    expect(anyBlocks(polys, { minX: 810, minY: 60, maxX: 840, maxY: 90 })).toBe(false)
  })

  it("MSF-43: линия разреза с обозначением — препятствие, в том числе линия самой фигуры", () => {
    const a = entry("a", "A", 400, 100)
    const polys = figureObstacles({ entries: [a], lineId: "a", title, plan: [] })
    expect(anyBlocks(polys, { minX: 195, minY: 350, maxX: 205, maxY: 360 })).toBe(true)
  })

  it("MSF-44: объекты плана из вызывающего кода входят в препятствия", () => {
    const a = entry("a", "A", 400, 100)
    const dimBox = boxPolygon({ minX: 0, minY: 300, maxX: 500, maxY: 320 })
    const polys = figureObstacles({ entries: [a], lineId: "a", title, plan: [dimBox] })
    expect(anyBlocks(polys, { minX: 100, minY: 310, maxX: 200, maxY: 340 })).toBe(true)
  })

  it("MSF-45: свободное место препятствием не считается", () => {
    const a = entry("a", "A", 400, 100)
    const polys = figureObstacles({ entries: [a], lineId: "a", title, plan: [] })
    expect(anyBlocks(polys, { minX: 1000, minY: 1000, maxX: 1100, maxY: 1050 })).toBe(false)
  })
})
