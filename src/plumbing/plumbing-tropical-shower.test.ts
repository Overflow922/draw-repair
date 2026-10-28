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

// change add-plumbing-tropical-shower: тропический душ на плане «Сантехника» (spec plumbing-plan «Приборы плана «Сантехника»»,
// «Габариты приборов на плане «Сантехника»», сценарии «Тропический душ показывается», «Повёрнутый душ», «Какие виды показываются»).
// Линии рисунка душа: 0 корпус, 1 панель, 2–25 форсунки (6 × 4) — всего 26 подконтуров.

const VIEW = { zoom: 1, pan: { x: 0, y: 0 } }
const OPTS = { grid: false, palette: LIGHT_PALETTE, theme: "light" } as const
const SHOWER_LINES = 26
const shower = (angleDeg = 0): FurnitureItem => ({ id: "h", kind: "tropicalShower", x: 150, y: 80, widthCm: 40, lengthCm: 30, angleDeg })
const other = (id: string, kind: FurnitureItem["kind"], x: number): FurnitureItem => ({ id, kind, x, y: 100, widthCm: 60, lengthCm: 60, angleDeg: 0 })
const view = (items: FurnitureItem[]): PlumbingView => ({ walls: [], doorways: [], pieces: [], drywall: [], items })

describe("тропический душ на плане «Сантехника»", () => {
  it("TSH-01: душ 40 × 30 с центром (150, 80) попадает в сцену с теми же данными, повёрнутый на 90° — тоже", () => {
    expect(plumbingScene({ ...drawing(), furniture: { items: [shower(0)], dimensions: [] } }).items).toEqual([shower(0)])
    expect(plumbingScene({ ...drawing(), furniture: { items: [shower(90)], dimensions: [] } }).items).toEqual([shower(90)])
  })

  it("TSH-02: среди раковины, посудомойки, стиральной и сушильной машин, варочной панели, холодильника и душа в сцене душ и три прибора", () => {
    const items = [
      other("s", "sink", 300),
      other("m", "dishwasher", 400),
      other("w", "washer", 500),
      other("d", "dryer", 500),
      other("h", "hob", 600),
      other("f", "fridge", 700),
      shower(),
    ]
    const scene = plumbingScene({ ...drawing(), furniture: { items, dimensions: [] } })
    expect(scene.items.map((i) => i.kind)).toEqual(["sink", "dishwasher", "washer", "tropicalShower"])
  })

  it("TSH-03: рисунок душа нарисован линиями без заливки — 26 линий (корпус, панель, 24 форсунки)", () => {
    const rec = recordingContext()
    drawPlumbingScene(rec.ctx, 800, 600, view([shower()]), "cm", VIEW, OPTS)
    expect(rec.ops.some((o) => o.kind === "stroke" && o.subpaths.length === SHOWER_LINES)).toBe(true)
  })

  it("TSH-04: габариты душа — «40» и «30», в миллиметрах «400» и «300»", () => {
    const shown = (unit: "cm" | "mm"): string[] => {
      const rec = recordingContext()
      drawPlumbingScene(rec.ctx, 800, 600, view([shower()]), unit, VIEW, OPTS)
      return rec.ops.filter((o): o is TextOp => o.kind === "fillText").map((o) => o.text).sort()
    }
    expect(shown("cm")).toEqual(["30", "40"])
    expect(shown("mm")).toEqual(["300", "400"])
  })

  it("TSH-05: габариты не подчёркнуты — числа не правятся", () => {
    const rec = dashRecorder()
    drawPlumbingScene(rec.ctx, 800, 600, view([shower()]), "cm", VIEW, OPTS)
    expect(rec.dashed).toHaveLength(0)
  })
})
