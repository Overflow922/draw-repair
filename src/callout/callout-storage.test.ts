import { describe, expect, it } from "vitest"
import { isCallout, parseStore, serializeStore } from "../storage"
import type { Drawing, DrawingStore } from "../types"
import { A, B, callout, make } from "./callout.test-utils"

// change add-callout: выноски в документе (spec drawing-storage «Выноски в документе»; design D1; test-plan C-STO-*).

const D = callout("d", { x: 5.5, y: 6 }, { x: 7, y: 8.25 }, "демонтаж")
const M = callout("m", { x: 1, y: 2 }, { x: 3, y: 4 }, "монтаж")
const store = (dr: Drawing): DrawingStore => ({ version: 3, activeId: dr.id, drawings: [dr] })
const roundTrip = (dr: Drawing): Drawing | undefined => parseStore(serializeStore(store(dr)))?.store.drawings[0]
const loadRaw = (extra: Record<string, unknown>): Drawing | undefined => parseStore(JSON.stringify(store(make(extra as Partial<Drawing>))))?.store.drawings[0]

describe("сохранение и восстановление", () => {
  it("C-STO-1: выноски обмера сохраняются целиком, включая переводы строк и дробные координаты", () => {
    const c = callout("c", { x: 100.37, y: -20.5 }, { x: 0.5, y: 1e3 }, "Монтаж радиатора\n\nв нишу")
    expect(roundTrip(make({ callouts: [A(), B(), c] }))?.callouts).toEqual([A(), B(), c])
  })

  it("C-STO-2: выноски «Демонтажа» хранятся в своём списке и не попадают в другие", () => {
    const loaded = roundTrip(make({ demolitionCallouts: [D] }))
    expect(loaded?.demolitionCallouts).toEqual([D])
    expect(loaded?.callouts).toBeUndefined()
    expect(loaded?.mounting).toBeUndefined()
  })

  it("C-STO-3: выноски «Монтажа» хранятся среди объектов плана «Монтаж», остальное содержимое плана сохранено", () => {
    const walls = [{ id: "own", a: { x: 0, y: 0 }, b: { x: 10, y: 0 }, thicknessCm: 10, type: "brick" as const }]
    const doorways = [{ id: "dw", wallId: "own", anchor: "a" as const, offsetCm: 10, widthCm: 50, heightCm: 210 }]
    const batteries = [{ id: "bt", wallId: "own", face: 1 as const, anchor: "a" as const, offsetCm: 5, lengthCm: 40, thicknessCm: 10, gapCm: 2 }]
    const loaded = roundTrip(make({ mounting: { walls, dimensions: [], doorways, batteries, callouts: [M] } }))
    expect(loaded?.mounting?.callouts).toEqual([M])
    expect(loaded?.mounting?.walls).toEqual(walls)
    expect(loaded?.mounting?.doorways).toEqual(doorways)
    expect(loaded?.mounting?.batteries).toEqual(batteries)
    expect(loaded?.callouts).toBeUndefined()
  })

  it("C-STO-3b: выноски трёх планов вместе — на каждом плане своя, чужих нет", () => {
    const loaded = roundTrip(make({ callouts: [A()], demolitionCallouts: [D], mounting: { walls: [], dimensions: [], callouts: [M] } }))
    expect(loaded?.callouts).toEqual([A()])
    expect(loaded?.demolitionCallouts).toEqual([D])
    expect(loaded?.mounting?.callouts).toEqual([M])
  })

  it("C-STO-1b: пустой список выносок сохраняется пустым, не исчезает и не заполняется", () => {
    expect(roundTrip(make({ callouts: [] }))?.callouts).toEqual([])
  })
})

describe("совместимость", () => {
  it("C-STO-4: документ без выносок читается без ошибок, поля не дописываются, остальное прежнее", () => {
    const original = make()
    const loaded = roundTrip(original)
    expect(loaded).toBeDefined()
    expect(loaded?.callouts).toBeUndefined()
    expect(loaded?.demolitionCallouts).toBeUndefined()
    expect(loaded?.mounting).toBeUndefined()
    expect(loaded?.walls).toEqual(original.walls)
    expect(loaded?.dimensions).toEqual(original.dimensions)
  })

  it("C-STO-4b: версия документа не меняется", () => {
    expect(JSON.parse(serializeStore(store(make({ callouts: [A()] })))).version).toBe(3)
  })

  it("C-STO-4c: у «Монтажа» без выносок поле не дописывается при загрузке", () => {
    const loaded = roundTrip(make({ mounting: { walls: [], dimensions: [] } }))
    expect(loaded?.mounting?.callouts).toBeUndefined()
  })
})

describe("недопустимые данные", () => {
  it("C-STO-5: выноски без идентификатора, с пустым идентификатором или без координат пропускаются, остальные загружаются", () => {
    const good = A()
    const loaded = loadRaw({
      callouts: [
        { target: { x: 1, y: 1 }, at: { x: 2, y: 2 }, text: "без id" },
        { id: "", target: { x: 1, y: 1 }, at: { x: 2, y: 2 }, text: "пустой id" },
        { id: "x", at: { x: 2, y: 2 }, text: "без target" },
        { id: "y", target: { x: 1, y: 1 }, text: "без at" },
        good,
      ],
    })
    expect(loaded?.callouts).toEqual([good])
  })

  it("C-STO-6: пустой, пробельный и нестроковый текст не загружается", () => {
    const loaded = loadRaw({
      callouts: [
        { id: "e", target: { x: 1, y: 1 }, at: { x: 2, y: 2 }, text: "" },
        { id: "s", target: { x: 1, y: 1 }, at: { x: 2, y: 2 }, text: "  \n " },
        { id: "n", target: { x: 1, y: 1 }, at: { x: 2, y: 2 }, text: 5 },
        { id: "u", target: { x: 1, y: 1 }, at: { x: 2, y: 2 } },
        B(),
      ],
    })
    expect(loaded?.callouts).toEqual([B()])
  })

  it("C-STO-7: нечисловые и бесконечные координаты не загружаются", () => {
    const loaded = loadRaw({
      callouts: [
        { id: "a", target: { x: "1", y: 1 }, at: { x: 2, y: 2 }, text: "т" },
        { id: "b", target: { x: 1, y: null }, at: { x: 2, y: 2 }, text: "т" },
        { id: "c", target: { x: 1, y: 1 }, at: { x: Infinity, y: 2 }, text: "т" },
        { id: "d", target: null, at: { x: 2, y: 2 }, text: "т" },
        A(),
      ],
    })
    expect(loaded?.callouts).toEqual([A()])
  })

  it("C-STO-7b: недопустимые выноски пропускаются и в списках «Демонтажа» и «Монтажа»", () => {
    const bad = { id: "b", target: { x: 1, y: 1 }, at: { x: 2, y: 2 }, text: "" }
    const loaded = loadRaw({ demolitionCallouts: [bad, D], mounting: { walls: [], dimensions: [], callouts: [bad, M] } })
    expect(loaded?.demolitionCallouts).toEqual([D])
    expect(loaded?.mounting?.callouts).toEqual([M])
  })

  it("C-STO-7c: недопустимая выноска не мешает загрузке остальных данных документа", () => {
    const loaded = loadRaw({ callouts: [{ id: "", text: "" }] })
    expect(loaded).toBeDefined()
    expect(loaded?.walls).toHaveLength(1)
  })

  it("C-STO-7d: список выносок не массив — читается как отсутствующий, документ загружается", () => {
    const loaded = loadRaw({ callouts: "не список" })
    expect(loaded).toBeDefined()
    expect(loaded?.callouts ?? []).toEqual([])
  })
})

describe("isCallout", () => {
  it("C-STO-8: допустимая выноска принимается, в том числе с текстом из нескольких строк", () => {
    expect(isCallout(A())).toBe(true)
    expect(isCallout(B())).toBe(true)
  })

  it("C-STO-8b: каждое нарушение отвергается", () => {
    const base = A()
    expect(isCallout({ ...base, id: "" })).toBe(false)
    expect(isCallout({ ...base, id: 1 })).toBe(false)
    expect(isCallout({ ...base, text: "" })).toBe(false)
    expect(isCallout({ ...base, text: "  " })).toBe(false)
    expect(isCallout({ ...base, target: { x: NaN, y: 1 } })).toBe(false)
    expect(isCallout({ ...base, at: { x: 1, y: Infinity } })).toBe(false)
    expect(isCallout(null)).toBe(false)
    expect(isCallout("строка")).toBe(false)
    expect(isCallout(undefined)).toBe(false)
  })
})
