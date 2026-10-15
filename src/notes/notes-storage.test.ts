import { describe, expect, it } from "vitest"
import { make } from "../callout/callout.test-utils"
import { parseStore, serializeStore } from "../storage"
import type { Drawing, DrawingStore } from "../types"
import { notesOf } from "./notes-store"

// change add-plan-notes: примечания в документе (spec drawing-storage «Примечания планов в документе»).

const store = (dr: Drawing): DrawingStore => ({ version: 3, activeId: dr.id, drawings: [dr] })
const roundTrip = (dr: Drawing): Drawing | undefined => parseStore(serializeStore(store(dr)))?.store.drawings[0]
const loadRaw = (patch: Record<string, unknown>): Drawing | undefined =>
  parseStore(JSON.stringify(store({ ...make(), ...patch } as Drawing)))?.store.drawings[0]

describe("сохранение и восстановление", () => {
  it("примечания каждого плана восстанавливаются раздельно и в том же порядке", () => {
    const loaded = roundTrip(make({ notes: ["о1", "о2"], demolitionNotes: ["д1"], mounting: { walls: [], dimensions: [], notes: ["м1", "м2", "м3"] } }))
    expect(loaded?.notes).toEqual(["о1", "о2"])
    expect(loaded?.demolitionNotes).toEqual(["д1"])
    expect(loaded?.mounting?.notes).toEqual(["м1", "м2", "м3"])
  })

  it("пустой список сохраняется пустым", () => {
    expect(roundTrip(make({ notes: [] }))?.notes).toEqual([])
  })

  it("примечания только одного плана не появляются у других", () => {
    const loaded = roundTrip(make({ demolitionNotes: ["д1"] }))
    expect(notesOf(loaded as Drawing, "measure")).toEqual([])
    expect(notesOf(loaded as Drawing, "mounting")).toEqual([])
  })
})

describe("совместимость", () => {
  it("документ без примечаний читается без ошибок, поля не дописываются, остальное прежнее", () => {
    const original = make()
    const loaded = roundTrip(original)
    expect(loaded).toBeDefined()
    expect(loaded?.notes).toBeUndefined()
    expect(loaded?.demolitionNotes).toBeUndefined()
    expect(loaded?.mounting).toBeUndefined()
    expect(loaded?.walls).toEqual(original.walls)
  })

  it("версия документа не меняется", () => {
    expect(JSON.parse(serializeStore(store(make({ notes: ["а"] })))).version).toBe(3)
  })

  it("«Монтаж» без примечаний не получает поле", () => {
    const loaded = roundTrip(make({ mounting: { walls: [], dimensions: [] } }))
    expect(loaded?.mounting?.notes).toBeUndefined()
  })
})

describe("недопустимые данные", () => {
  it("элементы, не являющиеся непустыми строками, пропускаются, остальные пункты и документ загружаются", () => {
    const loaded = loadRaw({ notes: ["а", 5, "", "   ", null, { x: 1 }, "б"] })
    expect(loaded?.notes).toEqual(["а", "б"])
    expect(loaded?.walls).toEqual(make().walls)
  })

  it("пункты обрезаются по пробелам", () => {
    expect(loadRaw({ notes: ["  а  "] })?.notes).toEqual(["а"])
  })

  it("список не массив читается как отсутствующий, остальное загружено", () => {
    for (const bad of ["текст", { 0: "а" }, 5, null]) {
      const loaded = loadRaw({ notes: bad, demolitionNotes: bad })
      expect(loaded).toBeDefined()
      expect(loaded?.notes).toBeUndefined()
      expect(loaded?.demolitionNotes).toBeUndefined()
      expect(loaded?.walls).toEqual(make().walls)
    }
  })

  it("примечания «Монтажа»: не массив — как отсутствующие, мусор пропускается", () => {
    expect(loadRaw({ mounting: { walls: [], dimensions: [], notes: "строка" } })?.mounting?.notes).toBeUndefined()
    expect(loadRaw({ mounting: { walls: [], dimensions: [], notes: ["а", 1] } })?.mounting?.notes).toEqual(["а"])
  })

  it("к загруженному списку применяются ограничения 15 пунктов и 300 символов", () => {
    const many = Array.from({ length: 16 }, (_, i) => `п${i + 1}`)
    const loaded = loadRaw({ notes: many, demolitionNotes: ["я".repeat(301)] })
    expect(loaded?.notes).toEqual(many.slice(0, 15))
    expect(loaded?.demolitionNotes).toEqual(["я".repeat(300)])
  })
})
