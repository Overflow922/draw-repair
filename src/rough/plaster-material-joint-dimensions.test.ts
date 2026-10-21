import { describe, expect, it } from "vitest"
import type { Drawing } from "../types"
import { plasterDimensions } from "./plaster-dimensions"
import { roughScene } from "./rough-scene"
import { drawing, plaster, wall } from "./rough.test-utils"

// spec rough-works-plan «Размер штукатурки от угла до угла»: на стыке коллинеарных стен разных материалов число размера
// равно длине участка на грани, без поправок на тело соседней стены (в браузере было 2710 вместо 2500 и 5210 вместо 5000)

const K = 2
const LABEL = 14

function widths(d: Drawing, markId: string): number[] {
  const scene = roughScene(d)
  const piece = scene.pieces.find((p) => p.mark.id === markId)
  if (!piece) return []
  return plasterDimensions(piece, scene.pieces, scene.base.walls, "cm", K, LABEL, scene.base.doorways)
    .filter((x) => x.target === "width")
    .map((x) => x.valueCm)
}

describe("размер штукатурки на стыке стен разных материалов", () => {
  it("MJ-1: кирпич и ГКЛ по 250 см с пометками на обеих — один размер 500 см", () => {
    const d = drawing({
      walls: [wall("S1", 0, 500, 250, 500, 20, "brick"), wall("S2", 250, 500, 500, 500, 20, "gkl")],
      roughPlaster: [plaster("m1", "S1", 1, "a", 0, 250), plaster("m2", "S2", 1, "a", 0, 250)],
    })
    expect(widths(d, "m1")).toEqual([500])
    expect(widths(d, "m2")).toEqual([500])
  })

  it("MJ-2: пометка 0–500 на кирпичной стене, за её концом бетонная стена 80 см без пометки — размер 500 см", () => {
    const d = drawing({
      walls: [wall("E", 0, 0, 500, 0, 20, "brick"), wall("N", 500, 0, 580, 0, 20, "concrete")],
      roughPlaster: [plaster("m1", "E", 1, "a", 0, 500)],
    })
    expect(widths(d, "m1")).toEqual([500])
  })
})
