import { describe, expect, it } from "vitest"
import { activePlanOf } from "../plans"
import { parseStore, serializeStore } from "../storage"
import type { Callout, Dimension, Drawing, DrawingStore, FurnitureItem, Wall } from "../types"

// change add-plumbing-plan: объекты плана «Сантехника» в документе версии 3
// (spec drawing-storage «Объекты плана «Сантехника» в документе»; design D5)

const W: Wall = { id: "w1", a: { x: 0, y: 0 }, b: { x: 500, y: 0 }, thicknessCm: 20, type: "brick" }
const S: FurnitureItem = { id: "s1", kind: "sink", x: 107.5, y: 30, widthCm: 45, lengthCm: 40, angleDeg: 0 }
const vertex = { a: { wallId: "w1", edge: 0 }, b: { wallId: "w1", edge: 1 } }
const toCenter: Dimension = { from: vertex, to: { kind: "item", itemId: "s1", at: { kind: "center" } }, offset: -30 }
const toCorner: Dimension = { from: vertex, to: { kind: "item", itemId: "s1", at: { kind: "corner", u: -1, v: 1 } }, offset: -50 }
const callout: Callout = { id: "c", target: { x: 1, y: 2 }, at: { x: 3, y: 4 }, text: "Раковина: ХВС, ГВС, К, h=500" }

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

describe("объекты «Сантехники» в документе", () => {
  it("PST-01: размер к центру и к углу прибора восстанавливается с той же вершиной, прибором, точкой и смещением", () => {
    const store: DrawingStore = { version: 3, activeId: "a", drawings: [drawing({ furniture: { items: [S], dimensions: [] }, plumbing: { dimensions: [toCenter, toCorner] } })] }
    const d = parseStore(serializeStore(store))?.store.drawings[0]
    expect(d?.plumbing?.dimensions).toEqual([toCenter, toCorner])
  })

  it("PST-02: приборы не копируются — в поле плана только размеры, выноски и примечания", () => {
    const store: DrawingStore = { version: 3, activeId: "a", drawings: [drawing({ furniture: { items: [S], dimensions: [] }, plumbing: { dimensions: [toCenter], callouts: [callout], notes: ["Первый"] } })] }
    const d = parseStore(serializeStore(store))?.store.drawings[0]
    expect(Object.keys(d?.plumbing ?? {}).sort()).toEqual(["callouts", "dimensions", "notes"])
    expect(d?.plumbing?.callouts).toEqual([callout])
    expect(d?.plumbing?.notes).toEqual(["Первый"])
    expect(d?.furniture?.items).toEqual([S])
  })

  it("PST-03: старый документ без поля открывается без изменений, поле не появляется", () => {
    const d = first(doc([drawing()]))
    expect(d.plumbing).toBeUndefined()
    expect("plumbing" in d).toBe(false)
  })

  it("PST-04: размер с точкой прибора без идентификатора отброшен, корректный восстановлен; документ рабочий", () => {
    const bad = { from: vertex, to: { kind: "item", at: { kind: "center" } }, offset: 10 }
    const badCorner = { from: vertex, to: { kind: "item", itemId: "s1", at: { kind: "corner", u: 2, v: 1 } }, offset: 10 }
    const unknownAt = { from: vertex, to: { kind: "item", itemId: "s1", at: { kind: "edge" } }, offset: 10 }
    const d = first(doc([drawing({ plumbing: { dimensions: [bad, badCorner, unknownAt, toCenter] } })]))
    expect(d.plumbing?.dimensions).toEqual([toCenter])
  })

  it("PST-05: размер на отсутствующий прибор сохраняется", () => {
    const d = first(doc([drawing({ plumbing: { dimensions: [toCenter] } })]))
    expect(d.plumbing?.dimensions).toEqual([toCenter])
  })

  it("PST-06: активный план plumbing читается как допустимый", () => {
    expect(activePlanOf(first(doc([drawing({ activePlan: "plumbing" })])))).toBe("plumbing")
  })

  it("PST-07: точка прибора в размере другого плана некорректна — такой размер отброшен", () => {
    const d = first(doc([drawing({ dimensions: [toCenter], furniture: { items: [S], dimensions: [toCenter] } })]))
    expect(d.dimensions).toEqual([])
    expect(d.furniture?.dimensions).toEqual([])
  })

  it("PST-08: поле, не являющееся объектом, читается как отсутствующее", () => {
    expect(first(doc([drawing({ plumbing: [1, 2] })])).plumbing).toBeUndefined()
  })

  it("PST-09: прочие планы не затронуты: стены, «Мебель» читаются из прежних полей", () => {
    const d = first(doc([drawing({ furniture: { items: [S], dimensions: [] }, plumbing: { dimensions: [toCenter] } })]))
    expect(d.walls).toEqual([W])
    expect(d.furniture).toEqual({ items: [S], dimensions: [] })
  })
})
