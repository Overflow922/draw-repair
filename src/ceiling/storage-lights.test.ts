import { describe, expect, it } from "vitest"
import { parseStore, serializeStore } from "../storage"
import type { Drawing, DrawingStore, LightFixture, StretchCeiling, Wall } from "../types"
import { storedCeiling } from "./ceiling-workspace"

// change add-ceiling-lighting: объекты освещения в поле плана «Потолки и освещение»
// (spec drawing-storage «Объекты плана «Потолки и освещение» в документе»; design D1)

const W: Wall = { id: "w1", a: { x: 0, y: 0 }, b: { x: 500, y: 0 }, thicknessCm: 20, type: "brick" }
const C50: StretchCeiling = { id: "c50", at: { x: 100, y: 100 }, dropMm: 50 }
const CHANDELIER: LightFixture = { id: "l1", kind: "chandelier", x: 200, y: 150 }
const SCONCE: LightFixture = { id: "l2", kind: "sconce", x: 120, y: 0, angleDeg: 90 }

const drawing = (extra: Record<string, unknown> = {}): Drawing =>
  ({ id: "a", name: "Чертёж 1", walls: [W], dimensions: [], view: { zoom: 1, pan: { x: 0, y: 0 } }, ...extra }) as Drawing

const doc = (drawings: Drawing[]): string => JSON.stringify({ version: 3, activeId: drawings[0]?.id ?? "", drawings })

const first = (raw: string): Drawing => {
  const parsed = parseStore(raw)
  expect(parsed?.readOnly).toBe(false)
  const [d] = parsed?.store.drawings ?? []
  if (!d) throw new Error("в документе нет чертежей")
  return d
}

describe("объекты освещения в документе", () => {
  it("CL-S1: люстра и бра восстанавливаются с видами, центрами и направлением бра", () => {
    const store: DrawingStore = { version: 3, activeId: "a", drawings: [drawing({ ceiling: { ceilings: [C50], lights: [CHANDELIER, SCONCE] } })] }
    const d = parseStore(serializeStore(store))?.store.drawings[0]
    expect(d?.ceiling?.lights).toEqual([CHANDELIER, SCONCE])
    expect(d?.ceiling?.ceilings).toEqual([C50])
  })

  it("CL-S2: документ без объектов освещения — потолки на месте, списка нет", () => {
    const d = first(doc([drawing({ ceiling: { ceilings: [C50] } })]))
    expect(d.ceiling?.ceilings).toEqual([C50])
    expect(d.ceiling && "lights" in d.ceiling).toBe(false)
  })

  it("CL-S3: битые объекты отбрасываются по одному, корректный восстановлен, потолки не затронуты", () => {
    const bad = [
      { id: "k", kind: "lamp", x: 1, y: 1 },
      { id: "f", kind: "spot", x: 10.5, y: 1 },
      { id: "s", kind: "sconce", x: 1, y: 1 },
      { id: "i", kind: "sconce", x: 1, y: 1, angleDeg: Infinity },
      { kind: "spot", x: 1, y: 1 },
      { id: "", kind: "spot", x: 1, y: 1 },
      { id: "n", kind: "spot", x: "1", y: 1 },
      null,
    ]
    const ok: LightFixture = { id: "ok", kind: "spot", x: 100, y: 80 }
    const d = first(doc([drawing({ ceiling: { ceilings: [C50], lights: [...bad, ok] } })]))
    expect(d.ceiling?.lights).toEqual([ok])
    expect(d.ceiling?.ceilings).toEqual([C50])
  })

  it("CL-S4: пустой список не записывается в план; правка потолков сохраняет объекты; список не-массив читается как отсутствие", () => {
    const d0 = drawing({ ceiling: { ceilings: [C50] } })
    expect(storedCeiling([C50], d0, [])).toEqual({ ceilings: [C50] })
    const d1 = drawing({ ceiling: { ceilings: [C50], lights: [CHANDELIER] } })
    expect(storedCeiling([], d1)).toEqual({ ceilings: [], lights: [CHANDELIER] })
    expect(storedCeiling([C50], d1, [])).toEqual({ ceilings: [C50] })
    const d = first(doc([drawing({ ceiling: { ceilings: [], lights: "x" } })]))
    expect(d.ceiling && "lights" in d.ceiling).toBe(false)
  })

  it("CL-S5: все пять видов читаются; центр бра может быть дробным; у точки лишний угол не сохраняется", () => {
    const lights = [
      { id: "1", kind: "spot", x: 1, y: 2 },
      { id: "2", kind: "smoke-detector", x: 3, y: 4 },
      { id: "3", kind: "chandelier", x: 5, y: 6 },
      { id: "4", kind: "sconce", x: 7, y: 7.5, angleDeg: -45 },
      { id: "5", kind: "lighting-outlet", x: 9, y: 10, angleDeg: 30 },
    ]
    const d = first(doc([drawing({ ceiling: { ceilings: [], lights } })]))
    expect(d.ceiling?.lights).toEqual([
      { id: "1", kind: "spot", x: 1, y: 2 },
      { id: "2", kind: "smoke-detector", x: 3, y: 4 },
      { id: "3", kind: "chandelier", x: 5, y: 6 },
      { id: "4", kind: "sconce", x: 7, y: 7.5, angleDeg: -45 },
      { id: "5", kind: "lighting-outlet", x: 9, y: 10 },
    ])
  })
})
