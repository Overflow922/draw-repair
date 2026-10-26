import { describe, expect, it } from "vitest"
import { emptyHistory, parseHistory, planHistory, recordFurniture, recordPlumbing, redoEntry, redoFurniture, redoPlumbing, serializeHistory, undoEntry, undoFurniture, undoPlumbing } from "../history"
import type { Dimension, FurnitureItem } from "../types"

// change add-plumbing-plan: история плана «Сантехника» — свой ключ «<id>:plumbing», снимок размеров плана
// (spec drawing-history «История плана «Сантехника»»; design D6)

const vertex = { a: { wallId: "w1", edge: 0 }, b: { wallId: "w2", edge: 1 } }
const toCenter = (offset = -30): Dimension => ({ from: vertex, to: { kind: "item", itemId: "s", at: { kind: "center" } }, offset })
const sink = (x = 100): FurnitureItem => ({ id: "s", kind: "sink", x, y: 20, widthCm: 45, lengthCm: 40, angleDeg: 0 })

describe("история плана «Сантехника»", () => {
  it("PH-01: отмена размера возвращает размеры до постановки, повтор — с теми же точками и смещением", () => {
    const h = planHistory(emptyHistory(), "a", "plumbing")
    recordPlumbing(h, [])
    expect(undoPlumbing(h, [toCenter()])).toEqual([])
    expect(redoPlumbing(h, [])).toEqual([toCenter()])
  })

  it("PH-02: история лежит под ключом «<id>:plumbing» и независима от «Мебели»", () => {
    const store = emptyHistory()
    recordFurniture(planHistory(store, "a", "furniture"), { items: [sink()], dimensions: [] })
    recordPlumbing(planHistory(store, "a", "plumbing"), [])
    expect(Object.keys(store.histories).sort()).toEqual(["a:furniture", "a:plumbing"])
    // отмена на «Сантехнике» убирает размер, сдвиг раковины на «Мебели» остаётся в её истории
    expect(undoPlumbing(planHistory(store, "a", "plumbing"), [toCenter()])).toEqual([])
    expect(planHistory(store, "a", "furniture").past).toHaveLength(1)
    expect(undoFurniture(planHistory(store, "a", "furniture"), { items: [sink(150)], dimensions: [] })?.items).toEqual([sink()])
  })

  it("PH-03: отмена на «Мебели» не трогает историю «Сантехники»", () => {
    const store = emptyHistory()
    recordPlumbing(planHistory(store, "a", "plumbing"), [])
    recordFurniture(planHistory(store, "a", "furniture"), { items: [], dimensions: [] })
    undoFurniture(planHistory(store, "a", "furniture"), { items: [sink()], dimensions: [] })
    expect(planHistory(store, "a", "plumbing").past).toEqual([{ kind: "plumbing", dimensions: [] }])
    expect(planHistory(store, "a", "plumbing").future).toEqual([])
  })

  it("PH-04: записи «plumbing» не забираются отменой других видов, и наоборот", () => {
    const h = planHistory(emptyHistory(), "a", "plumbing")
    recordPlumbing(h, [])
    expect(undoEntry(h, { walls: [], dimensions: [] })).toBeNull()
    expect(undoFurniture(h, { items: [], dimensions: [] })).toBeNull()
    expect(h.past).toHaveLength(1)
    undoPlumbing(h, [toCenter()])
    expect(redoEntry(h, { walls: [], dimensions: [] })).toBeNull()
    expect(redoFurniture(h, { items: [], dimensions: [] })).toBeNull()
    expect(h.future).toHaveLength(1)
  })

  it("PH-05: снимок не делит объекты с текущими размерами", () => {
    const h = planHistory(emptyHistory(), "a", "plumbing")
    const dim = toCenter()
    recordPlumbing(h, [dim])
    dim.offset = 99
    expect(undoPlumbing(h, [])).toEqual([toCenter()])
  })

  it("PH-06: история переживает перезагрузку: «Отменить» и «Повторить» на тех же шагах", () => {
    const store = emptyHistory()
    const h = planHistory(store, "a", "plumbing")
    recordPlumbing(h, [])
    recordPlumbing(h, [toCenter()])
    undoPlumbing(h, [toCenter(), toCenter(-60)])
    const loaded = parseHistory(serializeHistory(store))
    expect(loaded?.readOnly).toBe(false)
    const again = loaded ? planHistory(loaded.history, "a", "plumbing") : null
    expect(again?.past).toEqual([{ kind: "plumbing", dimensions: [] }])
    expect(again?.future).toEqual([{ kind: "plumbing", dimensions: [toCenter(), toCenter(-60)] }])
  })

  it("PH-07: история, сохранённая до введения плана, читается без изменений; история плана пуста", () => {
    const store = emptyHistory()
    recordFurniture(planHistory(store, "a", "furniture"), { items: [sink()], dimensions: [] })
    const loaded = parseHistory(serializeHistory(store))
    expect(loaded ? planHistory(loaded.history, "a", "furniture").past : null).toHaveLength(1)
    expect(loaded ? planHistory(loaded.history, "a", "plumbing").past : null).toEqual([])
  })

  it("PH-08: запись с некорректным размером — документ истории повреждён, история сбрасывается", () => {
    const raw = JSON.stringify({ version: 2, trash: [], histories: { "a:plumbing": { past: [{ kind: "plumbing", dimensions: [{ from: vertex, to: { kind: "item", at: { kind: "center" } }, offset: 1 }] }], future: [] } } })
    expect(parseHistory(raw)).toBeNull()
    expect(parseHistory(raw.replace('"to":{"kind":"item","at"', '"to":{"kind":"item","itemId":"s","at"'))).not.toBeNull()
  })
})
