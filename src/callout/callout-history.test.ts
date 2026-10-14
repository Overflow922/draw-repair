import { describe, expect, it } from "vitest"
import { HISTORY_LIMIT, emptyHistory, parseHistory, planHistory, record, recordCallouts, recordMarks, redoCallouts, redoDemolition, redoEntry, redoMarks, serializeHistory, undoCallouts, undoDemolition, undoEntry, undoMarks } from "../history"
import type { DrawingHistory, HistoryStore, Scene } from "../history"
import type { Callout } from "../types"
import { A, B, callout, deepFreeze } from "./callout.test-utils"

// change add-callout: выноски в истории плана (spec drawing-history «Выноски в истории»; design D3; test-plan C-HIS-*, C-PLN-2).

const empty = (): DrawingHistory => ({ past: [], future: [] })
const scene = (): Scene => ({ walls: [], dimensions: [] })

describe("шаги истории выносок", () => {
  it("C-HIS-1: создание — один шаг: отмена возвращает список до операции, повтор — после", () => {
    const h = empty()
    recordCallouts(h, [])
    const afterCreate = [A()]
    const restored = undoCallouts(h, afterCreate)
    expect(restored).toEqual([])
    expect(h.past).toHaveLength(0)
    expect(h.future).toHaveLength(1)
    expect(redoCallouts(h, restored ?? [])).toEqual([A()])
    expect(h.past).toHaveLength(1)
    expect(h.future).toHaveLength(0)
  })

  it("C-HIS-2: правка текста и перенос — снимок прежнего состояния с прежним текстом и точками", () => {
    const h = empty()
    const before = [A(), B()]
    recordCallouts(h, before)
    const after = [{ ...A(), text: "новый" }, { ...B(), at: { x: 1, y: 2 } }]
    expect(undoCallouts(h, after)).toEqual([A(), B()])
  })

  it("C-HIS-3: удаление — отмена возвращает выноску с прежним текстом и точками", () => {
    const h = empty()
    recordCallouts(h, [A(), B()])
    expect(undoCallouts(h, [B()])).toEqual([A(), B()])
  })

  it("C-HIS-4: запись — глубокая копия: правка списка после записи снимок не меняет", () => {
    const h = empty()
    const list: Callout[] = [A()]
    recordCallouts(h, list)
    list[0].text = "изменено"
    list[0].target.x = 999
    list.push(B())
    expect(undoCallouts(h, [])).toEqual([A()])
  })

  it("C-HIS-4b: возвращаемый снимок — копия: его правка не портит запись в future", () => {
    const h = empty()
    recordCallouts(h, [A()])
    const restored = undoCallouts(h, [B()]) ?? []
    restored[0].text = "испорчено"
    expect(redoCallouts(h, restored)).toEqual([B()])
  })

  it("C-HIS-4e: переданное «текущее» состояние сохраняется копией: его правка после вызова undoCallouts/redoCallouts запись не меняет", () => {
    const h = empty()
    recordCallouts(h, [A()])
    const current = [B()]
    undoCallouts(h, current) // в future ушла копия current
    current[0].text = "испорчено"
    current[0].target.x = 999
    const redone = redoCallouts(h, [A()])
    expect(redone).toEqual([B()])
    const again = [A()]
    undoCallouts(h, again) // повторная отмена: в future копия again
    again[0].text = "испорчено ещё"
    expect(redoCallouts(h, [B()])).toEqual([A()])
  })

  it("C-HIS-4i: несколько шагов подряд — две отмены, два повтора и ещё отмена возвращают состояния в правильном порядке, длины стеков верны", () => {
    const s0: Callout[] = []
    const s1: Callout[] = [A()]
    const s2: Callout[] = [A(), B()]
    const s3: Callout[] = [B()]
    const h = empty()
    recordCallouts(h, s0) // s0 -> s1
    recordCallouts(h, s1) // s1 -> s2
    recordCallouts(h, s2) // s2 -> s3
    expect(h.past).toHaveLength(3)
    expect(undoCallouts(h, s3)).toEqual(s2)
    expect(undoCallouts(h, s2)).toEqual(s1)
    expect(h.past).toHaveLength(1)
    expect(h.future).toHaveLength(2)
    expect(redoCallouts(h, s1)).toEqual(s2)
    expect(redoCallouts(h, s2)).toEqual(s3)
    expect(h.past).toHaveLength(3)
    expect(h.future).toHaveLength(0)
    expect(undoCallouts(h, s3)).toEqual(s2)
    expect(undoCallouts(h, s2)).toEqual(s1)
    expect(undoCallouts(h, s1)).toEqual(s0)
    expect(undoCallouts(h, s0)).toBeNull()
    expect(h.past).toHaveLength(0)
    expect(h.future).toHaveLength(3)
  })

  it("C-HIS-4j: частичная отмена и повтор не стирают остальную ветку повтора: третий повтор доступен после двух отмен и одного повтора", () => {
    const s0: Callout[] = []
    const s1: Callout[] = [A()]
    const s2: Callout[] = [A(), B()]
    const h = empty()
    recordCallouts(h, s0)
    recordCallouts(h, s1)
    undoCallouts(h, s2)
    undoCallouts(h, s1)
    expect(h.future).toHaveLength(2)
    expect(redoCallouts(h, s0)).toEqual(s1)
    expect(h.future).toHaveLength(1)
    expect(redoCallouts(h, s1)).toEqual(s2)
    expect(redoCallouts(h, s2)).toBeNull()
  })

  it("C-HIS-4g: снимок повтора и вложенные точки тоже копируются: правка current после redoCallouts, а также at и target, запись не меняет", () => {
    const h = empty()
    recordCallouts(h, [A()])
    const undone = undoCallouts(h, [B()]) ?? []
    const current = [A()]
    redoCallouts(h, current) // в past ушла копия current
    current[0].text = "испорчено"
    current[0].at.x = 777
    current[0].target.y = 888
    expect(undoCallouts(h, [B()])).toEqual([A()])
    expect(undone).toEqual([A()])
  })

  it("C-HIS-4h: точка at записи — копия: правка at исходной выноски после записи снимок не меняет", () => {
    const h = empty()
    const list: Callout[] = [A()]
    recordCallouts(h, list)
    list[0].at.x = 12345
    list[0].at.y = 54321
    expect(undoCallouts(h, [])).toEqual([A()])
  })

  it("C-HIS-4f: возвращённые списки — копии: правка результата undoCallouts/redoCallouts не меняет последующих шагов", () => {
    const h = empty()
    recordCallouts(h, [A()])
    const restored = undoCallouts(h, [B()]) ?? []
    restored[0].text = "испорчено"
    restored[0].at.x = 12345
    expect(redoCallouts(h, [A()])).toEqual([B()])
    const redone = undoCallouts(h, [B()]) ?? []
    expect(redone).toEqual([A()])
    redone[0].text = "снова испорчено"
    const back = redoCallouts(h, [A()]) ?? []
    expect(back).toEqual([B()])
    back[0].text = "и ещё"
    expect(undoCallouts(h, [B()])).toEqual([A()])
  })

  it("C-HIS-4c: повтор кладёт текущее состояние обратно в past (повторная отмена работает)", () => {
    const h = empty()
    recordCallouts(h, [])
    const created = [A()]
    const undone = undoCallouts(h, created) ?? []
    const redone = redoCallouts(h, undone) ?? []
    expect(redone).toEqual(created)
    expect(undoCallouts(h, redone)).toEqual([])
  })

  it("C-HIS-4d: новая запись после отмены очищает ветку повтора", () => {
    const h = empty()
    recordCallouts(h, [])
    undoCallouts(h, [A()])
    expect(h.future).toHaveLength(1)
    recordCallouts(h, [])
    expect(h.future).toHaveLength(0)
  })

  it("C-HIS-9: число шагов ограничено HISTORY_LIMIT: старейший отбрасывается", () => {
    const h = empty()
    for (let i = 0; i < HISTORY_LIMIT + 1; i++) recordCallouts(h, [callout(`c${i}`, { x: i, y: 0 }, { x: 0, y: 0 }, "т")])
    expect(h.past).toHaveLength(HISTORY_LIMIT)
    const oldest = h.past[0]
    expect(oldest.kind === "callouts" && oldest.callouts[0].id).toBe("c1")
  })

  it("C-INV-4: входной список записи не мутируется", () => {
    const h = empty()
    recordCallouts(h, deepFreeze([A()]))
    expect(undoCallouts(h, deepFreeze([B()]))).toEqual([A()])
  })
})

describe("запись «callouts» среди других записей стека", () => {
  it("C-HIS-10: undoCallouts/redoCallouts при верхней записи другого вида — null, стеки не меняются", () => {
    const h = empty()
    record(h, scene())
    const snapshot = JSON.stringify(h)
    expect(undoCallouts(h, [A()])).toBeNull()
    expect(redoCallouts(h, [A()])).toBeNull()
    expect(JSON.stringify(h)).toBe(snapshot)
    const g = empty()
    recordMarks(g, [])
    const gs = JSON.stringify(g)
    expect(undoCallouts(g, [])).toBeNull()
    expect(JSON.stringify(g)).toBe(gs)
  })

  it("C-HIS-10c: redoCallouts при чужой записи на вершине future — null, оба стека не меняются, чужая запись не теряется", () => {
    const h = empty()
    record(h, scene())
    recordCallouts(h, [A()])
    undoCallouts(h, [B()]) // future: «callouts»
    h.future.push({ kind: "walls", ...scene() }) // сверху в future — запись другого вида
    const before = JSON.stringify(h)
    expect(redoCallouts(h, [A()])).toBeNull()
    expect(JSON.stringify(h)).toBe(before)
    const g = empty()
    g.future.push({ kind: "demolition", marks: [] })
    const gs = JSON.stringify(g)
    expect(redoCallouts(g, [])).toBeNull()
    expect(JSON.stringify(g)).toBe(gs)
  })

  it("C-HIS-10b: пустые стеки — null", () => {
    expect(undoCallouts(empty(), [])).toBeNull()
    expect(redoCallouts(empty(), [])).toBeNull()
  })

  it("C-HIS-11: undoEntry, redoEntry, undoMarks, redoMarks, undoDemolition, redoDemolition записей «callouts» не забирают", () => {
    const state = { marks: [], batteryMarks: [] }
    const make = (): DrawingHistory => {
      const h = empty()
      recordCallouts(h, [A()])
      h.future.push({ kind: "callouts", callouts: [B()] })
      return h
    }
    const h = make()
    const before = JSON.stringify(h)
    expect(undoMarks(h, [])).toBeNull()
    expect(redoMarks(h, [])).toBeNull()
    expect(undoDemolition(h, state)).toBeNull()
    expect(redoDemolition(h, state)).toBeNull()
    expect(JSON.stringify(h)).toBe(before)
    expect(undoEntry(h, scene())).toBeNull()
    expect(redoEntry(h, scene())).toBeNull()
    expect(JSON.stringify(h)).toBe(before)
  })

  it("C-HIS-11b: записи других видов под записью «callouts» остаются доступными после её отмены", () => {
    const h = empty()
    record(h, scene())
    recordCallouts(h, [])
    expect(undoCallouts(h, [A()])).toEqual([])
    expect(undoEntry(h, scene())?.kind).toBe("walls")
  })
})

describe("независимость историй планов", () => {
  it("C-HIS-5: выноски разных планов пишутся в истории своих планов и отменяются независимо", () => {
    const store: HistoryStore = emptyHistory()
    const measure = planHistory(store, "d", "measure")
    const mounting = planHistory(store, "d", "mounting")
    const demolition = planHistory(store, "d", "demolition")
    recordCallouts(mounting, [])
    expect(measure.past).toHaveLength(0)
    expect(demolition.past).toHaveLength(0)
    expect(undoCallouts(measure, [A()])).toBeNull()
    expect(undoCallouts(mounting, [A()])).toEqual([])
  })
})

describe("персистентность", () => {
  it("C-HIS-6: история с записями «callouts» переживает сериализацию: те же шаги отмены и повтора", () => {
    const store = emptyHistory()
    const h = planHistory(store, "d", "mounting")
    recordCallouts(h, [])
    recordCallouts(h, [A()])
    undoCallouts(h, [A(), B()])
    const loaded = parseHistory(serializeHistory(store))
    expect(loaded).not.toBeNull()
    expect(loaded?.readOnly).toBe(false)
    const lh = planHistory(loaded?.history ?? emptyHistory(), "d", "mounting")
    expect(lh.past).toHaveLength(1)
    expect(lh.future).toHaveLength(1)
    expect(undoCallouts(lh, [A()])).toEqual([])
    expect(redoCallouts(lh, [])).toEqual([A()])
  })

  it("C-HIS-6b: версия документа истории остаётся 2", () => {
    const store = emptyHistory()
    recordCallouts(planHistory(store, "d", "measure"), [A()])
    expect(JSON.parse(serializeHistory(store)).version).toBe(2)
  })

  it("C-HIS-7: история, сохранённая до введения выносок, читается без изменений", () => {
    const legacy = JSON.stringify({
      version: 2,
      histories: { d: { past: [{ kind: "walls", walls: [], dimensions: [] }], future: [] } },
      trash: [],
    })
    const loaded = parseHistory(legacy)
    expect(loaded).not.toBeNull()
    expect(loaded?.history.histories.d.past).toHaveLength(1)
  })

  it("C-HIS-8: запись с выноской без идентификатора делает документ повреждённым", () => {
    const bad = JSON.stringify({
      version: 2,
      histories: { d: { past: [{ kind: "callouts", callouts: [{ target: { x: 1, y: 1 }, at: { x: 2, y: 2 }, text: "т" }] }], future: [] } },
      trash: [],
    })
    expect(parseHistory(bad)).toBeNull()
  })

  it("C-HIS-8b: запись с пустым текстом, нечисловой точкой и не-списком отвергается; запись в future проверяется так же", () => {
    const wrap = (entry: unknown, where: "past" | "future" = "past"): string =>
      JSON.stringify({ version: 2, histories: { d: { past: where === "past" ? [entry] : [], future: where === "future" ? [entry] : [] } }, trash: [] })
    expect(parseHistory(wrap({ kind: "callouts", callouts: [{ id: "x", target: { x: 1, y: 1 }, at: { x: 2, y: 2 }, text: "" }] }))).toBeNull()
    expect(parseHistory(wrap({ kind: "callouts", callouts: [{ id: "x", target: { x: "1", y: 1 }, at: { x: 2, y: 2 }, text: "т" }] }))).toBeNull()
    expect(parseHistory(wrap({ kind: "callouts", callouts: "нет" }))).toBeNull()
    expect(parseHistory(wrap({ kind: "callouts" }))).toBeNull()
    expect(parseHistory(wrap({ kind: "callouts", callouts: [{ id: "x", text: "" }] }, "future"))).toBeNull()
  })

  it("C-HIS-8d: проверяется каждая выноска записи, а не только первая: допустимая первая и недопустимая вторая — история повреждена", () => {
    const good = { id: "g", target: { x: 1, y: 1 }, at: { x: 2, y: 2 }, text: "т" }
    const bad = { id: "b", target: { x: 1, y: 1 }, at: { x: 2, y: 2 }, text: "" }
    const mk = (callouts: unknown[], where: "past" | "future" = "past"): string =>
      JSON.stringify({ version: 2, histories: { d: { past: where === "past" ? [{ kind: "callouts", callouts }] : [], future: where === "future" ? [{ kind: "callouts", callouts }] : [] } }, trash: [] })
    expect(parseHistory(mk([good, bad]))).toBeNull()
    expect(parseHistory(mk([good, good, bad], "future"))).toBeNull()
    expect(parseHistory(mk([good, { ...good, id: "g2" }]))).not.toBeNull()
  })

  it("C-HIS-8c: допустимая запись с пустым списком выносок принимается", () => {
    const ok = JSON.stringify({ version: 2, histories: { d: { past: [{ kind: "callouts", callouts: [] }], future: [] } }, trash: [] })
    expect(parseHistory(ok)).not.toBeNull()
  })
})
