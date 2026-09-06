import { describe, expect, it } from "vitest"
import { parseStore, serializeStore } from "./storage"
import type { Dimension, Drawing, DrawingStore, View, Wall } from "./types"

const wall: Wall = { id: "w1", a: { x: 0, y: 0 }, b: { x: 300, y: 0 }, thicknessCm: 20, type: "brick" }
const dimension: Dimension = {
  from: { a: { wallId: "w1", edge: 2 }, b: { wallId: "w1", edge: 0 } },
  to: { a: { wallId: "w1", edge: 3 }, b: { wallId: "w1", edge: 0 } },
  offset: 30,
}
const view: View = { zoom: 1.5, pan: { x: -10, y: 20 } }

const drawing = (id: string, name: string): Drawing => ({ id, name, walls: [wall], dimensions: [dimension], view, scale: 100 })

const store: DrawingStore = {
  version: 3,
  activeId: "a",
  drawings: [drawing("a", "Чертёж 1"), drawing("b", "Чертёж 2")],
}

describe("serializeStore/parseStore", () => {
  it("roundtrip сохраняет чертежи с размерами и активную вкладку", () => {
    expect(parseStore(serializeStore(store))).toEqual({ store, readOnly: false })
  })

  it("одиночный документ json-storage v1 мигрирует в конверт v3", () => {
    const legacy = JSON.stringify({ version: 1, walls: [{ a: { x: 0, y: 0 }, b: { x: 300, y: 0 }, thicknessCm: 20, type: "brick" }], view })
    const parsed = parseStore(legacy)
    expect(parsed?.readOnly).toBe(false)
    expect(parsed?.store.version).toBe(3)
    expect(parsed?.store.drawings.length).toBe(1)
    expect(parsed?.store.drawings[0].name).toBe("Чертёж 1")
    expect(parsed?.store.drawings[0].walls[0].id).toBeTruthy()
    const { id: _id, ...rest } = parsed?.store.drawings[0].walls[0] ?? { id: "", a: { x: 0, y: 0 }, b: { x: 0, y: 0 }, thicknessCm: 0, type: "" }
    expect(rest).toEqual({ a: { x: 0, y: 0 }, b: { x: 300, y: 0 }, thicknessCm: 20, type: "brick" })
    expect(parsed?.store.drawings[0].dimensions).toEqual([])
    expect(parsed?.store.drawings[0].view).toEqual(view)
    expect(parsed?.store.drawings[0].scale).toBe(100)
    expect(parsed?.store.activeId).toBe(parsed?.store.drawings[0].id)
  })

  it("конверт версии 1 мигрирует: масштаб 1:100, остальное без изменений", () => {
    const v1 = JSON.stringify({ version: 1, activeId: "a", drawings: [drawing("a", "Чертёж 1"), { ...drawing("b", "Чертёж 2"), scale: undefined }] })
    const parsed = parseStore(v1)
    expect(parsed?.readOnly).toBe(false)
    expect(parsed?.store.version).toBe(3)
    expect(parsed?.store.drawings.map((d) => ({ ...d, walls: d.walls.map(({ id, ...w }) => ({ ...w })), dimensions: d.dimensions }))).toEqual(
      store.drawings.map((d) => ({ ...d, walls: d.walls.map(({ id, ...w }) => ({ ...w })), dimensions: d.dimensions })),
    )
    expect(parsed?.store.drawings.every((d) => d.walls.every((w) => w.id === "w1"))).toBe(true)
    expect(parsed?.store.activeId).toBe("a")
  })

  it("конверт версии 2 мигрирует: id стенам, пустые размеры, масштаб сохранён", () => {
    const v2 = JSON.stringify({
      version: 2,
      activeId: "a",
      drawings: [{ id: "a", name: "Чертёж 1", walls: [{ a: { x: 0, y: 0 }, b: { x: 300, y: 0 }, thicknessCm: 20, type: "brick" }], view, scale: 200 }],
    })
    const parsed = parseStore(v2)
    expect(parsed?.readOnly).toBe(false)
    expect(parsed?.store.version).toBe(3)
    expect(parsed?.store.drawings[0].scale).toBe(200)
    expect(parsed?.store.drawings[0].walls[0].id).toBeTruthy()
    expect(parsed?.store.drawings[0].walls[0].a).toEqual({ x: 0, y: 0 })
    expect(parsed?.store.drawings[0].dimensions).toEqual([])
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
    expect(parseStore(JSON.stringify({ version: 3, activeId: "a", drawings: [{ id: "a", name: "x", walls: [wall], view, scale: 100 }] }))).toBeNull()
  })

  it("битые и устаревшие размеры отбрасываются, стены сохраняются", () => {
    const raw = JSON.stringify({
      version: 3,
      activeId: "a",
      drawings: [{
        ...drawing("a", "x"),
        dimensions: [
          { from: { wallId: "w1", t: 0 }, to: { wallId: "w1", t: 1 }, offset: 1 },
          { from: { a: { wallId: "", edge: 0 }, b: { wallId: "w1", edge: 0 } }, to: { a: { wallId: "w1", edge: 2 }, b: { wallId: "w1", edge: 0 } }, offset: 2 },
          { from: { a: { wallId: "w1", edge: 2 }, b: { wallId: "w1", edge: 0 } }, to: { a: { wallId: "w1", edge: 3 }, b: { wallId: "w1", edge: 0 } }, offset: 30 },
        ],
      }],
    })
    const parsed = parseStore(raw)
    expect(parsed?.readOnly).toBe(false)
    expect(parsed?.store.drawings[0].walls.length).toBe(1)
    expect(parsed?.store.drawings[0].dimensions.length).toBe(1)
    expect(parsed?.store.drawings[0].dimensions[0].offset).toBe(30)
  })

  it("битый масштаб в v3 — повреждённые данные", () => {
    const badScale = JSON.stringify({ version: 3, activeId: "a", drawings: [{ ...drawing("a", "Чертёж 1"), scale: 77 }] })
    expect(parseStore(badScale)).toBeNull()
    const noScale = JSON.stringify({ version: 3, activeId: "a", drawings: [{ id: "a", name: "Чертёж 1", walls: [wall], dimensions: [], view }] })
    expect(parseStore(noScale)).toBeNull()
  })

  it("будущая версия даёт пустое хранилище в режиме только чтение", () => {
    const parsed = parseStore(JSON.stringify({ version: 4, anything: "x" }))
    expect(parsed?.readOnly).toBe(true)
    expect(parsed?.store.version).toBe(3)
    expect(parsed?.store.drawings.length).toBe(1)
    expect(parsed?.store.drawings[0].walls.length).toBe(0)
    expect(parsed?.store.drawings[0].dimensions.length).toBe(0)
    expect(parsed?.store.drawings[0].view).toEqual({ zoom: 1, pan: { x: 0, y: 0 } })
    expect(parsed?.store.drawings[0].scale).toBe(100)
  })
})
