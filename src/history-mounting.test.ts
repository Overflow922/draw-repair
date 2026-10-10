import { describe, expect, it } from "vitest"
import { emptyHistory, parseHistory, planHistory, record, recordMarks, redoEntry, serializeHistory, undoEntry } from "./history"
import type { HistoryEntry, Scene } from "./history"
import type { Wall } from "./types"

// change mounting-plan: история плана «Монтаж» — свой ключ «<id>:mounting», снимок собственных объектов
// (spec drawing-history «История плана «Монтаж»»; design D6).

const wall = (x: number, id = `w${x}`): Wall => ({ id, a: { x, y: 0 }, b: { x: x + 100, y: 0 }, thicknessCm: 20, type: "brick" })
const scene = (...walls: Wall[]): Scene => ({ walls, dimensions: [] })

const wallsOf = (e: HistoryEntry | null): Wall[] => {
  expect(e?.kind).toBe("walls")
  return e?.kind === "walls" ? e.walls : []
}

describe("история плана «Монтаж»", () => {
  it("MP-70: история «Монтажа» лежит под ключом «<id>:mounting» и независима от обмера и демонтажа", () => {
    const store = emptyHistory()
    record(planHistory(store, "a", "mounting"), scene(wall(0)))
    expect(Object.keys(store.histories)).toEqual(["a:mounting"])
    expect(planHistory(store, "a", "measure").past).toEqual([])
    expect(planHistory(store, "a", "demolition").past).toEqual([])
    expect(planHistory(store, "a", "mounting").past).toHaveLength(1)
  })

  it("MP-70: шаги обмера и демонтажа не попадают в историю «Монтажа»", () => {
    const store = emptyHistory()
    record(planHistory(store, "a", "measure"), scene(wall(0)))
    recordMarks(planHistory(store, "a", "demolition"), [{ id: "m", wallId: "w0", anchor: "a", fromCm: 0, toCm: 10 }])
    expect(planHistory(store, "a", "mounting").past).toEqual([])
    expect(planHistory(store, "a", "mounting").future).toEqual([])
  })

  it("MP-70: у разных чертежей истории «Монтажа» независимы", () => {
    const store = emptyHistory()
    record(planHistory(store, "a", "mounting"), scene(wall(0)))
    expect(planHistory(store, "b", "mounting").past).toEqual([])
  })

  it("MP-71: отмена возвращает снимок собственных стен «Монтажа», повтор — состояние до отмены", () => {
    const store = emptyHistory()
    const h = planHistory(store, "a", "mounting")
    record(h, scene(wall(0)))
    const undone = undoEntry(h, scene(wall(0), wall(200)))
    expect(wallsOf(undone)).toEqual([wall(0)])
    expect(h.future).toHaveLength(1)
    expect(wallsOf(redoEntry(h, scene(wall(0))))).toEqual([wall(0), wall(200)])
  })

  it("MP-71: отмена в истории «Монтажа» не трогает записи обмера", () => {
    const store = emptyHistory()
    record(planHistory(store, "a", "measure"), scene(wall(0)))
    record(planHistory(store, "a", "mounting"), scene(wall(50)))
    undoEntry(planHistory(store, "a", "mounting"), scene(wall(50), wall(300)))
    expect(planHistory(store, "a", "measure").past).toHaveLength(1)
    expect(planHistory(store, "a", "measure").future).toEqual([])
  })

  it("MP-71: новая запись сбрасывает ветку повтора «Монтажа»", () => {
    const store = emptyHistory()
    const h = planHistory(store, "a", "mounting")
    record(h, scene(wall(0)))
    undoEntry(h, scene(wall(0), wall(200)))
    record(h, scene(wall(0)))
    expect(h.future).toEqual([])
  })

  it("MP-72: история «Монтажа» переживает сериализацию и чтение: версия документа остаётся 2", () => {
    const store = emptyHistory()
    record(planHistory(store, "a", "mounting"), scene(wall(0)))
    record(planHistory(store, "a", "measure"), scene(wall(500)))
    undoEntry(planHistory(store, "a", "mounting"), scene(wall(0), wall(200)))
    const loaded = parseHistory(serializeHistory(store))
    expect(loaded).not.toBeNull()
    expect(loaded?.history.version).toBe(2)
    expect(loaded?.history.histories["a:mounting"]?.past).toEqual([])
    expect(loaded?.history.histories["a:mounting"]?.future).toHaveLength(1)
    expect(loaded?.history.histories["a"]?.past).toHaveLength(1)
  })

  it("MP-72: запись истории «Монтажа» с некорректной стеной делает документ истории повреждённым, как у обмера", () => {
    const raw = JSON.stringify({
      version: 2,
      histories: { "a:mounting": { past: [{ kind: "walls", walls: [{ id: "x", a: { x: "q", y: 0 }, b: { x: 1, y: 0 }, thicknessCm: 20, type: "brick" }], dimensions: [] }], future: [] } },
      trash: [],
    })
    expect(parseHistory(raw)).toBeNull()
  })

  it("MP-73: снимок записи не зависит от последующих правок сцены", () => {
    const store = emptyHistory()
    const s = scene(wall(0))
    record(planHistory(store, "a", "mounting"), s)
    s.walls.push(wall(900))
    expect(wallsOf(planHistory(store, "a", "mounting").past[0] ?? null)).toEqual([wall(0)])
  })
})
