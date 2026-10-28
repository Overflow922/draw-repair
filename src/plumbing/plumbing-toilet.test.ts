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

// change add-toilet: унитаз на плане «Сантехника» (spec plumbing-plan «Приборы плана «Сантехника»», «Габариты приборов на плане
// «Сантехника»», сценарии «Унитаз показывается», «Габариты унитаза»).

const VIEW = { zoom: 1, pan: { x: 0, y: 0 } }
const OPTS = { grid: false, palette: LIGHT_PALETTE, theme: "light" } as const
const toilet = (angleDeg = 0): FurnitureItem => ({
  id: "t",
  kind: "toilet",
  x: 100,
  y: 100,
  widthCm: 70,
  lengthCm: 72,
  angleDeg,
  toilet: { bowlWidthCm: 38, bowlLengthCm: 52, blockWidthCm: 70, blockDepthCm: 20 },
})
const view = (items: FurnitureItem[]): PlumbingView => ({ walls: [], doorways: [], pieces: [], drywall: [], items })

describe("унитаз на плане «Сантехника»", () => {
  it("TLH-01: унитаз целиком — с центром, углом и четырьмя размерами — показан как прибор рядом с раковиной, стол и кухонный шкаф нет", () => {
    const sink: FurnitureItem = { id: "s", kind: "sink", x: 300, y: 100, widthCm: 45, lengthCm: 40, angleDeg: 0 }
    const table: FurnitureItem = { id: "x", kind: "table", x: 500, y: 100, widthCm: 80, lengthCm: 160, angleDeg: 0 }
    const rotated = toilet(90)
    const scene = plumbingScene({ ...drawing(), furniture: { items: [rotated, sink, table], dimensions: [] } })
    expect(scene.items).toEqual([rotated, sink])
  })

  it("TLH-02: габариты унитаза — четыре числа «38», «52», «70», «20», общей длины «72» нет", () => {
    const rec = recordingContext()
    drawPlumbingScene(rec.ctx, 800, 600, view([toilet()]), "cm", VIEW, OPTS)
    const shown = rec.ops.filter((o): o is TextOp => o.kind === "fillText").map((o) => o.text)
    expect([...shown].sort()).toEqual(["20", "38", "52", "70"])
  })

  it("TLH-03: в миллиметрах числа 380, 520, 700 и 200", () => {
    const rec = recordingContext()
    drawPlumbingScene(rec.ctx, 800, 600, view([toilet()]), "mm", VIEW, OPTS)
    expect(rec.ops.filter((o): o is TextOp => o.kind === "fillText").map((o) => o.text).sort()).toEqual(["200", "380", "520", "700"])
  })

  it("TLH-04: габариты не подчёркнуты — числа не правятся", () => {
    const rec = dashRecorder()
    drawPlumbingScene(rec.ctx, 800, 600, view([toilet()]), "cm", VIEW, OPTS)
    expect(rec.dashed).toHaveLength(0)
  })

  it("TLH-05: рисунок унитаза нарисован линиями без заливки", () => {
    const rec = recordingContext()
    drawPlumbingScene(rec.ctx, 800, 600, view([toilet()]), "cm", VIEW, OPTS)
    expect(rec.ops.some((o) => o.kind === "stroke" && o.subpaths.length === 8)).toBe(true)
    expect(rec.ops.some((o) => o.kind === "fill" && o.subpaths.length > 3)).toBe(false)
  })
})
