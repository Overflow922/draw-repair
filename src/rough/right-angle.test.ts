import { describe, expect, it } from "vitest"
import type { RightAngleMark } from "../types"
import { activeRightAngles, cornerStrips } from "./right-angle"
import { roughScene } from "./rough-scene"
import { drawing, plaster, wall } from "./rough.test-utils"
import type { RoughParts } from "./rough.test-utils"

// change plaster-right-angle: действие пометок прямых углов в сцене плана
// (spec rough-works-plan «Пометка прямого угла»; design D3)

const A = wall("A", 0, 0, 500, 0)
const B = wall("B", 500, 0, 500, 400)
const pa = plaster("pa", "A", 1, "a", 0, 500)
const pb = plaster("pb", "B", 1, "a", 0, 400)
const mark = (id: string, order: "canonical" | "reversed" = "canonical"): RightAngleMark => {
  const refs = [{ markId: "pa", at: "to" }, { markId: "pb", at: "from" }] as const
  return { id, corner: order === "canonical" ? [refs[0], refs[1]] : [refs[1], refs[0]] }
}

const sceneOf = (parts: RoughParts) => roughScene(drawing({ walls: [A, B], roughPlaster: [pa, pb], ...parts }))

describe("пометки прямых углов в сцене", () => {
  it("RA-20: пометка на внутреннем угле действует, знак в вершине (488; 12)", () => {
    const scene = sceneOf({ roughAngles: [mark("r")] })
    expect(scene.corners).toHaveLength(1)
    expect(scene.rightAngles).toHaveLength(1)
    expect(scene.rightAngles[0]?.mark.id).toBe("r")
    expect(scene.rightAngles[0]?.corner.point.x).toBeCloseTo(488, 6)
    expect(scene.rightAngles[0]?.corner.point.y).toBeCloseTo(12, 6)
  })

  it("RA-20: порядок ссылок в хранилище значения не имеет", () => {
    expect(sceneOf({ roughAngles: [mark("r", "reversed")] }).rightAngles).toHaveLength(1)
  })

  it("RA-21: снята штукатурка с одной грани — пометка не действует, но остаётся в списке", () => {
    const marks = [mark("r")]
    const without = sceneOf({ roughPlaster: [pa], roughAngles: marks })
    expect(without.rightAngles).toEqual([])
    expect(marks).toHaveLength(1)
    expect(sceneOf({ roughAngles: marks }).rightAngles).toHaveLength(1)
  })

  it("RA-21: пометка на отсутствующую штукатурку не действует", () => {
    expect(sceneOf({ roughPlaster: [], roughAngles: [mark("r")] }).rightAngles).toEqual([])
  })

  it("RA-22: на один угол приходится одна действующая пометка — первая", () => {
    const scene = sceneOf({ roughAngles: [mark("first"), mark("second", "reversed")] })
    expect(scene.rightAngles.map((a) => a.mark.id)).toEqual(["first"])
  })

  it("RA-23: смена толщины соседней полосы двигает знак, пометка действует", () => {
    const scene = sceneOf({ roughPlaster: [pa, plaster("pb", "B", 1, "a", 0, 400, 37)], roughAngles: [mark("r")] })
    expect(scene.rightAngles).toHaveLength(1)
    expect(scene.rightAngles[0]?.corner.point.x).toBeCloseTo(486.3, 6)
  })

  it("RA-24: пометка не меняет полосы и площади", () => {
    const plain = sceneOf({})
    const marked = sceneOf({ roughAngles: [mark("r")] })
    expect(marked.strips).toEqual(plain.strips)
    expect(marked.netItems).toEqual(plain.netItems)
  })

  it("RA-25: чертёж без списка — действующих пометок нет", () => {
    expect(sceneOf({}).rightAngles).toEqual([])
  })

  it("RA-26: подсвечиваются полосы только двух пометок угла", () => {
    const scene = sceneOf({ roughPlaster: [pa, pb, plaster("other", "A", -1, "a", 0, 500)] })
    const corner = scene.corners[0]
    if (!corner) throw new Error("нет угла")
    const strips = cornerStrips(corner, scene.pieces)
    expect(strips).toHaveLength(2)
    const ys = strips.flat().map((p) => p.y)
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(10 - 1e-9) // полоса грани −1 (y < −10) не подсвечена
  })

  it("activeRightAngles сопоставляет напрямую со списком углов", () => {
    const scene = sceneOf({})
    expect(activeRightAngles(scene.corners, [mark("r")])).toHaveLength(1)
    expect(activeRightAngles([], [mark("r")])).toEqual([])
  })
})
