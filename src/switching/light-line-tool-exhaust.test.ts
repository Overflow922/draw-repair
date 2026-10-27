import { describe, expect, it } from "vitest"
import { LIGHT_SYMBOL_PX_PER_MM } from "../ceiling/light-symbol"
import type { ExhaustFan, LightFixture, LightLine, View } from "../types"
import { PX_PER_CM } from "../types"
import { createLightLineTool } from "./light-line-tool"

// change add-exhaust-fan: инструмент «Линия освещения» на вытяжке (spec light-lines «Метка вытяжки»)

const VIEW: View = { zoom: 1, pan: { x: 0, y: 0 } }
const LIGHTS: LightFixture[] = [{ id: "a", kind: "spot", x: 100, y: 80 }]
const FANS: ExhaustFan[] = [{ id: "f", x: 300, y: 80 }]

function setup(initial: LightLine[] = [], name = "L1") {
  let lines = initial
  let records = 0
  const tool = createLightLineTool({
    lines: () => lines,
    lights: () => LIGHTS,
    exhausts: () => FANS,
    setLines: (next) => {
      lines = next
    },
    record: () => {
      records++
    },
    changed: () => {},
    redraw: () => {},
    newId: () => "id",
    newName: () => name,
    view: () => VIEW,
    unitsPerMm: LIGHT_SYMBOL_PX_PER_MM,
  })
  return { tool, lines: () => lines, records: () => records }
}

describe("метка вытяжки", () => {
  it("клик по вытяжке ставит LV<n> с числом поля, по светильнику — L<n>", () => {
    const s = setup([], "L1")
    expect(s.tool.place({ x: 300, y: 80 })).toBe(true)
    expect(s.tool.place({ x: 100, y: 80 })).toBe(true)
    expect(s.lines().map((l) => [l.targetId, l.name])).toEqual([["f", "LV1"], ["a", "L1"]])
    expect(s.records()).toBe(2)
  })
  it("повторный клик с тем же числом шага не создаёт", () => {
    const s = setup([{ id: "x", targetId: "f", name: "LV3" }], "L3")
    expect(s.tool.place({ x: 300, y: 80 })).toBe(false)
    expect(s.records()).toBe(0)
  })
  it("наведение подсвечивает вытяжку", () => {
    expect(setup().tool.hoverTarget({ x: 302, y: 80 })).toBe("f")
  })
  it("метка вытяжки находится по тексту и стирается ластиком", () => {
    const s = setup([{ id: "x", targetId: "f", name: "LV1" }])
    // текст правее и выше центра: левый нижний угол (+8, −8) px, текст из трёх знаков
    const p = { x: 300 + 14 / PX_PER_CM, y: 80 - 12 / PX_PER_CM }
    expect(s.tool.labelAt(p)?.id).toBe("x")
    expect(s.tool.erase(p)).toBe(true)
    expect(s.lines()).toEqual([])
  })
})
