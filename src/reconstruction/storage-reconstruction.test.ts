import { describe, expect, it } from "vitest"
import { activePlanOf } from "../plans"
import { parseStore, serializeStore } from "../storage"
import type { Dimension, Drawing, DrawingStore, Wall } from "../types"
import { drywall } from "./reconstruction.test-utils"

// change reconstruction-plan: объекты плана «Реконструкция» в документе версии 3
// (spec drawing-storage «Объекты плана «Реконструкция» в документе»; design D7)

const W: Wall = { id: "w1", a: { x: 0, y: 0 }, b: { x: 500, y: 0 }, thicknessCm: 20, type: "brick" }
const G = drywall("g1", 0, 40, 300, 40, 10, 270)
const stored = { id: "g1", a: { x: 0, y: 40 }, b: { x: 300, y: 40 }, thicknessCm: 10, heightCm: 270 }
const dim: Dimension = { from: { a: { wallId: "g1", edge: 0 }, b: { wallId: "w1", edge: 1 } }, to: { a: { wallId: "g1", edge: 2 }, b: { wallId: "w1", edge: 3 } }, offset: 20 }

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

describe("объекты «Реконструкции» в документе", () => {
  it("RC-90: стена ГКЛ восстанавливается без потерь: идентификатор, концы, толщина, высота", () => {
    const d = first(doc([drawing({ reconstruction: { walls: [stored], dimensions: [] } })]))
    expect(d.reconstruction?.walls).toEqual([G])
  })

  it("RC-90: круг serializeStore → parseStore сохраняет стены, размеры, активный план и обмер", () => {
    const store: DrawingStore = { version: 3, activeId: "a", drawings: [drawing({ activePlan: "reconstruction", reconstruction: { walls: [G], dimensions: [dim] } })] }
    const d = parseStore(serializeStore(store))?.store.drawings[0]
    expect(d?.reconstruction?.walls).toEqual([G])
    expect(d?.reconstruction?.dimensions).toEqual([dim])
    expect(d ? activePlanOf(d) : null).toBe("reconstruction")
    expect(d?.walls).toEqual([W])
  })

  it("RC-90: формат документа остаётся версии 3", () => {
    expect(parseStore(doc([drawing({ reconstruction: { walls: [stored], dimensions: [] } })]))?.store.version).toBe(3)
  })

  it("RC-90: тип стены в документе игнорируется — стена ГКЛ читается как «ГКЛ»", () => {
    const d = first(doc([drawing({ reconstruction: { walls: [{ ...stored, type: "brick" }], dimensions: [] } })]))
    expect(d.reconstruction?.walls[0]?.type).toBe("gkl")
  })

  it("RC-91: старый документ без поля — поле не появляется", () => {
    const d = first(doc([drawing()]))
    expect("reconstruction" in d).toBe(false)
    expect(d.walls).toEqual([W])
  })

  it("RC-92: некорректные стены отбрасываются по одной, корректная и размер восстанавливаются", () => {
    const bad = [
      { ...stored, id: "b1", heightCm: 0 },
      { ...stored, id: "b2", heightCm: -5 },
      { ...stored, id: "b3", heightCm: "250" },
      { id: "b4", a: stored.a, b: stored.b, thicknessCm: 10 },
      { ...stored, id: "" },
      { ...stored, id: "b6", thicknessCm: 0 },
      { ...stored, id: "b7", a: { x: "0", y: 40 } },
    ]
    const d = first(doc([drawing({ reconstruction: { walls: [...bad, stored], dimensions: [dim] } })]))
    expect(d.reconstruction?.walls).toEqual([G])
    expect(d.reconstruction?.dimensions).toEqual([dim])
  })

  it("RC-93: размер на стену, которой нет, сохраняется", () => {
    const ghost: Dimension = { ...dim, from: { a: { wallId: "нет", edge: 0 }, b: { wallId: "w1", edge: 1 } } }
    const d = first(doc([drawing({ reconstruction: { walls: [stored], dimensions: [ghost] } })]))
    expect(d.reconstruction?.dimensions).toEqual([ghost])
  })

  it("RC-93: размер не по формату отбрасывается", () => {
    const d = first(doc([drawing({ reconstruction: { walls: [stored], dimensions: [{ offset: 1 }, dim] } })]))
    expect(d.reconstruction?.dimensions).toEqual([dim])
  })

  it("RC-94: выноски и примечания плана читаются по общим правилам, битые отбрасываются", () => {
    const callout = { id: "c", target: { x: 1, y: 2 }, at: { x: 3, y: 4 }, text: "Обшить" }
    const d = first(doc([drawing({ reconstruction: { walls: [], dimensions: [], callouts: [callout, { id: "x" }], notes: ["Первый", "Второй"] } })]))
    expect(d.reconstruction?.callouts).toEqual([callout])
    expect(d.reconstruction?.notes).toEqual(["Первый", "Второй"])
  })

  it("RC-95: поле не объект или без списка стен не делает документ повреждённым", () => {
    for (const bad of [5, "x", null, [], { walls: 3, dimensions: 4 }]) {
      const d = first(doc([drawing({ reconstruction: bad })]))
      expect(d.walls).toEqual([W])
      expect(d.reconstruction?.walls ?? []).toEqual([])
    }
  })

  it("RC-96: прочие планы не затронуты: стены, размеры, штукатурка, «Монтаж» читаются из прежних полей", () => {
    const own: Wall = { id: "n1", a: { x: 0, y: 100 }, b: { x: 0, y: 400 }, thicknessCm: 10, type: "brick" }
    const plaster = { id: "p1", wallId: "w1", face: 1, anchor: "a", fromCm: 100, toCm: 300, thicknessMm: 20 }
    const d = first(doc([drawing({ mounting: { walls: [own], dimensions: [] }, roughPlaster: [plaster], reconstruction: { walls: [stored], dimensions: [] } })]))
    expect(d.walls).toEqual([W])
    expect(d.mounting?.walls).toEqual([own])
    expect(d.roughPlaster).toEqual([plaster])
  })

  it("RC-97: идентификатор активного плана reconstruction допустим; неизвестный читается как обмерочный", () => {
    expect(activePlanOf(first(doc([drawing({ activePlan: "reconstruction" })])))).toBe("reconstruction")
    expect(activePlanOf(first(doc([drawing({ activePlan: "reconstruction2" })])))).toBe("measure")
  })

  it("RC-98: подложка и значения панели в документе не хранятся", () => {
    const store: DrawingStore = { version: 3, activeId: "a", drawings: [drawing({ reconstruction: { walls: [G], dimensions: [] } })] }
    const raw = serializeStore(store)
    expect(raw).not.toContain("underlay")
    expect(raw).not.toContain("obstacles")
    expect(Object.keys(JSON.parse(raw).drawings[0].reconstruction).sort()).toEqual(["dimensions", "walls"])
  })
})
