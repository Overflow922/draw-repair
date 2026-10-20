import { describe, expect, it } from "vitest"
import type { Drawing, PlasterMark, Wall } from "../types"
import { plasterPieces } from "./plaster"
import { plasterDimensions } from "./plaster-dimensions"
import { roughScene } from "./rough-scene"
import { drawing, plaster, wall } from "./rough.test-utils"
import { px, setup } from "./plaster-tool.test-utils"

// change plaster-dimension-collinear-joint: ширина участка штукатурки на стыке коллинеарных стен разной толщины равна нарисованному
// куску и не заходит на соседа (spec rough-works-plan «Размер участка на стыке коллинеарных стен»)

interface Width {
  valueCm: number
  x0: number
  x1: number
}

// ширина куска грани +1 стены id: значение и границы размерной линии вдоль оси x
function widthOf(d: Drawing, id: string): Width | undefined {
  const scene = roughScene(d)
  const piece = plasterPieces(d).find((p) => p.wall.id.startsWith(id) && p.mark.face === 1)
  const dim = piece && plasterDimensions(piece, scene.pieces, scene.base.walls, "cm", 2, 14).find((x) => x.side === 1 && x.target === "width")
  if (!dim) return undefined
  const xs = [dim.geom.p1.x, dim.geom.p2.x]
  return { valueCm: dim.valueCm, x0: Math.min(...xs), x1: Math.max(...xs) }
}

function expectWidth(w: Width | undefined, valueCm: number, x0: number, x1: number): void {
  expect(w?.valueCm).toBeCloseTo(valueCm, 6)
  expect(w?.x0).toBeCloseTo(x0, 6)
  expect(w?.x1).toBeCloseTo(x1, 6)
}

// общая грань y = 3.5: W1 толщиной 7 см и W2 толщиной 10 см со сдвигом оси на 1.5 см; far — стена чертежа, задающая самую большую толщину
const W1 = wall("W1", 0, 0, 100, 0, 7)
const W2 = wall("W2", 100, -1.5, 300, -1.5, 10)
const MARKS: PlasterMark[] = [plaster("m1", "W1", 1, "a", 0, 100), plaster("m2", "W2", 1, "a", 0, 200)]
const far = (thicknessCm: number): Wall => wall("far", 0, 1000, 300, 1000, thicknessCm)

describe("стык стен разной толщины", () => {
  it("DJ-1: ширины 100 и 200 см, линии размеров смыкаются в x = 100 и не перекрываются", () => {
    const d = drawing({ walls: [W1, W2, far(25)], roughPlaster: MARKS })
    expectWidth(widthOf(d, "W1"), 100, 0, 100)
    expectWidth(widthOf(d, "W2"), 200, 100, 300)
  })

  it.each([5, 25, 60])("DJ-2: ширина и границы не зависят от толщины самой толстой стены чертежа (%d см)", (thicknessCm) => {
    const d = drawing({ walls: [W1, W2, far(thicknessCm)], roughPlaster: MARKS })
    expectWidth(widthOf(d, "W1"), 100, 0, 100)
    expectWidth(widthOf(d, "W2"), 200, 100, 300)
  })

  it("DJ-3: выносные линии стоят на краях нарисованной полосы", () => {
    const d = drawing({ walls: [W1, W2, far(25)], roughPlaster: MARKS })
    for (const id of ["W1", "W2"]) {
      const strip = plasterPieces(d).find((p) => p.wall.id.startsWith(id))
      const xs = strip ? [strip.from, strip.to] : []
      const w = widthOf(d, id)
      const origin = id === "W1" ? 0 : 100
      expectWidth(w, (xs[1] ?? NaN) - (xs[0] ?? NaN), origin + (xs[0] ?? NaN), origin + (xs[1] ?? NaN))
    }
  })
})

describe("правка числа на стыке", () => {
  it("DJ-4: ширина W2 150 — участок 0–150 (границы правки те же, что у размера)", () => {
    const s = setup(drawing({ walls: [W1, W2, far(25)], roughPlaster: MARKS }))
    s.tool.select(px(200, 4.5))
    const scene = roughScene(s.drawing())
    const piece = scene.pieces.find((p) => p.mark.id === "m2")
    const dim = piece && plasterDimensions(piece, scene.pieces, scene.base.walls, "cm", 2, 14).find((x) => x.side === 1 && x.target === "width")
    const spot = dim && s.tool.numberAt(dim.spot.center, "cm", 2, 14, 0)
    expect(spot).not.toBeNull()
    expect(spot && s.tool.applyNumber(spot, 150)).toBe(true)
    expect(s.marks()).toEqual([plaster("m1", "W1", 1, "a", 0, 100), plaster("m2", "W2", 1, "a", 0, 150)])
  })
})

describe("чертёж пользователя: кухня «Чертежа 2»", () => {
  // 4fec4452 (7 см, обмер) и a0048405 (10 см, «Монтаж») с общей гранью y = 405.6; у пользователя размеры показывали 703 и 2003
  const d: Drawing = {
    ...drawing({
      walls: [wall("4fec4452", 130.6, 402.1, 178.9, 402.1, 7, "blocks"), wall("63bcbab7", 450.7, 828.9, 450.7, 665.4, 25, "concrete")],
      mounting: { walls: [wall("a0048405", 178.9, 400.6, 353.2, 400.6, 10, "blocks")], dimensions: [] },
    }),
    roughPlaster: [plaster("be73e1b9", "4fec4452", 1, "a", 0, 48.3), plaster("3c8153b6", "a0048405", 1, "a", 0, 174.3)],
  }

  it("DJ-5: ширины равны длинам кусков (48.3 и 174.3 см), линии не перекрываются", () => {
    const first = widthOf(d, "4fec4452")
    const second = widthOf(d, "a0048405")
    expect(first?.valueCm).toBeCloseTo(48.3, 6)
    expect(second?.valueCm).toBeCloseTo(174.3, 6)
    expect(first?.x1).toBeLessThanOrEqual((second?.x0 ?? NaN) + 1e-6)
  })
})
