import { describe, expect, it } from "vitest"
import type { Point } from "../types"
import { plasterTarget } from "./plaster-face"
import type { PlasterTarget } from "./plaster-face"
import { wall } from "./rough.test-utils"

// change plaster-face-to-corners: курсор у свободного торца выступа выбирает боковую грань (spec rough-works-plan «Свободный торец»)

const at = (x: number, y: number): Point => ({ x, y })
const summary = (t: PlasterTarget | null) => t?.pieces.map((x) => [x.wall.id, x.face, Math.round(x.from * 10) / 10, Math.round(x.to * 10) / 10])

describe("свободный торец выступа", () => {
  const W = wall("W", -100, 0, 100, 0)
  const S = wall("S", 0, -10, 0, -30) // выступ длиной 20 см, свободный торец на y = −30

  it("PS-1: курсор за торцом справа от оси — боковая грань +1 (сторона курсора)", () => {
    expect(summary(plasterTarget(at(4, -33), [W, S], 5))).toEqual([["S", 1, 0, 20]])
  })

  it("PS-2: курсор за торцом слева от оси — грань с другой стороны", () => {
    expect(summary(plasterTarget(at(-4, -33), [W, S], 5))).toEqual([["S", -1, 0, 20]])
  })

  it("PS-3: курсор далеко за торцом — цели нет", () => {
    expect(plasterTarget(at(4, -45), [W, S], 5)).toBeNull()
  })
})
