import { describe, expect, it } from "vitest"
import { activePlanOf } from "../plans"
import { parseStore, serializeStore } from "../storage"
import type { Drawing, DrawingStore, PlasterMark, Screed, Wall } from "../types"

// change add-rough-works-plan: пометки штукатурки и стяжки в документе версии 3
// (spec drawing-storage «Объекты плана «Черновые работы» в документе»; design D7)

const W: Wall = { id: "w1", a: { x: 0, y: 0 }, b: { x: 500, y: 0 }, thicknessCm: 20, type: "brick" }
const own: Wall = { id: "n1", a: { x: 0, y: 100 }, b: { x: 0, y: 400 }, thicknessCm: 10, type: "brick" }
const plaster: PlasterMark = { id: "p1", wallId: "w1", face: 1, anchor: "a", fromCm: 100, toCm: 300, thicknessMm: 20 }
const screed: Screed = { id: "s1", at: { x: 210, y: 170 }, thicknessMm: 65 }

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

describe("объекты «Черновых работ» в документе", () => {
  it("RW-80: пометка штукатурки и стяжка восстанавливаются без потерь", () => {
    const d = first(doc([drawing({ roughPlaster: [plaster], roughScreeds: [screed] })]))
    expect(d.roughPlaster).toEqual([plaster])
    expect(d.roughScreeds).toEqual([screed])
  })

  it("RW-80: круг serializeStore → parseStore сохраняет объекты, активный план и обмер", () => {
    const store: DrawingStore = { version: 3, activeId: "a", drawings: [drawing({ activePlan: "rough", roughPlaster: [plaster], roughScreeds: [screed] })] }
    const d = parseStore(serializeStore(store))?.store.drawings[0]
    expect(d?.roughPlaster).toEqual([plaster])
    expect(d?.roughScreeds).toEqual([screed])
    expect(d ? activePlanOf(d) : null).toBe("rough")
    expect(d?.walls).toEqual([W])
  })

  it("RW-80: формат документа остаётся версии 3", () => {
    expect(parseStore(doc([drawing({ roughPlaster: [plaster] })]))?.store.version).toBe(3)
  })

  it("RW-81: старый документ без списков — списки не появляются", () => {
    const d = first(doc([drawing()]))
    expect("roughPlaster" in d).toBe(false)
    expect("roughScreeds" in d).toBe(false)
    expect("roughCallouts" in d).toBe(false)
    expect("roughNotes" in d).toBe(false)
    expect(d.walls).toEqual([W])
  })

  it("RW-82: некорректные пометки штукатурки отбрасываются по одной", () => {
    const bad = [
      { ...plaster, id: "" },
      { ...plaster, id: "f0", face: 0 },
      { ...plaster, id: "an", anchor: "c" },
      { ...plaster, id: "nan", fromCm: "x" },
      { ...plaster, id: "neg", fromCm: -1 },
      { ...plaster, id: "eq", fromCm: 100, toCm: 100 },
      { ...plaster, id: "t0", thicknessMm: 0 },
      { ...plaster, id: "t101", thicknessMm: 101 },
      { ...plaster, id: "tf", thicknessMm: 2.5 },
      { ...plaster, id: "nw", wallId: "" },
    ]
    const d = first(doc([drawing({ roughPlaster: [...bad, plaster] })]))
    expect(d.roughPlaster).toEqual([plaster])
  })

  it("RW-82: некорректные стяжки отбрасываются по одной", () => {
    const bad = [
      { ...screed, id: "" },
      { ...screed, id: "t5", thicknessMm: 5 },
      { ...screed, id: "t201", thicknessMm: 201 },
      { ...screed, id: "tf", thicknessMm: 65.5 },
      { ...screed, id: "pt", at: { x: "a", y: 1 } },
      { ...screed, id: "no", at: null },
    ]
    const d = first(doc([drawing({ roughScreeds: [...bad, screed] })]))
    expect(d.roughScreeds).toEqual([screed])
  })

  it("RW-83: пересекающиеся участки одной грани сливаются при загрузке", () => {
    const d = first(doc([drawing({ roughPlaster: [{ ...plaster, id: "p", fromCm: 100, toCm: 200 }, { ...plaster, id: "q", fromCm: 150, toCm: 300 }] })]))
    expect(d.roughPlaster).toEqual([{ ...plaster, id: "p", fromCm: 100, toCm: 300 }])
  })

  it("RW-84: пометка на отсутствующую стену сохраняется", () => {
    const d = first(doc([drawing({ roughPlaster: [{ ...plaster, wallId: "gone" }] })]))
    expect(d.roughPlaster).toEqual([{ ...plaster, wallId: "gone" }])
  })

  it("RW-84: пометка на собственную стену «Монтажа» сохраняется и не считается битой", () => {
    const d = first(doc([drawing({ mounting: { walls: [own], dimensions: [] }, roughPlaster: [{ ...plaster, wallId: "n1" }] })]))
    expect(d.roughPlaster).toHaveLength(1)
  })

  it("RW-85: стяжка с опорной точкой вне помещений сохраняется (проверка помещений — при отрисовке)", () => {
    const d = first(doc([drawing({ roughScreeds: [{ ...screed, at: { x: 9999, y: 9999 } }] })]))
    expect(d.roughScreeds).toHaveLength(1)
  })

  it("RW-86: поле, не являющееся списком, читается как отсутствующее; остальное загружается", () => {
    const d = first(doc([drawing({ roughPlaster: "x", roughScreeds: { a: 1 } })]))
    expect("roughPlaster" in d).toBe(false)
    expect("roughScreeds" in d).toBe(false)
    expect(d.walls).toEqual([W])
  })

  it("RW-87: выноски и примечания плана хранятся в своих списках и не смешиваются с другими планами", () => {
    const callout = { id: "c", target: { x: 1, y: 2 }, at: { x: 3, y: 4 }, text: "Грунт" }
    const d = first(doc([drawing({ roughCallouts: [callout], roughNotes: ["Первый", "  ", 5, "Второй"], callouts: [], notes: ["обмер"] })]))
    expect(d.roughCallouts).toEqual([callout])
    expect(d.roughNotes).toEqual(["Первый", "Второй"])
    expect(d.notes).toEqual(["обмер"])
    expect(d.callouts).toEqual([])
  })

  it("RW-88: идентификатор активного плана rough читается как допустимый", () => {
    expect(activePlanOf(first(doc([drawing({ activePlan: "rough" })])))).toBe("rough")
  })

  it("RW-89: объекты «Монтажа», сноса и помещений не затронуты", () => {
    const rooms = [{ number: 1, name: "Кухня", heightMm: 2700, anchor: { x: 1, y: 1 } }]
    const d = first(doc([drawing({ rooms, mounting: { walls: [own], dimensions: [] }, roughPlaster: [plaster] })]))
    expect(d.rooms).toEqual(rooms)
    expect(d.mounting?.walls).toEqual([own])
  })
})
