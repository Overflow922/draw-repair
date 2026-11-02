import { describe, expect, it } from "vitest"
import { reconstructionScene } from "../reconstruction/reconstruction-scene"
import { drawing, drywall } from "../reconstruction/reconstruction.test-utils"
import type { Drawing, DrywallWall, SectionLine } from "../types"

// change add-section-view: фигура в сцене плана «Реконструкция» (spec section-view «Фигура разреза»; design D2)

const lineA: SectionLine = { id: "L1", label: "A", view: "right", points: [{ x: 200, y: -100 }, { x: 200, y: 100 }] }

const withWalls = (walls: DrywallWall[], sections: SectionLine[] = [lineA]): Drawing =>
  drawing({ walls: [], reconstruction: { walls, dimensions: [], sections } })

describe("фигура в сцене", () => {
  it("SV-50: сцена содержит линию, фигуру и положение; габариты берутся по стене гипсокартона", () => {
    const [e] = reconstructionScene(withWalls([drywall("W", 100, 0, 300, 0, 10, 250)])).sections
    expect(e.line).toEqual(lineA)
    expect(e.figure.pieces).toEqual([{ wallId: "W", segment: 0, s0: 95, s1: 105, heightCm: 250 }])
    // габариты плана заканчиваются на x = 300: фигура начинается правее на зазор 100, пол на нижней границе y = 5
    expect(e.placement).toMatchObject({ x: 400, floorY: 5, width: 200, height: 250 })
  })

  it("SV-51: линия не следует за стеной, фигура пересчитывается: стену сдвинули за линию — сечения нет", () => {
    const before = reconstructionScene(withWalls([drywall("W", 100, 0, 300, 0)])).sections[0]
    const after = reconstructionScene(withWalls([drywall("W", 100, 300, 300, 300)])).sections[0]
    expect(after.line).toEqual(before.line)
    expect(before.figure.pieces).toHaveLength(1)
    expect(after.figure.pieces).toEqual([])
  })

  it("SV-52: возврат стены даёт то же сечение (пересчёт без остатка)", () => {
    const s = (y: number) => reconstructionScene(withWalls([drywall("W", 100, y, 300, y)])).sections[0].figure.pieces
    expect(s(300)).toEqual([])
    expect(s(0)).toHaveLength(1)
  })

  it("SV-53: без линий сцена не содержит фигур", () => {
    expect(reconstructionScene(withWalls([drywall("W", 100, 0, 300, 0)], [])).sections).toEqual([])
    expect(reconstructionScene(drawing()).sections).toEqual([])
  })

  it("SV-54: подложка в сечении не участвует, но входит в габариты", () => {
    // стена подложки до x = 600 расширяет габариты (зазор 100 даёт x = 700); сечений у линии нет
    const d = drawing({ walls: [{ id: "U", a: { x: 0, y: 0 }, b: { x: 600, y: 0 }, thicknessCm: 20, type: "brick" }], reconstruction: { walls: [], dimensions: [], sections: [lineA] } })
    const [e] = reconstructionScene(d).sections
    expect(e.figure.pieces).toEqual([])
    expect(e.placement.x).toBe(700)
  })
})
