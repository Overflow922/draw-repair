import { describe, expect, it } from "vitest"
import { parseStore, serializeStore } from "../storage"
import type { Drawing, DrawingStore, LightLine, Wall } from "../types"

// change add-light-lines: метки линий освещения в документе версии 3
// (spec drawing-storage «Метки линий освещения в документе»; design D1)

const W: Wall = { id: "w1", a: { x: 0, y: 0 }, b: { x: 500, y: 0 }, thicknessCm: 20, type: "brick" }
const line = (id: string, targetId: string, name: string): LightLine => ({ id, targetId, name })

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

describe("метки линий освещения в документе", () => {
  it("LL-20: метки сохраняются в порядке постановки", () => {
    const lines = [line("1", "x", "L3"), line("2", "y", "L3"), line("3", "z", "L5")]
    const store: DrawingStore = { version: 3, activeId: "a", drawings: [drawing({ switching: { lines } })] }
    expect(parseStore(serializeStore(store))?.store.drawings[0]?.switching?.lines).toEqual(lines)
  })

  it("LL-21: битая метка отбрасывается по одной, остальные восстанавливаются", () => {
    const d = first(
      docOf({
        lines: [
          line("1", "x", "L0"),
          line("2", "x", "3"),
          line("3", "x", "L2.5"),
          line("4", "x", "LV0"), // TCR (change add-exhaust-fan): «LV1» теперь допустимое имя (drawing-storage «Метки линий освещения в документе»)
          line("5", "x", ""),
          { id: "6", name: "L3" },
          { targetId: "x", name: "L3" },
          line("7", "x", "L2"),
        ],
      }),
    )
    expect(d.switching?.lines).toEqual([line("7", "x", "L2")])
  })

  it("LL-22: метка без светильника не делает документ повреждённым и сохраняется", () => {
    const d = first(docOf({ lines: [line("1", "нет-такого", "L3")] }))
    expect(d.switching?.lines).toEqual([line("1", "нет-такого", "L3")])
  })

  it("LL-23: поле без списка меток читается без меток, список не дописывается", () => {
    const d = first(docOf({ notes: ["Первый"] }))
    expect(d.switching && "lines" in d.switching).toBe(false)
  })

  it("LL-24: старый документ без поля плана не получает поле", () => {
    expect("switching" in first(JSON.stringify({ version: 3, activeId: "a", drawings: [drawing()] }))).toBe(false)
  })

  it("LL-25: не-массив в поле lines читается как отсутствующий список", () => {
    const d = first(docOf({ lines: "L3" }))
    expect(d.switching && "lines" in d.switching).toBe(false)
  })
})
