import { describe, expect, it } from "vitest"
import { parseStore, serializeStore } from "../storage"
import type { Drawing, DrawingStore, ExhaustFan, Wall } from "../types"

// change add-exhaust-fan: вытяжки и метки LV<n> в документе версии 3
// (spec drawing-storage «Вытяжки в документе», «Метки линий освещения в документе»)

const W: Wall = { id: "w1", a: { x: 0, y: 0 }, b: { x: 500, y: 0 }, thicknessCm: 20, type: "brick" }
const fan = (id: string, x = 100, y = 80): ExhaustFan => ({ id, x, y })
const drawing = (extra: Record<string, unknown> = {}): Drawing =>
  ({ id: "a", name: "Чертёж 1", walls: [W], dimensions: [], view: { zoom: 1, pan: { x: 0, y: 0 } }, ...extra }) as Drawing

const first = (raw: string): Drawing => {
  const parsed = parseStore(raw)
  expect(parsed).not.toBeNull()
  expect(parsed?.readOnly).toBe(false)
  const [d] = parsed?.store.drawings ?? []
  if (!d) throw new Error("в документе нет чертежей")
  return d
}

const docOf = (switching: unknown): string => JSON.stringify({ version: 3, activeId: "a", drawings: [drawing({ switching })] })

describe("вытяжки в документе", () => {
  it("вытяжка сохраняется с тем же центром и порядком", () => {
    const exhausts = [fan("f1"), fan("f2", -10, 5)]
    const store: DrawingStore = { version: 3, activeId: "a", drawings: [drawing({ switching: { exhausts } })] }
    expect(parseStore(serializeStore(store))?.store.drawings[0]?.switching?.exhausts).toEqual(exhausts)
  })

  it("битая вытяжка отбрасывается по одной, корректная восстанавливается", () => {
    const d = first(docOf({ exhausts: [{ id: "a", x: 10.5, y: 3 }, { x: 1, y: 2 }, { id: "", x: 1, y: 2 }, { id: "c", x: "1", y: 2 }, fan("ok")] }))
    expect(d.switching?.exhausts).toEqual([fan("ok")])
  })

  it("вытяжка внутри стены не делает документ повреждённым", () => {
    expect(first(docOf({ exhausts: [fan("in", 100, 0)] })).switching?.exhausts).toEqual([fan("in", 100, 0)])
  })

  it("поле без списка вытяжек читается без вытяжек и не дописывается", () => {
    expect(first(docOf({ notes: ["n"] })).switching).toEqual({ notes: ["n"] })
  })

  it("пустой список не восстанавливается как поле", () => {
    expect(first(docOf({ exhausts: [] })).switching).toEqual({})
  })
})

describe("метки вытяжек в документе", () => {
  it("метка LV1 вытяжки сохраняется", () => {
    const lines = [{ id: "l1", targetId: "f1", name: "LV1" }]
    const store: DrawingStore = { version: 3, activeId: "a", drawings: [drawing({ switching: { exhausts: [fan("f1")], lines } })] }
    expect(parseStore(serializeStore(store))?.store.drawings[0]?.switching?.lines).toEqual(lines)
  })

  it("метка LV1 на светильнике не делает документ повреждённым и хранится", () => {
    const lines = [{ id: "l1", targetId: "spot", name: "LV1" }]
    expect(first(docOf({ lines })).switching?.lines).toEqual(lines)
  })

  it("недопустимые имена отбрасываются", () => {
    const lines = ["LV0", "LL1", "LV", "L0"].map((name, i) => ({ id: String(i), targetId: "f", name }))
    expect(first(docOf({ lines })).switching?.lines).toBeUndefined()
  })
})
