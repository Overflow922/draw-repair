import { describe, expect, it } from "vitest"
import { isCommunication, parseStore, serializeStore } from "../storage"
import type { Drawing, DrawingStore, View, Wall } from "../types"

// change add-communications: поле communications чертежа в документе версии 3
// (spec communications «Коммуникации в документе»; test-plan CO-*).

const wallW: Wall = { id: "w1", a: { x: 0, y: 0 }, b: { x: 500, y: 0 }, thicknessCm: 20, type: "brick" }
const view: View = { zoom: 1.5, pan: { x: -10, y: 20 } }
const R = { kind: "riser", id: "r1", x: 100, y: 100, diameterCm: 11 }
const D = { kind: "duct", id: "d1", x: 200, y: 150, widthCm: 30, depthCm: 20 }

const drawing = (extra: Record<string, unknown> = {}): Drawing =>
  ({ id: "a", name: "Чертёж 1", walls: [wallW], dimensions: [], view, ...extra }) as Drawing

const doc = (drawings: Drawing[]): string => JSON.stringify({ version: 3, activeId: drawings[0]?.id ?? "", drawings })

const first = (raw: string): Drawing => {
  const parsed = parseStore(raw)
  expect(parsed).not.toBeNull()
  expect(parsed?.readOnly).toBe(false)
  const [d] = parsed?.store.drawings ?? []
  if (!d) throw new Error("в документе нет чертежей")
  return d
}

describe("isCommunication", () => {
  it("CO-04: корректные стояк и воздуховод принимаются", () => {
    expect(isCommunication(R)).toBe(true)
    expect(isCommunication(D)).toBe(true)
  })

  it("CO-04b: без идентификатора, пустой идентификатор, неизвестный вид, нечисловые координаты — отвергаются", () => {
    const { id: _id, ...noId } = R
    expect(isCommunication(noId)).toBe(false)
    expect(isCommunication({ ...R, id: "" })).toBe(false)
    expect(isCommunication({ ...R, kind: "pipe" })).toBe(false)
    expect(isCommunication({ ...D, kind: "pipe" })).toBe(false) // неизвестный вид с полями воздуховода
    expect(isCommunication({ ...R, kind: "duct" })).toBe(false) // вид воздуховода с полями стояка
    expect(isCommunication({ ...R, kind: undefined })).toBe(false)
    expect(isCommunication({ ...R, x: "100" })).toBe(false)
    expect(isCommunication({ ...R, y: NaN })).toBe(false)
    expect(isCommunication({ ...R, x: Infinity })).toBe(false)
  })

  it("CO-04c: размер не больше 0 или нечисловой — отвергается", () => {
    expect(isCommunication({ ...R, diameterCm: 0 })).toBe(false)
    expect(isCommunication({ ...R, diameterCm: -1 })).toBe(false)
    expect(isCommunication({ ...R, diameterCm: "11" })).toBe(false)
    expect(isCommunication({ ...D, widthCm: 0 })).toBe(false)
    expect(isCommunication({ ...D, depthCm: -5 })).toBe(false)
    expect(isCommunication({ ...D, depthCm: null })).toBe(false)
  })

  it("CO-04d: стояк без диаметра и воздуховод без габарита отвергаются; не объекты — тоже", () => {
    const { diameterCm: _d, ...noDiameter } = R
    expect(isCommunication(noDiameter)).toBe(false)
    const { widthCm: _w, ...noWidth } = D
    expect(isCommunication(noWidth)).toBe(false)
    for (const v of [null, undefined, 5, "riser", []]) expect(isCommunication(v)).toBe(false)
  })

  it("CO-04e: поле размера другого вида не заменяет своё (у стояка нет ширины, у воздуховода — диаметра)", () => {
    expect(isCommunication({ kind: "riser", id: "r", x: 0, y: 0, widthCm: 30, depthCm: 20 })).toBe(false)
    expect(isCommunication({ kind: "duct", id: "d", x: 0, y: 0, diameterCm: 11 })).toBe(false)
  })
})

describe("коммуникации в документе", () => {
  it("CO-01: стояк и воздуховод восстанавливаются без потерь", () => {
    const d = first(doc([drawing({ communications: [R, D] })]))
    expect(d.communications).toEqual([R, D])
  })

  it("CO-01b: круг serializeStore → parseStore сохраняет коммуникации и остальные поля чертежа", () => {
    const store: DrawingStore = { version: 3, activeId: "a", drawings: [drawing({ communications: [R, D], activePlan: "demolition" })] }
    const parsed = parseStore(serializeStore(store))
    expect(parsed?.readOnly).toBe(false)
    const d = parsed?.store.drawings[0]
    expect(d?.communications).toEqual([R, D])
    expect(d?.walls).toEqual([wallW])
    expect(d?.activePlan).toBe("demolition")
  })

  it("CO-02: документ без списка открывается без изменений, список не появляется", () => {
    const d = first(doc([drawing()]))
    expect("communications" in d).toBe(false)
    expect(d.walls).toEqual([wallW])
  })

  it("CO-02b: пустой список остаётся пустым списком", () => {
    expect(first(doc([drawing({ communications: [] })])).communications).toEqual([])
  })

  it("CO-03: битые элементы отбрасываются по одному, корректный восстанавливается, документ рабочий", () => {
    const bad = [
      { kind: "riser", x: 1, y: 1, diameterCm: 5 }, // без id
      { kind: "duct", id: "d9", x: 0, y: 0, widthCm: 0, depthCm: 20 }, // ширина 0
      { kind: "pipe", id: "p1", x: 0, y: 0, diameterCm: 5 }, // неизвестный вид
      R,
    ]
    const d = first(doc([drawing({ communications: bad })]))
    expect(d.communications).toEqual([R])
    expect(d.walls).toEqual([wallW])
  })

  it("CO-03b: поле не массив — читается как отсутствующее, остальные данные чертежа живы", () => {
    const d = first(doc([drawing({ communications: "oops" })]))
    expect(d.communications ?? []).toEqual([])
    expect(d.walls).toEqual([wallW])
  })

  it("CO-05: версия документа остаётся 3, чертёж с коммуникациями не считается повреждённым", () => {
    const raw = doc([drawing({ communications: [R] })])
    const parsed = parseStore(raw)
    expect(parsed).not.toBeNull()
    expect(parsed?.store.version).toBe(3)
    if (parsed) expect(serializeStore(parsed.store)).toContain('"version":3')
  })

  it("CO-06: коммуникации не зависят от плана: хранятся в чертеже рядом со стенами, а не в объектах «Монтажа»", () => {
    const d = first(doc([drawing({ communications: [R], mounting: { walls: [], dimensions: [] } })]))
    expect(d.communications).toEqual([R])
    expect(d.mounting).toEqual({ walls: [], dimensions: [] })
  })
})
