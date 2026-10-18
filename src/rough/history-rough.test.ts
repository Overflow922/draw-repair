import { describe, expect, it } from "vitest"
import { emptyHistory, parseHistory, planHistory, record, recordMarks, recordRough, redoEntry, redoRough, serializeHistory, undoEntry, undoRough } from "../history"
import type { Scene } from "../history"
import type { PlasterMark, Screed } from "../types"

// change add-rough-works-plan: история плана «Черновые работы» — свой ключ «<id>:rough», снимок обоих списков
// (spec drawing-history «История плана «Черновые работы»»; design D7)

const p = (id: string, from = 100, to = 200, mm = 20): PlasterMark => ({ id, wallId: "w", face: 1, anchor: "a", fromCm: from, toCm: to, thicknessMm: mm })
const s = (id: string, mm = 50): Screed => ({ id, at: { x: 10, y: 20 }, thicknessMm: mm })
const state = (plaster: PlasterMark[], screeds: Screed[]) => ({ plaster, screeds })
const emptyScene: Scene = { walls: [], dimensions: [] }

describe("история плана «Черновые работы»", () => {
  it("RW-90: история лежит под ключом «<id>:rough» и независима от других планов", () => {
    const store = emptyHistory()
    recordRough(planHistory(store, "a", "rough"), state([p("p")], []))
    expect(Object.keys(store.histories)).toEqual(["a:rough"])
    for (const plan of ["measure", "demolition", "mounting"] as const) expect(planHistory(store, "a", plan).past).toEqual([])
  })

  it("RW-90: шаги других планов не попадают в историю «Черновых работ»", () => {
    const store = emptyHistory()
    record(planHistory(store, "a", "measure"), emptyScene)
    recordMarks(planHistory(store, "a", "demolition"), [])
    expect(planHistory(store, "a", "rough").past).toEqual([])
  })

  it("RW-91: отмена возвращает оба списка до операции, повтор — состояние до отмены", () => {
    const store = emptyHistory()
    const h = planHistory(store, "a", "rough")
    recordRough(h, state([p("p")], []))
    const undone = undoRough(h, state([p("p"), p("q", 300, 400)], [s("z")]))
    expect(undone).toEqual(state([p("p")], []))
    expect(h.future).toHaveLength(1)
    const redone = redoRough(h, state([p("p")], []))
    expect(redone).toEqual(state([p("p"), p("q", 300, 400)], [s("z")]))
  })

  it("RW-91: снимок не зависит от дальнейших правок исходных списков", () => {
    const store = emptyHistory()
    const h = planHistory(store, "a", "rough")
    const list = [p("p")]
    recordRough(h, state(list, []))
    list[0]!.thicknessMm = 99
    expect(undoRough(h, state([], []))?.plaster[0]?.thicknessMm).toBe(20)
  })

  it("RW-92: новая запись сбрасывает ветку повтора", () => {
    const h = planHistory(emptyHistory(), "a", "rough")
    recordRough(h, state([], []))
    undoRough(h, state([p("p")], []))
    recordRough(h, state([], []))
    expect(h.future).toEqual([])
  })

  it("RW-93: undoRough/redoRough не забирают записи других видов и возвращают null при пустом стеке", () => {
    const h = planHistory(emptyHistory(), "a", "rough")
    expect(undoRough(h, state([], []))).toBeNull()
    expect(redoRough(h, state([], []))).toBeNull()
    record(h, emptyScene)
    expect(undoRough(h, state([], []))).toBeNull()
    expect(h.past).toHaveLength(1)
  })

  it("RW-93: undoEntry и redoEntry не забирают записи «rough»", () => {
    const h = planHistory(emptyHistory(), "a", "rough")
    recordRough(h, state([p("p")], []))
    expect(undoEntry(h, emptyScene)).toBeNull()
    expect(h.past).toHaveLength(1)
    undoRough(h, state([], []))
    expect(redoEntry(h, emptyScene)).toBeNull()
    expect(h.future).toHaveLength(1)
  })

  it("RW-94: история переживает сериализацию и чтение; версия документа остаётся 2", () => {
    const store = emptyHistory()
    const h = planHistory(store, "a", "rough")
    recordRough(h, state([p("p")], [s("z", 65)]))
    const loaded = parseHistory(serializeHistory(store))
    expect(loaded?.readOnly).toBe(false)
    expect(loaded?.history.version).toBe(2)
    const back = planHistory(loaded!.history, "a", "rough")
    expect(undoRough(back, state([], []))).toEqual(state([p("p")], [s("z", 65)]))
  })

  it("RW-95: старая история без записей «rough» читается, история плана пуста", () => {
    const store = emptyHistory()
    record(planHistory(store, "a", "measure"), emptyScene)
    const loaded = parseHistory(serializeHistory(store))
    expect(planHistory(loaded!.history, "a", "measure").past).toHaveLength(1)
    expect(planHistory(loaded!.history, "a", "rough").past).toEqual([])
  })

  it.each([
    ["пометка без идентификатора", { kind: "rough", plaster: [{ ...p("x"), id: "" }], screeds: [] }],
    ["стяжка без идентификатора", { kind: "rough", plaster: [], screeds: [{ ...s("x"), id: "" }] }],
    ["стяжка с толщиной 5", { kind: "rough", plaster: [], screeds: [{ ...s("x"), thicknessMm: 5 }] }],
    ["списки не массивы", { kind: "rough", plaster: "x", screeds: [] }],
    ["нет списка стяжек", { kind: "rough", plaster: [] }],
  ])("RW-96: запись с некорректным снимком делает документ истории повреждённым (%s)", (_name, entry) => {
    const raw = JSON.stringify({ version: 2, histories: { "a:rough": { past: [entry], future: [] } }, trash: [] })
    expect(parseHistory(raw)).toBeNull()
  })
})
