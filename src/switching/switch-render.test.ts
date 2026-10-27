import { describe, expect, it } from "vitest"
import { recordingContext } from "../room-area.test-utils"
import type { DrawOp, StrokeOp, TextOp } from "../room-area.test-utils"
import { rectWalls } from "../rough/rough.test-utils"
import { LIGHT_PALETTE } from "../theme"
import type { Callout, LightFixture, LightSwitch } from "../types"
import { drawSwitchingScene } from "./switching-render"
import type { SwitchingView } from "./switching-render"

// change add-light-switch: слой выключателей на холсте плана «Группы включения»
// (spec switching-plan «Отображение плана «Группы включения»» — порядок слоёв; light-switch «Знак выключателя»)

const VIEW = { zoom: 1, pan: { x: 0, y: 0 } }
const WALLS = rectWalls("w", -10, -10, 410, 310)
const spot: LightFixture = { id: "a", kind: "spot", x: 100, y: 80 }
const callout: Callout = { id: "c", target: { x: 100, y: 80 }, at: { x: 150, y: 120 }, text: "Выноска" }
const block: LightSwitch = { id: "s", at: { x: 120, y: -20 }, angle: -90, keys: [{ lines: ["L2", "LV1"] }, { lines: ["L3"] }, { lines: [] }] }

const viewOf = (extra: Partial<SwitchingView> = {}): SwitchingView => ({ walls: WALLS, doorways: [], pieces: [], drywall: [], items: [], lights: [spot], ...extra })

const draw = (view: SwitchingView): DrawOp[] => {
  const rec = recordingContext()
  drawSwitchingScene(rec.ctx, 1200, 900, view, "cm", VIEW, { grid: false, palette: LIGHT_PALETTE, theme: "light" })
  return rec.ops
}

const texts = (ops: DrawOp[]): string[] => ops.filter((o): o is TextOp => o.kind === "fillText").map((t) => t.text)
const redStrokes = (ops: DrawOp[]): StrokeOp[] => ops.filter((o): o is StrokeOp => o.kind === "stroke" && o.strokeStyle === LIGHT_PALETTE.lightingRed)

describe("выключатели на холсте", () => {
  it("SW-R1: подписи клавиш — имена через запятую, у пустой клавиши подписи нет", () => {
    expect(texts(draw(viewOf({ switches: [block] })))).toEqual(["L2,LV1", "L3"])
  })

  it("SW-R2: знаки клавиш нарисованы цветом освещения", () => {
    const without = redStrokes(draw(viewOf())).length
    expect(redStrokes(draw(viewOf({ switches: [block] }))).length).toBeGreaterThanOrEqual(without + 3)
  })

  it("SW-R3: выключатели лежат выше метки линии и ниже выноски", () => {
    const ops = draw(viewOf({ switches: [block], lineLabels: [{ id: "l", name: "L7", at: { x: 100, y: 80 } }], callouts: [callout] }))
    const at = (text: string): number => ops.findIndex((o) => o.kind === "fillText" && o.text === text)
    expect(at("L2,LV1")).toBeGreaterThan(at("L7"))
    expect(at("Выноска")).toBeGreaterThan(at("L3"))
  })

  it("SW-R4: размер знака не зависит от масштаба просмотра", () => {
    const count = (zoom: number): number => {
      const rec = recordingContext()
      drawSwitchingScene(rec.ctx, 1200, 900, viewOf({ switches: [block] }), "cm", { zoom, pan: { x: 0, y: 0 } }, { grid: false, palette: LIGHT_PALETTE, theme: "light" })
      return redStrokes(rec.ops).length
    }
    expect(count(2)).toBe(count(1))
  })

  it("SW-R5: выделенный выключатель подсвечен цветом выделения, стёртый — цветом ластика", () => {
    const sel = draw(viewOf({ switches: [block], selectedSwitchId: "s" }))
    expect(sel.some((o) => o.kind === "stroke" && o.strokeStyle === LIGHT_PALETTE.selection)).toBe(true)
    const erase = draw(viewOf({ switches: [block], erasingSwitchId: "s" }))
    expect(erase.some((o) => o.kind === "stroke" && o.strokeStyle === LIGHT_PALETTE.erase)).toBe(true)
    expect(draw(viewOf({ switches: [block] })).some((o) => o.kind === "stroke" && o.strokeStyle === LIGHT_PALETTE.selection)).toBe(false)
  })

  it("SW-R6: призрак рисуется полупрозрачным и без подписей", () => {
    const ghost: LightSwitch = { ...block, id: "ghost", keys: [{ lines: [] }] }
    const ops = draw(viewOf({ switchGhost: ghost }))
    expect(redStrokes(ops).length).toBeGreaterThan(redStrokes(draw(viewOf())).length)
    expect(texts(ops)).toEqual([])
  })
})
