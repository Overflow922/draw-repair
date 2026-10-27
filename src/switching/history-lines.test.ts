import { describe, expect, it } from "vitest"
import { emptyHistory, parseHistory, planHistory, recordCallouts, recordSwitchingLines, redoCallouts, redoSwitchingLines, serializeHistory, undoCallouts, undoEntry, undoSwitchingLines } from "../history"
import type { LightLine } from "../types"

// change add-light-lines: шаги истории меток линий на плане «Группы включения»
// (spec drawing-history «Отмена постановки метки», «Отмена смены имени»; design D7)

const l3: LightLine = { id: "1", targetId: "x", name: "L3" }
const l5: LightLine = { ...l3, name: "L5" }

describe("история меток линий", () => {
  it("LL-30: отмена постановки убирает метку, повтор возвращает", () => {
    const h = planHistory(emptyHistory(), "a", "switching")
    recordSwitchingLines(h, [])
    expect(undoSwitchingLines(h, [l3])).toEqual([])
    expect(redoSwitchingLines(h, [])).toEqual([l3])
  })

  it("LL-31: отмена смены имени возвращает прежнее имя", () => {
    const h = planHistory(emptyHistory(), "a", "switching")
    recordSwitchingLines(h, [l3])
    expect(undoSwitchingLines(h, [l5])).toEqual([l3])
    expect(redoSwitchingLines(h, [l3])).toEqual([l5])
  })

  it("LL-32: снимок не зависит от последующих правок списка", () => {
    const h = planHistory(emptyHistory(), "a", "switching")
    const lines = [{ ...l3 }]
    recordSwitchingLines(h, lines)
    if (lines[0]) lines[0].name = "L9"
    expect(undoSwitchingLines(h, [])).toEqual([l3])
  })

  it("LL-33: запись меток не принимается отменой выносок и наоборот", () => {
    const h = planHistory(emptyHistory(), "a", "switching")
    recordSwitchingLines(h, [])
    expect(undoCallouts(h, [])).toBeNull()
    expect(undoEntry(h, { walls: [], dimensions: [] })).toBeNull()
    expect(h.past).toHaveLength(1)
    recordCallouts(h, [])
    expect(undoSwitchingLines(h, [])).toBeNull()
    expect(redoCallouts(h, [])).toBeNull()
  })

  it("LL-34: история с метками переживает сериализацию", () => {
    const store = emptyHistory()
    recordSwitchingLines(planHistory(store, "a", "switching"), [l3])
    const loaded = parseHistory(serializeHistory(store))
    expect(loaded?.readOnly).toBe(false)
    if (!loaded) throw new Error("история не прочитана")
    expect(undoSwitchingLines(planHistory(loaded.history, "a", "switching"), [])).toEqual([l3])
  })

  it("LL-35: запись с битой меткой — повреждённая история, она не читается", () => {
    const raw = JSON.stringify({ version: 2, histories: { "a:switching": { past: [{ kind: "switching", lines: [{ id: "1", targetId: "x", name: "3" }] }], future: [] } }, trash: [] })
    expect(parseHistory(raw)).toBeNull()
  })
})
