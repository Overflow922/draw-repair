import { describe, expect, it } from "vitest"
import { activePlanOf } from "../plans"
import { parseStore, serializeStore } from "../storage"
import type { Callout, Drawing, DrawingStore, FurnitureItem, LightFixture, Wall } from "../types"

// change add-switching-plan: объекты плана «Группы включения» в документе версии 3
// (spec drawing-storage «Объекты плана «Группы включения» в документе»; design D2)

const W: Wall = { id: "w1", a: { x: 0, y: 0 }, b: { x: 500, y: 0 }, thicknessCm: 20, type: "brick" }
const T: FurnitureItem = { id: "t1", kind: "table", x: 200, y: 100, widthCm: 80, lengthCm: 160, angleDeg: 0 }
const L: LightFixture = { id: "l1", kind: "spot", x: 100, y: 100 }
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

describe("объекты «Групп включения» в документе", () => {
  it("SW-50: выноска и примечание восстанавливаются", () => {
    const store: DrawingStore = { version: 3, activeId: "a", drawings: [drawing({ switching: { callouts: [callout], notes: ["Первый"] } })] }
    const d = parseStore(serializeStore(store))?.store.drawings[0]
    expect(d?.switching?.callouts).toEqual([callout])
    expect(d?.switching?.notes).toEqual(["Первый"])
  })

  it("SW-51: освещение и мебель не копируются — в поле плана только выноски и примечания", () => {
    const store: DrawingStore = {
      version: 3,
      activeId: "a",
      drawings: [drawing({ furniture: { items: [T], dimensions: [] }, ceiling: { ceilings: [], lights: [L] }, switching: { callouts: [callout], notes: ["Первый"] } })],
    }
    const d = parseStore(serializeStore(store))?.store.drawings[0]
    expect(Object.keys(d?.switching ?? {}).sort()).toEqual(["callouts", "notes"])
    expect(d?.ceiling?.lights).toEqual([L])
    expect(d?.furniture?.items).toEqual([T])
  })

  it("SW-52: старый документ без поля открывается без изменений, поле не появляется", () => {
    expect("switching" in first(doc([drawing()]))).toBe(false)
  })

  it("SW-53: битая выноска отбрасывается, корректная восстановлена; поле не-объект читается как отсутствующее", () => {
    const bad = { id: "z", target: { x: 1, y: 1 }, text: "без точки текста" }
    expect(first(doc([drawing({ switching: { callouts: [bad, callout] } })])).switching?.callouts).toEqual([callout])
    expect("switching" in first(doc([drawing({ switching: [callout] })]))).toBe(false)
  })

  it("SW-54: активный план switching сохраняется и читается", () => {
    const store: DrawingStore = { version: 3, activeId: "a", drawings: [drawing({ activePlan: "switching" })] }
    const d = parseStore(serializeStore(store))?.store.drawings[0]
    expect(d && activePlanOf(d)).toBe("switching")
  })

  it("SW-55: прочие планы читаются из прежних полей без изменений", () => {
    const furniture = { items: [T], dimensions: [], callouts: [callout] }
    const ceiling = { ceilings: [{ id: "c50", at: { x: 100, y: 100 }, dropMm: 50 }], lights: [L] }
    const plumbing = { dimensions: [], notes: ["Сантехника"] }
    const d = first(doc([drawing({ furniture, ceiling, plumbing, switching: { notes: ["Группы"] } })]))
    expect(d.furniture).toEqual(furniture)
    expect(d.ceiling).toEqual(ceiling)
    expect(d.plumbing).toEqual(plumbing)
  })
})
