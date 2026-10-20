import { describe, expect, it } from "vitest"
import { parseStore, serializeStore } from "../storage"
import type { Drawing, DrawingStore, PlasterMark, Wall } from "../types"

// change plaster-opening-reveals: пометки откосов в документе версии 3
// (spec drawing-storage «Объекты плана «Черновые работы» в документе», сценарии про откосы)

const W: Wall = { id: "w1", a: { x: 0, y: 0 }, b: { x: 500, y: 0 }, thicknessCm: 20, type: "brick" }
const reveal: PlasterMark = { id: "r1", face: "reveal", elementId: "win1", jamb: "a", thicknessMm: 20 }

const drawing = (extra: Record<string, unknown> = {}): Drawing =>
  ({ id: "a", name: "Чертёж 1", walls: [W], dimensions: [], view: { zoom: 1, pan: { x: 0, y: 0 } }, ...extra }) as Drawing

const doc = (drawings: Drawing[]): string => JSON.stringify({ version: 3, activeId: drawings[0]?.id ?? "", drawings })

const first = (raw: string): Drawing => {
  const parsed = parseStore(raw)
  expect(parsed).not.toBeNull()
  expect(parsed?.readOnly).toBe(false)
  const [d] = parsed?.store.drawings ?? []
  if (!d) throw new Error("в документе нет чертежей")
  return d
}

describe("откосы в документе", () => {
  it("откос сохраняется с тем же идентификатором, элементом, откосом и толщиной", () => {
    const d = first(doc([drawing({ roughPlaster: [reveal] })]))
    expect(d.roughPlaster).toEqual([reveal])
  })

  it("круг serializeStore → parseStore сохраняет откос обоих сторон", () => {
    const both: PlasterMark[] = [reveal, { ...reveal, id: "r2", jamb: "b", thicknessMm: 35 }]
    const store: DrawingStore = { version: 3, activeId: "a", drawings: [drawing({ roughPlaster: both })] }
    expect(parseStore(serializeStore(store))?.store.drawings[0]?.roughPlaster).toEqual(both)
  })

  it("битые откосы отбрасываются по одной, корректный остаётся", () => {
    const bad = [
      { ...reveal, id: "" },
      { ...reveal, id: "j", jamb: "c" },
      { ...reveal, id: "t0", thicknessMm: 0 },
      { ...reveal, id: "t101", thicknessMm: 101 },
      { ...reveal, id: "tf", thicknessMm: 2.5 },
      { ...reveal, id: "e", elementId: "" },
      { ...reveal, id: "en", elementId: 5 },
    ]
    const d = first(doc([drawing({ roughPlaster: [...bad, reveal] })]))
    expect(d.roughPlaster).toEqual([reveal])
  })

  it("откос элемента, которого нет в чертеже, сохраняется", () => {
    const d = first(doc([drawing({ roughPlaster: [{ ...reveal, elementId: "gone" }] })]))
    expect(d.roughPlaster).toEqual([{ ...reveal, elementId: "gone" }])
  })

  it("лишние поля откоса не переносятся", () => {
    const d = first(doc([drawing({ roughPlaster: [{ ...reveal, wallId: "w1", fromCm: 1 }] })]))
    expect(d.roughPlaster).toEqual([reveal])
  })

  it("откос не мешает граням: участки грани по-прежнему сливаются", () => {
    const side = { id: "p", wallId: "w1", face: 1, anchor: "a", fromCm: 100, toCm: 200, thicknessMm: 20 }
    const d = first(doc([drawing({ roughPlaster: [side, reveal, { ...side, id: "q", fromCm: 150, toCm: 300 }] })]))
    expect(d.roughPlaster).toEqual([{ ...side, toCm: 300 }, reveal])
  })
})
