import { describe, expect, it } from "vitest"
import { cloneScene, emptyHistory, parseHistory, planHistory, record, redoEntry, serializeHistory, undoEntry } from "./history"
import type { Scene } from "./history"
import type { RoomRecord, Wall } from "./types"

// Тесты change add-room-explication: данные помещений в шагах истории плана «Монтаж» (spec drawing-history «Данные помещений в истории»).

const wall: Wall = { id: "w", a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, thicknessCm: 20, type: "brick" }
const kitchen: RoomRecord = { number: 1, name: "Кухня", heightMm: 2700, anchor: { x: 10, y: 20 } }
const scene = (rooms?: RoomRecord[]): Scene => ({ walls: [wall], dimensions: [], ...(rooms ? { rooms } : null) })

describe("снимок сцены с данными помещений", () => {
  it("копия содержит записи помещений и не делит с оригиналом ни записи, ни опорные точки", () => {
    const original = scene([kitchen])
    const copy = cloneScene(original)
    expect(copy.rooms).toEqual([kitchen])
    expect(copy.rooms?.[0]).not.toBe(original.rooms?.[0])
    expect(copy.rooms?.[0].anchor).not.toBe(original.rooms?.[0].anchor)
  })

  it("сцена без помещений копируется без поля", () => {
    expect(cloneScene(scene()).rooms).toBeUndefined()
  })
})

describe("шаги истории", () => {
  it("отмена возвращает записи помещений вместе со стенами, повтор — текущие", () => {
    const h = planHistory(emptyHistory(), "d", "mounting")
    record(h, scene([kitchen]))
    const after = scene([{ ...kitchen, name: "Спальня" }])
    const undone = undoEntry(h, after)
    expect(undone).toMatchObject({ kind: "walls", rooms: [kitchen] })
    const redone = redoEntry(h, scene([kitchen]))
    expect(redone).toMatchObject({ kind: "walls", rooms: [{ ...kitchen, name: "Спальня" }] })
  })

  it("правка названия — шаг истории: запись в past содержит прежние данные", () => {
    const h = planHistory(emptyHistory(), "d", "mounting")
    record(h, scene([kitchen]))
    expect(h.past).toHaveLength(1)
    expect(h.past[0]).toMatchObject({ rooms: [kitchen] })
  })

  it("запись истории не меняется последующими правками сцены", () => {
    const h = planHistory(emptyHistory(), "d", "mounting")
    const s = scene([{ ...kitchen }])
    record(h, s)
    if (s.rooms) s.rooms[0].name = "Другое"
    expect(h.past[0]).toMatchObject({ rooms: [{ name: "Кухня" }] })
  })

  it("история плана «Монтаж» не затрагивает историю обмерочного плана", () => {
    const store = emptyHistory()
    record(planHistory(store, "d", "mounting"), scene([kitchen]))
    expect(planHistory(store, "d", "measure").past).toHaveLength(0)
  })
})

describe("хранение истории", () => {
  const stored = (entry: object): string =>
    JSON.stringify({ version: 2, histories: { d: { past: [entry], future: [] } }, trash: [] })

  it("записи помещений в шаге переживают сохранение и загрузку", () => {
    const store = emptyHistory()
    record(planHistory(store, "d", "mounting"), scene([kitchen]))
    const loaded = parseHistory(serializeHistory(store))
    expect(loaded?.readOnly).toBe(false)
    const entry = Object.values(loaded?.history.histories ?? {})[0].past[0]
    expect(entry).toMatchObject({ kind: "walls", rooms: [kitchen] })
  })

  it("история, сохранённая до введения данных помещений, читается без ошибок", () => {
    const loaded = parseHistory(stored({ kind: "walls", walls: [wall], dimensions: [] }))
    expect(loaded?.history.histories.d.past).toHaveLength(1)
    expect(loaded?.history.histories.d.past[0]).not.toHaveProperty("rooms")
  })

  it("шаг с недопустимой записью помещения делает документ истории повреждённым", () => {
    const bad = { kind: "walls", walls: [wall], dimensions: [], rooms: [{ ...kitchen, heightMm: 0 }] }
    expect(parseHistory(stored(bad))).toBeNull()
  })

  it("шаг с rooms не списком делает документ повреждённым", () => {
    expect(parseHistory(stored({ kind: "walls", walls: [wall], dimensions: [], rooms: "x" }))).toBeNull()
  })

  it("версия документа истории не меняется", () => {
    expect(JSON.parse(serializeHistory(emptyHistory())).version).toBe(2)
  })
})
