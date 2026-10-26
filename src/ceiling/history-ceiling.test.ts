import { describe, expect, it } from "vitest"
import { emptyHistory, parseHistory, planHistory, recordCeiling, recordFurniture, redoCeiling, redoEntry, redoFurniture, serializeHistory, undoCeiling, undoEntry, undoFurniture } from "../history"
import type { FurnitureItem, StretchCeiling } from "../types"

// change add-ceiling-plan: история плана «Потолки и освещение» — свой ключ «<id>:ceiling», снимок списка потолков плана
// (spec drawing-history «История плана «Потолки и освещение»»; design D6)

const ceiling = (dropMm = 50, id = "c"): StretchCeiling => ({ id, at: { x: 100, y: 100 }, dropMm })
const table = (x = 100): FurnitureItem => ({ id: "t", kind: "table", x, y: 20, widthCm: 80, lengthCm: 160, angleDeg: 0 })

describe("история плана «Потолки и освещение»", () => {
  it("CP-50: отмена постановки возвращает список до постановки, повтор — потолок с той же точкой и опусканием", () => {
    const h = planHistory(emptyHistory(), "a", "ceiling")
    recordCeiling(h, [])
    expect(undoCeiling(h, [ceiling()])).toEqual([])
    expect(redoCeiling(h, [])).toEqual([ceiling()])
  })

  it("CP-51: отмена правки опускания возвращает прежнее опускание", () => {
    const h = planHistory(emptyHistory(), "a", "ceiling")
    recordCeiling(h, [ceiling(50)])
    expect(undoCeiling(h, [ceiling(80)])).toEqual([ceiling(50)])
  })

  it("CP-52: история лежит под ключом «<id>:ceiling» и независима от «Мебели»", () => {
    const store = emptyHistory()
    recordFurniture(planHistory(store, "a", "furniture"), { items: [table()], dimensions: [] })
    recordCeiling(planHistory(store, "a", "ceiling"), [])
    expect(Object.keys(store.histories).sort()).toEqual(["a:ceiling", "a:furniture"])
    expect(undoCeiling(planHistory(store, "a", "ceiling"), [ceiling()])).toEqual([])
    expect(undoFurniture(planHistory(store, "a", "furniture"), { items: [table(150)], dimensions: [] })?.items).toEqual([table()])
  })

  it("CP-53: записи «ceiling» не забираются отменой других видов, и наоборот", () => {
    const h = planHistory(emptyHistory(), "a", "ceiling")
    recordCeiling(h, [])
    expect(undoEntry(h, { walls: [], dimensions: [] })).toBeNull()
    expect(undoFurniture(h, { items: [], dimensions: [] })).toBeNull()
    expect(h.past).toHaveLength(1)
    undoCeiling(h, [ceiling()])
    expect(redoEntry(h, { walls: [], dimensions: [] })).toBeNull()
    expect(redoFurniture(h, { items: [], dimensions: [] })).toBeNull()
    expect(h.future).toHaveLength(1)
    const other = planHistory(emptyHistory(), "a", "furniture")
    recordFurniture(other, { items: [], dimensions: [] })
    expect(undoCeiling(other, [])).toBeNull()
    expect(other.past).toHaveLength(1)
  })

  it("CP-54: снимок не делит объекты с текущим списком", () => {
    const h = planHistory(emptyHistory(), "a", "ceiling")
    const c = ceiling()
    recordCeiling(h, [c])
    c.dropMm = 99
    c.at.x = 5
    expect(undoCeiling(h, [])).toEqual([ceiling()])
  })

  it("CP-55: история переживает перезагрузку: «Отменить» и «Повторить» на тех же шагах", () => {
    const store = emptyHistory()
    const h = planHistory(store, "a", "ceiling")
    recordCeiling(h, [])
    recordCeiling(h, [ceiling()])
    undoCeiling(h, [ceiling(), ceiling(80, "d")])
    const loaded = parseHistory(serializeHistory(store))
    expect(loaded?.readOnly).toBe(false)
    const again = loaded ? planHistory(loaded.history, "a", "ceiling") : null
    expect(again?.past).toEqual([{ kind: "ceiling", ceilings: [] }])
    expect(again?.future).toEqual([{ kind: "ceiling", ceilings: [ceiling(), ceiling(80, "d")] }])
  })

  it("CP-56: история, сохранённая до введения плана, читается без изменений; история плана пуста", () => {
    const store = emptyHistory()
    recordFurniture(planHistory(store, "a", "furniture"), { items: [table()], dimensions: [] })
    const loaded = parseHistory(serializeHistory(store))
    expect(loaded ? planHistory(loaded.history, "a", "furniture").past : null).toHaveLength(1)
    expect(loaded ? planHistory(loaded.history, "a", "ceiling").past : null).toEqual([])
  })

  it("CP-57: запись с некорректным потолком — документ истории повреждён, история сбрасывается", () => {
    const raw = (dropMm: unknown): string =>
      JSON.stringify({ version: 2, trash: [], histories: { "a:ceiling": { past: [{ kind: "ceiling", ceilings: [{ id: "c", at: { x: 1, y: 1 }, dropMm }] }], future: [] } } })
    expect(parseHistory(raw(0))).toBeNull()
    expect(parseHistory(raw(2.5))).toBeNull()
    expect(parseHistory(raw(50))).not.toBeNull()
  })
})
