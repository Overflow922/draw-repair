import { describe, expect, it } from "vitest"
import type { Point } from "../types"
import { plasterTarget } from "./plaster-face"
import type { PlasterTarget } from "./plaster-face"
import { wall } from "./rough.test-utils"

// change plaster-wall-end-face: цель клика у свободного торца выступа (spec rough-works-plan «Постановка штукатурки кликом
// по грани»: «Свободный торец выступа», «Курсор у бока выступа за концом»)

const at = (x: number, y: number): Point => ({ x, y })
const summary = (t: PlasterTarget | null) =>
  t?.pieces.map((x) => [x.wall.id, x.face, Math.round(x.from * 10) / 10, Math.round(x.to * 10) / 10])

describe("свободный торец выступа", () => {
  const W = wall("W", -100, 0, 100, 0)
  const S = wall("S", 0, -10, 0, -30) // выступ длиной 20 см, свободный торец на y = −30

  it("PS-1: курсор за торцом по центру — цель торец на всю толщину стены", () => {
    expect(summary(plasterTarget(at(0, -33), [W, S], 5))).toEqual([["S", "end", -10, 10]])
    expect(summary(plasterTarget(at(6, -31), [W, S], 5))).toEqual([["S", "end", -10, 10]])
  })

  it("PS-2: за концом оси, но вне тела поперёк — боковая грань со стороны курсора", () => {
    expect(summary(plasterTarget(at(14, -33), [W, S], 5))).toEqual([["S", 1, 0, 20]])
    expect(summary(plasterTarget(at(-14, -33), [W, S], 5))).toEqual([["S", -1, 0, 20]])
  })

  it("PS-3: курсор далеко за торцом — цели нет", () => {
    expect(plasterTarget(at(4, -45), [W, S], 5)).toBeNull()
  })

  it("PS-4: на теле выступа цель — боковая грань стороны курсора", () => {
    expect(summary(plasterTarget(at(4, -20), [W, S], 5))).toEqual([["S", 1, 0, 20]])
  })

  it("PS-5: конец, не являющийся концом исходной стены, торцом не считается — остаётся боковая грань", () => {
    expect(summary(plasterTarget(at(0, -33), [W, S], 5, () => false))).toEqual([["S", 1, 0, 20]])
  })
})
