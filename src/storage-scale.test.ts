import { afterEach, describe, expect, it, vi } from "vitest"
import { loadStore, parseStore, saveStore, serializeStore } from "./storage"
import type { Drawing, DrawingStore } from "./types"

// change auto-fit-scale: масштаб печати не хранится в чертеже, а прежнее значение игнорируется (spec drawing-storage
// «Формат документа» — сценарии «Масштаб не записывается», «Прежде сохранённый масштаб игнорируется»; миграции
// версий 1 и 2; design D3; test-plan T-40…T-43).

const WALL = { id: "w1", a: { x: 0, y: 0 }, b: { x: 300, y: 0 }, thicknessCm: 20, type: "brick" }
const DIM = {
  from: { a: { wallId: "w1", edge: 2 }, b: { wallId: "w1", edge: 0 } },
  to: { a: { wallId: "w1", edge: 3 }, b: { wallId: "w1", edge: 0 } },
  offset: 30,
}
const VIEW = { zoom: 1.5, pan: { x: -10, y: 20 } }

// чертёж документа в виде «сырых» данных: scale задаётся тестом (или опускается), как у прежних версий приложения
const rawDrawing = (id: string, name: string, extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  id,
  name,
  walls: [WALL],
  dimensions: [DIM],
  view: VIEW,
  ...extra,
})

const rawStore = (version: number, drawings: Record<string, unknown>[]): string =>
  JSON.stringify({ version, activeId: "a", drawings })

function load(raw: string): DrawingStore {
  const loaded = parseStore(raw)
  if (!loaded) throw new Error("документ не прочитан")
  expect(loaded.readOnly).toBe(false)
  return loaded.store
}

const hasScaleKey = (d: unknown): boolean => typeof d === "object" && d !== null && "scale" in d

const parsedDrawings = (json: string): unknown[] => {
  const doc: unknown = JSON.parse(json)
  if (typeof doc !== "object" || doc === null || !("drawings" in doc) || !Array.isArray(doc.drawings)) throw new Error("нет drawings")
  return doc.drawings
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("масштаб не записывается", () => {
  it("T-40: после загрузки и сохранения в JSON чертежей нет поля scale", () => {
    const store = load(rawStore(3, [rawDrawing("a", "Чертёж 1"), rawDrawing("b", "Чертёж 2")]))
    const drawings = parsedDrawings(serializeStore(store))
    expect(drawings).toHaveLength(2)
    for (const d of drawings) expect(hasScaleKey(d)).toBe(false)
  })

  it("T-40: новый пустой чертёж (пустое хранилище) сохраняется без поля scale", () => {
    const written: string[] = []
    vi.stubGlobal("localStorage", {
      getItem: (): string | null => null,
      setItem: (_key: string, value: string): void => {
        written.push(value)
      },
    })
    const { store } = loadStore()
    expect(store.drawings).toHaveLength(1)
    saveStore(store)
    expect(written).toHaveLength(1)
    const drawings = parsedDrawings(written[0] ?? "")
    expect(drawings).toHaveLength(1)
    expect(hasScaleKey(drawings[0])).toBe(false)
  })

  it("T-40: прочие данные чертежа при сохранении остаются: стены, размеры, вид, имя", () => {
    const store = load(rawStore(3, [rawDrawing("a", "Чертёж 1")]))
    const saved: Drawing[] = load(serializeStore(store)).drawings
    expect(saved).toHaveLength(1)
    expect(saved[0]?.name).toBe("Чертёж 1")
    expect(saved[0]?.walls).toHaveLength(1)
    expect(saved[0]?.dimensions).toHaveLength(1)
    expect(saved[0]?.view).toEqual(VIEW)
  })
})

describe("прежде сохранённый масштаб игнорируется", () => {
  it.each([
    ["допустимый прежде 50", 50],
    ["допустимый прежде 100", 100],
    ["значение вне ряда 75", 75],
    ["значение вне прежнего ряда 1000", 1000],
    ["нулевое значение", 0],
    ["отрицательное значение", -5],
    ["строка", "100"],
    ["null", null],
    ["объект", { x: 1 }],
  ] as const)("T-41/T-42: scale — %s: чертёж не отброшен, поля scale в модели нет", (_name, value) => {
    const store = load(rawStore(3, [rawDrawing("a", "Чертёж 1", { scale: value }), rawDrawing("b", "Чертёж 2")]))
    expect(store.drawings.map((d) => d.name)).toEqual(["Чертёж 1", "Чертёж 2"])
    expect(store.activeId).toBe("a")
    for (const d of store.drawings) {
      expect(hasScaleKey(d), d.name).toBe(false)
      expect(d.walls).toHaveLength(1)
      expect(d.dimensions).toHaveLength(1)
      expect(d.view).toEqual(VIEW)
    }
  })

  it("T-41: чертёж версии 3 без поля scale открывается как обычный", () => {
    const store = load(rawStore(3, [rawDrawing("a", "Чертёж 1")]))
    expect(store.drawings).toHaveLength(1)
    expect(store.drawings[0]?.walls).toHaveLength(1)
  })

  it("T-41/T-42: после перезагрузки с игнорированием scale сохранённый документ не содержит его", () => {
    const store = load(rawStore(3, [rawDrawing("a", "Чертёж 1", { scale: 50 })]))
    for (const d of parsedDrawings(serializeStore(store))) expect(hasScaleKey(d)).toBe(false)
  })

  it("T-41: документ с неподходящим scale не считается повреждённым (приложение не открывается пустым)", () => {
    const loaded = parseStore(rawStore(3, [rawDrawing("a", "Мой чертёж", { scale: 12345 })]))
    expect(loaded).not.toBeNull()
    expect(loaded?.store.drawings[0]?.name).toBe("Мой чертёж")
  })
})

describe("миграции прежних версий без масштаба", () => {
  it("T-43: документ версии 2 открывается, масштаб в модель не попадает, остальное сохранено", () => {
    const v2walls = [{ a: { x: 0, y: 0 }, b: { x: 300, y: 0 }, thicknessCm: 20, type: "brick" }]
    const raw = JSON.stringify({
      version: 2,
      activeId: "a",
      drawings: [{ id: "a", name: "Чертёж 1", walls: v2walls, view: VIEW, scale: 200 }],
    })
    const store = load(raw)
    expect(store.version).toBe(3)
    const d = store.drawings[0]
    expect(d?.walls).toHaveLength(1)
    expect(d?.walls[0]?.id).toBeTruthy()
    expect(d?.dimensions).toEqual([])
    expect(d?.view).toEqual(VIEW)
    expect(hasScaleKey(d)).toBe(false)
  })

  it("T-43: документ версии 2 с недопустимым scale тоже открывается", () => {
    const v2walls = [{ a: { x: 0, y: 0 }, b: { x: 300, y: 0 }, thicknessCm: 20, type: "brick" }]
    const raw = JSON.stringify({
      version: 2,
      activeId: "a",
      drawings: [{ id: "a", name: "Чертёж 1", walls: v2walls, view: VIEW, scale: 75 }],
    })
    const loaded = parseStore(raw)
    expect(loaded).not.toBeNull()
    expect(loaded?.store.drawings[0]?.walls).toHaveLength(1)
  })

  it("T-43: документ версии 1 (конверт) открывается без масштаба по умолчанию", () => {
    const raw = JSON.stringify({ version: 1, activeId: "a", drawings: [{ id: "a", name: "Чертёж 1", walls: [WALL], view: VIEW }] })
    const store = load(raw)
    expect(store.version).toBe(3)
    expect(store.drawings[0]?.walls).toHaveLength(1)
    expect(hasScaleKey(store.drawings[0])).toBe(false)
  })

  it("T-43: одиночный документ версии 1 открывается без масштаба по умолчанию", () => {
    const raw = JSON.stringify({ version: 1, walls: [{ a: { x: 0, y: 0 }, b: { x: 300, y: 0 }, thicknessCm: 20, type: "brick" }], view: VIEW })
    const store = load(raw)
    expect(store.drawings).toHaveLength(1)
    expect(hasScaleKey(store.drawings[0])).toBe(false)
  })
})
