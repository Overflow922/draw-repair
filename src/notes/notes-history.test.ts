import { describe, expect, it } from "vitest"
import { HISTORY_LIMIT, emptyHistory, parseHistory, planHistory, record, recordMarks, recordNotes, redoEntry, redoMarks, redoNotes, serializeHistory, undoEntry, undoMarks, undoNotes } from "../history"
import type { DrawingHistory, Scene } from "../history"

// change add-plan-notes: примечания в истории плана (spec drawing-history «Примечания в истории»; design D3).

const empty = (): DrawingHistory => ({ past: [], future: [] })
const scene = (): Scene => ({ walls: [], dimensions: [] })

describe("шаги истории примечаний", () => {
  it("правка — один шаг: отмена возвращает список до правки, повтор — после", () => {
    const h = empty()
    recordNotes(h, [])
    const restored = undoNotes(h, ["а", "б", "в"])
    expect(restored).toEqual([])
    expect(h.past).toHaveLength(0)
    expect(h.future).toHaveLength(1)
    expect(redoNotes(h, restored ?? [])).toEqual(["а", "б", "в"])
    expect(h.past).toHaveLength(1)
    expect(h.future).toHaveLength(0)
  })

  it("запись — копия: правка списка после записи снимок не меняет", () => {
    const h = empty()
    const list = ["а"]
    recordNotes(h, list)
    list.push("б")
    list[0] = "изменено"
    expect(undoNotes(h, [])).toEqual(["а"])
  })

  it("возвращаемый снимок — копия: его правка не портит запись в future", () => {
    const h = empty()
    recordNotes(h, ["а"])
    const restored = undoNotes(h, ["б"]) ?? []
    restored.push("испорчено")
    expect(redoNotes(h, restored)).toEqual(["б"])
  })

  it("новая запись обнуляет ветку повтора", () => {
    const h = empty()
    recordNotes(h, [])
    undoNotes(h, ["а"])
    expect(h.future).toHaveLength(1)
    recordNotes(h, [])
    expect(h.future).toHaveLength(0)
  })

  it("история ограничена HISTORY_LIMIT: старейшая запись вытесняется", () => {
    const h = empty()
    for (let i = 0; i <= HISTORY_LIMIT; i++) recordNotes(h, [String(i)])
    expect(h.past).toHaveLength(HISTORY_LIMIT)
    expect(h.past[0]).toEqual({ kind: "notes", notes: ["1"] })
  })

  it("отмена и повтор примечаний при чужой верхней записи возвращают null и стеки не меняют", () => {
    const h = empty()
    record(h, scene())
    expect(undoNotes(h, [])).toBeNull()
    expect(h.past).toHaveLength(1)
    const f = empty()
    f.future.push({ kind: "demolition", marks: [] })
    expect(redoNotes(f, [])).toBeNull()
    expect(f.future).toHaveLength(1)
  })

  it("прежние функции отмены и повтора записей примечаний не забирают", () => {
    const h = empty()
    recordNotes(h, ["а"])
    expect(undoEntry(h, scene())).toBeNull()
    expect(undoMarks(h, [])).toBeNull()
    expect(h.past).toHaveLength(1)
    const f = empty()
    f.future.push({ kind: "notes", notes: ["а"] })
    expect(redoEntry(f, scene())).toBeNull()
    expect(redoMarks(f, [])).toBeNull()
    expect(f.future).toHaveLength(1)
  })

  it("отмена правки стены не забирает примечания и наоборот", () => {
    const h = empty()
    recordNotes(h, [])
    record(h, scene())
    expect(undoNotes(h, ["а"])).toBeNull()
    expect(undoEntry(h, scene())?.kind).toBe("walls")
    expect(undoNotes(h, ["а"])).toEqual([])
  })
})

describe("независимость историй планов", () => {
  it("правка примечаний «Монтажа» не попадает в историю обмера и демонтажа", () => {
    const store = emptyHistory()
    recordNotes(planHistory(store, "d", "mounting"), [])
    expect(planHistory(store, "d", "measure").past).toHaveLength(0)
    expect(planHistory(store, "d", "demolition").past).toHaveLength(0)
    expect(planHistory(store, "d", "mounting").past).toHaveLength(1)
  })
})

describe("персистентность", () => {
  it("история с шагами примечаний переживает сериализацию", () => {
    const store = emptyHistory()
    const h = planHistory(store, "d", "demolition")
    recordNotes(h, [])
    recordNotes(h, ["а"])
    undoNotes(h, ["а", "б"])
    const loaded = parseHistory(serializeHistory(store))
    expect(loaded?.readOnly).toBe(false)
    expect(loaded?.history).toEqual(store)
  })

  it("версия документа истории не меняется", () => {
    expect(JSON.parse(serializeHistory(emptyHistory())).version).toBe(2)
  })

  it("история без записей примечаний читается как раньше", () => {
    const store = emptyHistory()
    recordMarks(planHistory(store, "d", "demolition"), [])
    expect(parseHistory(serializeHistory(store))?.history).toEqual(store)
  })

  it("запись примечаний, где снимок не список строк, делает историю повреждённой", () => {
    for (const bad of [undefined, "строка", [1, 2], ["а", null], { 0: "а" }]) {
      const raw = JSON.stringify({ version: 2, histories: { d: { past: [{ kind: "notes", notes: bad }], future: [] } }, trash: [] })
      expect(parseHistory(raw)).toBeNull()
    }
  })

  it("запись примечаний в future с битым снимком тоже делает историю повреждённой", () => {
    const raw = JSON.stringify({ version: 2, histories: { d: { past: [], future: [{ kind: "notes", notes: 5 }] } }, trash: [] })
    expect(parseHistory(raw)).toBeNull()
  })
})
