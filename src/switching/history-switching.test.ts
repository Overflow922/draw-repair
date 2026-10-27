import { describe, expect, it } from "vitest"
import { emptyHistory, parseHistory, planHistory, recordCallouts, recordCeilingPlan, recordExhausts, recordSwitches, recordSwitchingLines, serializeHistory, undoCallouts, undoCeilingPlan, undoExhausts, undoSwitches, undoSwitchingLines } from "../history"
import type { Callout, LightFixture, LightLine, LightSwitch } from "../types"

// change add-switching-plan, переработан в change merge-lighting-plans: у плана «Потолки и освещение» один стек истории (ключ
// «<id>:ceiling»), в нём шаги светильников, меток, выключателей, вытяжек и выносок; ключ «<id>:switching» не читается
// (spec drawing-history «Метки, выключатели и вытяжки в одной очереди с освещением», «Старая история «Группы включения»»; design D5)

const callout = (text = "Выключатель"): Callout => ({ id: "c", target: { x: 1, y: 2 }, at: { x: 3, y: 4 }, text })
const spot: LightFixture = { id: "l", kind: "spot", x: 10, y: 20 }
const line: LightLine = { id: "m", targetId: "l", name: "L1" }
const sw: LightSwitch = { id: "s", at: { x: 0, y: 0 }, angle: 0, keys: [{ lines: ["L1"] }] }

describe("история плана «Потолки и освещение» после слияния", () => {
  it("SW-60: отмена выноски убирает её в стеке плана ceiling", () => {
    const h = planHistory(emptyHistory(), "a", "ceiling")
    recordCallouts(h, [])
    expect(undoCallouts(h, [callout()])).toEqual([])
  })

  it("SW-61: светильник, метка и выключатель — три шага одного стека, три «Отменить» возвращают прежнее состояние", () => {
    const store = emptyHistory()
    const h = planHistory(store, "a", "ceiling")
    recordCeilingPlan(h, { ceilings: [], lights: [] })
    recordSwitchingLines(h, [])
    recordSwitches(h, [])
    expect(Object.keys(store.histories)).toEqual(["a:ceiling"])
    expect(h.past.map((e) => e.kind)).toEqual(["ceiling", "switching", "switches"])
    expect(undoSwitches(h, [sw])).toEqual([])
    expect(undoSwitchingLines(h, [line])).toEqual([])
    expect(undoCeilingPlan(h, { ceilings: [], lights: [spot] })?.lights).toEqual([])
    expect(h.past).toEqual([])
  })

  it("SW-62: шаги вытяжки и выноски лежат в том же стеке и отменяются по очереди", () => {
    const h = planHistory(emptyHistory(), "a", "ceiling")
    recordExhausts(h, { exhausts: [], lines: [] })
    recordCallouts(h, [])
    expect(undoCallouts(h, [callout()])).toEqual([])
    expect(undoExhausts(h, { exhausts: [{ id: "f", x: 1, y: 2 }], lines: [] })).toEqual({ exhausts: [], lines: [] })
  })

  it("SW-63: история переживает перезагрузку: «Отменить» и «Повторить» на тех же шагах", () => {
    const store = emptyHistory()
    const h = planHistory(store, "a", "ceiling")
    recordCallouts(h, [])
    recordCallouts(h, [callout()])
    undoCallouts(h, [callout(), callout("Второй")])
    const loaded = parseHistory(serializeHistory(store))
    expect(loaded?.readOnly).toBe(false)
    const again = loaded ? planHistory(loaded.history, "a", "ceiling") : null
    expect(again?.past).toEqual([{ kind: "callouts", callouts: [] }])
    expect(again?.future).toEqual([{ kind: "callouts", callouts: [callout(), callout("Второй")] }])
  })

  it("SW-64: сохранённая ранее история «Групп включения» (ключ «<id>:switching») не читается и не трогается; прочие истории доступны", () => {
    const raw = JSON.stringify({
      version: 2,
      histories: {
        "a:switching": { past: [{ kind: "callouts", callouts: [] }], future: [] },
        "a:ceiling": { past: [{ kind: "ceiling", ceilings: [], lights: [] }], future: [] },
      },
      trash: [],
    })
    const loaded = parseHistory(raw)
    expect(loaded?.readOnly).toBe(false)
    if (!loaded) throw new Error("история не прочитана")
    expect(planHistory(loaded.history, "a", "ceiling").past).toHaveLength(1)
    expect(planHistory(loaded.history, "a", "ceiling").past[0]?.kind).toBe("ceiling")
  })
})
