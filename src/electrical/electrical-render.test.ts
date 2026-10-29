import { describe, expect, it } from "vitest"
import { recordingContext } from "../room-area.test-utils"
import type { DrawOp, StrokeOp, TextOp } from "../room-area.test-utils"
import { rectWalls } from "../rough/rough.test-utils"
import { DARK_PALETTE, LIGHT_PALETTE } from "../theme"
import type { Callout, FurnitureItem, LightSwitch } from "../types"
import { drawElectricalScene } from "./electrical-render"
import type { ElectricalView } from "./electrical-render"

// change add-electrical-plan: отрисовка плана «Электрооборудование»
// (spec electrical-plan «Отображение плана «Электрооборудование»», «Выключатели на плане «Электрооборудование»»)

const VIEW = { zoom: 1, pan: { x: 0, y: 0 } }
const WALLS = rectWalls("w", -10, -10, 410, 310)
const table: FurnitureItem = { id: "t", kind: "table", x: 200, y: 150, widthCm: 80, lengthCm: 160, angleDeg: 0 }
const callout: Callout = { id: "c", target: { x: 100, y: 80 }, at: { x: 150, y: 120 }, text: "h=900" }
const block: LightSwitch = { id: "s", at: { x: 120, y: -20 }, angle: -90, keys: [{ lines: ["L2", "LV1"] }, { lines: ["L3"] }, { lines: [] }] }

const viewOf = (extra: Partial<ElectricalView> = {}): ElectricalView => ({ walls: WALLS, doorways: [], pieces: [], drywall: [], items: [], switches: [], ...extra })

const draw = (view: ElectricalView, palette = LIGHT_PALETTE, theme: "light" | "dark" = "light"): DrawOp[] => {
  const rec = recordingContext()
  drawElectricalScene(rec.ctx, 1200, 900, view, "cm", VIEW, { grid: false, palette, theme })
  return rec.ops
}

const texts = (ops: DrawOp[]): string[] => ops.filter((o): o is TextOp => o.kind === "fillText").map((t) => t.text)
const strokes = (ops: DrawOp[], color: string): StrokeOp[] => ops.filter((o): o is StrokeOp => o.kind === "stroke" && o.strokeStyle === color)

describe("план «Электрооборудование» на холсте", () => {
  it("ER-01: подписи клавиш — текст имён линий через запятую, у пустой клавиши подписи нет; линий и светильников нет", () => {
    const ops = draw(viewOf({ switches: [block] }))
    expect(texts(ops)).toEqual(["L2,LV1", "L3"])
  })

  it("ER-02: знаки клавиш нарисованы цветом освещения", () => {
    const without = strokes(draw(viewOf()), LIGHT_PALETTE.lightingRed).length
    expect(strokes(draw(viewOf({ switches: [block] })), LIGHT_PALETTE.lightingRed).length).toBeGreaterThanOrEqual(without + 3)
  })

  it("ER-03: предметы мебели нарисованы линиями серого цвета подложки без габаритов", () => {
    const ops = draw(viewOf({ items: [table] }))
    expect(strokes(ops, LIGHT_PALETTE.muted).length).toBeGreaterThan(0)
    expect(texts(ops)).toEqual([])
  })

  it("ER-04: выноска лежит выше знака выключателя", () => {
    const ops = draw(viewOf({ switches: [block], callouts: [callout] }))
    const at = (text: string): number => ops.findIndex((o) => o.kind === "fillText" && o.text === text)
    expect(at("h=900")).toBeGreaterThan(at("L3"))
  })

  it("ER-05: выключатель не подсвечивается как выделенный или стираемый", () => {
    const ops = draw(viewOf({ switches: [block] }))
    expect(strokes(ops, LIGHT_PALETTE.selection)).toEqual([])
    expect(strokes(ops, LIGHT_PALETTE.erase)).toEqual([])
  })

  it("ER-06: размер знака не зависит от масштаба просмотра", () => {
    const count = (zoom: number): number => {
      const rec = recordingContext()
      drawElectricalScene(rec.ctx, 1200, 900, viewOf({ switches: [block] }), "cm", { zoom, pan: { x: 0, y: 0 } }, { grid: false, palette: LIGHT_PALETTE, theme: "light" })
      return strokes(rec.ops, LIGHT_PALETTE.lightingRed).length
    }
    expect(count(2)).toBe(count(1))
  })

  it("ER-07: тёмная схема — знак выключателя нарисован цветом освещения тёмной схемы", () => {
    const ops = draw(viewOf({ switches: [block] }), DARK_PALETTE, "dark")
    expect(strokes(ops, DARK_PALETTE.lightingRed).length).toBeGreaterThanOrEqual(3)
  })
})
