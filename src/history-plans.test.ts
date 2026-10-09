import { describe, expect, it } from "vitest"
import { drawingHistory, emptyHistory, parseHistory, planHistory, record, redoEntry, serializeHistory, undoEntry } from "./history"
import type { HistoryEntry, HistoryStore, Scene } from "./history"
import type { Wall } from "./types"

// change drawing-plans: история на (чертёж, план); у обмерочного плана ключ прежний
// (spec drawing-history «Независимость историй планов»; design D4).

const wall = (x: number): Wall => ({ id: `w${x}`, a: { x, y: 0 }, b: { x: x + 100, y: 0 }, thicknessCm: 20, type: "brick" })
const scene = (...walls: Wall[]): Scene => ({ walls, dimensions: [] })

const wallsOf = (e: HistoryEntry | null): Wall[] => {
  expect(e?.kind).toBe("walls")
  return (e as Extract<HistoryEntry, { kind: "walls" }>).walls
}

describe("planHistory", () => {
  it("HI-01: для обмерочного плана возвращает ту же историю, что drawingHistory чертежа", () => {
    const store = emptyHistory()
    const viaPlan = planHistory(store, "a", "measure")
    expect(viaPlan).toBe(drawingHistory(store, "a"))
    expect(viaPlan).toBe(store.histories["a"])
  })

  it("HI-01: ранее созданная через drawingHistory история видна через planHistory", () => {
    const store = emptyHistory()
    record(drawingHistory(store, "a"), scene(wall(0)))
    expect(planHistory(store, "a", "measure").past).toHaveLength(1)
  })

  it("HI-02: повторный вызов возвращает тот же объект, записи накапливаются, а не теряются", () => {
    const store = emptyHistory()
    record(planHistory(store, "a", "measure"), scene())
    record(planHistory(store, "a", "measure"), scene(wall(0)))
    expect(planHistory(store, "a", "measure")).toBe(planHistory(store, "a", "measure"))
    expect(planHistory(store, "a", "measure").past).toHaveLength(2)
  })

  it("HI-02: запись → отмена → повтор через planHistory работают как через drawingHistory", () => {
    const store = emptyHistory()
    const h = planHistory(store, "a", "measure")
    record(h, scene(wall(0)))
    const undone = undoEntry(h, scene(wall(0), wall(200)))
    expect(wallsOf(undone)).toEqual([wall(0)])
    expect(planHistory(store, "a", "measure").future).toHaveLength(1)
    expect(wallsOf(redoEntry(planHistory(store, "a", "measure"), scene(wall(0))))).toEqual([wall(0), wall(200)])
    expect(planHistory(store, "a", "measure").past).toHaveLength(1)
  })

  it("HI-04: история чертежа без записей создаётся лениво под ключом идентификатора чертежа, без суффикса", () => {
    const store = emptyHistory()
    const h = planHistory(store, "a", "measure")
    expect(h).toEqual({ past: [], future: [] })
    expect(Object.keys(store.histories)).toEqual(["a"])
  })

  it("HI-05: чтение истории (как при переключении плана) не добавляет шагов и не очищает повтор", () => {
    const store = emptyHistory()
    record(planHistory(store, "a", "measure"), scene())
    undoEntry(planHistory(store, "a", "measure"), scene(wall(0)))
    const before = structuredClone(store)
    planHistory(store, "a", "measure")
    planHistory(store, "a", "measure")
    expect(store).toEqual(before)
    expect(planHistory(store, "a", "measure").future).toHaveLength(1)
  })

  it("HI-07: истории разных чертежей независимы", () => {
    const store = emptyHistory()
    record(planHistory(store, "a", "measure"), scene(wall(0)))
    expect(planHistory(store, "b", "measure").past).toEqual([])
    expect(planHistory(store, "a", "measure").past).toHaveLength(1)
    expect(Object.keys(store.histories).sort()).toEqual(["a", "b"])
  })
})

describe("история, сохранённая до введения планов", () => {
  const stored = (): HistoryStore => ({
    version: 2,
    histories: {
      a: {
        past: [{ kind: "walls", walls: [wall(0)], dimensions: [] }],
        future: [{ kind: "walls", walls: [wall(0), wall(200)], dimensions: [] }],
      },
    },
    trash: [],
  })

  it("HI-03: parseHistory читает документ версии 2; planHistory обмерочного плана отдаёт его стеки", () => {
    const parsed = parseHistory(JSON.stringify(stored()))
    expect(parsed?.readOnly).toBe(false)
    const h = planHistory(parsed?.history ?? emptyHistory(), "a", "measure")
    expect(h.past).toHaveLength(1)
    expect(h.future).toHaveLength(1)
    expect(wallsOf(h.past[0] ?? null)).toEqual([wall(0)])
    expect(wallsOf(h.future[0] ?? null)).toEqual([wall(0), wall(200)])
  })

  it("HI-03: отмена по прежней истории работает и ключи не получают суффикса", () => {
    const parsed = parseHistory(JSON.stringify(stored()))
    const store = parsed?.history ?? emptyHistory()
    const e = undoEntry(planHistory(store, "a", "measure"), scene(wall(0), wall(200)))
    expect(wallsOf(e)).toEqual([wall(0)])
    expect(Object.keys(store.histories)).toEqual(["a"])
  })

  it("HI-06: формат документа истории не меняется — версия 2, ключи по идентификатору чертежа, roundtrip равен исходному", () => {
    const store = stored()
    const json = JSON.parse(serializeHistory(store)) as { version: number; histories: Record<string, unknown> }
    expect(json.version).toBe(2)
    expect(Object.keys(json.histories)).toEqual(["a"])
    expect(parseHistory(serializeHistory(store))).toEqual({ history: store, readOnly: false })
  })

  it("HI-06: запись через planHistory сохраняется в тот же формат и читается обратно", () => {
    const store = emptyHistory()
    record(planHistory(store, "a", "measure"), scene(wall(0)))
    const parsed = parseHistory(serializeHistory(store))
    expect(parsed?.history.version).toBe(2)
    expect(Object.keys(parsed?.history.histories ?? {})).toEqual(["a"])
    expect(planHistory(parsed?.history ?? emptyHistory(), "a", "measure").past).toHaveLength(1)
  })

  it("HI-06: будущая версия истории по-прежнему читается как пустая и только для чтения", () => {
    const parsed = parseHistory(JSON.stringify({ version: 3, histories: { a: { past: [], future: [] } }, trash: [] }))
    expect(parsed?.readOnly).toBe(true)
    expect(parsed?.history.histories).toEqual({})
  })
})
