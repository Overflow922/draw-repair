import { describe, expect, it } from "vitest"
import type { Point, SectionView } from "../types"
import type { SectionFigure } from "./section-figure"
import { layoutFigures } from "./section-layout"
import type { Bounds } from "./section-layout"

// change move-section-figure: переставленные фигуры в раскладке (spec section-view «Фигура разреза — положение»)

const fig = (label: string, view: SectionView, width: number, height: number): SectionFigure => ({
  lineId: `L${label}`,
  label,
  view,
  width,
  height,
  pieces: [],
})

const bounds: Bounds = { minX: 0, minY: 0, maxX: 400, maxY: 400 }
const spans = new Map([
  ["LA", { minX: 0, maxX: 200 }],
  ["LB", { minX: 0, maxX: 200 }],
])
const fixed = (id: string, at: Point): ReadonlyMap<string, Point> => new Map([[id, at]])

describe("переставленная фигура в раскладке", () => {
  it("MSF-10: переставленная фигура стоит на сохранённом месте и сохраняет размеры", () => {
    const [p] = layoutFigures([fig("A", "down", 200, 250)], bounds, spans, fixed("LA", { x: 800, y: 40 }))
    expect(p).toMatchObject({ lineId: "LA", x: 800, floorY: 40, width: 200, height: 250 })
  })

  it("MSF-11: переставленная фигура освобождает слот — следующая фигура той же стороны встаёт на первое место", () => {
    const placements = layoutFigures([fig("A", "down", 200, 250), fig("B", "down", 200, 100)], bounds, spans, fixed("LA", { x: 800, y: 40 }))
    const b = placements.find((p) => p.lineId === "LB")
    // зазор 100 под габаритами (maxY = 400): пол фигуры B на 500 + её высота 100
    expect(b).toMatchObject({ x: 0, floorY: 600 })
  })

  it("MSF-12: без переставленных фигур раскладка прежняя", () => {
    const placements = layoutFigures([fig("A", "down", 200, 250), fig("B", "down", 200, 100)], bounds, spans)
    expect(placements.find((p) => p.lineId === "LB")).toMatchObject({ floorY: 500 + 250 + 100 + 100 })
  })

  it("MSF-14: автоматическая фигура обходит переставленную, если та стоит на её месте (взгляд вниз)", () => {
    // A переставлена в слот под планом: x 0…200, y от 500 до 750 (пол на 750); B по порядку попадает туда же и сдвигается ниже
    const placements = layoutFigures([fig("A", "down", 200, 250), fig("B", "down", 200, 100)], bounds, spans, fixed("LA", { x: 0, y: 750 }))
    const b = placements.find((p) => p.lineId === "LB")
    expect(b).toMatchObject({ x: 0, floorY: 750 + 100 + 100 })
  })

  it("MSF-15: автоматическая фигура справа обходит переставленную на своём месте", () => {
    const placements = layoutFigures([fig("A", "right", 200, 250), fig("B", "right", 200, 100)], bounds, spans, fixed("LA", { x: 500, y: 400 }))
    expect(placements.find((p) => p.lineId === "LB")).toMatchObject({ x: 500 + 200 + 100 })
  })

  it("MSF-16: автоматическая фигура слева обходит переставленную на своём месте", () => {
    const placements = layoutFigures([fig("A", "left", 200, 250), fig("B", "left", 200, 100)], bounds, spans, fixed("LA", { x: -300, y: 400 }))
    // свободный слот B: x = -100 - 200 = -300…-100 занят A (x -300…-100); B уходит левее на зазор 100
    expect(placements.find((p) => p.lineId === "LB")).toMatchObject({ x: -300 - 100 - 200 })
  })

  it("MSF-17: автоматическая фигура над планом обходит переставленную на своём месте", () => {
    const placements = layoutFigures([fig("A", "up", 200, 250), fig("B", "up", 200, 100)], bounds, spans, fixed("LA", { x: 0, y: -100 }))
    expect(placements.find((p) => p.lineId === "LB")).toMatchObject({ floorY: -100 - 250 - 100 })
  })

  it("MSF-18: переставленная фигура в стороне от слота автоматическую не двигает", () => {
    const placements = layoutFigures([fig("A", "down", 200, 250), fig("B", "down", 200, 100)], bounds, spans, fixed("LA", { x: 5000, y: 750 }))
    expect(placements.find((p) => p.lineId === "LB")).toMatchObject({ x: 0, floorY: 600 })
  })

  it("MSF-13: переставленная фигура остаётся на месте, сколько бы ни росли габариты плана", () => {
    const wide: Bounds = { minX: -500, minY: -500, maxX: 2000, maxY: 2000 }
    const [p] = layoutFigures([fig("A", "right", 200, 250)], wide, spans, fixed("LA", { x: 800, y: 40 }))
    expect(p).toMatchObject({ x: 800, floorY: 40 })
  })
})
