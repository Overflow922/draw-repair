import { describe, expect, it } from "vitest"
import { emptyHistory, parseHistory, planHistory, record, recordCallouts, recordFurniture, recordMarks, recordRough, redoEntry, redoFurniture, serializeHistory, undoEntry, undoFurniture } from "../history"
import type { Scene } from "../history"
import type { Table } from "../types"

// change furniture-plan-table: история плана «Мебель» — свой ключ «<id>:furniture», снимок столов и размеров
// (spec drawing-history «История плана «Мебель»»; design D9)

const table = (id: string, x = 0, angleDeg = 0): Table => ({ id, x, y: 0, widthCm: 80, lengthCm: 160, angleDeg })
const empty: Scene = { walls: [], dimensions: [] }

describe("история плана «Мебель»", () => {
  it("FP-80: история лежит под ключом «<id>:furniture» и независима от других планов", () => {
    const store = emptyHistory()
    recordFurniture(planHistory(store, "a", "furniture"), { tables: [table("t")], dimensions: [] })
    expect(Object.keys(store.histories)).toEqual(["a:furniture"])
    for (const plan of ["measure", "demolition", "mounting", "rough", "reconstruction"] as const) expect(planHistory(store, "a", plan).past).toEqual([])
  })

  it("FP-80: шаги других планов не попадают в историю «Мебели»", () => {
    const store = emptyHistory()
    record(planHistory(store, "a", "measure"), empty)
    recordMarks(planHistory(store, "a", "demolition"), [])
    recordRough(planHistory(store, "a", "rough"), { plaster: [], screeds: [] })
    record(planHistory(store, "a", "reconstruction"), empty)
    expect(planHistory(store, "a", "furniture").past).toEqual([])
  })

  it("FP-81: отмена возвращает столы до операции, повтор — состояние до отмены", () => {
    const h = planHistory(emptyHistory(), "a", "furniture")
    recordFurniture(h, { tables: [table("t")], dimensions: [] })
    const undone = undoFurniture(h, { tables: [table("t"), table("u")], dimensions: [] })
    expect(undone?.tables.map((t) => t.id)).toEqual(["t"])
    const redone = redoFurniture(h, { tables: [table("t")], dimensions: [] })
    expect(redone?.tables.map((t) => t.id)).toEqual(["t", "u"])
  })

  it("FP-81: отмена поворота возвращает прежний угол", () => {
    const h = planHistory(emptyHistory(), "a", "furniture")
    recordFurniture(h, { tables: [table("t", 0, 0)], dimensions: [] })
    expect(undoFurniture(h, { tables: [table("t", 0, 30)], dimensions: [] })?.tables[0]?.angleDeg).toBe(0)
  })

  it("FP-81: снимок не зависит от дальнейших правок исходного стола", () => {
    const h = planHistory(emptyHistory(), "a", "furniture")
    const t = table("t")
    recordFurniture(h, { tables: [t], dimensions: [] })
    t.x = 999
    t.angleDeg = 45
    expect(undoFurniture(h, { tables: [], dimensions: [] })?.tables[0]).toEqual(table("t"))
  })

  it("FP-82: новая запись сбрасывает ветку повтора", () => {
    const h = planHistory(emptyHistory(), "a", "furniture")
    recordFurniture(h, { tables: [table("t")], dimensions: [] })
    undoFurniture(h, { tables: [table("t"), table("u")], dimensions: [] })
    expect(h.future).toHaveLength(1)
    recordFurniture(h, { tables: [table("t")], dimensions: [] })
    expect(h.future).toEqual([])
  })

  it("FP-82: отмена и повтор столов не забирают чужие записи, и наоборот", () => {
    const h = planHistory(emptyHistory(), "a", "furniture")
    recordCallouts(h, [])
    expect(undoFurniture(h, { tables: [], dimensions: [] })).toBeNull()
    expect(h.past).toHaveLength(1)
    const g = planHistory(emptyHistory(), "a", "furniture")
    recordFurniture(g, { tables: [table("t")], dimensions: [] })
    expect(undoEntry(g, empty)).toBeNull()
    expect(redoEntry(g, empty)).toBeNull()
    expect(g.past).toHaveLength(1)
  })

  it("FP-83: история переживает сериализацию и сохраняет угол", () => {
    const store = emptyHistory()
    recordFurniture(planHistory(store, "a", "furniture"), { tables: [table("t", 0, 30)], dimensions: [] })
    const parsed = parseHistory(serializeHistory(store))
    expect(parsed?.readOnly).toBe(false)
    const entry = parsed?.history.histories["a:furniture"]?.past[0]
    expect(entry?.kind === "furniture" ? entry.tables[0]?.angleDeg : null).toBe(30)
  })

  it("FP-84: старая история без ключа плана читается, история плана пуста", () => {
    const store = emptyHistory()
    record(planHistory(store, "a", "measure"), empty)
    const parsed = parseHistory(serializeHistory(store))
    expect(parsed?.readOnly).toBe(false)
    expect(parsed ? planHistory(parsed.history, "a", "furniture").past : null).toEqual([])
  })

  it("FP-85: запись со столом без идентификатора или с нулевой шириной — документ истории повреждён", () => {
    const store = emptyHistory()
    recordFurniture(planHistory(store, "a", "furniture"), { tables: [table("t")], dimensions: [] })
    const raw = serializeHistory(store)
    expect(parseHistory(raw.replace('"id":"t"', '"id":""'))).toBeNull()
    expect(parseHistory(raw.replace('"widthCm":80', '"widthCm":0'))).toBeNull()
    expect(parseHistory(raw)).not.toBeNull()
  })
})
