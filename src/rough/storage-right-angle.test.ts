import { describe, expect, it } from "vitest"
import { parseStore, serializeStore } from "../storage"
import type { Drawing, DrawingStore, RightAngleMark, Wall } from "../types"

// change plaster-right-angle: пометки прямых углов в документе версии 3
// (spec drawing-storage «Прямые углы плана «Черновые работы» в документе»; design D3)

const W: Wall = { id: "w1", a: { x: 0, y: 0 }, b: { x: 500, y: 0 }, thicknessCm: 20, type: "brick" }
const angle: RightAngleMark = { id: "r1", corner: [{ markId: "p1", at: "to" }, { markId: "p2", at: "from" }] }

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

describe("прямые углы в документе", () => {
  it("RA-60: пометка восстанавливается с теми же идентификатором, ссылками и положениями", () => {
    expect(first(doc([drawing({ roughAngles: [angle] })])).roughAngles).toEqual([angle])
  })

  it("RA-60: круг serializeStore → parseStore сохраняет пометку; версия документа 3", () => {
    const store: DrawingStore = { version: 3, activeId: "a", drawings: [drawing({ roughAngles: [angle] })] }
    const parsed = parseStore(serializeStore(store))
    expect(parsed?.store.version).toBe(3)
    expect(parsed?.store.drawings[0]?.roughAngles).toEqual([angle])
  })

  it("RA-61: старый документ без списка — список не появляется", () => {
    const d = first(doc([drawing()]))
    expect("roughAngles" in d).toBe(false)
    expect(d.walls).toEqual([W])
  })

  it("RA-62: некорректные пометки отбрасываются по одной, корректная остаётся", () => {
    const bad = [
      { ...angle, id: "" },
      { id: "one", corner: [{ markId: "p1", at: "to" }] },
      { id: "three", corner: [{ markId: "p1", at: "to" }, { markId: "p2", at: "from" }, { markId: "p3", at: "to" }] },
      { id: "middle", corner: [{ markId: "p1", at: "middle" }, { markId: "p2", at: "from" }] },
      { id: "nomark", corner: [{ markId: "", at: "to" }, { markId: "p2", at: "from" }] },
      { id: "twice", corner: [{ markId: "p1", at: "through" }, { markId: "p2", at: "through" }] },
      { id: "nocorner" },
    ]
    expect(first(doc([drawing({ roughAngles: [...bad, angle] })])).roughAngles).toEqual([angle])
  })

  it("RA-62: пометка со ссылкой на одну сквозную полосу корректна", () => {
    const tee: RightAngleMark = { id: "t", corner: [{ markId: "p1", at: "through" }, { markId: "p2", at: "to" }] }
    expect(first(doc([drawing({ roughAngles: [tee] })])).roughAngles).toEqual([tee])
  })

  it("RA-63: пометка на отсутствующую штукатурку сохраняется, документ рабочий", () => {
    const d = first(doc([drawing({ roughPlaster: [], roughAngles: [angle] })]))
    expect(d.roughAngles).toEqual([angle])
  })

  it("RA-60: список — не список читается как отсутствие", () => {
    expect("roughAngles" in first(doc([drawing({ roughAngles: "x" })]))).toBe(false)
  })
})
