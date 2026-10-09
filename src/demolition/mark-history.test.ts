import { describe, expect, it } from "vitest"
import { HISTORY_LIMIT, emptyHistory, parseHistory, planHistory, record, recordMarks, redoMarks, serializeHistory, undoEntry, undoMarks } from "../history"
import type { DrawingHistory, HistoryStore } from "../history"
import type { DemolitionMark, Wall } from "../types"
import { mk } from "./demolition.test-utils"

// change demolition-plan: история плана «Демонтаж» (spec drawing-history «История плана «Демонтаж»»; design D7).
// Снимок шага — полный список пометок чертежа до операции; версия документа истории остаётся 2.

const hist = (): DrawingHistory => ({ past: [], future: [] })
const m1 = mk("m1", "w1", "a", 100, 190)
const m2 = mk("m2", "w1", "a", 250, 300)
const wall = (x: number): Wall => ({ id: `w${x}`, a: { x, y: 0 }, b: { x: x + 100, y: 0 }, thicknessCm: 20, type: "brick" })

describe("recordMarks / undoMarks / redoMarks", () => {
  it("HI-01: запись → отмена возвращает снимок до операции, текущие пометки уходят в повтор", () => {
    const h = hist()
    recordMarks(h, [])
    const undone = undoMarks(h, [m1])
    expect(undone).toEqual([])
    expect(h.past).toHaveLength(0)
    expect(h.future).toEqual([{ kind: "demolition", marks: [m1] }])
  })

  it("HI-01: повтор возвращает состояние после операции, текущие пометки уходят обратно в past", () => {
    const h = hist()
    recordMarks(h, [])
    undoMarks(h, [m1])
    const redone = redoMarks(h, [])
    expect(redone).toEqual([m1])
    expect(h.future).toHaveLength(0)
    expect(h.past).toEqual([{ kind: "demolition", marks: [] }])
  })

  it("HI-02: снятие пометки — запись списка с пометкой, отмена возвращает её с прежним участком", () => {
    const h = hist()
    recordMarks(h, [m1, m2])
    expect(undoMarks(h, [m2])).toEqual([m1, m2])
  })

  it("HI-03: правка числа — отмена возвращает прежние границы", () => {
    const h = hist()
    recordMarks(h, [m1])
    expect(undoMarks(h, [mk("m1", "w1", "a", 100, 300)])).toEqual([m1])
  })

  it("HI-08: новая запись срезает ветку повтора", () => {
    const h = hist()
    recordMarks(h, [])
    undoMarks(h, [m1])
    expect(h.future).toHaveLength(1)
    recordMarks(h, [])
    expect(h.future).toHaveLength(0)
  })

  it("HI-09: лимит истории: после HISTORY_LIMIT + 1 записей остаётся HISTORY_LIMIT, старейшая вытеснена", () => {
    const h = hist()
    for (let i = 0; i <= HISTORY_LIMIT; i++) recordMarks(h, [mk(`m${i}`, "w1", "a", i, i + 1)])
    expect(h.past).toHaveLength(HISTORY_LIMIT)
    const first = h.past[0]
    expect(first?.kind === "demolition" ? first.marks[0]?.id : null).toBe("m1")
  })

  it("HI-10: снимок независим от живого массива: изменение исходного списка и объектов после записи не меняет историю", () => {
    const live: DemolitionMark[] = [{ ...m1 }]
    const h = hist()
    recordMarks(h, live)
    live[0]!.toCm = 999
    live.push(m2)
    expect(undoMarks(h, [])).toEqual([m1])
  })

  it("HI-10: текущие пометки, положенные в повтор при отмене, тоже копируются: правка живого списка после отмены не меняет повтор", () => {
    const h = hist()
    recordMarks(h, [])
    const live: DemolitionMark[] = [{ ...m1 }]
    undoMarks(h, live)
    live[0]!.toCm = 999
    live.push(m2)
    expect(redoMarks(h, [])).toEqual([m1])
  })

  it("HI-10: текущие пометки, положенные в past при повторе, тоже копируются", () => {
    const h = hist()
    recordMarks(h, [])
    undoMarks(h, [m1])
    const live: DemolitionMark[] = [{ ...m2 }]
    redoMarks(h, live)
    live[0]!.toCm = 999
    expect(undoMarks(h, [])).toEqual([m2])
  })

  it("HI-11: пустые стеки — отмена и повтор возвращают null и ничего не меняют", () => {
    const h = hist()
    expect(undoMarks(h, [m1])).toBeNull()
    expect(redoMarks(h, [m1])).toBeNull()
    expect(h).toEqual({ past: [], future: [] })
  })

  it("HI-12: цепочка из трёх шагов отменяется и повторяется по порядку", () => {
    const h = hist()
    recordMarks(h, [])
    recordMarks(h, [m1])
    recordMarks(h, [m1, m2])
    expect(undoMarks(h, [m1, m2, mk("m3", "w1", "a", 400, 450)])).toEqual([m1, m2])
    expect(undoMarks(h, [m1, m2])).toEqual([m1])
    expect(undoMarks(h, [m1])).toEqual([])
    expect(undoMarks(h, [])).toBeNull()
    expect(redoMarks(h, [])).toEqual([m1])
    expect(redoMarks(h, [m1])).toEqual([m1, m2])
  })
})

describe("независимость историй планов", () => {
  it("HI-04: запись пометок идёт в историю плана «Демонтаж» под ключом «<id>:demolition», обмерочная не затронута", () => {
    const store = emptyHistory()
    recordMarks(planHistory(store, "a", "demolition"), [m1])
    expect(Object.keys(store.histories)).toEqual(["a:demolition"])
    expect(planHistory(store, "a", "measure")).toEqual({ past: [], future: [] })
    expect(planHistory(store, "a", "demolition").past).toHaveLength(1)
  })

  it("HI-04: правка обмерочного плана не попадает в историю демонтажа и наоборот", () => {
    const store = emptyHistory()
    record(planHistory(store, "a", "measure"), { walls: [wall(0)], dimensions: [] })
    recordMarks(planHistory(store, "a", "demolition"), [m1])
    expect(planHistory(store, "a", "measure").past.map((e) => e.kind)).toEqual(["walls"])
    expect(planHistory(store, "a", "demolition").past.map((e) => e.kind)).toEqual(["demolition"])
    // отмена на обмерочном плане не трогает пометки
    const e = undoEntry(planHistory(store, "a", "measure"), { walls: [wall(0), wall(200)], dimensions: [] })
    expect(e?.kind).toBe("walls")
    expect(planHistory(store, "a", "demolition").past).toHaveLength(1)
  })

  it("HI-04: истории демонтажа разных чертежей независимы", () => {
    const store = emptyHistory()
    recordMarks(planHistory(store, "a", "demolition"), [m1])
    expect(planHistory(store, "b", "demolition").past).toEqual([])
  })
})

describe("персистентность истории пометок", () => {
  const stored = (): HistoryStore => {
    const store = emptyHistory()
    recordMarks(planHistory(store, "a", "demolition"), [])
    recordMarks(planHistory(store, "a", "demolition"), [m1])
    undoMarks(planHistory(store, "a", "demolition"), [m1, m2])
    record(planHistory(store, "a", "measure"), { walls: [wall(0)], dimensions: [] })
    return store
  }

  it("HI-05: serialize → parse возвращает тот же документ версии 2; ключи «a» и «a:demolition»", () => {
    const store = stored()
    const json = JSON.parse(serializeHistory(store)) as { version: number; histories: Record<string, unknown> }
    expect(json.version).toBe(2)
    expect(Object.keys(json.histories).sort()).toEqual(["a", "a:demolition"])
    expect(parseHistory(serializeHistory(store))).toEqual({ history: store, readOnly: false })
  })

  it("HI-05: после перезагрузки отмена и повтор доступны на тех же шагах", () => {
    const parsed = parseHistory(serializeHistory(stored()))
    const store = parsed?.history ?? emptyHistory()
    const h = planHistory(store, "a", "demolition")
    expect(h.past).toHaveLength(1)
    expect(h.future).toHaveLength(1)
    expect(undoMarks(h, [m1])).toEqual([])
    // в повторе два снимка: последним положен текущий [m1] (по отмене), под ним — [m1, m2] из сохранённой истории
    expect(redoMarks(h, [])).toEqual([m1])
    expect(redoMarks(h, [m1])).toEqual([m1, m2])
  })

  it("HI-05: пустой снимок пометок допустим", () => {
    const store = emptyHistory()
    recordMarks(planHistory(store, "a", "demolition"), [])
    expect(parseHistory(serializeHistory(store))?.history).toEqual(store)
  })

  it("HI-06: история до введения плана «Демонтаж» читается: обмерочный план доступен, демонтаж пуст", () => {
    const old = JSON.stringify({
      version: 2,
      histories: { a: { past: [{ kind: "walls", walls: [wall(0)], dimensions: [] }], future: [] } },
      trash: [],
    })
    const parsed = parseHistory(old)
    expect(parsed?.readOnly).toBe(false)
    const store = parsed?.history ?? emptyHistory()
    expect(planHistory(store, "a", "measure").past).toHaveLength(1)
    expect(planHistory(store, "a", "demolition")).toEqual({ past: [], future: [] })
  })

  it("HI-07: запись пометок с пометкой без идентификатора делает документ повреждённым (null)", () => {
    const bad = JSON.stringify({
      version: 2,
      histories: { "a:demolition": { past: [{ kind: "demolition", marks: [{ wallId: "w1", anchor: "a", fromCm: 1, toCm: 2 }] }], future: [] } },
      trash: [],
    })
    expect(parseHistory(bad)).toBeNull()
  })

  it.each([
    ["marks не массив", { kind: "demolition", marks: "oops" }],
    ["marks отсутствует", { kind: "demolition" }],
    ["пометка с anchor c", { kind: "demolition", marks: [{ id: "m", wallId: "w1", anchor: "c", fromCm: 1, toCm: 2 }] }],
    ["пометка с toCm = fromCm", { kind: "demolition", marks: [{ id: "m", wallId: "w1", anchor: "a", fromCm: 2, toCm: 2 }] }],
    ["пометка — null", { kind: "demolition", marks: [null] }],
  ])("HI-07: %s — документ повреждён", (_name, entry) => {
    expect(parseHistory(JSON.stringify({ version: 2, histories: { "a:demolition": { past: [entry], future: [] } }, trash: [] }))).toBeNull()
  })

  it("HI-07: некорректная запись в future тоже делает документ повреждённым", () => {
    const bad = { kind: "demolition", marks: [{ id: "", wallId: "w1", anchor: "a", fromCm: 1, toCm: 2 }] }
    expect(parseHistory(JSON.stringify({ version: 2, histories: { a: { past: [], future: [bad] } }, trash: [] }))).toBeNull()
  })

  it("HI-07: версия документа истории больше 2 по-прежнему читается как пустая только для чтения", () => {
    const parsed = parseHistory(JSON.stringify({ version: 3, histories: {}, trash: [] }))
    expect(parsed?.readOnly).toBe(true)
  })
})
