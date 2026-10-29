import { describe, expect, it } from "vitest"
import { emptyHistory, parseHistory, planHistory, recordCallouts, recordNotes, redoCallouts, redoNotes, serializeHistory, undoCallouts, undoNotes } from "../history"
import type { Callout } from "../types"

// change add-electrical-plan: история плана «Электрооборудование»
// (spec electrical-plan «История плана «Электрооборудование»»; drawing-history «Независимость историй планов»)

const callout: Callout = { id: "c", target: { x: 1, y: 2 }, at: { x: 3, y: 4 }, text: "h=900" }

describe("история плана «Электрооборудование»", () => {
  it("EH-01: отмена выноски убирает её, повтор возвращает", () => {
    const h = emptyHistory()
    const hist = planHistory(h, "a", "electrical")
    recordCallouts(hist, [])
    expect(undoCallouts(hist, [callout])).toEqual([])
    expect(redoCallouts(hist, [])).toEqual([callout])
  })

  it("EH-02: отмена примечаний возвращает прежний список, повтор — новый", () => {
    const h = emptyHistory()
    const hist = planHistory(h, "a", "electrical")
    recordNotes(hist, ["Первое"])
    expect(undoNotes(hist, ["Первое", "Второе"])).toEqual(["Первое"])
    expect(redoNotes(hist, ["Первое"])).toEqual(["Первое", "Второе"])
  })

  it("EH-03: история лежит под ключом «<id>:electrical» и независима от «Потолков и освещения» и «Мебели»", () => {
    const h = emptyHistory()
    recordCallouts(planHistory(h, "a", "electrical"), [])
    expect(Object.keys(h.histories)).toEqual(["a:electrical"])
    expect(undoCallouts(planHistory(h, "a", "ceiling"), [callout])).toBeNull()
    expect(undoCallouts(planHistory(h, "a", "furniture"), [callout])).toBeNull()
    expect(planHistory(h, "a", "electrical").past).toHaveLength(1)
  })

  it("EH-04: шаги других планов не попадают в историю «Электрооборудования»", () => {
    const h = emptyHistory()
    recordCallouts(planHistory(h, "a", "ceiling"), [])
    recordNotes(planHistory(h, "a", "plumbing"), [])
    expect(planHistory(h, "a", "electrical").past).toEqual([])
    expect(undoCallouts(planHistory(h, "a", "electrical"), [callout])).toBeNull()
  })

  it("EH-05: история переживает перезагрузку: «Отменить» и «Повторить» на тех же шагах", () => {
    const h = emptyHistory()
    const hist = planHistory(h, "a", "electrical")
    recordCallouts(hist, [])
    undoCallouts(hist, [callout])
    const loaded = parseHistory(serializeHistory(h))
    if (!loaded) throw new Error("история не прочитана")
    const again = planHistory(loaded.history, "a", "electrical")
    expect(again.future).toHaveLength(1)
    expect(redoCallouts(again, [])).toEqual([callout])
  })

  it("EH-06: история, сохранённая до введения плана, читается без изменений; история плана пуста", () => {
    const h = emptyHistory()
    recordCallouts(planHistory(h, "a", "ceiling"), [])
    const loaded = parseHistory(serializeHistory(h))
    if (!loaded) throw new Error("история не прочитана")
    expect(loaded.readOnly).toBe(false)
    expect(planHistory(loaded.history, "a", "ceiling").past).toHaveLength(1)
    expect(planHistory(loaded.history, "a", "electrical")).toEqual({ past: [], future: [] })
  })
})
