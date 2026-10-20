import { describe, expect, it } from "vitest"
import { recordingContext } from "../room-area.test-utils"
import type { TextOp } from "../room-area.test-utils"
import type { Drawing, WallElement } from "../types"
import { drawRoughScene } from "./rough-render"
import type { RoughOptions } from "./rough-render"
import { roughScene } from "./rough-scene"
import { drawing, plaster, wall } from "./rough.test-utils"

// change plaster-dimension-corner-to-corner: размер на холсте — один на непрерывную полосу, сегменты по проёмам, расстояния до
// стыков только у выделенной пометки (spec rough-works-plan «Размер штукатурки от угла до угла», «Выделение штукатурки и правка на месте»)

const VIEW = { zoom: 1, pan: { x: 0, y: 0 } }
const opening: WallElement = { id: "o", wallId: "W", anchor: "a", offsetCm: 250, widthCm: 100, heightCm: 210 }

function texts(d: Drawing, selectedPlasterId: string | null = null, opts: RoughOptions = {}): string[] {
  const scene = roughScene(d)
  const rec = recordingContext()
  drawRoughScene(rec.ctx, 800, 600, { walls: scene.base.walls, doorways: scene.base.doorways, pieces: scene.pieces, screeds: [], blocks: [], selectedPlasterId }, "cm", VIEW, { grid: false, ...opts })
  return rec.ops.filter((o): o is TextOp => o.kind === "fillText").map((o) => o.text)
}

describe("размеры штукатурки на холсте", () => {
  const W = wall("W", 0, 0, 500, 0)

  it("CR-1: невыделенная пометка показывает только сегменты ширины: 250 | 100 | 150", () => {
    const shown = texts(drawing({ walls: [W], roughPlaster: [plaster("m", "W", 1, "a", 0, 500)], doorways: [opening] }))
    expect(shown).toEqual(expect.arrayContaining(["250", "100", "150"]))
    expect(shown).not.toContain("500")
  })

  it("CR-2: выделенная пометка 100–300 показывает расстояния до стыков и сегменты ширины", () => {
    const d = drawing({ walls: [W], roughPlaster: [plaster("m", "W", 1, "a", 100, 300)], doorways: [opening] })
    expect(texts(d)).toEqual(expect.arrayContaining(["150", "50"]))
    expect(texts(d)).not.toContain("100")
    expect(texts(d, "m")).toEqual(expect.arrayContaining(["100", "150", "50", "200"]))
  })

  it("CR-3: через стык стен рисуется один размер 600, а не два по 300", () => {
    const d = drawing({
      walls: [wall("W1", 0, 0, 300, 0), wall("W2", 300, 0, 600, 0)],
      roughPlaster: [plaster("m1", "W1", 1, "a", 0, 300), plaster("m2", "W2", 1, "a", 0, 300)],
    })
    const shown = texts(d)
    expect(shown.filter((t) => t === "600")).toHaveLength(1)
    expect(shown).not.toContain("300")
  })

  it("CR-5: торец в плоскости не имеет своего размера, торец без боковых полос — имеет", () => {
    const H1 = wall("H1", 0, 0, 490, 0)
    const H2 = wall("H2", 510, 0, 1000, 0)
    const S = wall("S", 500, -10, 500, 300)
    const end = { id: "e", wallId: "S", face: "end" as const, anchor: "a" as const, thicknessMm: 20 }
    const sides = [plaster("p1", "H1", -1, "a", 0, 490), plaster("p2", "H2", -1, "a", 0, 490)]
    const joined = texts(drawing({ walls: [H1, H2, S], roughPlaster: [...sides, end] }))
    expect(joined).toContain("1000")
    expect(joined).not.toContain("20")
    expect(texts(drawing({ walls: [H1, H2, S], roughPlaster: [...sides, end] }), "e")).not.toContain("20")
    expect(texts(drawing({ walls: [H1, H2, S], roughPlaster: [end] }))).toContain("20")
  })

  it("CR-4: на плане без размеров (PDF) размеров штукатурки нет", () => {
    const d = drawing({ walls: [W], roughPlaster: [plaster("m", "W", 1, "a", 0, 500)], doorways: [opening] })
    expect(texts(d, null, { dimensions: false })).not.toContain("250")
  })
})
