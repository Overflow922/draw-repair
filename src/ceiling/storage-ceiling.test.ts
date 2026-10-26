import { describe, expect, it } from "vitest"
import { activePlanOf } from "../plans"
import { parseStore, serializeStore } from "../storage"
import type { Callout, Drawing, DrawingStore, FurnitureItem, StretchCeiling, Wall } from "../types"

// change add-ceiling-plan: объекты плана «Потолки и освещение» в документе версии 3
// (spec drawing-storage «Объекты плана «Потолки и освещение» в документе»; design D2)

const W: Wall = { id: "w1", a: { x: 0, y: 0 }, b: { x: 500, y: 0 }, thicknessCm: 20, type: "brick" }
const T: FurnitureItem = { id: "t1", kind: "table", x: 200, y: 100, widthCm: 80, lengthCm: 160, angleDeg: 0 }
const C50: StretchCeiling = { id: "c50", at: { x: 100, y: 100 }, dropMm: 50 }
const C80: StretchCeiling = { id: "c80", at: { x: 300, y: 200 }, dropMm: 80 }
const callout: Callout = { id: "c", target: { x: 1, y: 2 }, at: { x: 3, y: 4 }, text: "Светильник" }

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

describe("объекты «Потолков и освещения» в документе", () => {
  it("CP-40: потолок восстанавливается с той же опорной точкой и опусканием; порядок списка сохраняется", () => {
    const store: DrawingStore = { version: 3, activeId: "a", drawings: [drawing({ ceiling: { ceilings: [C50, C80] } })] }
    const d = parseStore(serializeStore(store))?.store.drawings[0]
    expect(d?.ceiling?.ceilings).toEqual([C50, C80])
    const reversed = parseStore(serializeStore({ ...store, drawings: [drawing({ ceiling: { ceilings: [C80, C50] } })] }))?.store.drawings[0]
    expect(reversed?.ceiling?.ceilings.map((c) => c.id)).toEqual(["c80", "c50"])
  })

  it("CP-41: мебель не копируется — в поле плана только потолки, выноски и примечания", () => {
    const store: DrawingStore = {
      version: 3,
      activeId: "a",
      drawings: [drawing({ furniture: { items: [T], dimensions: [] }, ceiling: { ceilings: [C50], callouts: [callout], notes: ["Первый"] } })],
    }
    const d = parseStore(serializeStore(store))?.store.drawings[0]
    expect(Object.keys(d?.ceiling ?? {}).sort()).toEqual(["callouts", "ceilings", "notes"])
    expect(d?.ceiling?.callouts).toEqual([callout])
    expect(d?.ceiling?.notes).toEqual(["Первый"])
    expect(d?.furniture?.items).toEqual([T])
  })

  it("CP-42: старый документ без поля открывается без изменений, поле не появляется", () => {
    const d = first(doc([drawing()]))
    expect("ceiling" in d).toBe(false)
  })

  it("CP-43: битые потолки отбрасываются по одному, корректный восстановлен; документ рабочий", () => {
    const bad = [
      { id: "z", at: { x: 1, y: 1 }, dropMm: 0 },
      { id: "f", at: { x: 1, y: 1 }, dropMm: 2.5 },
      { id: "n", at: { x: 1, y: 1 }, dropMm: -50 },
      { id: "s", at: { x: 1, y: 1 }, dropMm: "50" },
      { at: { x: 1, y: 1 }, dropMm: 50 },
      { id: "", at: { x: 1, y: 1 }, dropMm: 50 },
      { id: "p", at: { x: "1", y: 1 }, dropMm: 50 },
      { id: "q", dropMm: 50 },
      null,
    ]
    const d = first(doc([drawing({ ceiling: { ceilings: [...bad, C50] } })]))
    expect(d.ceiling?.ceilings).toEqual([C50])
  })

  it("CP-44: потолок вне помещений сохраняется; поле не-объект и список не-массив читаются как пустой план", () => {
    expect(first(doc([drawing({ ceiling: { ceilings: [{ id: "x", at: { x: 9000, y: 9000 }, dropMm: 50 }] } })])).ceiling?.ceilings).toHaveLength(1)
    expect("ceiling" in first(doc([drawing({ ceiling: [C50] })]))).toBe(false)
    expect(first(doc([drawing({ ceiling: { ceilings: "x" } })])).ceiling?.ceilings).toEqual([])
  })

  it("CP-45: активный план ceiling сохраняется и читается", () => {
    const store: DrawingStore = { version: 3, activeId: "a", drawings: [drawing({ activePlan: "ceiling" })] }
    const d = parseStore(serializeStore(store))?.store.drawings[0]
    expect(d && activePlanOf(d)).toBe("ceiling")
  })

  it("CP-46: прочие планы читаются из прежних полей без изменений", () => {
    const furniture = { items: [T], dimensions: [], callouts: [callout] }
    const plumbing = { dimensions: [], notes: ["Сантехника"] }
    const roughScreeds = [{ id: "s", at: { x: 100, y: 100 }, thicknessMm: 65 }]
    const d = first(doc([drawing({ furniture, plumbing, roughScreeds, ceiling: { ceilings: [C50] } })]))
    expect(d.furniture).toEqual(furniture)
    expect(d.plumbing).toEqual(plumbing)
    expect(d.roughScreeds).toEqual(roughScreeds)
  })
})
