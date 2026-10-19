import { describe, expect, it } from "vitest"
import type { Point, Wall } from "../types"
import { chainSegment } from "../wall-chain"
import type { StartRef } from "../wall-angle"
import { snapRadiusCm } from "../wall-snap"
import { plasterTarget } from "./plaster-face"
import { wall } from "./rough.test-utils"

// change collinear-axes-meet (spec rough-works-plan «Штукатурка не прерывается на стыке коллинеарных стен»):
// стена, нарисованная прилипанием к торцу, сходится с ранней осью, и штукатурка идёт сквозь стык без щели.

const R = 5
const at = (x: number, y: number): Point => ({ x, y })
const summary = (walls: readonly Wall[], p: Point) =>
  plasterTarget(p, walls, R)?.pieces.map((x) => [x.wall.id, x.face, Math.round(x.from * 10) / 10, Math.round(x.to * 10) / 10])

// вторая стена так, как её строит инструмент «Стена»: первый клик у торца, сегмент вдоль оси, длина введена
function drawnAlong(early: Wall, start: Point, ref: StartRef, id: string, thicknessCm: number, lengthCm: number, type: Wall["type"]): Wall {
  const seg = chainSegment({
    start,
    ref,
    raw: at(start.x + 200, start.y),
    walls: [early],
    radiusCm: snapRadiusCm(1),
    gridStepCm: 10,
    thicknessCm,
    ortho: true,
    typedAngleDeg: null,
    typedLengthCm: lengthCm,
  })
  return wall(id, seg.start.x, seg.start.y, seg.end.x, seg.end.y, thicknessCm, type)
}

describe("штукатурка на стыке нарисованных стен", () => {
  it("PJ-1: кирпич и бетон одной толщины — сплошной участок 0–300 + 0–300 без щели", () => {
    const w1 = wall("W1", 0, 0, 300, 0, 20, "brick")
    const w2 = drawnAlong(w1, at(310, 0), { kind: "cap", normal: at(1, 0), anchor: at(300, 0) }, "W2", 20, 300, "concrete")
    expect(w2.a).toEqual(at(300, 0))
    expect(summary([w1, w2], at(100, 15))).toEqual([
      ["W1", 1, 0, 300],
      ["W2", 1, 0, 300],
    ])
  })

  it("PJ-2: стена толще и тоньше (40 и 20 см, заподлицо с гранью y = 20) — сплошной участок без щели", () => {
    const w1 = wall("W1", 0, 0, 300, 0, 40, "brick")
    const w2 = drawnAlong(w1, at(310, 10), { kind: "cap", normal: at(1, 0), anchor: at(300, 10) }, "W2", 20, 300, "concrete")
    expect(w2.a).toEqual(at(300, 10))
    expect(summary([w1, w2], at(100, 25))).toEqual([
      ["W1", 1, 0, 300],
      ["W2", 1, 0, 300],
    ])
  })
})
