import { describe, expect, it } from "vitest"
import { emptyHistory, parseHistory, planHistory, recordCallouts, recordSwitches, recordSwitchingLines, redoCallouts, redoSwitches, redoSwitchingLines, serializeHistory, undoCallouts, undoEntry, undoSwitches, undoSwitchingLines } from "../history"
import type { LightSwitch } from "../types"

// change add-light-switch: шаги истории выключателей на плане «Группы включения»
// (spec drawing-history «Отмена постановки выключателя», «Отмена правки линий клавиши»; design D7)

const one: LightSwitch = { id: "s1", at: { x: 120, y: -20 }, angle: -90, keys: [{ lines: ["L2"] }, { lines: [] }] }
const edited: LightSwitch = { ...one, keys: [{ lines: ["L3", "LV1"] }, { lines: [] }] }

describe("история выключателей", () => {
  it("LS-30: отмена постановки убирает выключатель, повтор возвращает с положением и клавишами", () => {
    const h = planHistory(emptyHistory(), "a", "switching")
    recordSwitches(h, [])
    expect(undoSwitches(h, [one])).toEqual([])
    expect(redoSwitches(h, [])).toEqual([one])
  })

  it("LS-31: отмена правки линий клавиши возвращает прежний список", () => {
    const h = planHistory(emptyHistory(), "a", "switching")
    recordSwitches(h, [one])
    expect(undoSwitches(h, [edited])).toEqual([one])
    expect(redoSwitches(h, [one])).toEqual([edited])
  })

  it("LS-32: снимок не зависит от последующих правок", () => {
    const h = planHistory(emptyHistory(), "a", "switching")
    const list: LightSwitch[] = [structuredClone(one)]
    recordSwitches(h, list)
    const first = list[0]
    if (first) {
      first.at.x = 999
      first.keys[0]?.lines.push("L9")
    }
    expect(undoSwitches(h, [])).toEqual([one])
  })

  it("LS-33: запись выключателей не принимается отменой меток, выносок и наоборот", () => {
    const h = planHistory(emptyHistory(), "a", "switching")
    recordSwitches(h, [])
    expect(undoSwitchingLines(h, [])).toBeNull()
    expect(undoCallouts(h, [])).toBeNull()
    expect(undoEntry(h, { walls: [], dimensions: [] })).toBeNull()
    expect(h.past).toHaveLength(1)
    recordSwitchingLines(h, [])
    expect(undoSwitches(h, [])).toBeNull()
    recordCallouts(h, [])
    expect(undoSwitches(h, [])).toBeNull()
    expect(redoSwitches(h, [])).toBeNull()
    expect(redoSwitchingLines(h, [])).toBeNull()
    expect(redoCallouts(h, [])).toBeNull()
  })

  it("LS-34: новая правка очищает повтор", () => {
    const h = planHistory(emptyHistory(), "a", "switching")
    recordSwitches(h, [])
    undoSwitches(h, [one])
    expect(h.future).toHaveLength(1)
    recordSwitches(h, [])
    expect(h.future).toHaveLength(0)
  })

  it("LS-35: история с выключателями переживает сериализацию", () => {
    const store = emptyHistory()
    recordSwitches(planHistory(store, "a", "switching"), [one])
    const loaded = parseHistory(serializeHistory(store))
    expect(loaded?.readOnly).toBe(false)
    if (!loaded) throw new Error("история не прочитана")
    expect(undoSwitches(planHistory(loaded.history, "a", "switching"), [])).toEqual([one])
  })

  it("LS-36: запись с битым выключателем — повреждённая история, она не читается", () => {
    const bad = { id: "s1", at: { x: 0, y: 0 }, angle: 0, keys: [] }
    const raw = JSON.stringify({ version: 2, histories: { "a:switching": { past: [{ kind: "switches", switches: [bad] }], future: [] } }, trash: [] })
    expect(parseHistory(raw)).toBeNull()
  })
})
