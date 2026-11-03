import { describe, expect, it } from "vitest"
import { importDrawingFile, serializeDrawingFile } from "../drawing-file/drawing-file"
import { emptyHistory, parseHistory, planHistory, recordSections, redoSections, serializeHistory, undoSections } from "../history"
import { parseStore, serializeStore } from "../storage"
import type { Drawing, DrawingStore, SectionLine, SectionsState } from "../types"

// change move-section-figure: позиция переставленной фигуры в документе, в истории и в файле чертежа
// (spec drawing-storage «Объекты плана «Реконструкция» в документе»; section-view «Перемещение фигуры разреза»)

const A: SectionLine = { id: "s1", label: "A", view: "right", points: [{ x: 200, y: -100 }, { x: 200, y: 100 }] }
const MOVED: SectionLine = { ...A, figureAt: { x: 800, y: 40 } }

const drawing = (sections: unknown[]): Drawing =>
  ({
    id: "a",
    name: "Чертёж 1",
    walls: [],
    dimensions: [],
    view: { zoom: 1, pan: { x: 0, y: 0 } },
    reconstruction: { walls: [], dimensions: [], sections },
  }) as Drawing

const sectionsOf = (raw: string): readonly SectionLine[] | undefined => {
  const parsed = parseStore(raw)
  expect(parsed).not.toBeNull()
  return parsed?.store.drawings[0]?.reconstruction?.sections
}

const doc = (sections: unknown[]): string => JSON.stringify({ version: 3, activeId: "a", drawings: [drawing(sections)] })

describe("позиция фигуры разреза в документе", () => {
  it("MSF-1: позиция переставленной фигуры сохраняется при перезагрузке", () => {
    const store: DrawingStore = { version: 3, activeId: "a", drawings: [drawing([MOVED])] }
    expect(sectionsOf(serializeStore(store))).toEqual([MOVED])
  })

  it("MSF-2: у не переставленной фигуры поле позиции не дописывается", () => {
    const [line] = sectionsOf(doc([A])) ?? []
    expect(line).toEqual(A)
    expect(line && "figureAt" in line).toBe(false)
  })

  it("MSF-3: нечисловая позиция сбрасывается, линия остаётся", () => {
    const broken = { ...A, figureAt: { x: "800", y: 40 } }
    const [line] = sectionsOf(doc([broken])) ?? []
    expect(line).toEqual(A)
    expect(line && "figureAt" in line).toBe(false)
  })

  it("MSF-4: позиция не пара — сбрасывается, остальные линии не страдают", () => {
    const other = { ...A, id: "s2", label: "B", figureAt: 5 }
    const sections = sectionsOf(doc([MOVED, other])) ?? []
    expect(sections).toEqual([MOVED, { ...A, id: "s2", label: "B" }])
  })

  it("MSF-5: формат документа остаётся версии 3", () => {
    expect(parseStore(doc([MOVED]))?.store.version).toBe(3)
  })
})

describe("позиция фигуры разреза в файле чертежа", () => {
  it("MSF-6: сохранить в файл и загрузить — позиция та же", () => {
    const result = importDrawingFile(serializeDrawingFile(drawing([MOVED])), new Set(), "new")
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.drawing.reconstruction?.sections).toEqual([MOVED])
  })
})

describe("позиция фигуры разреза в истории", () => {
  const lines = (sections: SectionLine[]): SectionsState => ({ sections, shapes: [] })

  it("MSF-7: отмена возвращает прежнее положение, повтор ставит новое; запись переживает сериализацию", () => {
    const store = emptyHistory()
    recordSections(planHistory(store, "a", "reconstruction"), lines([A]))
    const loaded = parseHistory(serializeHistory(store))
    expect(loaded).not.toBeNull()
    if (loaded === null) return
    const h = planHistory(loaded.history, "a", "reconstruction")
    expect(undoSections(h, lines([MOVED]))).toEqual(lines([A]))
    expect(redoSections(h, lines([A]))).toEqual(lines([MOVED]))
  })
})
