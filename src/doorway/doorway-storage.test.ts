import { describe, expect, it } from "vitest"
import { cloneScene, parseHistory, record, redoEntry, serializeHistory, undoEntry } from "../history"
import type { DrawingHistory, HistoryEntry, HistoryStore, Scene } from "../history"
import { parseStore, serializeStore } from "../storage"
import type { Doorway, Drawing, DrawingStore, Wall, WallElement } from "../types"

// change add-doorway: хранение и история проёмов
// (spec drawing-storage «Формат документа», «Автосохранение при изменениях»; drawing-history
// «Отменяемые действия», «Персистентность истории»; design D9).
// Чертёж и снимок без поля doorways эквивалентны пустому списку: проверяется `doorways ?? []`,
// так как одобренный roundtrip-тест storage.test.ts сравнивает документ без этого поля.

const W: Wall = { id: "W", a: { x: 0, y: 0 }, b: { x: 500, y: 0 }, thicknessCm: 20, type: "brick" }
const d: Doorway = { id: "d0", wallId: "W", anchor: "b", offsetCm: 241, widthCm: 90, heightCm: 200 }

const drawing = (doorways?: unknown[]): Drawing => {
  const base: Drawing = { id: "a", name: "Чертёж 1", walls: [W], dimensions: [], view: { zoom: 1, pan: { x: 0, y: 0 } }, scale: 100 }
  return doorways === undefined ? base : ({ ...base, doorways } as Drawing)
}
const store = (dr: Drawing): DrawingStore => ({ version: 3, activeId: dr.id, drawings: [dr] })

describe("документ хранилища", () => {
  it("DS-01: сохранённый документ содержит проёмы со всеми полями", () => {
    const raw = JSON.parse(serializeStore(store(drawing([d])))) as { drawings: { doorways: unknown }[] }
    expect(raw.drawings[0].doorways).toEqual([d])
  })

  it("DS-05: круговой обмен сохраняет проём", () => {
    const parsed = parseStore(serializeStore(store(drawing([d]))))
    expect(parsed?.readOnly).toBe(false)
    expect(parsed?.store.drawings[0].doorways).toEqual([d])
  })

  it("DS-02: документ версии 3 без проёмов открывается с пустым списком, стены сохранены", () => {
    const parsed = parseStore(JSON.stringify(store(drawing())))
    expect(parsed).not.toBeNull()
    expect(parsed?.store.drawings[0].doorways ?? []).toEqual([])
    expect(parsed?.store.drawings[0].walls).toEqual([W])
  })

  it("DS-03: битые проёмы отбрасываются, корректный восстанавливается", () => {
    const bad = [
      { ...d, id: "zero", widthCm: 0 },
      { id: "noanchor", wallId: "W", offsetCm: 10, widthCm: 90, heightCm: 210 },
      { ...d, id: "neg", offsetCm: -1 },
      { ...d, id: "noheight", heightCm: 0 },
      { ...d, id: "badanchor", anchor: "c" },
      { ...d, id: "nan", widthCm: "90" },
      { ...d, id: 7 },
      null,
      "x",
      d,
    ]
    const parsed = parseStore(JSON.stringify(store(drawing(bad))))
    expect(parsed).not.toBeNull()
    expect(parsed?.store.drawings[0].doorways).toEqual([d])
    expect(parsed?.store.drawings[0].walls).toEqual([W])
  })

  it("DS-04: проём-сирота (нет стены) отбрасывается при загрузке", () => {
    const orphan = { ...d, id: "o", wallId: "gone" }
    const parsed = parseStore(JSON.stringify(store(drawing([orphan, d]))))
    expect(parsed?.store.drawings[0].doorways).toEqual([d])
  })

  it("DS-06: список проёмов не массив — чертёж открывается с пустым списком", () => {
    const parsed = parseStore(JSON.stringify(store({ ...drawing(), doorways: "oops" } as unknown as Drawing)))
    expect(parsed).not.toBeNull()
    expect(parsed?.store.drawings[0].doorways ?? []).toEqual([])
    expect(parsed?.store.drawings[0].walls).toEqual([W])
  })
})

describe("история", () => {
  const history = (): DrawingHistory => ({ past: [], future: [] })
  const sceneOf = (doorways: Doorway[]): Scene => ({ walls: [W], dimensions: [], doorways })
  const doorwaysOf = (e: HistoryEntry | null): WallElement[] => {
    expect(e?.kind).toBe("walls")
    return e && e.kind === "walls" ? (e.doorways ?? []) : []
  }

  it("DH-01: отмена установки проёма возвращает снимок без него, повтор — с ним", () => {
    const h = history()
    record(h, sceneOf([]))
    const undone = undoEntry(h, sceneOf([d]))
    expect(doorwaysOf(undone)).toEqual([])
    const redone = redoEntry(h, sceneOf([]))
    expect(doorwaysOf(redone)).toEqual([d])
  })

  it("DH-01b: снимок отделён от живых данных — правка проёма после записи не меняет историю", () => {
    const live: Doorway = { ...d }
    const h = history()
    record(h, sceneOf([live]))
    live.offsetCm = 10
    expect(doorwaysOf(undoEntry(h, sceneOf([live])))).toEqual([d])
  })

  it("DH-01c: cloneScene копирует проёмы", () => {
    const s = sceneOf([{ ...d }])
    const c = cloneScene(s)
    expect(c.doorways).toEqual([d])
    expect(c.doorways?.[0]).not.toBe(s.doorways?.[0])
  })

  it("DH-02/DH-03: история с проёмами переживает сериализацию", () => {
    const h = history()
    record(h, sceneOf([d]))
    const hs: HistoryStore = { version: 2, histories: { a: h }, trash: [] }
    const loaded = parseHistory(serializeHistory(hs))
    expect(loaded).not.toBeNull()
    const entry = loaded?.history.histories.a.past[0] ?? null
    expect(doorwaysOf(entry)).toEqual([d])
  })

  it("DH-04: снимок без проёмов читается как пустой список, история не повреждена", () => {
    const raw = JSON.stringify({
      version: 2,
      histories: { a: { past: [{ kind: "walls", walls: [W], dimensions: [] }], future: [] } },
      trash: [],
    })
    const loaded = parseHistory(raw)
    expect(loaded).not.toBeNull()
    expect(loaded?.history.histories.a.past).toHaveLength(1)
    expect(doorwaysOf(loaded?.history.histories.a.past[0] ?? null)).toEqual([])
  })
})
