import { describe, expect, it } from "vitest"
import { plasterColors } from "../rough/rough-render"
import { reveal, windowOn } from "../rough/rough.test-utils"
import { recordingContext } from "../room-area.test-utils"
import type { FillOp } from "../room-area.test-utils"
import { LIGHT_PALETTE } from "../theme"
import { PX_PER_CM } from "../types"
import type { Drawing, Point } from "../types"
import { drawReconstructionScene } from "./reconstruction-render"
import type { ReconstructionView } from "./reconstruction-render"
import { reconstructionScene } from "./reconstruction-scene"
import { drawing, plaster } from "./reconstruction.test-utils"

// change plaster-opening-reveals: откосы на плане «Реконструкция» — серая подложка, не фиолетовая
// (spec rough-works-plan «Штукатурка откосов проёма»: откосы показываются в составе серой подложки штукатурки)

const K = PX_PER_CM
const VIEW = { zoom: 1, pan: { x: 0, y: 0 } }
const WIN = windowOn("win", "W", 100, 120) // откосы x = 100 и 220 на стене W (0,0)-(500,0), 20 см

const box = (pts: readonly Point[]) => ({
  minX: Math.min(...pts.map((p) => p.x)),
  maxX: Math.max(...pts.map((p) => p.x)),
  minY: Math.min(...pts.map((p) => p.y)),
  maxY: Math.max(...pts.map((p) => p.y)),
})

const draw = (d: Drawing) => {
  const s = reconstructionScene(d)
  const view: ReconstructionView = { walls: s.underlay, doorways: s.base.doorways, pieces: s.pieces, drywall: s.own }
  const rec = recordingContext()
  drawReconstructionScene(rec.ctx, 800, 600, view, "cm", VIEW, { grid: false, palette: LIGHT_PALETTE })
  return rec.ops.filter((o): o is FillOp => o.kind === "fill")
}

describe("откосы на плане «Реконструкция»", () => {
  it("RV-34: откос в сцене плана есть и нарисован серой заливкой подложки: x 100…102, y −10…10", () => {
    const d = drawing({ doorways: [WIN], roughPlaster: [reveal("r", "win", "a", 20)] })
    expect(reconstructionScene(d).pieces).toHaveLength(1)
    const strips = draw(d).filter((f) => f.fillStyle === LIGHT_PALETTE.muted)
    const hit = strips.some((f) => {
      const b = box(f.subpaths.flat())
      return Math.abs(b.minX - 100 * K) < 1e-6 && Math.abs(b.maxX - 102 * K) < 1e-6 && Math.abs(b.minY + 10 * K) < 1e-6 && Math.abs(b.maxY - 10 * K) < 1e-6
    })
    expect(hit).toBe(true)
  })

  it("RV-34: фиолетового цвета штукатурки нет ни в одной схеме", () => {
    const ops = draw(drawing({ doorways: [WIN], roughPlaster: [plaster("p", "W", 1, "a", 0, 500, 20), reveal("r", "win", "a", 20)] }))
    for (const theme of ["light", "dark"] as const) expect(ops.filter((f) => f.fillStyle === plasterColors(theme).fill)).toEqual([])
  })
})
