import { describe, expect, it } from "vitest"
import { parseHistory, record, redoEntry, serializeHistory, undoEntry } from "../history"
import type { DrawingHistory, HistoryStore, Scene } from "../history"
import { parseStore, serializeStore } from "../storage"
import type { Doorway, Drawing, DrawingStore, Wall, WallDoor, WallElement, WallWindow } from "../types"
import { sceneF } from "./opening-reach-body-end.test-utils"

// change fix-opening-reach-body-end: хранение элемента стены с отрицательным расстоянием привязки на выступе
// тела опорной стены (spec drawing-storage «Отрицательное расстояние привязки элемента стены»; test-plan T-17…T-19).
// Сцена F: блочная W (0,0)-(500,0), тело доходит до x = 510 (выступ 10 см за конец b).

const { walls } = sceneF()

const onOverhang: WallWindow = { kind: "window", id: "w1", wallId: "W", anchor: "b", offsetCm: -10, widthCm: 120, heightCm: 150, sillCm: 85 }
const doorOnOverhang: WallDoor = { kind: "door", id: "d1", wallId: "W", anchor: "b", offsetCm: -10, widthCm: 90, heightCm: 210, hinge: "a", swing: "left" }
const doorwayOnOverhang: Doorway = { id: "o1", wallId: "W", anchor: "b", offsetCm: -10, widthCm: 90, heightCm: 210 }

const drawing = (doorways: unknown[], ws: Wall[] = walls): Drawing =>
  ({ id: "a", name: "Чертёж 1", walls: ws, dimensions: [], doorways, view: { zoom: 1, pan: { x: 0, y: 0 } } }) as Drawing
const store = (dr: Drawing): DrawingStore => ({ version: 3, activeId: dr.id, drawings: [dr] })
const roundTrip = (doorways: unknown[]): WallElement[] | undefined => {
  const parsed = parseStore(serializeStore(store(drawing(doorways))))
  return parsed?.store.drawings[0].doorways
}
const loaded = (doorways: unknown[]): WallElement[] | undefined => parseStore(JSON.stringify(store(drawing(doorways))))?.store.drawings[0].doorways

describe("отрицательное расстояние привязки", () => {
  it("T-17: окно на выступе переживает сохранение и загрузку с тем же смещением −10", () => {
    const parsed = parseStore(serializeStore(store(drawing([onOverhang]))))
    expect(parsed?.readOnly).toBe(false)
    expect(parsed?.store.drawings[0].doorways).toEqual([onOverhang])
    expect(parsed?.store.drawings[0].walls).toEqual(walls)
  })

  it("T-17b: сохранённый JSON содержит смещение −10 без изменений", () => {
    const raw = JSON.parse(serializeStore(store(drawing([onOverhang])))) as { drawings: { doorways: { offsetCm: number }[] }[] }
    expect(raw.drawings[0].doorways[0].offsetCm).toBe(-10)
  })

  it("T-17c: дверь и проём на выступе восстанавливаются так же", () => {
    expect(roundTrip([doorOnOverhang, doorwayOnOverhang])).toEqual([doorOnOverhang, doorwayOnOverhang])
  })

  it("T-17d: смещение на выступе дробное (−9.5) сохраняется без округления", () => {
    const e: WallWindow = { ...onOverhang, offsetCm: -9.5 }
    expect(roundTrip([e])).toEqual([e])
  })

  it("T-18: нечисловое расстояние привязки отбрасывается, корректное окно на выступе восстанавливается", () => {
    const bad = [
      { ...onOverhang, id: "null", offsetCm: null },
      { ...onOverhang, id: "str", offsetCm: "-10" },
      { ...onOverhang, id: "undef", offsetCm: undefined },
      { ...onOverhang, id: "nan", offsetCm: Number.NaN },
      { ...onOverhang, id: "inf", offsetCm: Number.POSITIVE_INFINITY },
      { ...onOverhang, id: "ninf", offsetCm: Number.NEGATIVE_INFINITY },
      onOverhang,
    ]
    expect(loaded(bad)).toEqual([onOverhang])
  })

  it("T-18b: остальные проверки элемента остаются: нулевая ширина, нет стороны привязки — отброшены при отрицательном смещении", () => {
    const bad = [
      { ...onOverhang, id: "zero", widthCm: 0 },
      { id: "noanchor", wallId: "W", offsetCm: -10, widthCm: 90, heightCm: 210 },
      { ...onOverhang, id: "badanchor", anchor: "c" },
      { ...onOverhang, id: "noheight", heightCm: 0 },
      onOverhang,
    ]
    expect(loaded(bad)).toEqual([onOverhang])
  })

  it("T-18c: элемент-сирота с отрицательным смещением (нет стены) отбрасывается", () => {
    expect(loaded([{ ...onOverhang, id: "o", wallId: "gone" }, onOverhang])).toEqual([onOverhang])
  })

  it("T-18d: расстояние привязки 1e999 и −1e999 в сыром JSON (не конечное число) — элемент отброшен", () => {
    const base = JSON.stringify(store(drawing([onOverhang])))
    const marker = '"offsetCm":-10'
    expect(base).toContain(marker)
    for (const huge of ["1e999", "-1e999"]) {
      const parsed = parseStore(base.replace(marker, `"offsetCm":${huge}`))
      expect(parsed, huge).not.toBeNull()
      expect(parsed?.store.drawings[0].doorways ?? [], huge).toEqual([])
    }
  })

  it("T-27: смещение −1 на свободной стене без выступа читается и не отбрасывается: окно, проём, дверь", () => {
    const free: Wall = { id: "W", a: { x: 0, y: 0 }, b: { x: 500, y: 0 }, thicknessCm: 20, type: "blocks" }
    const els: WallElement[] = [
      { ...onOverhang, id: "w2", offsetCm: -1 },
      { ...doorwayOnOverhang, id: "o2", offsetCm: -1 },
      { ...doorOnOverhang, id: "d2", offsetCm: -1 },
    ]
    const parsed = parseStore(serializeStore(store(drawing(els, [free]))))
    expect(parsed?.store.drawings[0].doorways).toEqual(els)
  })

  it("T-19: документ с элементами со смещением не меньше 0 читается как прежде", () => {
    const old: WallElement[] = [
      { kind: "window", id: "w0", wallId: "W", anchor: "a", offsetCm: 0, widthCm: 120, heightCm: 150, sillCm: 85 },
      { id: "o0", wallId: "W", anchor: "b", offsetCm: 241, widthCm: 90, heightCm: 200 },
      { kind: "door", id: "d0", wallId: "W", anchor: "a", offsetCm: 100, widthCm: 90, heightCm: 210, hinge: "b", swing: "right" },
    ]
    expect(loaded(old)).toEqual(old)
  })

  it("T-34: нижней границы у смещения нет: −500 см читается и не отбрасывается (нарушенный документ, не потеря данных)", () => {
    const far: WallElement = { ...onOverhang, id: "far", offsetCm: -500 }
    expect(roundTrip([far])).toEqual([far])
  })

  it("T-35: отмена правки, поставившей окно на выступ, возвращает прежнее неотрицательное смещение, повтор — −10", () => {
    const before: WallElement = { ...onOverhang, anchor: "a", offsetCm: 300 }
    const sceneOf = (e: WallElement): Scene => ({ walls, dimensions: [], doorways: [e] })
    const h: DrawingHistory = { past: [], future: [] }
    record(h, sceneOf(before))
    const undone = undoEntry(h, sceneOf(onOverhang))
    expect(undone?.kind === "walls" ? undone.doorways : null).toEqual([before])
    const redone = redoEntry(h, sceneOf(before))
    expect(redone?.kind === "walls" ? redone.doorways : null).toEqual([onOverhang])
  })

  it("T-35b: история со смещением −10 переживает сериализацию и чтение", () => {
    const h: DrawingHistory = { past: [], future: [] }
    record(h, { walls, dimensions: [], doorways: [onOverhang] })
    const hs: HistoryStore = { version: 2, histories: { a: h }, trash: [] }
    const entry = parseHistory(serializeHistory(hs))?.history.histories.a.past[0]
    expect(entry?.kind === "walls" ? entry.doorways : null).toEqual([onOverhang])
  })

  it("T-19b: версия документа остаётся 3", () => {
    const raw = JSON.parse(serializeStore(store(drawing([onOverhang])))) as { version: number }
    expect(raw.version).toBe(3)
  })
})
