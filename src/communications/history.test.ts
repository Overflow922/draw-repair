import { describe, expect, it } from "vitest"
import { cloneScene, emptyHistory, parseHistory, planHistory, record, redoEntry, serializeHistory, undoEntry } from "../history"
import type { HistoryEntry, Scene } from "../history"
import type { Communication, Wall } from "../types"
import { duct, riser } from "./communications.test-utils"

// change add-communications: коммуникации в истории обмерочного плана
// (spec communications «История коммуникаций»; drawing-history «Независимость историй планов»; test-plan CH-*).

const wall: Wall = { id: "w", a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, thicknessCm: 20, type: "brick" }
const scene = (communications?: Communication[]): Scene => ({ walls: [wall], dimensions: [], ...(communications ? { communications } : null) })
const comms = (e: HistoryEntry | null): Communication[] | undefined => {
  expect(e?.kind).toBe("walls")
  return e?.kind === "walls" ? e.communications : undefined
}

describe("история: снимки с коммуникациями", () => {
  it("CH-01: отмена установки — запись несёт прежний (пустой) список; повтор возвращает стояк", () => {
    const h = emptyHistory()
    const hist = planHistory(h, "a", "measure")
    record(hist, scene([])) // до установки
    const r = riser(100, 100, 11)
    const undone = undoEntry(hist, scene([r])) // текущее состояние: стояк поставлен
    expect(comms(undone)).toEqual([])
    const redone = redoEntry(hist, scene([]))
    expect(comms(redone)).toEqual([r])
  })

  it("CH-02: отмена удаления — запись несёт стояк с прежним местом и диаметром", () => {
    const h = emptyHistory()
    const hist = planHistory(h, "a", "measure")
    const r = riser(100, 100, 16)
    record(hist, scene([r])) // до удаления
    const undone = undoEntry(hist, scene([]))
    expect(comms(undone)).toEqual([riser(100, 100, 16)])
  })

  it("CH-03: снимок изолирован от последующих правок (копия, а не ссылка)", () => {
    const h = emptyHistory()
    const hist = planHistory(h, "a", "measure")
    const list = [riser(100, 100, 11), duct(200, 150)]
    record(hist, scene(list))
    list[0] = riser(999, 999, 11)
    ;(list[1] as Communication).x = 0
    const undone = undoEntry(hist, scene([]))
    expect(comms(undone)).toEqual([riser(100, 100, 11), duct(200, 150)])
  })

  it("CH-03b: cloneScene копирует список глубоко и не добавляет поле, если его не было", () => {
    const withList = scene([riser(1, 2, 3)])
    const copy = cloneScene(withList)
    expect(copy.communications).toEqual([riser(1, 2, 3)])
    expect(copy.communications?.[0]).not.toBe(withList.communications?.[0])
    expect("communications" in cloneScene(scene())).toBe(false)
  })

  it("CH-04: запись без поля коммуникаций (старая история) отмену не затрагивает: поле отсутствует", () => {
    const h = emptyHistory()
    const hist = planHistory(h, "a", "measure")
    record(hist, scene()) // старый снимок без коммуникаций
    const undone = undoEntry(hist, scene([riser(100, 100, 11)]))
    expect(comms(undone)).toBeUndefined()
    // текущее состояние для повтора сохранено в будущем: повтор вернёт стояк
    expect(comms(redoEntry(hist, scene()))).toEqual([riser(100, 100, 11)])
  })

  it("CH-05: коммуникации живут только в истории обмерочного плана; ключи других планов пусты", () => {
    const h = emptyHistory()
    record(planHistory(h, "a", "measure"), scene([riser(1, 1, 1)]))
    // ключи проверяются до чтения других планов: planHistory создаёт пустую запись
    expect(Object.keys(h.histories)).toEqual(["a"])
    expect(h.histories["a"]?.past).toHaveLength(1)
    expect(h.histories["a:demolition"]).toBeUndefined()
    expect(h.histories["a:mounting"]).toBeUndefined()
    expect(planHistory(h, "a", "demolition").past).toEqual([])
    expect(planHistory(h, "a", "mounting").past).toEqual([])
  })
})

describe("история: сохранение и разбор", () => {
  it("CH-06: коммуникации в снимках переживают serializeHistory → parseHistory; версия документа истории 2", () => {
    const h = emptyHistory()
    record(planHistory(h, "a", "measure"), scene([riser(100, 100, 11), duct(200, 150)]))
    const parsed = parseHistory(serializeHistory(h))
    expect(parsed?.readOnly).toBe(false)
    expect(parsed?.history.version).toBe(2)
    const entry = parsed?.history.histories.a?.past[0] ?? null
    expect(comms(entry)).toEqual([riser(100, 100, 11), duct(200, 150)])
  })

  it("CH-07: запись без поля коммуникаций читается (старая история)", () => {
    const h = emptyHistory()
    record(planHistory(h, "a", "measure"), scene())
    const parsed = parseHistory(serializeHistory(h))
    expect(parsed).not.toBeNull()
    expect(parsed?.history.histories.a?.past).toHaveLength(1)
  })

  it("CH-08: запись с битой коммуникацией (стояк без идентификатора) делает документ повреждённым", () => {
    const raw = JSON.stringify({
      version: 2,
      histories: { a: { past: [{ kind: "walls", walls: [], dimensions: [], communications: [{ kind: "riser", x: 1, y: 1, diameterCm: 5 }] }], future: [] } },
      trash: [],
    })
    expect(parseHistory(raw)).toBeNull()
  })

  it("CH-08b: коммуникация с нулевым размером или неизвестным видом — тоже повреждение", () => {
    for (const bad of [
      { kind: "riser", id: "r", x: 1, y: 1, diameterCm: 0 },
      { kind: "pipe", id: "p", x: 1, y: 1, diameterCm: 5 },
      { kind: "pipe", id: "p", x: 1, y: 1, widthCm: 30, depthCm: 20 },
      "riser",
    ]) {
      const raw = JSON.stringify({
        version: 2,
        histories: { a: { past: [], future: [{ kind: "walls", walls: [], dimensions: [], communications: [bad] }] } },
        trash: [],
      })
      expect(parseHistory(raw), JSON.stringify(bad)).toBeNull()
    }
  })

  it("CH-08c: поле коммуникаций не массив — повреждение", () => {
    const raw = JSON.stringify({ version: 2, histories: { a: { past: [{ kind: "walls", walls: [], dimensions: [], communications: 5 }], future: [] } }, trash: [] })
    expect(parseHistory(raw)).toBeNull()
  })

  it("CH-09: корректная коммуникация в записи принимается", () => {
    const raw = JSON.stringify({
      version: 2,
      histories: { a: { past: [{ kind: "walls", walls: [], dimensions: [], communications: [{ kind: "duct", id: "d", x: 0, y: 0, widthCm: 30, depthCm: 20 }] }], future: [] } },
      trash: [],
    })
    expect(parseHistory(raw)).not.toBeNull()
  })
})
