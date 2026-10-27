import { describe, expect, it } from "vitest"
import { LIGHT_SYMBOL_PX_PER_MM } from "../ceiling/light-symbol"
import type { ExhaustFan, LightFixture, LightLine, View } from "../types"
import { createLightLineTool } from "./light-line-tool"

// change line-edit-and-highlight: линия выделенного светильника или вытяжки правится полем панели (spec light-lines «Панель инструмента «Линия освещения»»)

const VIEW: View = { zoom: 1, pan: { x: 0, y: 0 } }
const LIGHTS: LightFixture[] = [
  { id: "a", kind: "spot", x: 100, y: 80 },
  { id: "ds", kind: "smoke-detector", x: 200, y: 80 },
]
const FANS: ExhaustFan[] = [{ id: "f", x: 300, y: 80 }]

function setup(initial: LightLine[] = []) {
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
    newName: () => "L1",
    view: () => VIEW,
    unitsPerMm: LIGHT_SYMBOL_PX_PER_MM,
  })
  return { tool, lines: () => lines, records: () => records }
}

describe("setLineOf", () => {
  it("светильнику без метки ставит L<n> одним шагом истории", () => {
    const s = setup()
    expect(s.tool.setLineOf("a", 3)).toBe(true)
    expect(s.lines().map((l) => [l.targetId, l.name])).toEqual([["a", "L3"]])
    expect(s.records()).toBe(1)
  })

  it("меняет имя существующей метки, id сохраняется", () => {
    const s = setup([{ id: "x", targetId: "a", name: "L3" }])
    expect(s.tool.setLineOf("a", 5)).toBe(true)
    expect(s.lines()).toEqual([{ id: "x", targetId: "a", name: "L5" }])
    expect(s.records()).toBe(1)
  })

  it("то же имя — шага истории нет", () => {
    const s = setup([{ id: "x", targetId: "a", name: "L3" }])
    expect(s.tool.setLineOf("a", 3)).toBe(false)
    expect(s.records()).toBe(0)
  })

  it("вытяжке ставит L<n>, как светильнику", () => {
    const s = setup()
    expect(s.tool.setLineOf("f", 2)).toBe(true)
    expect(s.lines().map((l) => [l.targetId, l.name])).toEqual([["f", "L2"]])
  })

  it("датчик метку не несёт", () => {
    const s = setup()
    expect(s.tool.setLineOf("ds", 1)).toBe(false)
    expect(s.lines()).toEqual([])
    expect(s.records()).toBe(0)
  })

  it("несуществующий носитель — ничего", () => {
    const s = setup()
    expect(s.tool.setLineOf("nope", 1)).toBe(false)
    expect(s.records()).toBe(0)
  })
})

describe("canCarryLineId", () => {
  it("светильник и вытяжка могут нести метку, датчик и неизвестный id — нет", () => {
    const { tool } = setup()
    expect(tool.canCarry("a")).toBe(true)
    expect(tool.canCarry("f")).toBe(true)
    expect(tool.canCarry("ds")).toBe(false)
    expect(tool.canCarry("nope")).toBe(false)
  })
})
