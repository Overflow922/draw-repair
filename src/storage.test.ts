import { describe, expect, it } from "vitest"
import { parseStore, serializeStore } from "./storage"
import type { Drawing, DrawingStore, View, Wall } from "./types"

const wall: Wall = { a: { x: 0, y: 0 }, b: { x: 300, y: 0 }, thicknessCm: 20, type: "brick" }
const view: View = { zoom: 1.5, pan: { x: -10, y: 20 } }

const drawing = (id: string, name: string): Drawing => ({ id, name, walls: [wall], view, scale: 100 })

const store: DrawingStore = {
  version: 2,
  activeId: "a",
  drawings: [drawing("a", "Чертёж 1"), drawing("b", "Чертёж 2")],
}

describe("serializeStore/parseStore", () => {
  it("roundtrip сохраняет набор чертежей и активную вкладку", () => {
    expect(parseStore(serializeStore(store))).toEqual({ store, readOnly: false })
  })

  it("одиночный документ json-storage мигрирует в конверт v2 с масштабом 1:100", () => {
    const legacy = JSON.stringify({ version: 1, walls: [wall], view })
    const parsed = parseStore(legacy)
    expect(parsed?.readOnly).toBe(false)
    expect(parsed?.store.version).toBe(2)
    expect(parsed?.store.drawings.length).toBe(1)
    expect(parsed?.store.drawings[0].name).toBe("Чертёж 1")
    expect(parsed?.store.drawings[0].walls).toEqual([wall])
    expect(parsed?.store.drawings[0].view).toEqual(view)
    expect(parsed?.store.drawings[0].scale).toBe(100)
    expect(parsed?.store.activeId).toBe(parsed?.store.drawings[0].id)
  })

  it("конверт версии 1 мигрирует: масштаб 1:100, остальное без изменений", () => {
    const v1 = JSON.stringify({ version: 1, activeId: "a", drawings: [drawing("a", "Чертёж 1"), { ...drawing("b", "Чертёж 2"), scale: undefined }] })
    const parsed = parseStore(v1)
    expect(parsed?.readOnly).toBe(false)
    expect(parsed?.store.version).toBe(2)
    expect(parsed?.store.drawings).toEqual([drawing("a", "Чертёж 1"), drawing("b", "Чертёж 2")])
    expect(parsed?.store.activeId).toBe("a")
  })

  it("все старые типы мигрируют в brick, валидные материалы сохраняются", () => {
    const legacy = JSON.stringify({
      version: 1,
      walls: [
        { ...wall, type: "partition" },
        { ...wall, type: "drywall" },
        { ...wall, type: "bearing" },
        { ...wall, type: "selfbearing" },
        { ...wall, type: "nonbearing" },
      ],
      view,
    })
    const parsed = parseStore(legacy)
    expect(parsed?.store.drawings[0].walls.map((w) => w.type)).toEqual([
      "brick",
      "brick",
      "brick",
      "brick",
      "brick",
    ])
    const envelope = JSON.stringify({
      version: 1,
      activeId: "a",
      drawings: [{ ...drawing("a", "Чертёж 1"), walls: [{ ...wall, type: "wood-long" }] }],
    })
    const parsedEnvelope = parseStore(envelope)
    expect(parsedEnvelope?.store.drawings[0].walls[0].type).toBe("wood-long")
  })

  it("битый JSON отклоняется", () => {
    expect(parseStore("{oops")).toBeNull()
  })

  it("JSON не-объект отклоняется", () => {
    expect(parseStore("42")).toBeNull()
    expect(parseStore("\"строка\"")).toBeNull()
  })

  it("структура не по формату отклоняется", () => {
    expect(parseStore("{}")).toBeNull()
    expect(parseStore(JSON.stringify({ version: 1, activeId: "a", drawings: [] }))).toBeNull()
    expect(parseStore(JSON.stringify({ version: 1, drawings: [drawing("a", "Чертёж 1")] }))).toBeNull()
    expect(parseStore(JSON.stringify({ version: 1, activeId: "x", drawings: [drawing("a", "Чертёж 1")] }))).toBeNull()
    expect(parseStore(JSON.stringify({ version: 1, activeId: "a", drawings: [{ id: "a", walls: [], view }] }))).toBeNull()
    expect(parseStore(JSON.stringify({ version: 1, walls: "не массив", view }))).toBeNull()
  })

  it("битый масштаб в v2 — повреждённые данные", () => {
    const badScale = JSON.stringify({ version: 2, activeId: "a", drawings: [{ ...drawing("a", "Чертёж 1"), scale: 77 }] })
    expect(parseStore(badScale)).toBeNull()
    const noScale = JSON.stringify({ version: 2, activeId: "a", drawings: [{ id: "a", name: "Чертёж 1", walls: [wall], view }] })
    expect(parseStore(noScale)).toBeNull()
  })

  it("будущая версия даёт пустое хранилище в режиме только чтение", () => {
    const parsed = parseStore(JSON.stringify({ version: 3, anything: "x" }))
    expect(parsed?.readOnly).toBe(true)
    expect(parsed?.store.version).toBe(2)
    expect(parsed?.store.drawings.length).toBe(1)
    expect(parsed?.store.drawings[0].walls.length).toBe(0)
    expect(parsed?.store.drawings[0].view).toEqual({ zoom: 1, pan: { x: 0, y: 0 } })
    expect(parsed?.store.drawings[0].scale).toBe(100)
  })
})
