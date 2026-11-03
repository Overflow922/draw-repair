import { describe, expect, it } from "vitest"
import { reconstructionScene } from "../reconstruction/reconstruction-scene"
import { drawing, drywall } from "../reconstruction/reconstruction.test-utils"
import type { SectionCornerPoint, SectionLine } from "../types"
import { sectionCornerPosition } from "./section-corners"
import { sectionExtent } from "./section-extent"

// change move-section-figure: всё, что построено от положения фигуры, следует за переставленной фигурой
// (spec section-view «Фигура разреза — положение»: размеры и точки замера на фигуре следуют за ней; PDF берёт то же положение)

const base: SectionLine = { id: "L1", label: "A", view: "right", points: [{ x: 250, y: 0 }, { x: 250, y: 200 }] }
const scene = (line: SectionLine) =>
  reconstructionScene(drawing({ walls: [], reconstruction: { walls: [drywall("G", 100, 100, 400, 100, 10, 250)], dimensions: [], sections: [line] } })).sections

const corner: SectionCornerPoint = { kind: "section", lineId: "L1", wallId: "G", segment: 0, at: { s: "lo", z: "floor" } }

describe("точки фигуры следуют за переставленной фигурой", () => {
  const auto = scene(base)
  const moved = scene({ ...base, figureAt: { x: auto[0].placement.x + 700, y: auto[0].placement.floorY - 90 } })

  it("MSF-70: фигура стоит на сохранённом месте, размеры фигуры те же", () => {
    expect(moved[0].placement).toMatchObject({ x: auto[0].placement.x + 700, floorY: auto[0].placement.floorY - 90 })
    expect(moved[0].placement.width).toBe(auto[0].placement.width)
    expect(moved[0].placement.height).toBe(auto[0].placement.height)
  })

  it("MSF-71: точка замера на углу сечения сдвигается вместе с фигурой, угол тот же", () => {
    const before = sectionCornerPosition(corner, auto)
    const after = sectionCornerPosition(corner, moved)
    expect(before).not.toBeNull()
    expect(after).toEqual({ x: (before?.x ?? 0) + 700, y: (before?.y ?? 0) - 90 })
  })

  it("MSF-72: габариты страницы PDF охватывают фигуру на новом месте", () => {
    const xs = sectionExtent(moved[0], 1, 3).map((p) => p.x)
    expect(Math.max(...xs)).toBeGreaterThanOrEqual(moved[0].placement.x + moved[0].placement.width)
    expect(Math.max(...xs)).toBeGreaterThan(Math.max(...sectionExtent(auto[0], 1, 3).map((p) => p.x)))
  })

  it("MSF-73: сечение стены в фигуре не меняется — фигура пересчитана по стене", () => {
    expect(moved[0].figure.pieces).toEqual(auto[0].figure.pieces)
  })
})
