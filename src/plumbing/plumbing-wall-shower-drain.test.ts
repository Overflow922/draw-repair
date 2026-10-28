import { describe, expect, it } from "vitest"
import { dashRecorder } from "../doorway/selection-editing.test-utils"
import { drawing } from "../reconstruction/reconstruction.test-utils"
import { recordingContext } from "../room-area.test-utils"
import type { TextOp } from "../room-area.test-utils"
import { LIGHT_PALETTE } from "../theme"
import type { FurnitureItem } from "../types"
import { drawPlumbingScene } from "./plumbing-render"
import type { PlumbingView } from "./plumbing-render"
import { plumbingScene } from "./plumbing-scene"

// change add-wall-shower-drain: трап в стену на плане «Сантехника» (spec plumbing-plan «Приборы плана «Сантехника»», «Габариты приборов на
// плане «Сантехника»», сценарии «Трап в стену показывается», «Повёрнутый трап в стену»).
// Линии рисунка трапа: 0 контур лотка, 1 тело лотка, 2 щель — всего 3 подконтура.

const VIEW = { zoom: 1, pan: { x: 0, y: 0 } }
const OPTS = { grid: false, palette: LIGHT_PALETTE, theme: "light" } as const
const DRAIN_LINES = 3
const drain = (angleDeg = 0): FurnitureItem => ({ id: "t", kind: "wallShowerDrain", x: 100, y: 205, widthCm: 70, lengthCm: 8, angleDeg })
const other = (id: string, kind: FurnitureItem["kind"], x: number): FurnitureItem => ({ id, kind, x, y: 100, widthCm: 60, lengthCm: 60, angleDeg: 0 })
const view = (items: FurnitureItem[]): PlumbingView => ({ walls: [], doorways: [], pieces: [], drywall: [], items })

describe("трап в стену на плане «Сантехника»", () => {
  it("WSP-01: трап 70 × 8 с центром (100, 205) попадает в сцену с теми же данными, повёрнутый на 180° — тоже", () => {
    expect(plumbingScene({ ...drawing(), furniture: { items: [drain(0)], dimensions: [] } }).items).toEqual([drain(0)])
    expect(plumbingScene({ ...drawing(), furniture: { items: [drain(180)], dimensions: [] } }).items).toEqual([drain(180)])
  })

  it("WSP-02: среди раковины, сушильной машины, холодильника и трапа в сцене раковина и трап", () => {
    const items = [other("s", "sink", 300), other("d", "dryer", 500), other("f", "fridge", 700), drain()]
    const scene = plumbingScene({ ...drawing(), furniture: { items, dimensions: [] } })
    expect(scene.items.map((i) => i.kind)).toEqual(["sink", "wallShowerDrain"])
  })

  it("WSP-03: рисунок трапа нарисован линиями без заливки — 3 линии (контур, тело, щель)", () => {
    const rec = recordingContext()
    drawPlumbingScene(rec.ctx, 800, 600, view([drain()]), "cm", VIEW, OPTS)
    expect(rec.ops.some((o) => o.kind === "stroke" && o.subpaths.length === DRAIN_LINES)).toBe(true)
  })

  it("WSP-04: габариты трапа — «70» и «8», в миллиметрах «700» и «80»", () => {
    const shown = (unit: "cm" | "mm"): string[] => {
      const rec = recordingContext()
      drawPlumbingScene(rec.ctx, 800, 600, view([drain()]), unit, VIEW, OPTS)
      return rec.ops.filter((o): o is TextOp => o.kind === "fillText").map((o) => o.text).sort()
    }
    expect(shown("cm")).toEqual(["70", "8"])
    expect(shown("mm")).toEqual(["700", "80"])
  })

  it("WSP-05: габариты не подчёркнуты — числа не правятся", () => {
    const rec = dashRecorder()
    drawPlumbingScene(rec.ctx, 800, 600, view([drain()]), "cm", VIEW, OPTS)
    expect(rec.dashed).toHaveLength(0)
  })
})
