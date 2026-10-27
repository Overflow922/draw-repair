import { describe, expect, it } from "vitest"
import { activePlanOf } from "../plans"
import { parseStore, serializeStore } from "../storage"
import type { Callout, Drawing, DrawingStore, ExhaustFan, FurnitureItem, LightFixture, LightLine, LightSwitch, Wall } from "../types"

// change add-switching-plan, переработан в change merge-lighting-plans: метки, выключатели и вытяжки плана «Потолки и освещение» в
// документе версии 3 (spec drawing-storage «Метки, выключатели и вытяжки в документе», «Активный план чертежа в документе»;
// design D1, D2)

const W: Wall = { id: "w1", a: { x: 0, y: 0 }, b: { x: 500, y: 0 }, thicknessCm: 20, type: "brick" }
const T: FurnitureItem = { id: "t1", kind: "table", x: 200, y: 100, widthCm: 80, lengthCm: 160, angleDeg: 0 }
const L: LightFixture = { id: "l1", kind: "spot", x: 100, y: 100 }
const line: LightLine = { id: "m1", targetId: "l1", name: "L1" }
const sw: LightSwitch = { id: "s1", at: { x: 120, y: 0 }, angle: 90, keys: [{ lines: ["L1"] }] }
const fan: ExhaustFan = { id: "f1", x: 50, y: 60 }
const callout: Callout = { id: "c", target: { x: 1, y: 2 }, at: { x: 3, y: 4 }, text: "Выключатель у двери" }

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

describe("метки, выключатели и вытяжки в документе", () => {
  it("SW-50: выноска и примечание единого плана восстанавливаются из объектов плана ceiling", () => {
    const store: DrawingStore = { version: 3, activeId: "a", drawings: [drawing({ ceiling: { ceilings: [], callouts: [callout], notes: ["Первый"] } })] }
    const d = parseStore(serializeStore(store))?.store.drawings[0]
    expect(d?.ceiling?.callouts).toEqual([callout])
    expect(d?.ceiling?.notes).toEqual(["Первый"])
  })

  it("SW-51: освещение и мебель не копируются — в поле только метки, выключатели и вытяжки", () => {
    const store: DrawingStore = {
      version: 3,
      activeId: "a",
      drawings: [drawing({ furniture: { items: [T], dimensions: [] }, ceiling: { ceilings: [], lights: [L] }, switching: { lines: [line], switches: [sw], exhausts: [fan] } })],
    }
    const d = parseStore(serializeStore(store))?.store.drawings[0]
    expect(Object.keys(d?.switching ?? {}).sort()).toEqual(["exhausts", "lines", "switches"])
    expect(d?.switching).toEqual({ lines: [line], switches: [sw], exhausts: [fan] })
    expect(d?.ceiling?.lights).toEqual([L])
    expect(d?.furniture?.items).toEqual([T])
  })

  it("SW-52: старый документ без поля открывается без изменений, поле не появляется", () => {
    expect("switching" in first(doc([drawing()]))).toBe(false)
  })

  it("SW-53: выноска и примечание в поле прежнего плана игнорируются, документ рабочий, объекты восстановлены", () => {
    const d = first(doc([drawing({ switching: { callouts: [callout], notes: ["Первый"], lines: [line], exhausts: [fan] } })]))
    expect(d.switching).toEqual({ lines: [line], exhausts: [fan] })
    expect(d.ceiling?.callouts).toBeUndefined()
  })

  it("SW-53b: поле, не являющееся объектом, читается как отсутствующее", () => {
    expect("switching" in first(doc([drawing({ switching: [callout] })]))).toBe(false)
  })

  it("SW-54: активный план прежнего «Группы включения» (switching) читается как ceiling, объекты на месте", () => {
    const d = first(doc([drawing({ activePlan: "switching", switching: { lines: [line], switches: [sw], exhausts: [fan] } })]))
    expect(activePlanOf(d)).toBe("ceiling")
    expect(d.activePlan).toBe("ceiling")
    expect(d.switching).toEqual({ lines: [line], switches: [sw], exhausts: [fan] })
  })

  it("SW-54b: неизвестный идентификатор плана по-прежнему читается как обмерочный", () => {
    expect(activePlanOf(first(doc([drawing({ activePlan: "unknown-plan" })])))).toBe("measure")
  })

  it("SW-55: прочие планы читаются из прежних полей без изменений", () => {
    const furniture = { items: [T], dimensions: [], callouts: [callout] }
    const ceiling = { ceilings: [{ id: "c50", at: { x: 100, y: 100 }, dropMm: 50 }], lights: [L] }
    const plumbing = { dimensions: [], notes: ["Сантехника"] }
    const d = first(doc([drawing({ furniture, ceiling, plumbing, switching: { lines: [line] } })]))
    expect(d.furniture).toEqual(furniture)
    expect(d.ceiling).toEqual(ceiling)
    expect(d.plumbing).toEqual(plumbing)
  })
})
