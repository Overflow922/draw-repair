import { describe, expect, it } from "vitest"
import { recordingContext } from "../room-area.test-utils"
import type { FillOp, TextOp } from "../room-area.test-utils"
import type { PlasterPiece } from "./plaster"
import { drawRoughScene, plasterColors } from "./rough-render"
import type { PlasterGhost } from "./rough-render"
import { wall } from "./rough.test-utils"

// change plaster-partial-drag: превью протяжки — полоса участка и его размер; подсветка цели клика размеров не имеет
// (spec rough-works-plan «Постановка частичной штукатурки протяжкой», «Постановка штукатурки кликом по грани»)

const W = wall("W", 0, 0, 500, 0)
const VIEW = { zoom: 1, pan: { x: 0, y: 0 } }
const EMPTY = { walls: [W], doorways: [], pieces: [] as PlasterPiece[], screeds: [], blocks: [] }

const texts = (ghost: PlasterGhost | null): string[] => {
  const rec = recordingContext()
  drawRoughScene(rec.ctx, 800, 600, { ...EMPTY, ghost }, "cm", VIEW, { grid: false })
  return rec.ops.filter((o): o is TextOp => o.kind === "fillText").map((o) => o.text)
}

describe("превью протяжки", () => {
  const piece = { wall: W, from: 100, to: 300, face: 1 as const }

  it("PD-40: у превью протяжки есть полоса участка и размер — ширина 200", () => {
    const fill = plasterColors("light").fill
    const rec = recordingContext()
    drawRoughScene(rec.ctx, 800, 600, { ...EMPTY, ghost: { pieces: [piece], thicknessMm: 20, measured: true } }, "cm", VIEW, { grid: false })
    expect(rec.ops.filter((o): o is FillOp => o.kind === "fill" && o.fillStyle === fill)).toHaveLength(1)
    expect(texts({ pieces: [piece], thicknessMm: 20, measured: true })).toContain("200")
  })

  it("PD-41: у подсветки цели клика размера нет", () => {
    expect(texts({ pieces: [piece], thicknessMm: 20 })).toEqual(texts(null))
  })

  it("PD-42: на плане без размеров (PDF) превью размера не рисует", () => {
    const rec = recordingContext()
    drawRoughScene(rec.ctx, 800, 600, { ...EMPTY, ghost: { pieces: [piece], thicknessMm: 20, measured: true } }, "cm", VIEW, { grid: false, dimensions: false })
    expect(rec.ops.filter((o): o is TextOp => o.kind === "fillText").map((o) => o.text)).not.toContain("200")
  })
})
