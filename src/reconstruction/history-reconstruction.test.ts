import { describe, expect, it } from "vitest"
import { cloneScene, emptyHistory, parseHistory, planHistory, record, recordMarks, recordRough, redoEntry, serializeHistory, undoEntry } from "../history"
import type { Scene } from "../history"
import { drywall } from "./reconstruction.test-utils"

// change reconstruction-plan: история плана «Реконструкция» — свой ключ «<id>:reconstruction», снимок стен ГКЛ и размеров
// (spec drawing-history «История плана «Реконструкция»»; design D7)

const scene = (...ids: string[]): Scene => ({ walls: ids.map((id, i) => drywall(id, 0, i * 50, 300, i * 50, 10, 270)), dimensions: [] })
const empty: Scene = { walls: [], dimensions: [] }

describe("история плана «Реконструкция»", () => {
  it("RC-80: история лежит под ключом «<id>:reconstruction» и независима от других планов", () => {
    const store = emptyHistory()
    record(planHistory(store, "a", "reconstruction"), scene("g"))
    expect(Object.keys(store.histories)).toEqual(["a:reconstruction"])
    for (const plan of ["measure", "demolition", "mounting", "rough"] as const) expect(planHistory(store, "a", plan).past).toEqual([])
  })

  it("RC-80: шаги других планов не попадают в историю «Реконструкции»", () => {
    const store = emptyHistory()
    record(planHistory(store, "a", "measure"), empty)
    recordMarks(planHistory(store, "a", "demolition"), [])
    recordRough(planHistory(store, "a", "rough"), { plaster: [], screeds: [] })
    expect(planHistory(store, "a", "reconstruction").past).toEqual([])
  })

  it("RC-81: снимок сохраняет высоту, толщину и тип стен ГКЛ", () => {
    const snap = cloneScene(scene("g"))
    expect(snap.walls[0]).toMatchObject({ id: "g", heightCm: 270, thicknessCm: 10, type: "gkl" })
  })

  it("RC-81: отмена возвращает стены до операции с высотой, повтор — состояние до отмены", () => {
    const h = planHistory(emptyHistory(), "a", "reconstruction")
    record(h, scene("g"))
    const undone = undoEntry(h, scene("g", "h"))
    expect(undone?.kind === "walls" ? undone.walls.map((w) => w.id) : null).toEqual(["g"])
    expect(undone?.kind === "walls" ? (undone.walls[0] as { heightCm?: number }).heightCm : null).toBe(270)
    const redone = redoEntry(h, scene("g"))
    expect(redone?.kind === "walls" ? redone.walls.map((w) => w.id) : null).toEqual(["g", "h"])
    expect(redone?.kind === "walls" ? (redone.walls[1] as { heightCm?: number }).heightCm : null).toBe(270)
  })

  it("RC-81: снимок не зависит от дальнейших правок исходной стены", () => {
    const h = planHistory(emptyHistory(), "a", "reconstruction")
    const s = scene("g")
    record(h, s)
    s.walls[0]!.a.x = 77
    Object.assign(s.walls[0] ?? {}, { heightCm: 999 })
    const undone = undoEntry(h, empty)
    expect(undone?.kind === "walls" ? undone.walls[0]?.a.x : null).toBe(0)
    expect(undone?.kind === "walls" ? (undone.walls[0] as { heightCm?: number }).heightCm : null).toBe(270)
  })

  it("RC-82: новая запись сбрасывает ветку повтора", () => {
    const h = planHistory(emptyHistory(), "a", "reconstruction")
    record(h, scene("g"))
    undoEntry(h, scene("g", "h"))
    expect(h.future).toHaveLength(1)
    record(h, scene("g"))
    expect(h.future).toEqual([])
  })

  it("RC-83: история переживает сериализацию и сохраняет высоту", () => {
    const store = emptyHistory()
    record(planHistory(store, "a", "reconstruction"), scene("g"))
    const parsed = parseHistory(serializeHistory(store))
    expect(parsed?.readOnly).toBe(false)
    const entry = parsed?.history.histories["a:reconstruction"]?.past[0]
    expect(entry?.kind === "walls" ? (entry.walls[0] as { heightCm?: number }).heightCm : null).toBe(270)
  })

  it("RC-84: старая история без ключа плана читается, история плана пуста", () => {
    const store = emptyHistory()
    record(planHistory(store, "a", "measure"), empty)
    const parsed = parseHistory(serializeHistory(store))
    expect(parsed?.readOnly).toBe(false)
    expect(parsed ? planHistory(parsed.history, "a", "reconstruction").past : null).toEqual([])
  })

  it("RC-85: запись со стеной ГКЛ без идентификатора — документ истории повреждён", () => {
    const store = emptyHistory()
    record(planHistory(store, "a", "reconstruction"), scene("g"))
    const raw = serializeHistory(store).replace('"id":"g"', '"id":""')
    expect(parseHistory(raw)).toBeNull()
  })

  it("RC-85: запись плана «Реконструкция» со стеной с нулевой высотой — документ повреждён; у других планов поле не проверяется", () => {
    const store = emptyHistory()
    record(planHistory(store, "a", "reconstruction"), scene("g"))
    expect(parseHistory(serializeHistory(store).replace('"heightCm":270', '"heightCm":0'))).toBeNull()
    const other = emptyHistory()
    record(planHistory(other, "a", "mounting"), scene("g"))
    expect(parseHistory(serializeHistory(other).replace('"heightCm":270', '"heightCm":0'))).not.toBeNull()
  })
})
