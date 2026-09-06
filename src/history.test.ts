import { describe, expect, it } from "vitest"
import {
  HISTORY_LIMIT,
  cloneScene,
  drawingHistory,
  parseHistory,
  record,
  recordSnapshot,
  redoEntry,
  serializeHistory,
  undoEntry,
} from "./history"
import type { DrawingHistory, HistoryEntry, HistoryStore, Scene } from "./history"
import type { Dimension, View, Wall } from "./types"

const wall = (x: number): Wall => ({ id: `w${x}`, a: { x, y: 0 }, b: { x: x + 100, y: 0 }, thicknessCm: 20, type: "brick" })
const dimension: Dimension = {
  from: { a: { wallId: "w0", edge: 2 }, b: { wallId: "w0", edge: 0 } },
  to: { a: { wallId: "w0", edge: 3 }, b: { wallId: "w0", edge: 0 } },
  offset: 30,
}
const view: View = { zoom: 1, pan: { x: 0, y: 0 } }
const history = (): DrawingHistory => ({ past: [], future: [] })
const scene = (walls: Wall[], dimensions: Dimension[] = []): Scene => ({ walls, dimensions })

const wallsOf = (e: HistoryEntry | null): Wall[] => {
  expect(e?.kind).toBe("walls")
  return (e as Extract<HistoryEntry, { kind: "walls" }>).walls
}

const dimsOf = (e: HistoryEntry | null): Dimension[] => {
  expect(e?.kind).toBe("walls")
  return (e as Extract<HistoryEntry, { kind: "walls" }>).dimensions
}

describe("record/undoEntry/redoEntry", () => {
  it("undo возвращает снимок до действия, redo — после", () => {
    const h = history()
    record(h, scene([wall(0)], [dimension]))
    const walls = [wall(0), wall(200)]
    const e = undoEntry(h, scene(walls, [dimension]))
    expect(wallsOf(e)).toEqual([wall(0)])
    expect(dimsOf(e)).toEqual([dimension])
    expect(h.future.length).toBe(1)
    expect(wallsOf(redoEntry(h, scene([wall(0)])))).toEqual([wall(0), wall(200)])
    expect(h.future.length).toBe(0)
    expect(h.past.length).toBe(1)
  })

  it("новое действие срезает ветку повтора", () => {
    const h = history()
    record(h, scene([]))
    undoEntry(h, scene([wall(0)]))
    expect(h.future.length).toBe(1)
    record(h, scene([wall(0)]))
    expect(h.future.length).toBe(0)
  })

  it("снимки независимы от живого массива стен", () => {
    const h = history()
    record(h, scene([]))
    const restored = wallsOf(undoEntry(h, scene([wall(0)])))
    restored.push(wall(9))
    expect(wallsOf(redoEntry(h, scene(restored)))).toEqual([wall(0)])
    expect(cloneScene(scene([wall(0)]))).not.toBe({ walls: [wall(0)], dimensions: [] })
    expect(cloneScene(scene([wall(0)]))).toEqual({ walls: [wall(0)], dimensions: [] })
  })

  it("пустой past даёт null", () => {
    const h = history()
    expect(undoEntry(h, scene([]))).toBeNull()
    expect(redoEntry(h, scene([]))).toBeNull()
  })

  it("вытесняются самые старые шаги при превышении лимита", () => {
    const h = history()
    for (let i = 0; i <= HISTORY_LIMIT; i++) record(h, scene([wall(i * 10)]))
    expect(h.past.length).toBe(HISTORY_LIMIT)
    expect(h.past[0]).toEqual({ kind: "walls", walls: [wall(10)], dimensions: [] })
    expect(wallsOf(undoEntry(h, scene([wall(520)])))).toEqual([wall(HISTORY_LIMIT * 10)])
  })

  it("запись о закрытии переходит между стеками без копирования", () => {
    const h = history()
    const close: HistoryEntry = { kind: "close", index: 1, drawingId: "x" }
    h.past.push(close)
    expect(undoEntry(h, scene([wall(0)]))).toBe(close)
    expect(h.future[0]).toBe(close)
    expect(redoEntry(h, scene([wall(0)]))).toBe(close)
  })

  it("drawingHistory создаёт и переиспользует историю чертежа", () => {
    const store: HistoryStore = { version: 2, histories: {}, trash: [] }
    expect(drawingHistory(store, "a")).toEqual({ past: [], future: [] })
    drawingHistory(store, "a").past.push({ kind: "close", index: 0, drawingId: "b" })
    expect(store.histories.a.past.length).toBe(1)
  })

  it("recordSnapshot кладёт готовый снимок", () => {
    const h = history()
    const snapshot = cloneScene(scene([wall(0)], [dimension]))
    recordSnapshot(h, snapshot)
    expect(h.past[0]).toEqual({ kind: "walls", walls: [wall(0)], dimensions: [dimension] })
  })
})

describe("serializeHistory/parseHistory", () => {
  const store: HistoryStore = {
    version: 2,
    histories: {
      a: {
        past: [{ kind: "walls", walls: [wall(0)], dimensions: [dimension] }, { kind: "close", index: 1, drawingId: "b" }],
        future: [{ kind: "walls", walls: [], dimensions: [] }],
      },
    },
    trash: [{ index: 1, drawing: { id: "b", name: "Чертёж 2", walls: [wall(0)], dimensions: [], view, scale: 100 } }],
  }

  it("roundtrip сохраняет истории, размеры и корзину", () => {
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
    expect(parseHistory(JSON.stringify({ version: 2, histories: [], trash: [] }))).toBeNull()
    expect(parseHistory(JSON.stringify({ version: 2, histories: {}, trash: [{}] }))).toBeNull()
    expect(parseHistory(JSON.stringify({ version: 2, histories: {}, trash: [{ index: -1, drawing: { id: "b", name: "x", walls: [], dimensions: [], view } }] }))).toBeNull()
    expect(parseHistory(JSON.stringify({ version: 2, histories: { a: { past: [{}], future: [] } }, trash: [] }))).toBeNull()
    expect(parseHistory(JSON.stringify({ version: 2, histories: { a: { past: [{ kind: "walls", walls: [wall(0)] }], future: [] } }, trash: [] }))).toBeNull()
    expect(parseHistory(JSON.stringify({ version: 2, histories: { a: { past: [{ kind: "close", index: 0.5, drawingId: "b" }], future: [] } }, trash: [] }))).toBeNull()
  })

  it("история версии 1 несовместима и сбрасывается в пустую без readonly", () => {
    const parsed = parseHistory(JSON.stringify({ version: 1, histories: { a: { past: [{ kind: "walls", walls: [wall(0)] }], future: [] } }, trash: [] }))
    expect(parsed?.readOnly).toBe(false)
    expect(parsed?.history.version).toBe(2)
    expect(parsed?.history.histories).toEqual({})
  })

  it("будущая версия даёт пустую историю в режиме только чтение", () => {
    const parsed = parseHistory(JSON.stringify({ version: 3, histories: { a: { past: [], future: [] } }, trash: [] }))
    expect(parsed?.readOnly).toBe(true)
    expect(parsed?.history.histories).toEqual({})
    expect(parsed?.history.trash).toEqual([])
  })
})
