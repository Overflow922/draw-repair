import { describe, expect, it } from "vitest"
import { make } from "./callout/callout.test-utils"
import { parseStore, serializeStore } from "./storage"
import type { Drawing, DrawingStore, RoomRecord } from "./types"

// Тесты change add-room-explication: данные помещений в документе (spec drawing-storage «Данные помещений в документе»).

const store = (dr: Drawing): DrawingStore => ({ version: 3, activeId: dr.id, drawings: [dr] })
const roundTrip = (dr: Drawing): Drawing | undefined => parseStore(serializeStore(store(dr)))?.store.drawings[0]
const loadRaw = (rooms: unknown): Drawing | undefined =>
  parseStore(JSON.stringify(store({ ...make(), rooms } as Drawing)))?.store.drawings[0]

const kitchen: RoomRecord = { number: 1, name: "Кухня", heightMm: 2700, anchor: { x: 120.5, y: 80 } }
const bedroom: RoomRecord = { number: 2, name: "", heightMm: 3000, anchor: { x: 400, y: 80 } }

describe("сохранение и восстановление", () => {
  it("записи помещений сохраняются целиком", () => {
    expect(roundTrip(make({ rooms: [kitchen, bedroom] }))?.rooms).toEqual([kitchen, bedroom])
  })

  it("пустой список сохраняется пустым", () => {
    expect(roundTrip(make({ rooms: [] }))?.rooms).toEqual([])
  })
})

describe("совместимость", () => {
  it("документ без помещений читается без ошибок, поле не дописывается, остальное прежнее", () => {
    const original = make()
    const loaded = roundTrip(original)
    expect(loaded).toBeDefined()
    expect(loaded?.rooms).toBeUndefined()
    expect(loaded?.walls).toEqual(original.walls)
    expect(loaded?.dimensions).toEqual(original.dimensions)
  })

  it("версия документа не меняется", () => {
    expect(JSON.parse(serializeStore(store(make({ rooms: [kitchen] })))).version).toBe(3)
  })

  it("поле, не являющееся списком, читается как отсутствующее", () => {
    expect(loadRaw("мусор")?.rooms).toBeUndefined()
  })
})

describe("недопустимые записи", () => {
  it("высота 0 — запись пропущена, остальное загружено", () => {
    const loaded = loadRaw([{ ...kitchen, heightMm: 0 }, bedroom])
    expect(loaded?.rooms).toEqual([bedroom])
  })

  it.each([
    ["высота выше 99999", { ...kitchen, heightMm: 100000 }],
    ["высота дробная", { ...kitchen, heightMm: 2700.5 }],
    ["высота строкой", { ...kitchen, heightMm: "2700" }],
    ["номер 0", { ...kitchen, number: 0 }],
    ["номер дробный", { ...kitchen, number: 1.5 }],
    ["номер отрицательный", { ...kitchen, number: -1 }],
    ["название не строка", { ...kitchen, name: 5 }],
    ["опорная точка нечисловая", { ...kitchen, anchor: { x: "a", y: 1 } }],
    ["нет опорной точки", { number: 1, name: "", heightMm: 3000 }],
    ["не объект", 7],
  ])("%s — запись пропущена", (_, bad) => {
    expect(loadRaw([bad, bedroom])?.rooms).toEqual([bedroom])
  })

  it("высота на границах диапазона допустима", () => {
    expect(loadRaw([{ ...kitchen, heightMm: 1 }, { ...bedroom, heightMm: 99999 }])?.rooms).toHaveLength(2)
  })

  it("повторяющийся номер — загружена первая запись", () => {
    const dup: RoomRecord = { ...bedroom, number: 1, name: "Дубль" }
    expect(loadRaw([kitchen, dup])?.rooms).toEqual([kitchen])
  })
})
