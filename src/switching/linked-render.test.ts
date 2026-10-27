import { describe, expect, it } from "vitest"
import { recordingContext } from "../room-area.test-utils"
import type { DrawOp, StrokeOp } from "../room-area.test-utils"
import { rectWalls } from "../rough/rough.test-utils"
import { LIGHT_PALETTE } from "../theme"
import type { ExhaustFan, LightFixture, LightSwitch } from "../types"
import { drawSwitchingScene } from "./switching-render"
import type { SwitchingView } from "./switching-render"

// change line-edit-and-highlight: подсветка объектов, связанных линией с выделенным (spec line-highlight), на холсте плана

const VIEW = { zoom: 1, pan: { x: 0, y: 0 } }
const spot: LightFixture = { id: "a", kind: "spot", x: 100, y: 80 }
const fan: ExhaustFan = { id: "f", x: 200, y: 150 }
const block: LightSwitch = { id: "s", at: { x: 120, y: -20 }, angle: -90, keys: [{ lines: ["L3"] }] }
const label = { id: "l", name: "L3", at: { x: 100, y: 80 } }

const viewOf = (extra: Partial<SwitchingView> = {}): SwitchingView => ({ walls: rectWalls("w", -10, -10, 410, 310), doorways: [], pieces: [], drywall: [], items: [], lights: [], ...extra })

const draw = (view: SwitchingView): DrawOp[] => {
  const rec = recordingContext()
  drawSwitchingScene(rec.ctx, 1200, 900, view, "cm", VIEW, { grid: false, palette: LIGHT_PALETTE, theme: "light" })
  return rec.ops
}

const strokes = (ops: DrawOp[], color: string): StrokeOp[] => ops.filter((o): o is StrokeOp => o.kind === "stroke" && o.strokeStyle === color)
const selection = (view: SwitchingView): number => strokes(draw(view), LIGHT_PALETTE.selection).length

describe("подсветка связанных объектов", () => {
  it("без связанных подсветки нет", () => {
    expect(selection(viewOf({ lights: [spot], exhausts: [fan], lineLabels: [label], switches: [block] }))).toBe(0)
  })

  it("светильник подсвечен цветом выделения", () => {
    expect(selection(viewOf({ lights: [spot], linkedLightIds: new Set(["a"]) }))).toBeGreaterThan(0)
  })

  it("вытяжка подсвечена, красного штриха у неё не остаётся", () => {
    const ops = draw(viewOf({ exhausts: [fan], linkedExhaustIds: new Set(["f"]) }))
    expect(strokes(ops, LIGHT_PALETTE.selection).length).toBeGreaterThan(0)
    expect(strokes(ops, LIGHT_PALETTE.lightingRed)).toEqual([])
  })

  it("метка подсвечена", () => {
    expect(selection(viewOf({ lineLabels: [label], linkedLineIds: new Set(["l"]) }))).toBeGreaterThan(0)
  })

  it("выключатель подсвечен", () => {
    expect(selection(viewOf({ switches: [block], linkedSwitchIds: new Set(["s"]) }))).toBeGreaterThan(0)
  })

  it("подсвечены только перечисленные", () => {
    const only = selection(viewOf({ lights: [spot, { ...spot, id: "b", x: 300 }], linkedLightIds: new Set(["a"]) }))
    const both = selection(viewOf({ lights: [spot, { ...spot, id: "b", x: 300 }], linkedLightIds: new Set(["a", "b"]) }))
    expect(both).toBeGreaterThan(only)
  })

  it("страница PDF: набор полей, который передаёт pdf.ts, подсветки не даёт", () => {
    const page = { items: [], lights: [spot], lineLabels: [label], switches: [block], exhausts: [fan] }
    expect(selection(viewOf(page))).toBe(0)
  })

  it.each([
    ["светильник", { lights: [spot], linkedLightIds: new Set(["a"]), erasingLightId: "a" }],
    ["вытяжка", { exhausts: [fan], linkedExhaustIds: new Set(["f"]), erasingExhaustId: "f" }],
    ["метка", { lineLabels: [label], linkedLineIds: new Set(["l"]), erasingLineId: "l" }],
  ] satisfies [string, Partial<SwitchingView>][])("ластик главнее подсветки: %s", (_name, extra) => {
    const ops = draw(viewOf(extra))
    expect(strokes(ops, LIGHT_PALETTE.selection)).toEqual([])
    expect(strokes(ops, LIGHT_PALETTE.erase).length).toBeGreaterThan(0)
  })

  it("ластик главнее подсветки: выключатель", () => {
    const ops = draw(viewOf({ switches: [block], linkedSwitchIds: new Set(["s"]), erasingSwitchId: "s" }))
    expect(strokes(ops, LIGHT_PALETTE.selection)).toEqual([])
    expect(strokes(ops, LIGHT_PALETTE.erase).length).toBeGreaterThan(0)
  })
})
