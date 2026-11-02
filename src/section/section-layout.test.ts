import { describe, expect, it } from "vitest"
import type { SectionView } from "../types"
import type { SectionFigure } from "./section-figure"
import { figureToWorld, layoutFigures } from "./section-layout"
import type { Bounds } from "./section-layout"

// change add-section-view: положение фигур разреза (spec section-view «Фигура разреза — положение»)

const fig = (label: string, view: SectionView, width: number, height: number): SectionFigure => ({
  lineId: `L${label}`,
  label,
  view,
  width,
  height,
  pieces: [],
})

// габариты плана: x от 100 до 300, y от -5 до 5 (стена гипсокартона 100…300, толщина 10)
const wallBounds: Bounds = { minX: 100, minY: -5, maxX: 300, maxY: 5 }
const lines = (...xs: [string, number, number][]) => new Map(xs.map(([id, minX, maxX]) => [id, { minX, maxX }]))

describe("положение фигуры", () => {
  it("SV-40: взгляд вправо — фигура правее габаритов на зазор 100, пол на нижней границе", () => {
    const [p] = layoutFigures([fig("A", "right", 200, 250)], wallBounds, lines(["LA", 200, 200]))
    expect(p).toMatchObject({ lineId: "LA", x: 400, floorY: 5, width: 200, height: 250 })
  })

  it("SV-41: взгляд влево — фигура левее габаритов на зазор 100", () => {
    const [p] = layoutFigures([fig("A", "left", 200, 250)], wallBounds, lines(["LA", 200, 200]))
    expect(p).toMatchObject({ x: 100 - 100 - 200, floorY: 5 })
  })

  it("SV-42: взгляд вверх — фигура выше y = −100 по тем же X, что линия", () => {
    // габариты плана по y от 0 до 400, линия (0,0)-(200,0)
    const b: Bounds = { minX: 0, minY: 0, maxX: 300, maxY: 400 }
    const [p] = layoutFigures([fig("A", "up", 200, 250)], b, lines(["LA", 0, 200]))
    expect(p).toMatchObject({ x: 0, floorY: -100, width: 200, height: 250 })
  })

  it("SV-43: взгляд вниз — фигура ниже габаритов на зазор 100, по X те же координаты, что у линии", () => {
    const b: Bounds = { minX: 0, minY: 0, maxX: 300, maxY: 400 }
    const [p] = layoutFigures([fig("A", "down", 200, 250)], b, lines(["LA", 0, 200]))
    // верх фигуры на y = 500, пол на y = 750
    expect(p).toMatchObject({ x: 0, floorY: 750 })
  })

  it("SV-44: две фигуры одной стороны не перекрываются — вторая дальше на высоту первой плюс зазор", () => {
    const b: Bounds = { minX: 0, minY: 0, maxX: 300, maxY: 400 }
    const ps = layoutFigures([fig("B", "down", 200, 150), fig("A", "down", 200, 250)], b, lines(["LA", 0, 200], ["LB", 0, 200]))
    const a = ps.find((p) => p.lineId === "LA")
    const bb = ps.find((p) => p.lineId === "LB")
    expect(a?.floorY).toBe(750)
    // верх B = пол A + 100 = 850, пол B = 850 + 150
    expect(bb?.floorY).toBe(1000)
  })

  it("SV-45: фигуры вправо стоят друг за другом по ширине", () => {
    const ps = layoutFigures([fig("A", "right", 200, 250), fig("B", "right", 120, 100)], wallBounds, lines(["LA", 0, 0], ["LB", 0, 0]))
    expect(ps.find((p) => p.lineId === "LA")?.x).toBe(400)
    // правый край A = 600, зазор 100
    expect(ps.find((p) => p.lineId === "LB")?.x).toBe(700)
  })

  it("SV-46: фигуры разных сторон считаются независимо", () => {
    const b: Bounds = { minX: 0, minY: 0, maxX: 300, maxY: 400 }
    const ps = layoutFigures([fig("A", "up", 200, 250), fig("B", "down", 200, 250)], b, lines(["LA", 0, 200], ["LB", 0, 200]))
    expect(ps.find((p) => p.lineId === "LA")?.floorY).toBe(-100)
    expect(ps.find((p) => p.lineId === "LB")?.floorY).toBe(750)
  })

  it("SV-47: порядок по обозначению: A1 идёт после Z", () => {
    const b: Bounds = { minX: 0, minY: 0, maxX: 300, maxY: 400 }
    const ps = layoutFigures([fig("A1", "down", 100, 50), fig("Z", "down", 100, 50)], b, lines(["LA1", 0, 100], ["LZ", 0, 100]))
    expect((ps.find((p) => p.lineId === "LZ")?.floorY ?? 0) < (ps.find((p) => p.lineId === "LA1")?.floorY ?? 0)).toBe(true)
  })
})

describe("перевод точки фигуры в чертёж", () => {
  it("SV-48: s от левого края вправо, z вверх от пола", () => {
    const [p] = layoutFigures([fig("A", "right", 200, 250)], wallBounds, lines(["LA", 200, 200]))
    expect(figureToWorld(p, 95, 0)).toEqual({ x: 495, y: 5 })
    expect(figureToWorld(p, 105, 250)).toEqual({ x: 505, y: -245 })
  })
})
