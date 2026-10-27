import { describe, expect, it } from "vitest"
import { emptyHistory, parseHistory, planHistory, recordExhausts, recordSwitches, redoExhausts, serializeHistory, undoEntry, undoExhausts, undoSwitches } from "../history"
import type { ExhaustFan, ExhaustState, LightLine } from "../types"

// change add-exhaust-fan: шаги истории вытяжек на плане «Группы включения»
// (spec drawing-history «Отмена постановки вытяжки», «Отмена удаления вытяжки с меткой»; design D6)

const fan: ExhaustFan = { id: "f1", x: 100, y: 80 }
const mark: LightLine = { id: "l1", targetId: "f1", name: "LV1" }
const empty: ExhaustState = { exhausts: [], lines: [] }
const withBoth: ExhaustState = { exhausts: [fan], lines: [mark] }

describe("история вытяжек", () => {
  it("отмена постановки убирает вытяжку, повтор возвращает на то же место", () => {
    const h = planHistory(emptyHistory(), "a", "switching")
    recordExhausts(h, empty)
    expect(undoExhausts(h, { exhausts: [fan], lines: [] })).toEqual(empty)
    expect(redoExhausts(h, empty)).toEqual({ exhausts: [fan], lines: [] })
  })

  it("удаление вытяжки с меткой откатывается одним шагом: возвращаются оба", () => {
    const h = planHistory(emptyHistory(), "a", "switching")
    recordExhausts(h, withBoth)
    expect(h.past).toHaveLength(1)
    expect(undoExhausts(h, empty)).toEqual(withBoth)
    expect(redoExhausts(h, withBoth)).toEqual(empty)
  })

  it("снимок не зависит от последующих правок", () => {
    const h = planHistory(emptyHistory(), "a", "switching")
    const list = [structuredClone(fan)]
    recordExhausts(h, { exhausts: list, lines: [] })
    const first = list[0]
    if (first) first.x = 999
    expect(undoExhausts(h, empty)?.exhausts).toEqual([fan])
  })

  it("запись вытяжек не принимается чужими отменами и наоборот", () => {
    const h = planHistory(emptyHistory(), "a", "switching")
    recordExhausts(h, empty)
    expect(undoSwitches(h, [])).toBeNull()
    expect(undoEntry(h, { walls: [], dimensions: [] })).toBeNull()
    expect(h.past).toHaveLength(1)
    recordSwitches(h, [])
    expect(undoExhausts(h, empty)).toBeNull()
  })

  it("переживает сериализацию", () => {
    const store = emptyHistory()
    const h = planHistory(store, "a", "switching")
    recordExhausts(h, withBoth)
    const back = parseHistory(serializeHistory(store))
    const restored = back ? planHistory(back.history, "a", "switching") : null
    expect(restored?.past).toEqual([{ kind: "exhausts", exhausts: [fan], lines: [mark] }])
  })

  it("повреждённая запись сбрасывает историю", () => {
    const raw = JSON.stringify({ version: 2, histories: { "a:switching": { past: [{ kind: "exhausts", exhausts: [{ id: "x", x: 1.5, y: 2 }], lines: [] }], future: [] } }, trash: [] })
    const back = parseHistory(raw)
    expect(back).toBeNull()
  })
})
