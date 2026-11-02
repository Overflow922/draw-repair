import { describe, expect, it } from "vitest"
import { reconstructionScene } from "../reconstruction/reconstruction-scene"
import { drawing, drywall } from "../reconstruction/reconstruction.test-utils"
import type { Point, SectionLine, SectionShape } from "../types"
import { finishShape, placingPreview, startShape } from "./section-shape-placing"
import { figureHit } from "./section-shape-snap"

// change add-section-shapes: размещение детали двумя кликами и привязка (spec section-view «Инструмент «Деталь разреза» и
// размещение детали»)
//
//   стена W (100,0)-(300,0) толщиной 10 высотой 250; линия A: x = 200 от y = -100 до y = 100, взгляд right
//   фигура: x 400..600 (s = x - 400), пол y = 100 (z = 100 - y), высота 250, сечения стен s 0..10, 95..105 и 190..200     схематично, не в масштабе
//
//   y=-245 +------------------+  z=250
//          |        ///       |
//   y=-150 |  +-------        |  z=120 первый клик (s=10)
//   y=100  +------------------+  z=0
//          x=400            x=600
const LINE: SectionLine = { id: "L1", label: "A", view: "right", points: [{ x: 200, y: -100 }, { x: 200, y: 100 }] }
const RADIUS = 3

const entriesOf = (shapes: SectionShape[] = []) =>
  reconstructionScene(drawing({ walls: [], reconstruction: { walls: [drywall("W", 100, 0, 300, 0, 10, 250), drywall("E1", 100, -95, 300, -95, 10, 250), drywall("E2", 100, 95, 300, 95, 10, 250)], dimensions: [], sections: [LINE], sectionShapes: shapes } })).sections
const world = (s: number, z: number): Point => ({ x: 400 + s, y: 100 - z })

describe("привязка точки к фигуре", () => {
  it("SH-300: клик попадает на узел сетки 10 см от левого нижнего угла фигуры", () => {
    expect(figureHit(entriesOf(), world(13, 118), RADIUS)?.point).toEqual({ s: 10, z: 120 })
  })

  it("SH-301: рядом грань сечения в радиусе — точка на ней, а не на сетке", () => {
    // грань сечения s = 95, ближайший узел сетки 90 или 100: ближе грань
    expect(figureHit(entriesOf(), world(96, 120), RADIUS)?.point).toEqual({ s: 95, z: 120 })
    // верх сечения на z = 250
    expect(figureHit(entriesOf(), world(10, 249), RADIUS)?.point).toEqual({ s: 10, z: 250 })
  })

  it("SH-302: грани другой детали тоже привязывают", () => {
    const other: SectionShape = { id: "b", lineId: "L1", s0: 12, s1: 62, z0: 33, z1: 47 }
    expect(figureHit(entriesOf([other]), world(61, 46), RADIUS)?.point).toEqual({ s: 62, z: 47 })
  })

  it("SH-303: клик вне прямоугольника фигуры точку не задаёт", () => {
    expect(figureHit(entriesOf(), { x: 300, y: -200 }, RADIUS)).toBeNull()
    expect(figureHit(entriesOf(), world(210, 100), RADIUS)).toBeNull()
  })

  it("SH-304: фигура без стен (высота 0) деталей не принимает", () => {
    const empty = reconstructionScene(drawing({ walls: [], reconstruction: { walls: [], dimensions: [], sections: [LINE] } })).sections
    expect(empty[0].figure.height).toBe(0)
    expect(figureHit(empty, world(0, 0), RADIUS)).toBeNull()
  })

  it("SH-305: lineId удерживает точку на той же фигуре", () => {
    expect(figureHit(entriesOf(), world(50, 100), RADIUS, "OTHER")).toBeNull()
    expect(figureHit(entriesOf(), world(50, 100), RADIUS, "L1")?.point).toEqual({ s: 50, z: 100 })
  })
})

describe("двухкликовое размещение", () => {
  it("SH-310: два клика дают деталь s 10…190, z 120…130", () => {
    const entries = entriesOf()
    const first = startShape(entries, world(10, 120), RADIUS)
    expect(first).toEqual({ lineId: "L1", first: { s: 10, z: 120 } })
    expect(finishShape(first!, entries, world(190, 130), RADIUS, "p1")).toEqual({ id: "p1", lineId: "L1", s0: 10, s1: 190, z0: 120, z1: 130 })
  })

  it("SH-311: порядок углов не важен", () => {
    const entries = entriesOf()
    const first = startShape(entries, world(190, 130), RADIUS)
    expect(finishShape(first!, entries, world(10, 120), RADIUS, "p1")).toEqual({ id: "p1", lineId: "L1", s0: 10, s1: 190, z0: 120, z1: 130 })
  })

  it("SH-312: нулевая высота — точка не задана", () => {
    const entries = entriesOf()
    const first = startShape(entries, world(10, 120), RADIUS)
    expect(finishShape(first!, entries, world(190, 120), RADIUS, "p1")).toBeNull()
  })

  it("SH-313: первый клик вне фигуры — размещение не началось", () => {
    expect(startShape(entriesOf(), { x: 0, y: 0 }, RADIUS)).toBeNull()
  })

  it("SH-314: резинка показывает прямоугольник до курсора, у нулевого — ничего", () => {
    const entries = entriesOf()
    const first = startShape(entries, world(10, 120), RADIUS)!
    expect(placingPreview(first, entries, world(60, 160), RADIUS)).toMatchObject({ s0: 10, s1: 60, z0: 120, z1: 160 })
    expect(placingPreview(first, entries, world(60, 120), RADIUS)).toBeNull()
  })
})

describe("габарит сечений ограничивает фигуру", () => {
  // линия x = 200, y -100..100 (s 0..200) пересекает одну стену: сечение занимает только s 95..105, остальное — пустая часть линии
  const narrow = reconstructionScene(drawing({ walls: [], reconstruction: { walls: [drywall("W", 100, 0, 300, 0, 10, 250)], dimensions: [], sections: [LINE] } })).sections
  const at = (s: number, z: number): Point => ({ x: 400 + s, y: 5 - z })

  it("SH-316: клик левее самого левого и правее самого правого сечения точку не задаёт, на сечении — задаёт", () => {
    expect(figureHit(narrow, at(10, 120), RADIUS)).toBeNull()
    expect(figureHit(narrow, at(150, 120), RADIUS)).toBeNull()
    expect(figureHit(narrow, at(100, 120), RADIUS)?.point).toEqual({ s: 100, z: 120 })
  })
})
