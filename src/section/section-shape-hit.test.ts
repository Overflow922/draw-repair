import { describe, expect, it } from "vitest"
import { reconstructionScene } from "../reconstruction/reconstruction-scene"
import { drawing, drywall } from "../reconstruction/reconstruction.test-utils"
import type { Point, SectionLine, SectionShape } from "../types"
import { pickSection } from "./section-hit"
import { pickShape } from "./section-shape-hit"

// change add-section-shapes: попадание клика в деталь (spec section-view «Выделение, перемещение и правка детали разреза»)
//
//   фигура x 400..600 (s = x - 400), пол y = 5 (z = 5 - y), сечение стены s 95..105 высотой 250; полка s 10..90, z 120..125
//
//   z=250  |  ///  |
//   z=125  +=======/// <- полка примыкает к сечению
//   z=120  +=======///                                     схематично, не в масштабе
const LINE: SectionLine = { id: "L1", label: "A", view: "right", points: [{ x: 200, y: -100 }, { x: 200, y: 100 }] }
const SHELF: SectionShape = { id: "p1", lineId: "L1", s0: 10, s1: 90, z0: 120, z1: 125 }
const RADIUS = 6

const entries = reconstructionScene(drawing({ walls: [], reconstruction: { walls: [drywall("W", 100, 0, 300, 0, 10, 250)], dimensions: [], sections: [LINE], sectionShapes: [SHELF] } })).sections
const world = (s: number, z: number): Point => ({ x: 400 + s, y: 5 - z })

describe("попадание в деталь", () => {
  it("SH-400: клик по штриховке детали выбирает деталь", () => {
    expect(pickShape(entries, world(50, 122.5), RADIUS)).toEqual({ lineId: "L1", shapeId: "p1" })
  })

  it("SH-401: тонкая деталь ловится рядом с контуром, в запасе полрадиуса", () => {
    expect(pickShape(entries, world(50, 127), RADIUS)).toEqual({ lineId: "L1", shapeId: "p1" })
    expect(pickShape(entries, world(50, 130), RADIUS)).toBeNull()
  })

  it("SH-402: клик мимо детали — null", () => {
    expect(pickShape(entries, world(50, 200), RADIUS)).toBeNull()
    expect(pickShape(entries, { x: 0, y: 0 }, RADIUS)).toBeNull()
  })

  it("SH-403: клик по сечению стены выбирает линию, а не деталь", () => {
    const inCut = world(100, 200)
    expect(pickShape(entries, inCut, RADIUS)).toBeNull()
    expect(pickSection(entries, inCut, RADIUS)).toBe("L1")
  })

  it("SH-404: из пересекающихся деталей выбирается нарисованная поверх (последняя)", () => {
    const top: SectionShape = { ...SHELF, id: "p2", z0: 121, z1: 126 }
    const two = reconstructionScene(drawing({ walls: [], reconstruction: { walls: [drywall("W", 100, 0, 300, 0, 10, 250)], dimensions: [], sections: [LINE], sectionShapes: [SHELF, top] } })).sections
    expect(pickShape(two, world(50, 123), RADIUS)?.shapeId).toBe("p2")
  })
})
