import { describe, expect, it } from "vitest"
import { isDrawing, parseStore, readDrawing } from "./storage"
import type { Drawing } from "./types"

// change export-import-drawing-file: чертёж из файла читается по тем же правилам, что чертёж из хранилища (spec drawing-storage
// «Общие правила чтения чертежа», сценарии «Чертёж из файла читается как чертёж из хранилища», «Чтение хранилища не изменилось»).

const WALL = { id: "w1", a: { x: 0, y: 0 }, b: { x: 300, y: 0 }, thicknessCm: 20, type: "brick" }
const GOOD_DIM = {
  from: { a: { wallId: "w1", edge: 2 }, b: { wallId: "w1", edge: 0 } },
  to: { a: { wallId: "w1", edge: 3 }, b: { wallId: "w1", edge: 0 } },
  offset: 30,
}
const BAD_DIM = { from: "устаревший формат", to: 5, offset: 1 }
const VIEW = { zoom: 1.5, pan: { x: -10, y: 20 } }

const rawDrawing = {
  id: "a",
  name: "Кухня",
  walls: [WALL],
  dimensions: [BAD_DIM, GOOD_DIM],
  doorways: [
    { id: "d1", wallId: "w1", anchor: "a", offsetCm: 50, widthCm: 90, heightCm: 210 },
    { id: "d2", wallId: "w1", anchor: "a", offsetCm: 50, widthCm: 0, heightCm: 210 },
    { id: "d3", wallId: "missing", anchor: "a", offsetCm: 50, widthCm: 90, heightCm: 210 },
  ],
  view: VIEW,
  scale: 50,
  activePlan: "unknown-plan",
}

const readFromFileSide = (raw: unknown): Drawing => {
  if (!isDrawing(raw)) throw new Error("чертёж не соответствует формату")
  return readDrawing(raw)
}

describe("общее чтение чертежа", () => {
  const fromStore = parseStore(JSON.stringify({ version: 3, activeId: "a", drawings: [rawDrawing] }))?.store.drawings[0]
  const fromFile = readFromFileSide(rawDrawing)

  it("чертёж из хранилища прочитан", () => {
    expect(fromStore?.name).toBe("Кухня")
  })

  it("несоответствующий размер отброшен, корректный восстановлен", () => {
    expect(fromFile.dimensions).toHaveLength(1)
    expect(fromFile.dimensions[0]?.offset).toBe(30)
  })

  it("несоответствующие проёмы отброшены, корректный восстановлен", () => {
    expect(fromFile.doorways?.map((d) => d.id)).toEqual(["d1"])
  })

  it("записанный масштаб печати игнорируется", () => {
    expect("scale" in fromFile).toBe(false)
  })

  it("неизвестный активный план читается как отсутствующий", () => {
    expect("activePlan" in fromFile).toBe(false)
  })

  it("результат совпадает с чтением того же чертежа из документа хранилища", () => {
    expect(fromFile).toEqual(fromStore)
  })
})
