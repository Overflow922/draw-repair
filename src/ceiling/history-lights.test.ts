import { describe, expect, it } from "vitest"
import { emptyHistory, parseHistory, planHistory, recordCeilingPlan, redoCeilingPlan, serializeHistory, undoCeilingPlan } from "../history"
import type { LightFixture, StretchCeiling } from "../types"

// change add-ceiling-lighting: шаги истории плана «Потолки и освещение» с объектами освещения
// (spec drawing-history «История плана «Потолки и освещение»»; design D9)

const C50: StretchCeiling = { id: "c", at: { x: 100, y: 100 }, dropMm: 50 }
const spot = (x = 100): LightFixture => ({ id: "s", kind: "spot", x, y: 80 })
const CHANDELIER: LightFixture = { id: "l", kind: "chandelier", x: 200, y: 150 }

describe("история объектов освещения", () => {
  it("CL-H1: отмена постановки светильника убирает его, повтор возвращает с тем же видом и центром", () => {
    const h = planHistory(emptyHistory(), "a", "ceiling")
    recordCeilingPlan(h, { ceilings: [], lights: [] })
    expect(undoCeilingPlan(h, { ceilings: [], lights: [spot()] })).toEqual({ ceilings: [], lights: [] })
    expect(redoCeilingPlan(h, { ceilings: [], lights: [] })).toEqual({ ceilings: [], lights: [spot()] })
  })

  it("CL-H2: отмена ввода расстояния возвращает прежний центр", () => {
    const h = planHistory(emptyHistory(), "a", "ceiling")
    recordCeilingPlan(h, { ceilings: [], lights: [spot(100)] })
    expect(undoCeilingPlan(h, { ceilings: [], lights: [spot(60)] })?.lights).toEqual([spot(100)])
  })

  it("CL-H3: потолок и люстра в одной истории — первая отмена убирает люстру, вторая потолок", () => {
    const h = planHistory(emptyHistory(), "a", "ceiling")
    recordCeilingPlan(h, { ceilings: [], lights: [] })
    recordCeilingPlan(h, { ceilings: [C50], lights: [] })
    const once = undoCeilingPlan(h, { ceilings: [C50], lights: [CHANDELIER] })
    expect(once).toEqual({ ceilings: [C50], lights: [] })
    expect(undoCeilingPlan(h, once ?? { ceilings: [], lights: [] })).toEqual({ ceilings: [], lights: [] })
  })

  it("CL-H4: шаг, сохранённый до введения освещения, восстанавливает потолки и не удаляет светильник", () => {
    const raw = JSON.stringify({ version: 2, trash: [], histories: { "a:ceiling": { past: [{ kind: "ceiling", ceilings: [] }], future: [] } } })
    const loaded = parseHistory(raw)
    const h = loaded ? planHistory(loaded.history, "a", "ceiling") : null
    if (!h) throw new Error("история не прочитана")
    expect(undoCeilingPlan(h, { ceilings: [C50], lights: [spot()] })).toEqual({ ceilings: [], lights: [spot()] })
  })

  it("CL-H5: запись с некорректным объектом освещения — документ истории повреждён", () => {
    const raw = (lights: unknown): string =>
      JSON.stringify({ version: 2, trash: [], histories: { "a:ceiling": { past: [{ kind: "ceiling", ceilings: [], lights }], future: [] } } })
    expect(parseHistory(raw([{ id: "x", kind: "lamp", x: 1, y: 1 }]))).toBeNull()
    expect(parseHistory(raw([{ id: "x", kind: "sconce", x: 1, y: 1 }]))).toBeNull()
    expect(parseHistory(raw("x"))).toBeNull()
    expect(parseHistory(raw([spot()]))).not.toBeNull()
  })

  it("CL-H6: снимок не делит объекты с текущим списком и переживает перезагрузку", () => {
    const store = emptyHistory()
    const h = planHistory(store, "a", "ceiling")
    const l = spot()
    recordCeilingPlan(h, { ceilings: [], lights: [l] })
    l.x = 5
    const loaded = parseHistory(serializeHistory(store))
    const again = loaded ? planHistory(loaded.history, "a", "ceiling") : null
    expect(again?.past).toEqual([{ kind: "ceiling", ceilings: [], lights: [spot()] }])
  })
})
