import { describe, expect, it } from "vitest"
import { emptyHistory, parseHistory, planHistory, recordSections, redoEntry, redoSections, serializeHistory, undoEntry, undoSections } from "../history"
import { parseStore, serializeStore } from "../storage"
import type { Drawing, DrawingStore, SectionLine, SectionsState } from "../types"

// change add-section-view: линии разреза в документе и в истории
// (spec drawing-storage «Объекты плана «Реконструкция» в документе»; drawing-history «История плана «Реконструкция»»)

const A: SectionLine = { id: "s1", label: "A", view: "right", points: [{ x: 200, y: -100 }, { x: 200, y: 100 }] }
const B: SectionLine = { id: "s2", label: "B", view: "down", points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 40 }, { x: 200, y: 40 }] }

// состояние шага: линии без деталей (change add-section-shapes: запись истории хранит линии и детали)
const lines = (sections: SectionLine[]): SectionsState => ({ sections, shapes: [] })

const drawing = (extra: Record<string, unknown> = {}): Drawing =>
  ({ id: "a", name: "Чертёж 1", walls: [], dimensions: [], view: { zoom: 1, pan: { x: 0, y: 0 } }, ...extra }) as Drawing

const doc = (drawings: Drawing[]): string => JSON.stringify({ version: 3, activeId: drawings[0]?.id ?? "", drawings })

const first = (raw: string): Drawing => {
  const parsed = parseStore(raw)
  expect(parsed).not.toBeNull()
  expect(parsed?.readOnly).toBe(false)
  const [d] = parsed?.store.drawings ?? []
  if (!d) throw new Error("в документе нет чертежей")
  return d
}

describe("линии разреза в документе", () => {
  it("SV-60: линия восстанавливается с идентификатором, обозначением, вершинами и направлением", () => {
    const store: DrawingStore = { version: 3, activeId: "a", drawings: [drawing({ reconstruction: { walls: [], dimensions: [], sections: [A, B] } })] }
    const d = parseStore(serializeStore(store))?.store.drawings[0]
    expect(d?.reconstruction?.sections).toEqual([A, B])
  })

  it("SV-61: формат документа остаётся версии 3", () => {
    expect(parseStore(doc([drawing({ reconstruction: { walls: [], dimensions: [], sections: [A] } })]))?.store.version).toBe(3)
  })

  it("SV-62: битые линии отбрасываются по одной, корректная остаётся", () => {
    const oneVertex = { ...A, id: "x1", points: [{ x: 0, y: 0 }] }
    const skew = { ...A, id: "x2", points: [{ x: 0, y: 0 }, { x: 100, y: 30 }] }
    const noId = { ...A, id: "" }
    const noLabel = { ...A, id: "x3", label: "" }
    const badView = { ...A, id: "x4", view: "sideways" }
    const d = first(doc([drawing({ reconstruction: { walls: [], dimensions: [], sections: [oneVertex, skew, noId, noLabel, badView, A] } })]))
    expect(d.reconstruction?.sections).toEqual([A])
  })

  it("SV-63: Г-образная линия и возврат назад в документе отбрасываются", () => {
    const even = { ...B, id: "e", points: B.points.slice(0, 3) }
    const back = { ...B, id: "b", points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 40 }, { x: 40, y: 40 }] }
    const d = first(doc([drawing({ reconstruction: { walls: [], dimensions: [], sections: [even, back] } })]))
    expect(d.reconstruction?.sections).toEqual([])
  })

  it("SV-64: документ без поля sections открывается без изменений, поле не появляется", () => {
    const d = first(doc([drawing({ reconstruction: { walls: [], dimensions: [] } })]))
    expect(d.reconstruction).toEqual({ walls: [], dimensions: [] })
    expect(d.reconstruction && "sections" in d.reconstruction).toBe(false)
  })

  it("SV-65: sections не массив читается как пустой список, документ рабочий", () => {
    const d = first(doc([drawing({ reconstruction: { walls: [], dimensions: [], sections: "oops" } })]))
    expect(d.reconstruction?.sections).toEqual([])
  })
})

describe("линии разреза в истории", () => {
  it("SV-70: шаг пишется в историю плана «Реконструкция» и независим от других планов", () => {
    const store = emptyHistory()
    recordSections(planHistory(store, "a", "reconstruction"), lines([]))
    expect(planHistory(store, "a", "reconstruction").past).toHaveLength(1)
    for (const plan of ["measure", "mounting", "rough", "furniture"] as const) expect(planHistory(store, "a", plan).past).toEqual([])
  })

  it("SV-71: отмена возвращает список до операции, повтор — состояние до отмены", () => {
    const h = planHistory(emptyHistory(), "a", "reconstruction")
    recordSections(h, lines([]))
    expect(undoSections(h, lines([A]))).toEqual(lines([]))
    expect(redoSections(h, lines([]))).toEqual(lines([A]))
  })

  it("SV-72: общие функции отмены записи «sections» не забирают", () => {
    const h = planHistory(emptyHistory(), "a", "reconstruction")
    recordSections(h, lines([]))
    expect(undoEntry(h, { walls: [], dimensions: [] })).toBeNull()
    expect(h.past).toHaveLength(1)
    undoSections(h, lines([A]))
    expect(redoEntry(h, { walls: [], dimensions: [] })).toBeNull()
    expect(h.future).toHaveLength(1)
  })

  it("SV-73: отмена при другой верхней записи ничего не делает", () => {
    const h = planHistory(emptyHistory(), "a", "reconstruction")
    expect(undoSections(h, lines([A]))).toBeNull()
    expect(redoSections(h, lines([A]))).toBeNull()
  })

  it("SV-74: история переживает перезагрузку", () => {
    const store = emptyHistory()
    recordSections(planHistory(store, "a", "reconstruction"), lines([A]))
    const loaded = parseHistory(serializeHistory(store))
    expect(loaded).not.toBeNull()
    const h = loaded ? planHistory(loaded.history, "a", "reconstruction") : null
    expect(h?.past).toEqual([{ kind: "sections", sections: [A] }])
  })

  it("SV-75: запись с некорректной линией делает документ истории повреждённым", () => {
    const store = emptyHistory()
    recordSections(planHistory(store, "a", "reconstruction"), lines([A]))
    const raw = serializeHistory(store).replace('"label":"A"', '"label":""')
    expect(parseHistory(raw)).toBeNull()
  })

  it("SV-76: запись истории — копия: последующая правка списка её не меняет", () => {
    const h = planHistory(emptyHistory(), "a", "reconstruction")
    const list = [{ ...A, points: [...A.points] }]
    recordSections(h, lines(list))
    list[0].points[0] = { x: 999, y: 999 }
    expect(h.past[0]).toEqual({ kind: "sections", sections: [A] })
  })
})
