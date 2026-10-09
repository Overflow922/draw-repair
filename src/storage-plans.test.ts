import { describe, expect, it } from "vitest"
import { activePlanOf } from "./plans"
import { parseStore, serializeStore } from "./storage"
import type { Dimension, Doorway, Drawing, DrawingStore, View, Wall } from "./types"

// change drawing-plans: необязательное поле activePlan чертежа в документе версии 3
// (spec drawing-storage «Активный план чертежа в документе»; design D3).

const wall: Wall = { id: "w1", a: { x: 0, y: 0 }, b: { x: 300, y: 0 }, thicknessCm: 20, type: "brick" }
const dimension: Dimension = {
  from: { a: { wallId: "w1", edge: 2 }, b: { wallId: "w1", edge: 0 } },
  to: { a: { wallId: "w1", edge: 3 }, b: { wallId: "w1", edge: 0 } },
  offset: 30,
}
const doorway: Doorway = { id: "d1", wallId: "w1", anchor: "a", offsetCm: 50, widthCm: 90, heightCm: 210 }
const view: View = { zoom: 1.5, pan: { x: -10, y: 20 } }

const drawing = (id: string, extra: Record<string, unknown> = {}): Drawing =>
  ({ id, name: `Чертёж ${id}`, walls: [wall], dimensions: [dimension], doorways: [doorway], view, scale: 100, ...extra }) as Drawing

const doc = (drawings: Drawing[]): string => JSON.stringify({ version: 3, activeId: drawings[0]?.id ?? "", drawings })

const parsedDrawings = (raw: string): Drawing[] => {
  const parsed = parseStore(raw)
  expect(parsed).not.toBeNull()
  expect(parsed?.readOnly).toBe(false)
  return parsed?.store.drawings ?? []
}

describe("активный план в документе", () => {
  it("ST-01: чертёж версии 3 без поля активного плана открывается с планом measure и поле не добавляется", () => {
    const [d] = parsedDrawings(doc([drawing("a")]))
    expect(d).toBeDefined()
    expect(activePlanOf(d as Drawing)).toBe("measure")
    expect("activePlan" in (d as Drawing)).toBe(false)
  })

  it("ST-01: документ без поля не считается повреждённым — все данные чертежа восстановлены", () => {
    const parsed = parseStore(doc([drawing("a")]))
    expect(parsed?.store.version).toBe(3)
    expect(parsed?.store.activeId).toBe("a")
    expect(parsed?.store.drawings).toEqual([drawing("a")])
  })

  it.each([
    ["неизвестный идентификатор", "unknown-plan"],
    ["пустая строка", ""],
    ["другой регистр", "Measure"],
    ["число", 5],
    ["null", null],
    ["true", true],
    ["объект", {}],
    ["массив", ["measure"]],
  ])("ST-02: недопустимый activePlan (%s) не повреждает документ: стены, размеры и проёмы восстановлены, активен measure", (_name, value) => {
    const [d] = parsedDrawings(doc([drawing("a", { activePlan: value })]))
    expect(d?.walls).toEqual([wall])
    expect(d?.dimensions).toEqual([dimension])
    expect(d?.doorways).toEqual([doorway])
    expect(d?.view).toEqual(view)
    expect(d?.scale).toBe(100)
    expect(activePlanOf(d as Drawing)).toBe("measure")
    // design D3: недопустимое поле отбрасывается, а не сохраняется как есть
    expect("activePlan" in (d as Drawing)).toBe(false)
  })

  it("ST-02: недопустимое значение не мешает остальным чертежам документа", () => {
    const drawings = parsedDrawings(doc([drawing("a", { activePlan: "unknown-plan" }), drawing("b", { activePlan: "measure" })]))
    expect(drawings.map((d) => d.id)).toEqual(["a", "b"])
    expect(drawings.map((d) => activePlanOf(d))).toEqual(["measure", "measure"])
  })

  it("ST-03: сохранённый activePlan переживает serialize → parse", () => {
    const store: DrawingStore = { version: 3, activeId: "a", drawings: [drawing("a", { activePlan: "measure" })] }
    const parsed = parseStore(serializeStore(store))
    expect(parsed?.readOnly).toBe(false)
    expect(parsed?.store.drawings[0]?.activePlan).toBe("measure")
    expect(parsed?.store).toEqual(store)
  })

  it("ST-03: serialize записывает activePlan в JSON чертежа", () => {
    const store: DrawingStore = { version: 3, activeId: "a", drawings: [drawing("a", { activePlan: "measure" })] }
    const json: unknown = JSON.parse(serializeStore(store))
    expect(json).toMatchObject({ drawings: [{ id: "a", activePlan: "measure" }] })
  })

  it("ST-04: стены, размеры и проёмы читаются из прежних полей без потерь", () => {
    const [d] = parsedDrawings(doc([drawing("a", { activePlan: "measure" })]))
    expect(d?.walls).toEqual([wall])
    expect(d?.dimensions).toEqual([dimension])
    expect(d?.doorways).toEqual([doorway])
    expect(d?.name).toBe("Чертёж a")
    expect(d?.view).toEqual(view)
    expect(d?.scale).toBe(100)
  })

  it("ST-04: запись не переносит объекты в новые поля — в JSON нет ключа plans", () => {
    const store: DrawingStore = { version: 3, activeId: "a", drawings: [drawing("a", { activePlan: "measure" })] }
    const json = JSON.parse(serializeStore(store)) as { drawings: Record<string, unknown>[] }
    expect(Object.keys(json.drawings[0] ?? {}).sort()).toEqual(["activePlan", "dimensions", "doorways", "id", "name", "scale", "view", "walls"])
  })

  it("ST-05: версия документа остаётся 3 при чтении и записи", () => {
    const store: DrawingStore = { version: 3, activeId: "a", drawings: [drawing("a", { activePlan: "measure" })] }
    expect(parseStore(serializeStore(store))?.store.version).toBe(3)
    expect(JSON.parse(serializeStore(store))).toMatchObject({ version: 3 })
  })

  it("ST-06: у двух чертежей поле хранится независимо: у одного сохранено, у другого отсутствует", () => {
    const drawings = parsedDrawings(doc([drawing("a", { activePlan: "measure" }), drawing("b")]))
    expect(drawings[0]?.activePlan).toBe("measure")
    expect(drawings[1] !== undefined && "activePlan" in drawings[1]).toBe(false)
  })

  it("ST-07: документ будущей версии по-прежнему только для чтения и не читает поле плана", () => {
    const parsed = parseStore(JSON.stringify({ version: 4, activeId: "a", drawings: [drawing("a", { activePlan: "measure" })] }))
    expect(parsed?.readOnly).toBe(true)
    expect(parsed?.store.drawings).toHaveLength(1)
    expect(parsed?.store.drawings[0]?.walls).toEqual([])
  })
})
