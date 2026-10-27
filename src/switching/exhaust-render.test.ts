import { describe, expect, it } from "vitest"
import { recordingContext } from "../room-area.test-utils"
import type { DrawOp, StrokeOp, TextOp } from "../room-area.test-utils"
import { rectWalls } from "../rough/rough.test-utils"
import { LIGHT_PALETTE } from "../theme"
import type { ExhaustFan, LightFixture } from "../types"
import { drawSwitchingScene } from "./switching-render"
import type { SwitchingView } from "./switching-render"

// change add-exhaust-fan: слой вытяжек на холсте плана «Группы включения»
// (spec switching-plan «Отображение плана «Группы включения»»: вытяжки выше знаков освещения и ниже меток линий)

const VIEW = { zoom: 1, pan: { x: 0, y: 0 } }
const fan: ExhaustFan = { id: "f", x: 200, y: 150 }
const spot: LightFixture = { id: "a", kind: "spot", x: 100, y: 80 }

const viewOf = (extra: Partial<SwitchingView> = {}): SwitchingView => ({ walls: rectWalls("w", -10, -10, 410, 310), doorways: [], pieces: [], drywall: [], items: [], lights: [], ...extra })

const draw = (view: SwitchingView): DrawOp[] => {
  const rec = recordingContext()
  drawSwitchingScene(rec.ctx, 1200, 900, view, "cm", VIEW, { grid: false, palette: LIGHT_PALETTE, theme: "light" })
  return rec.ops
}

const strokes = (ops: DrawOp[], color: string): StrokeOp[] => ops.filter((o): o is StrokeOp => o.kind === "stroke" && o.strokeStyle === color)

describe("вытяжки на холсте", () => {
  it("вытяжка нарисована красным цветом освещения", () => {
    expect(strokes(draw(viewOf({ exhausts: [fan] })), LIGHT_PALETTE.lightingRed).length).toBeGreaterThan(0)
  })
  it("без вытяжек красных штрихов нет", () => {
    expect(strokes(draw(viewOf()), LIGHT_PALETTE.lightingRed)).toEqual([])
  })
  it("выделенная подсвечена цветом выделения, стираемая — цветом ластика", () => {
    const ops = draw(viewOf({ exhausts: [fan], selectedExhaustId: "f" }))
    expect(strokes(ops, LIGHT_PALETTE.selection).length).toBeGreaterThan(0)
    expect(strokes(ops, LIGHT_PALETTE.lightingRed)).toEqual([])
    expect(strokes(draw(viewOf({ exhausts: [fan], erasingExhaustId: "f" })), LIGHT_PALETTE.erase).length).toBeGreaterThan(0)
  })
  it("вытяжка нарисована после знаков освещения и до меток линий", () => {
    const ops = draw(viewOf({ lights: [spot], exhausts: [fan], lineLabels: [{ id: "l", name: "LV1", at: { x: 200, y: 150 } }] }))
    const red = ops.map((o, i) => (o.kind === "stroke" && o.strokeStyle === LIGHT_PALETTE.lightingRed ? i : -1)).filter((i) => i >= 0)
    const label = ops.findIndex((o): o is TextOp => o.kind === "fillText" && o.text === "LV1")
    expect(red.length).toBeGreaterThan(1)
    expect(Math.max(...red)).toBeLessThan(label)
    // знак светильника (первый красный штрих) раньше знака вытяжки (последний)
    expect(red[0]).toBeLessThan(red[red.length - 1] ?? 0)
  })
  it("призрак рисуется без ошибок", () => {
    expect(() => draw(viewOf({ exhaustGhost: fan }))).not.toThrow()
  })
})
