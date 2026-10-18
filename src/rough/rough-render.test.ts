import { describe, expect, it } from "vitest"
import { recordingContext } from "../room-area.test-utils"
import type { FillOp } from "../room-area.test-utils"
import { plasterColors, drawRoughScene } from "./rough-render"
import type { PlasterPiece } from "./plaster"
import { wall } from "./rough.test-utils"

// change add-rough-works-plan: превью протяжки штукатурки и цвета (spec rough-works-plan «Инструмент «Штукатурка»», «Цвет штукатурки»)

const W = wall("W", 0, 0, 500, 0)
const VIEW = { zoom: 1, pan: { x: 0, y: 0 } }
const EMPTY = { walls: [W], doorways: [], pieces: [] as PlasterPiece[], screeds: [], blocks: [] }

describe("превью протяжки", () => {
  it("RW-220: превью — заливка цвета штукатурки (полупрозрачная) и контур; без протяжки заливок цвета штукатурки нет", () => {
    const fill = plasterColors("light").fill
    const none = recordingContext()
    drawRoughScene(none.ctx, 800, 600, EMPTY, "cm", VIEW, { grid: false })
    expect(none.ops.filter((o): o is FillOp => o.kind === "fill" && o.fillStyle === fill)).toEqual([])
    const withGhost = recordingContext()
    drawRoughScene(withGhost.ctx, 800, 600, { ...EMPTY, ghost: { wall: W, from: 100, to: 300, face: 1, thicknessMm: 20 } }, "cm", VIEW, { grid: false })
    expect(withGhost.ops.filter((o): o is FillOp => o.kind === "fill" && o.fillStyle === fill)).toHaveLength(1)
  })

  it("RW-221: цвета штукатурки различны на светлой и тёмной схемах, а заливка не совпадает с контуром", () => {
    const light = plasterColors("light")
    const dark = plasterColors("dark")
    expect(light.fill).not.toBe(dark.fill)
    expect(light.fill).not.toBe(light.stroke)
    expect(dark.fill).not.toBe(dark.stroke)
  })
})
