import { describe, expect, it } from "vitest"
import { reconstructionScene } from "../reconstruction/reconstruction-scene"
import { drawing, drywall } from "../reconstruction/reconstruction.test-utils"
import type { Drawing, DrywallWall, SectionLine, SectionShape, SectionView } from "../types"
import { shapeWorldBox } from "./section-layout"
import type { FigurePlacement } from "./section-layout"

// change add-section-shapes: детали в сцене плана «Реконструкция» (spec section-view «Деталь разреза»; design D2)
//
//   стена W (100,0)-(300,0), линия A: x = 200, взгляд right, фигура правее x = 400, пол y = 5     схематично, не в масштабе
//
//   y=-100 A
//          |            фигура: x 400..600, пол y = 5
//   W: ####|####         деталь s 30..190, z 120..125  ->  x 430..590, y -120..-115
//          A
const lineA: SectionLine = { id: "L1", label: "A", view: "right", points: [{ x: 200, y: -100 }, { x: 200, y: 100 }] }
const SHELF: SectionShape = { id: "p1", lineId: "L1", s0: 30, s1: 190, z0: 120, z1: 125 }

const withShapes = (walls: DrywallWall[], sectionShapes: SectionShape[]): Drawing =>
  drawing({ walls: [], reconstruction: { walls, dimensions: [], sections: [lineA], sectionShapes } })

describe("детали в сцене", () => {
  it("SH-200: запись линии содержит только её детали", () => {
    const other: SectionShape = { ...SHELF, id: "p2", lineId: "OTHER" }
    const [entry] = reconstructionScene(withShapes([drywall("W", 100, 0, 300, 0, 10, 250)], [SHELF, other])).sections
    expect(entry.shapes).toEqual([SHELF])
  })

  it("SH-201: без деталей список пуст", () => {
    const [entry] = reconstructionScene(drawing({ walls: [], reconstruction: { walls: [drywall("W", 100, 0, 300, 0, 10, 250)], dimensions: [], sections: [lineA] } })).sections
    expect(entry.shapes).toEqual([])
  })

  it("SH-202: деталь не следует за стеной: сдвиг стены и возврат не меняют границы", () => {
    const at = (y: number) => reconstructionScene(withShapes([drywall("W", 100, y, 300, y, 10, 250)], [SHELF])).sections[0].shapes
    expect(at(0)).toEqual([SHELF])
    expect(at(300)).toEqual([SHELF])
    expect(at(0)).toEqual([SHELF])
  })
})

describe("прямоугольник детали в чертеже", () => {
  it("SH-210: фигура справа: деталь s 30..190, z 120..125 стоит в x 430..590, y -120..-115", () => {
    const [entry] = reconstructionScene(withShapes([drywall("W", 100, 0, 300, 0, 10, 250)], [SHELF])).sections
    expect(shapeWorldBox(entry.placement, SHELF)).toEqual({ minX: 430, minY: -120, maxX: 590, maxY: -115 })
  })

  it.each<SectionView>(["up", "down", "left", "right"])("SH-211: взгляд %s: верх детали выше низа, левая грань левее правой", (view) => {
    const placement: FigurePlacement = { lineId: "L1", label: "A", view, x: 400, floorY: 105, width: 220, height: 250 }
    const box = shapeWorldBox(placement, SHELF)
    expect(box).toEqual({ minX: 430, minY: -20, maxX: 590, maxY: -15 })
    expect(box.minX).toBeLessThan(box.maxX)
    expect(box.minY).toBeLessThan(box.maxY)
  })
})
