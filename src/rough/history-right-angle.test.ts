import { describe, expect, it } from "vitest"
import { emptyHistory, parseHistory, planHistory, recordRough, redoRough, serializeHistory, undoRough } from "../history"
import type { PlasterMark, RightAngleMark, Screed } from "../types"

// change plaster-right-angle: список прямых углов входит в снимок истории плана «Черновые работы»
// (spec drawing-history «История прямых углов плана «Черновые работы»»; design D4)

const p = (id: string): PlasterMark => ({ id, wallId: "w", face: 1, anchor: "a", fromCm: 100, toCm: 200, thicknessMm: 20 })
const s = (id: string): Screed => ({ id, at: { x: 10, y: 20 }, thicknessMm: 50 })
const ra = (id: string): RightAngleMark => ({ id, corner: [{ markId: "p", at: "to" }, { markId: "q", at: "from" }] })

describe("история прямых углов", () => {
  it("RA-70: отмена возвращает список углов до операции, повтор — состояние до отмены", () => {
    const h = planHistory(emptyHistory(), "a", "rough")
    recordRough(h, { plaster: [p("p")], screeds: [], angles: [] })
    const undone = undoRough(h, { plaster: [p("p")], screeds: [], angles: [ra("r")] })
    expect(undone?.angles).toEqual([])
    expect(undone?.plaster).toEqual([p("p")])
    expect(redoRough(h, { plaster: [p("p")], screeds: [], angles: [] })?.angles).toEqual([ra("r")])
  })

  it("RA-70: отмена удаления возвращает пометку", () => {
    const h = planHistory(emptyHistory(), "a", "rough")
    recordRough(h, { plaster: [], screeds: [s("z")], angles: [ra("r")] })
    const undone = undoRough(h, { plaster: [], screeds: [s("z")], angles: [] })
    expect(undone?.angles).toEqual([ra("r")])
    expect(undone?.screeds).toEqual([s("z")])
  })

  it("RA-70: снимок не зависит от дальнейших правок исходного списка", () => {
    const h = planHistory(emptyHistory(), "a", "rough")
    const list = [ra("r")]
    recordRough(h, { plaster: [], screeds: [], angles: list })
    list[0] = ra("changed")
    expect(undoRough(h, { plaster: [], screeds: [], angles: [] })?.angles).toEqual([ra("r")])
  })

  it("RA-70: запись без углов (старая история) отменяется без поля углов", () => {
    const h = planHistory(emptyHistory(), "a", "rough")
    recordRough(h, { plaster: [p("p")], screeds: [] })
    const undone = undoRough(h, { plaster: [], screeds: [] })
    expect(undone?.angles).toBeUndefined()
  })

  it("RA-70: история переживает сериализацию", () => {
    const store = emptyHistory()
    recordRough(planHistory(store, "a", "rough"), { plaster: [], screeds: [], angles: [ra("r")] })
    const loaded = parseHistory(serializeHistory(store))
    expect(loaded?.readOnly).toBe(false)
    const back = planHistory(loaded?.history ?? emptyHistory(), "a", "rough")
    expect(back.past).toEqual([{ kind: "rough", plaster: [], screeds: [], angles: [ra("r")] }])
  })

  it("RA-71: старая история без поля углов читается", () => {
    const raw = JSON.stringify({ version: 2, histories: { "a:rough": { past: [{ kind: "rough", plaster: [], screeds: [] }], future: [] } }, trash: [] })
    const loaded = parseHistory(raw)
    expect(loaded?.readOnly).toBe(false)
    expect(planHistory(loaded?.history ?? emptyHistory(), "a", "rough").past).toHaveLength(1)
  })

  it("RA-72: запись с пометкой без идентификатора делает историю повреждённой", () => {
    const bad = { kind: "rough", plaster: [], screeds: [], angles: [{ id: "", corner: [{ markId: "p", at: "to" }, { markId: "q", at: "from" }] }] }
    const raw = JSON.stringify({ version: 2, histories: { "a:rough": { past: [bad], future: [] } }, trash: [] })
    expect(parseHistory(raw)).toBeNull()
  })

  it("RA-72: запись с углами не списком делает историю повреждённой", () => {
    const bad = { kind: "rough", plaster: [], screeds: [], angles: "x" }
    const raw = JSON.stringify({ version: 2, histories: { "a:rough": { past: [bad], future: [] } }, trash: [] })
    expect(parseHistory(raw)).toBeNull()
  })
})
