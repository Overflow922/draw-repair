import { describe, expect, it } from "vitest"
import {
  HISTORY_LIMIT,
  cloneWalls,
  drawingHistory,
  parseHistory,
  record,
  recordSnapshot,
  redoEntry,
  serializeHistory,
  undoEntry,
} from "./history"
import type { DrawingHistory, HistoryEntry, HistoryStore } from "./history"
import type { View, Wall } from "./types"

const wall = (x: number): Wall => ({ a: { x, y: 0 }, b: { x: x + 100, y: 0 }, thicknessCm: 20, type: "partition" })
const view: View = { zoom: 1, pan: { x: 0, y: 0 } }
const history = (): DrawingHistory => ({ past: [], future: [] })

const wallsOf = (e: HistoryEntry | null): Wall[] => {
  expect(e?.kind).toBe("walls")
  return (e as Extract<HistoryEntry, { kind: "walls" }>).walls
}

describe("record/undoEntry/redoEntry", () => {
  it("undo возвращает снимок до действия, redo — после", () => {
    const h = history()
    record(h, [wall(0)])
    const walls = [wall(0), wall(200)]
    expect(wallsOf(undoEntry(h, walls))).toEqual([wall(0)])
    expect(h.future.length).toBe(1)
    expect(wallsOf(redoEntry(h, [wall(0)]))).toEqual([wall(0), wall(200)])
    expect(h.future.length).toBe(0)
    expect(h.past.length).toBe(1)
  })

  it("новое действие срезает ветку повтора", () => {
    const h = history()
    record(h, [])
    undoEntry(h, [wall(0)])
    expect(h.future.length).toBe(1)
    record(h, [wall(0)])
    expect(h.future.length).toBe(0)
  })

  it("снимки независимы от живого массива стен", () => {
    const h = history()
    record(h, [])
    const restored = wallsOf(undoEntry(h, [wall(0)]))
    restored.push(wall(9))
    expect(wallsOf(redoEntry(h, restored))).toEqual([wall(0)])
    expect(cloneWalls([wall(0)])).not.toBe([wall(0)])
    expect(cloneWalls([wall(0)])[0]).toEqual(wall(0))
  })

  it("пустой past даёт null", () => {
    const h = history()
    expect(undoEntry(h, [])).toBeNull()
    expect(redoEntry(h, [])).toBeNull()
  })

  it("вытесняются самые старые шаги при превышении лимита", () => {
    const h = history()
    for (let i = 0; i <= HISTORY_LIMIT; i++) record(h, [wall(i * 10)])
    expect(h.past.length).toBe(HISTORY_LIMIT)
    expect(h.past[0]).toEqual({ kind: "walls", walls: [wall(10)] })
    expect(wallsOf(undoEntry(h, [wall(520)]))).toEqual([wall(HISTORY_LIMIT * 10)])
  })

  it("запись о закрытии переходит между стеками без копирования", () => {
    const h = history()
    const close: HistoryEntry = { kind: "close", index: 1, drawingId: "x" }
    h.past.push(close)
    expect(undoEntry(h, [wall(0)])).toBe(close)
    expect(h.future[0]).toBe(close)
    expect(redoEntry(h, [wall(0)])).toBe(close)
  })

  it("drawingHistory создаёт и переиспользует историю чертежа", () => {
    const store: HistoryStore = { version: 1, histories: {}, trash: [] }
    expect(drawingHistory(store, "a")).toEqual({ past: [], future: [] })
    drawingHistory(store, "a").past.push({ kind: "close", index: 0, drawingId: "b" })
    expect(store.histories.a.past.length).toBe(1)
  })

  it("recordSnapshot кладёт готовый снимок", () => {
    const h = history()
    const snapshot = cloneWalls([wall(0)])
    recordSnapshot(h, snapshot)
    expect(h.past[0]).toEqual({ kind: "walls", walls: [wall(0)] })
  })
})

describe("serializeHistory/parseHistory", () => {
  const store: HistoryStore = {
    version: 1,
    histories: {
      a: { past: [{ kind: "walls", walls: [wall(0)] }, { kind: "close", index: 1, drawingId: "b" }], future: [{ kind: "walls", walls: [] }] },
    },
    trash: [{ index: 1, drawing: { id: "b", name: "Чертёж 2", walls: [wall(0)], view } }],
  }

  it("roundtrip сохраняет истории и корзину", () => {
    expect(parseHistory(serializeHistory(store))).toEqual({ history: store, readOnly: false })
  })

  it("битый JSON отклоняется", () => {
    expect(parseHistory("{oops")).toBeNull()
  })

  it("JSON не-объект отклоняется", () => {
    expect(parseHistory("42")).toBeNull()
    expect(parseHistory("\"строка\"")).toBeNull()
  })

  it("структура не по формату отклоняется", () => {
    expect(parseHistory("{}")).toBeNull()
    expect(parseHistory(JSON.stringify({ version: 1, histories: [], trash: [] }))).toBeNull()
    expect(parseHistory(JSON.stringify({ version: 1, histories: {}, trash: [{}] }))).toBeNull()
    expect(parseHistory(JSON.stringify({ version: 1, histories: {}, trash: [{ index: -1, drawing: { id: "b", name: "x", walls: [], view } }] }))).toBeNull()
    expect(parseHistory(JSON.stringify({ version: 1, histories: { a: { past: [{}], future: [] } }, trash: [] }))).toBeNull()
    expect(parseHistory(JSON.stringify({ version: 1, histories: { a: { past: [{ kind: "close", index: 0.5, drawingId: "b" }], future: [] } }, trash: [] }))).toBeNull()
  })

  it("будущая версия даёт пустую историю в режиме только чтение", () => {
    const parsed = parseHistory(JSON.stringify({ version: 2, histories: { a: { past: [], future: [] } }, trash: [] }))
    expect(parsed?.readOnly).toBe(true)
    expect(parsed?.history.histories).toEqual({})
    expect(parsed?.history.trash).toEqual([])
  })
})
