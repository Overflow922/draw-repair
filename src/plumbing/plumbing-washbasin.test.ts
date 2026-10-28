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

// change add-washbasin: умывальник на плане «Сантехника» (spec plumbing-plan «Приборы плана «Сантехника»», «Габариты приборов на плане
// «Сантехника»», сценарии «Умывальник показывается», «Повёрнутый умывальник»).
// Линии рисунка умывальника: 0 рамка, 1 чаша, 2 слив, 3 смеситель, 4–5 вентили — всего 6 подконтуров.

const VIEW = { zoom: 1, pan: { x: 0, y: 0 } }
const OPTS = { grid: false, palette: LIGHT_PALETTE, theme: "light" } as const
const BASIN_LINES = 6
const basin = (angleDeg = 0): FurnitureItem => ({ id: "b", kind: "washbasin", x: 150, y: 220, widthCm: 60, lengthCm: 48, angleDeg })
const other = (id: string, kind: FurnitureItem["kind"], x: number): FurnitureItem => ({ id, kind, x, y: 100, widthCm: 60, lengthCm: 60, angleDeg: 0 })
const view = (items: FurnitureItem[]): PlumbingView => ({ walls: [], doorways: [], pieces: [], drywall: [], items })

describe("умывальник на плане «Сантехника»", () => {
  it("WBP-01: умывальник 60 × 48 с центром (150, 220) попадает в сцену с теми же данными, повёрнутый на 180° — тоже", () => {
    expect(plumbingScene({ ...drawing(), furniture: { items: [basin(0)], dimensions: [] } }).items).toEqual([basin(0)])
    expect(plumbingScene({ ...drawing(), furniture: { items: [basin(180)], dimensions: [] } }).items).toEqual([basin(180)])
  })

  it("WBP-02: среди раковины, сушильной машины, холодильника и умывальника в сцене раковина и умывальник", () => {
    const items = [other("s", "sink", 300), other("d", "dryer", 500), other("f", "fridge", 700), basin()]
    const scene = plumbingScene({ ...drawing(), furniture: { items, dimensions: [] } })
    expect(scene.items.map((i) => i.kind)).toEqual(["sink", "washbasin"])
  })

  it("WBP-03: рисунок умывальника нарисован линиями без заливки — 6 линий (рамка, чаша, слив, смеситель, два вентиля)", () => {
    const rec = recordingContext()
    drawPlumbingScene(rec.ctx, 800, 600, view([basin()]), "cm", VIEW, OPTS)
    expect(rec.ops.some((o) => o.kind === "stroke" && o.subpaths.length === BASIN_LINES)).toBe(true)
  })

  it("WBP-04: габариты умывальника — «60» и «48», в миллиметрах «600» и «480»", () => {
    const shown = (unit: "cm" | "mm"): string[] => {
      const rec = recordingContext()
      drawPlumbingScene(rec.ctx, 800, 600, view([basin()]), unit, VIEW, OPTS)
      return rec.ops.filter((o): o is TextOp => o.kind === "fillText").map((o) => o.text).sort()
    }
    expect(shown("cm")).toEqual(["48", "60"])
    expect(shown("mm")).toEqual(["480", "600"])
  })

  it("WBP-05: габариты не подчёркнуты — числа не правятся", () => {
    const rec = dashRecorder()
    drawPlumbingScene(rec.ctx, 800, 600, view([basin()]), "cm", VIEW, OPTS)
    expect(rec.dashed).toHaveLength(0)
  })
})
