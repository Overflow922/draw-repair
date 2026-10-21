import { describe, expect, it } from "vitest"
import { emptyHistory, parseHistory, planHistory, record, recordCallouts, recordFurniture, recordMarks, recordRough, redoEntry, redoFurniture, serializeHistory, undoEntry, undoFurniture } from "../history"
import type { Scene } from "../history"
import type { FurnitureItem } from "../types"

// change furniture-plan-table: история плана «Мебель» — свой ключ «<id>:furniture», снимок столов и размеров
// (spec drawing-history «История плана «Мебель»»; design D9)
// TCR (change furniture-items-catalog): стол стал предметом мебели (Table → FurnitureItem, tables → items, table*.ts → item*.ts) с видом «table»; меняются только имена и вид в данных, утверждения о поведении не менялись

const table = (id: string, x = 0, angleDeg = 0): FurnitureItem => ({ id, kind: "table", x, y: 0, widthCm: 80, lengthCm: 160, angleDeg })
const empty: Scene = { walls: [], dimensions: [] }

describe("история плана «Мебель»", () => {
  it("FP-80: история лежит под ключом «<id>:furniture» и независима от других планов", () => {
    const store = emptyHistory()
    recordFurniture(planHistory(store, "a", "furniture"), { items: [table("t")], dimensions: [] })
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
    recordFurniture(h, { items: [table("t")], dimensions: [] })
    const undone = undoFurniture(h, { items: [table("t"), table("u")], dimensions: [] })
    expect(undone?.items.map((t) => t.id)).toEqual(["t"])
    const redone = redoFurniture(h, { items: [table("t")], dimensions: [] })
    expect(redone?.items.map((t) => t.id)).toEqual(["t", "u"])
  })

  it("FP-81: отмена поворота возвращает прежний угол", () => {
    const h = planHistory(emptyHistory(), "a", "furniture")
    recordFurniture(h, { items: [table("t", 0, 0)], dimensions: [] })
    expect(undoFurniture(h, { items: [table("t", 0, 30)], dimensions: [] })?.items[0]?.angleDeg).toBe(0)
  })

  it("FP-81: снимок не зависит от дальнейших правок исходного стола", () => {
    const h = planHistory(emptyHistory(), "a", "furniture")
    const t = table("t")
    recordFurniture(h, { items: [t], dimensions: [] })
    t.x = 999
    t.angleDeg = 45
    expect(undoFurniture(h, { items: [], dimensions: [] })?.items[0]).toEqual(table("t"))
  })

  it("FP-82: новая запись сбрасывает ветку повтора", () => {
    const h = planHistory(emptyHistory(), "a", "furniture")
    recordFurniture(h, { items: [table("t")], dimensions: [] })
    undoFurniture(h, { items: [table("t"), table("u")], dimensions: [] })
    expect(h.future).toHaveLength(1)
    recordFurniture(h, { items: [table("t")], dimensions: [] })
    expect(h.future).toEqual([])
  })

  it("FP-82: отмена и повтор столов не забирают чужие записи, и наоборот", () => {
    const h = planHistory(emptyHistory(), "a", "furniture")
    recordCallouts(h, [])
    expect(undoFurniture(h, { items: [], dimensions: [] })).toBeNull()
    expect(h.past).toHaveLength(1)
    const g = planHistory(emptyHistory(), "a", "furniture")
    recordFurniture(g, { items: [table("t")], dimensions: [] })
    expect(undoEntry(g, empty)).toBeNull()
    expect(redoEntry(g, empty)).toBeNull()
    expect(g.past).toHaveLength(1)
  })

  it("FP-83: история переживает сериализацию и сохраняет угол", () => {
    const store = emptyHistory()
    recordFurniture(planHistory(store, "a", "furniture"), { items: [table("t", 0, 30)], dimensions: [] })
    const parsed = parseHistory(serializeHistory(store))
    expect(parsed?.readOnly).toBe(false)
    const entry = parsed?.history.histories["a:furniture"]?.past[0]
    expect(entry?.kind === "furniture" ? entry.items[0]?.angleDeg : null).toBe(30)
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
    recordFurniture(planHistory(store, "a", "furniture"), { items: [table("t")], dimensions: [] })
    const raw = serializeHistory(store)
    expect(parseHistory(raw.replace('"id":"t"', '"id":""'))).toBeNull()
    expect(parseHistory(raw.replace('"widthCm":80', '"widthCm":0'))).toBeNull()
    expect(parseHistory(raw)).not.toBeNull()
  })

  // change furniture-items-catalog, design D5: записи, сохранённые до каталога видов
  it("FIK-30: старая запись истории (поле tables, предметы без вида) читается: предметы переходят в items столами", () => {
    const store = emptyHistory()
    recordFurniture(planHistory(store, "a", "furniture"), { items: [table("t", 5)], dimensions: [] })
    const legacy = serializeHistory(store).replace('"items":', '"tables":').replace('"kind":"table",', "")
    expect(legacy).toContain('"tables"')
    expect(legacy).not.toContain('"kind":"table"')
    const entry = parseHistory(legacy)?.history.histories["a:furniture"]?.past[0]
    expect(entry?.kind === "furniture" ? entry.items : null).toEqual([table("t", 5)])
  })

  it("FIK-31: запись с предметом неизвестного вида — документ истории повреждён", () => {
    const store = emptyHistory()
    recordFurniture(planHistory(store, "a", "furniture"), { items: [table("t")], dimensions: [] })
    expect(parseHistory(serializeHistory(store).replace('"kind":"table"', '"kind":"wardrobe"'))).toBeNull()
  })
})
