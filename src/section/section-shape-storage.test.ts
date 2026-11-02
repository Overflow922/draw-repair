import { describe, expect, it } from "vitest"
import { emptyHistory, parseHistory, planHistory, recordSections, redoSections, serializeHistory, undoSections } from "../history"
import { parseStore, serializeStore } from "../storage"
import type { Drawing, DrawingStore, SectionLine, SectionShape, SectionsState } from "../types"

// change add-section-shapes: детали разреза в документе и в истории (spec drawing-storage «Объекты плана «Реконструкция» в
// документе»; drawing-history «История плана «Реконструкция»»)

const A: SectionLine = { id: "s1", label: "A", view: "right", points: [{ x: 200, y: -100 }, { x: 200, y: 100 }] }
const SHELF: SectionShape = { id: "d1", lineId: "s1", s0: 10, s1: 210, z0: 120, z1: 125 }
const BLOCK: SectionShape = { id: "d2", lineId: "s1", s0: 10, s1: 210, z0: 190, z1: 250 }

const drawing = (extra: Record<string, unknown> = {}): Drawing =>
  ({ id: "a", name: "Чертёж 1", walls: [], dimensions: [], view: { zoom: 1, pan: { x: 0, y: 0 } }, ...extra }) as Drawing

const doc = (d: Drawing): string => JSON.stringify({ version: 3, activeId: d.id, drawings: [d] })

const loaded = (raw: string): Drawing => {
  const parsed = parseStore(raw)
  expect(parsed).not.toBeNull()
  const [d] = parsed?.store.drawings ?? []
  if (!d) throw new Error("в документе нет чертежей")
  return d
}

describe("детали разреза в документе", () => {
  it("SH-500: деталь восстанавливается с идентификатором, линией и границами", () => {
    const store: DrawingStore = { version: 3, activeId: "a", drawings: [drawing({ reconstruction: { walls: [], dimensions: [], sections: [A], sectionShapes: [SHELF, BLOCK] } })] }
    expect(parseStore(serializeStore(store))?.store.drawings[0]?.reconstruction?.sectionShapes).toEqual([SHELF, BLOCK])
  })

  it("SH-501: битые детали отбрасываются по одной, корректная остаётся", () => {
    const flat = { ...SHELF, id: "x1", s1: SHELF.s0 }
    const noLine = { ...SHELF, id: "x2", lineId: "нет такой" }
    const noId = { ...SHELF, id: "" }
    const text = { ...SHELF, id: "x3", z1: "много" }
    const upsideDown = { ...SHELF, id: "x4", z0: 130 }
    const d = loaded(doc(drawing({ reconstruction: { walls: [], dimensions: [], sections: [A], sectionShapes: [flat, noLine, noId, text, upsideDown, SHELF] } })))
    expect(d.reconstruction?.sectionShapes).toEqual([SHELF])
  })

  it("SH-502: документ без деталей открывается без изменений, поле не появляется", () => {
    const d = loaded(doc(drawing({ reconstruction: { walls: [], dimensions: [], sections: [A] } })))
    expect(d.reconstruction).toEqual({ walls: [], dimensions: [], sections: [A] })
    expect(d.reconstruction && "sectionShapes" in d.reconstruction).toBe(false)
  })

  it("SH-503: если корректных деталей не осталось, поле тоже не появляется", () => {
    const d = loaded(doc(drawing({ reconstruction: { walls: [], dimensions: [], sections: [A], sectionShapes: [{ ...SHELF, s1: 0 }] } })))
    expect(d.reconstruction && "sectionShapes" in d.reconstruction).toBe(false)
  })

  it("SH-504: sectionShapes не массив читается как отсутствующее, документ рабочий", () => {
    const d = loaded(doc(drawing({ reconstruction: { walls: [], dimensions: [], sections: [A], sectionShapes: "oops" } })))
    expect(d.reconstruction?.sections).toEqual([A])
    expect(d.reconstruction && "sectionShapes" in d.reconstruction).toBe(false)
  })

  it("SH-505: детали без линий в документе отбрасываются (линии удалены или битые)", () => {
    const d = loaded(doc(drawing({ reconstruction: { walls: [], dimensions: [], sectionShapes: [SHELF] } })))
    expect(d.reconstruction && "sectionShapes" in d.reconstruction).toBe(false)
  })

  it("SH-506: формат документа остаётся версии 3", () => {
    expect(parseStore(doc(drawing({ reconstruction: { walls: [], dimensions: [], sections: [A], sectionShapes: [SHELF] } })))?.store.version).toBe(3)
  })
})

const state = (sections: SectionLine[], shapes: SectionShape[] = []): SectionsState => ({ sections, shapes })

describe("детали разреза в истории", () => {
  it("SH-510: отмена детали: поставили деталь, сдвинули (ввод расстояния), дважды отменили и повторили", () => {
    const h = planHistory(emptyHistory(), "a", "reconstruction")
    const moved: SectionShape = { ...SHELF, z0: 150, z1: 155 }
    recordSections(h, state([A])) // постановка: до неё деталей не было
    recordSections(h, state([A], [SHELF])) // ввод расстояния: до него деталь стояла на месте
    expect(undoSections(h, state([A], [moved]))).toEqual(state([A], [SHELF]))
    expect(undoSections(h, state([A], [SHELF]))).toEqual(state([A]))
    expect(redoSections(h, state([A]))).toEqual(state([A], [SHELF]))
    expect(redoSections(h, state([A], [SHELF]))).toEqual(state([A], [moved]))
  })

  it("SH-511: отмена удаления линии с двумя деталями возвращает линию и обе детали одним шагом", () => {
    const h = planHistory(emptyHistory(), "a", "reconstruction")
    recordSections(h, state([A], [SHELF, BLOCK])) // удаление линии: после него нет ни линии, ни деталей
    expect(h.past).toHaveLength(1)
    expect(undoSections(h, state([]))).toEqual(state([A], [SHELF, BLOCK]))
    expect(h.past).toHaveLength(0)
    expect(redoSections(h, state([A], [SHELF, BLOCK]))).toEqual(state([]))
  })

  it("SH-512: запись без деталей не получает поля shapes, запись с деталями — получает", () => {
    const h = planHistory(emptyHistory(), "a", "reconstruction")
    recordSections(h, state([A]))
    recordSections(h, state([A], [SHELF]))
    expect(h.past[0]).toEqual({ kind: "sections", sections: [A] })
    expect(h.past[1]).toEqual({ kind: "sections", sections: [A], shapes: [SHELF] })
  })

  it("SH-513: запись истории — копия: правка списка деталей после записи её не меняет", () => {
    const h = planHistory(emptyHistory(), "a", "reconstruction")
    const shapes = [{ ...SHELF }]
    recordSections(h, state([A], shapes))
    shapes[0].s1 = 999
    expect(h.past[0]).toEqual({ kind: "sections", sections: [A], shapes: [SHELF] })
  })

  it("SH-514: история с деталями переживает перезагрузку", () => {
    const store = emptyHistory()
    recordSections(planHistory(store, "a", "reconstruction"), state([A], [SHELF]))
    const back = parseHistory(serializeHistory(store))
    expect(back).not.toBeNull()
    expect(back ? planHistory(back.history, "a", "reconstruction").past : null).toEqual([{ kind: "sections", sections: [A], shapes: [SHELF] }])
  })

  it("SH-515: старая запись без поля shapes читается как «деталей не было»", () => {
    const store = emptyHistory()
    recordSections(planHistory(store, "a", "reconstruction"), state([A]))
    const back = parseHistory(serializeHistory(store))
    const h = back ? planHistory(back.history, "a", "reconstruction") : null
    expect(h ? undoSections(h, state([A], [SHELF])) : null).toEqual(state([A]))
  })

  it("SH-516: запись с некорректной деталью делает документ истории повреждённым", () => {
    const store = emptyHistory()
    recordSections(planHistory(store, "a", "reconstruction"), state([A], [SHELF]))
    expect(parseHistory(serializeHistory(store).replace('"s1":210', '"s1":10'))).toBeNull()
  })
})
