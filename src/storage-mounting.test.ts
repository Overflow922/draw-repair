import { describe, expect, it } from "vitest"
import { activePlanOf } from "./plans"
import { parseStore, serializeStore } from "./storage"
import type { Dimension, Doorway, Drawing, DrawingStore, View, Wall } from "./types"

// change mounting-plan: поле mounting чертежа в документе версии 3 (spec drawing-storage «Объекты плана «Монтаж»
// в документе»; design D4). Остатки в документ не пишутся.

const wallW: Wall = { id: "w1", a: { x: 0, y: 0 }, b: { x: 500, y: 0 }, thicknessCm: 20, type: "brick" }
const own: Wall = { id: "n1", a: { x: 0, y: 100 }, b: { x: 0, y: 400 }, thicknessCm: 10, type: "concrete" }
const dim: Dimension = {
  from: { a: { wallId: "w1~0", edge: 1 }, b: { wallId: "n1", edge: 2 } },
  to: { a: { wallId: "w1~0", edge: 1 }, b: { wallId: "n1", edge: 3 } },
  offset: 30,
}
const opening: Doorway = { id: "p1", wallId: "w1", anchor: "a", offsetCm: 50, widthCm: 90, heightCm: 210 }
const view: View = { zoom: 1.5, pan: { x: -10, y: 20 } }

const drawing = (extra: Record<string, unknown> = {}): Drawing =>
  ({ id: "a", name: "Чертёж 1", walls: [wallW], dimensions: [], view, scale: 100, ...extra }) as Drawing

const doc = (drawings: Drawing[]): string => JSON.stringify({ version: 3, activeId: drawings[0]?.id ?? "", drawings })

const first = (raw: string): Drawing => {
  const parsed = parseStore(raw)
  expect(parsed).not.toBeNull()
  expect(parsed?.readOnly).toBe(false)
  const [d] = parsed?.store.drawings ?? []
  if (!d) throw new Error("в документе нет чертежей")
  return d
}

describe("объекты «Монтажа» в документе", () => {
  it("MP-60: стены, размеры и элементы «Монтажа» восстанавливаются без потерь", () => {
    const d = first(doc([drawing({ mounting: { walls: [own], dimensions: [dim], doorways: [opening] } })]))
    expect(d.mounting).toEqual({ walls: [own], dimensions: [dim], doorways: [opening] })
  })

  it("MP-60: круг serializeStore → parseStore сохраняет объекты «Монтажа», активный план и обмер", () => {
    const store: DrawingStore = {
      version: 3,
      activeId: "a",
      drawings: [drawing({ activePlan: "mounting", mounting: { walls: [own], dimensions: [dim], doorways: [opening] } })],
    }
    const parsed = parseStore(serializeStore(store))
    const d = parsed?.store.drawings[0]
    expect(d?.mounting).toEqual({ walls: [own], dimensions: [dim], doorways: [opening] })
    expect(d ? activePlanOf(d) : null).toBe("mounting")
    expect(d?.walls).toEqual([wallW])
  })

  it("MP-60: формат документа остаётся версии 3", () => {
    const parsed = parseStore(doc([drawing({ mounting: { walls: [own], dimensions: [] } })]))
    expect(parsed?.store.version).toBe(3)
  })

  it("MP-60: список элементов «Монтажа» не дописывается, если его не было в документе", () => {
    const d = first(doc([drawing({ mounting: { walls: [own], dimensions: [] } })]))
    expect(d.mounting?.walls).toEqual([own])
    expect(d.mounting?.doorways).toBeUndefined()
  })

  it("MP-61: чертёж без поля mounting открывается без изменений и поле не появляется", () => {
    const d = first(doc([drawing()]))
    expect("mounting" in d).toBe(false)
    expect(d.walls).toEqual([wallW])
  })

  it("MP-61: объекты «Монтажа» не попадают в стены, размеры и элементы обмера", () => {
    const d = first(doc([drawing({ mounting: { walls: [own], dimensions: [dim], doorways: [opening] } })]))
    expect(d.walls).toEqual([wallW])
    expect(d.dimensions).toEqual([])
    expect(d.doorways).toBeUndefined()
  })

  it("MP-62: стена с нечисловой координатой отбрасывается, корректные стена и размер остаются, документ рабочий", () => {
    const broken = { id: "bad", a: { x: "zero", y: 0 }, b: { x: 10, y: 0 }, thicknessCm: 20, type: "brick" }
    const d = first(doc([drawing({ mounting: { walls: [broken, own], dimensions: [dim] } })]))
    expect(d.mounting?.walls).toEqual([own])
    expect(d.mounting?.dimensions).toEqual([dim])
  })

  it("MP-62: стена с нулевой толщиной отбрасывается", () => {
    const thin = { ...own, id: "thin", thicknessCm: 0 }
    expect(first(doc([drawing({ mounting: { walls: [thin, own], dimensions: [] } })])).mounting?.walls).toEqual([own])
  })

  it("MP-62: размер не по формату и элемент не по формату отбрасываются по одному", () => {
    const badDim = { from: { a: { wallId: "n1", edge: 9 }, b: { wallId: "n1", edge: 0 } }, to: dim.to, offset: 5 }
    const badEl = { ...opening, id: "x", widthCm: -1 }
    const d = first(doc([drawing({ mounting: { walls: [own], dimensions: [badDim, dim], doorways: [badEl, opening] } })]))
    expect(d.mounting?.dimensions).toEqual([dim])
    expect(d.mounting?.doorways).toEqual([opening])
  })

  it("MP-62: стена без идентификатора остаётся и получает непустой идентификатор", () => {
    const noId = { ...own, id: "" }
    const d = first(doc([drawing({ mounting: { walls: [noId], dimensions: [] } })]))
    expect(d.mounting?.walls).toHaveLength(1)
    const [w] = d.mounting?.walls ?? []
    expect(w?.id).not.toBe("")
    expect(w?.a).toEqual(own.a)
  })

  it("MP-62: неизвестный материал собственной стены читается как кирпич, как у обмера", () => {
    const odd = { ...own, type: "unknown" }
    expect(first(doc([drawing({ mounting: { walls: [odd], dimensions: [] } })])).mounting?.walls[0]?.type).toBe("brick")
  })

  it("MP-63: проём и размер со ссылкой на отсутствующую стену сохраняются (они могут вернуться)", () => {
    const ghostEl: Doorway = { ...opening, id: "g", wallId: "ghost" }
    const ghostDim: Dimension = { ...dim, from: { a: { wallId: "ghost~0", edge: 0 }, b: { wallId: "ghost~0", edge: 1 } } }
    const d = first(doc([drawing({ mounting: { walls: [own], dimensions: [ghostDim], doorways: [ghostEl] } })]))
    expect(d.mounting?.doorways).toEqual([ghostEl])
    expect(d.mounting?.dimensions).toEqual([ghostDim])
  })

  it("MP-64: остатки не пишутся в документ: после круга в чертеже нет стен с тильдой, «Монтаж» не содержит стен обмера", () => {
    const store: DrawingStore = {
      version: 3,
      activeId: "a",
      drawings: [drawing({ demolition: [{ id: "m", wallId: "w1", anchor: "a", fromCm: 100, toCm: 190 }], mounting: { walls: [own], dimensions: [] } })],
    }
    const raw = serializeStore(store)
    const d = parseStore(raw)?.store.drawings[0]
    expect(raw).not.toContain("w1~")
    expect(d?.walls).toEqual([wallW])
    expect(d?.mounting?.walls).toEqual([own])
    expect(d?.demolition).toHaveLength(1)
  })

  it("MP-65: активный план mounting читается как допустимый и не считается повреждением", () => {
    const parsed = parseStore(doc([drawing({ activePlan: "mounting" })]))
    expect(parsed).not.toBeNull()
    const d = parsed?.store.drawings[0]
    expect(d ? activePlanOf(d) : null).toBe("mounting")
  })

  it("MP-66: поле mounting не объект или walls не массив — чертёж открывается, собственных стен нет", () => {
    for (const mounting of ["junk", 7, null, [], { walls: "x", dimensions: [] }, { dimensions: [dim] }]) {
      const d = first(doc([drawing({ mounting })]))
      expect(d.walls, JSON.stringify(mounting)).toEqual([wallW])
      expect(d.mounting?.walls ?? [], JSON.stringify(mounting)).toEqual([])
    }
  })

  it("MP-67: у двух чертежей объекты «Монтажа» независимы", () => {
    const d2 = { ...drawing({ mounting: { walls: [], dimensions: [] } }), id: "b" }
    const parsed = parseStore(doc([drawing({ mounting: { walls: [own], dimensions: [] } }), d2]))
    expect(parsed?.store.drawings.map((d) => d.mounting?.walls.length ?? 0)).toEqual([1, 0])
  })
})
