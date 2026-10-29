import { describe, expect, it } from "vitest"
import { activePlanOf } from "../plans"
import { parseStore, serializeStore } from "../storage"
import type { Callout, Drawing, DrawingStore, FurnitureItem, LightSwitch, Wall } from "../types"

// change add-electrical-plan: выноски и примечания плана «Электрооборудование» в документе версии 3
// (spec drawing-storage «Объекты плана «Электрооборудование» в документе»; design D4)

const W: Wall = { id: "w1", a: { x: 0, y: 0 }, b: { x: 500, y: 0 }, thicknessCm: 20, type: "brick" }
const T: FurnitureItem = { id: "t1", kind: "table", x: 200, y: 100, widthCm: 80, lengthCm: 160, angleDeg: 0 }
const SW: LightSwitch = { id: "s1", at: { x: 100, y: 10 }, angle: 270, keys: [{ lines: ["L2"] }] }
const callout: Callout = { id: "c", target: { x: 1, y: 2 }, at: { x: 3, y: 4 }, text: "h=900" }

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

describe("объекты «Электрооборудования» в документе", () => {
  it("ES-01: выноска восстанавливается с той же точкой стрелки, точкой текста и текстом", () => {
    const store: DrawingStore = { version: 3, activeId: "a", drawings: [drawing({ electrical: { callouts: [callout] } })] }
    expect(parseStore(serializeStore(store))?.store.drawings[0]?.electrical?.callouts).toEqual([callout])
  })

  it("ES-02: примечания восстанавливаются в том же порядке", () => {
    const store: DrawingStore = { version: 3, activeId: "a", drawings: [drawing({ electrical: { notes: ["Первое", "Второе"] } })] }
    expect(parseStore(serializeStore(store))?.store.drawings[0]?.electrical?.notes).toEqual(["Первое", "Второе"])
  })

  it("ES-03: мебель и выключатели не копируются — в поле плана только выноски и примечания", () => {
    const store: DrawingStore = {
      version: 3,
      activeId: "a",
      drawings: [drawing({ furniture: { items: [T], dimensions: [] }, switching: { switches: [SW] }, electrical: { callouts: [callout], notes: ["Первое"] } })],
    }
    const d = parseStore(serializeStore(store))?.store.drawings[0]
    expect(Object.keys(d?.electrical ?? {}).sort()).toEqual(["callouts", "notes"])
    expect(d?.furniture?.items).toEqual([T])
    expect(d?.switching?.switches).toEqual([SW])
  })

  it("ES-04: старый документ без поля открывается без изменений, поле не появляется", () => {
    const d = first(doc([drawing()]))
    expect("electrical" in d).toBe(false)
  })

  it("ES-05: битая выноска и пустое примечание отбрасываются по одному, корректные восстановлены", () => {
    const bad = { id: "", target: { x: 1, y: 2 }, at: { x: 3, y: 4 }, text: "" }
    const d = first(doc([drawing({ electrical: { callouts: [bad, callout], notes: ["  ", "Первое", 5] } })]))
    expect(d.electrical?.callouts).toEqual([callout])
    expect(d.electrical?.notes).toEqual(["Первое"])
  })

  it("ES-06: поле, не являющееся объектом, читается как отсутствующее; документ рабочий", () => {
    for (const bad of [null, 5, "x", []]) {
      const d = first(doc([drawing({ electrical: bad })]))
      expect("electrical" in d).toBe(false)
      expect(d.walls).toEqual([W])
    }
  })

  it("ES-07: активный план electrical читается как допустимый и сохраняется", () => {
    expect(activePlanOf(first(doc([drawing({ activePlan: "electrical" })])))).toBe("electrical")
    const store: DrawingStore = { version: 3, activeId: "a", drawings: [drawing({ activePlan: "electrical" })] }
    expect(parseStore(serializeStore(store))?.store.drawings[0]?.activePlan).toBe("electrical")
  })
})
