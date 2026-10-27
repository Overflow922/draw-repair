import { describe, expect, it } from "vitest"
import { parseStore, serializeStore } from "../storage"
import type { Drawing, DrawingStore, LightSwitch, Wall } from "../types"

// change add-light-switch: выключатели в документе версии 3 (spec drawing-storage «Выключатели в документе»; design D1)

const W: Wall = { id: "w1", a: { x: 0, y: 0 }, b: { x: 500, y: 0 }, thicknessCm: 20, type: "brick" }
const sw = (id: string, keys: string[][] = [["L2"]], extra: Record<string, unknown> = {}): LightSwitch =>
  ({ id, at: { x: 120, y: -10 }, angle: -90, keys: keys.map((lines) => ({ lines })), ...extra }) as LightSwitch

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

describe("выключатели в документе", () => {
  it("LS-20: блок из трёх клавиш сохраняется с центром, направлением и линиями", () => {
    const switches = [sw("s1", [["L2", "LV1"], ["L3"], ["L4", "L5"]]), sw("s2", [[]])]
    const store: DrawingStore = { version: 3, activeId: "a", drawings: [drawing({ switching: { switches } })] }
    expect(parseStore(serializeStore(store))?.store.drawings[0]?.switching?.switches).toEqual(switches)
  })

  it("LS-21: битые выключатели отбрасываются целиком, корректный восстанавливается", () => {
    const d = first(
      docOf({
        switches: [
          sw("a", []),
          sw("b", [["L1"], ["L1"], ["L1"], ["L1"], ["L1"], ["L1"], ["L1"]]),
          sw("c", [["L0"]]),
          sw("d", [["L2", "L2"]]),
          sw("e", [["abc"]]),
          sw("f", [["l2"]]),
          sw("g", [["L1"]], { id: "" }),
          sw("h", [["L1"]], { at: { x: "1", y: 0 } }),
          sw("i", [["L1"]], { angle: "90" }),
          sw("j", [["L1"]], { keys: [{ lines: "L1" }] }),
          sw("k", [["L1"]], { keys: "L1" }),
          sw("ok", [["L2"], ["LV1"]]),
        ],
      }),
    )
    expect(d.switching?.switches).toEqual([sw("ok", [["L2"], ["LV1"]])])
  })

  it("LS-22: выключатель без стены под ним сохраняется на прежнем месте", () => {
    const d = first(docOf({ switches: [sw("s1", [["L2"]], { at: { x: 5000, y: 5000 } })] }))
    expect(d.switching?.switches?.[0]?.at).toEqual({ x: 5000, y: 5000 })
  })

  it("LS-23: поле без списка читается без выключателей, список не дописывается", () => {
    const d = first(docOf({ notes: ["Первый"] }))
    expect(d.switching && "switches" in d.switching).toBe(false)
  })

  it("LS-24: пустой и не-массив читаются как отсутствующий список", () => {
    expect(first(docOf({ switches: [] })).switching && "switches" in (first(docOf({ switches: [] })).switching ?? {})).toBe(false)
    const d = first(docOf({ switches: "x" }))
    expect(d.switching && "switches" in d.switching).toBe(false)
  })

  it("LS-25: выключатели читаются вместе с метками линий", () => {
    const lines = [{ id: "l", targetId: "t", name: "L2" }]
    const d = first(docOf({ lines, switches: [sw("s1")] }))
    expect(d.switching?.lines).toEqual(lines)
    expect(d.switching?.switches).toEqual([sw("s1")])
  })

  it("LS-26: старый документ без поля плана не получает поле", () => {
    expect("switching" in first(JSON.stringify({ version: 3, activeId: "a", drawings: [drawing()] }))).toBe(false)
  })
})
