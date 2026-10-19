import { describe, expect, it } from "vitest"
import { recordingContext } from "../room-area.test-utils"
import type { FillOp } from "../room-area.test-utils"
import { plasterColors, drawRoughScene } from "./rough-render"
import type { PlasterPiece } from "./plaster"
import { wall } from "./rough.test-utils"

// change add-rough-works-plan, plaster-click-whole-face: подсветка цели штукатурки и цвета (spec rough-works-plan «Постановка штукатурки кликом по грани», «Цвет штукатурки»)

const W = wall("W", 0, 0, 500, 0)
const VIEW = { zoom: 1, pan: { x: 0, y: 0 } }
const EMPTY = { walls: [W], doorways: [], pieces: [] as PlasterPiece[], screeds: [], blocks: [] }

describe("подсветка цели", () => {
  it("RW-220: подсветка — заливка цвета штукатурки (полупрозрачная) и контур; без наведения заливок цвета штукатурки нет", () => {
    const fill = plasterColors("light").fill
    const none = recordingContext()
    drawRoughScene(none.ctx, 800, 600, EMPTY, "cm", VIEW, { grid: false })
    expect(none.ops.filter((o): o is FillOp => o.kind === "fill" && o.fillStyle === fill)).toEqual([])
    const withGhost = recordingContext()
    drawRoughScene(withGhost.ctx, 800, 600, { ...EMPTY, ghost: { pieces: [{ wall: W, from: 0, to: 500, face: 1 }], thicknessMm: 20 } }, "cm", VIEW, { grid: false })
    expect(withGhost.ops.filter((o): o is FillOp => o.kind === "fill" && o.fillStyle === fill)).toHaveLength(1)
  })

  it("RW-220b: подсветка цели из двух кусков — по заливке на каждый кусок; размеров у подсветки нет", () => {
    const fill = plasterColors("light").fill
    const W2 = wall("W2", 500, 0, 900, 0)
    const none = recordingContext()
    drawRoughScene(none.ctx, 800, 600, { ...EMPTY, walls: [W, W2] }, "cm", VIEW, { grid: false })
    const ghost = recordingContext()
    const ghostScene = { ...EMPTY, walls: [W, W2], ghost: { pieces: [{ wall: W, from: 0, to: 500, face: 1 as const }, { wall: W2, from: 0, to: 400, face: 1 as const }], thicknessMm: 20 } }
    drawRoughScene(ghost.ctx, 800, 600, ghostScene, "cm", VIEW, { grid: false })
    expect(ghost.ops.filter((o): o is FillOp => o.kind === "fill" && o.fillStyle === fill)).toHaveLength(2)
    expect(ghost.ops.filter((o) => o.kind === "fillText")).toHaveLength(none.ops.filter((o) => o.kind === "fillText").length)
  })

  it("RW-221: цвета штукатурки различны на светлой и тёмной схемах, а заливка не совпадает с контуром", () => {
    const light = plasterColors("light")
    const dark = plasterColors("dark")
    expect(light.fill).not.toBe(dark.fill)
    expect(light.fill).not.toBe(light.stroke)
    expect(dark.fill).not.toBe(dark.stroke)
  })
})
