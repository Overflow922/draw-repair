import { describe, expect, it } from "vitest"
import { parseHistory, record, serializeHistory, undoEntry } from "../history"
import type { DrawingHistory, HistoryEntry, HistoryStore, Scene } from "../history"
import { parseStore, serializeStore } from "../storage"
import type { Doorway, Drawing, DrawingStore, Wall, WallElement, WallWindow } from "../types"

// change add-window: хранение и история окон, совместимость проёмов без вида
// (spec drawing-storage «Формат документа»; drawing-history «Персистентность истории»; design D1, D7).

const W: Wall = { id: "W", a: { x: 0, y: 0 }, b: { x: 500, y: 0 }, thicknessCm: 20, type: "brick" }
const d: Doorway = { id: "d0", wallId: "W", anchor: "b", offsetCm: 241, widthCm: 90, heightCm: 200 }
const x: WallWindow = { kind: "window", id: "w0", wallId: "W", anchor: "a", offsetCm: 100, widthCm: 120, heightCm: 150, sillCm: 85 }

const drawing = (doorways: unknown[]): Drawing =>
  ({ id: "a", name: "Чертёж 1", walls: [W], dimensions: [], view: { zoom: 1, pan: { x: 0, y: 0 } }, scale: 100, doorways }) as Drawing
const store = (dr: Drawing): DrawingStore => ({ version: 3, activeId: dr.id, drawings: [dr] })
const loaded = (doorways: unknown[]): WallElement[] | undefined => {
  const parsed = parseStore(JSON.stringify(store(drawing(doorways))))
  expect(parsed).not.toBeNull()
  expect(parsed?.store.drawings[0].walls).toEqual([W])
  return parsed?.store.drawings[0].doorways
}

describe("документ хранилища", () => {
  it("WS-01: окно сохраняется с видом и подоконником и восстанавливается", () => {
    const raw = JSON.parse(serializeStore(store(drawing([x])))) as { drawings: { doorways: Record<string, unknown>[] }[] }
    expect(raw.drawings[0].doorways[0]).toEqual({ ...x })
    const parsed = parseStore(serializeStore(store(drawing([d, x]))))
    expect(parsed?.store.drawings[0].doorways).toEqual([d, x])
  })

  it("WS-02: проём сохраняется без поля вида", () => {
    const raw = JSON.parse(serializeStore(store(drawing([d, x])))) as { drawings: { doorways: Record<string, unknown>[] }[] }
    expect(Object.keys(raw.drawings[0].doorways[0])).not.toContain("kind")
    expect(Object.keys(raw.drawings[0].doorways[0])).not.toContain("sillCm")
    expect(raw.drawings[0].doorways[1].kind).toBe("window")
  })

  it("WS-03: проём без вида и с видом doorway читается как проём, без подоконника", () => {
    const list = loaded([d, { ...d, id: "d1", kind: "doorway" }])
    expect(list).toHaveLength(2)
    expect(list?.[0]).toEqual(d)
    const second = list?.[1]
    expect(second?.kind ?? "doorway").toBe("doorway")
    expect(second).toMatchObject({ id: "d1", wallId: "W", anchor: "b", offsetCm: 241, widthCm: 90, heightCm: 200 })
    expect(second && "sillCm" in second).toBe(false)
  })

  it("WS-03b: лишний подоконник у проёма не превращает его в окно и не сохраняется", () => {
    const list = loaded([{ ...d, sillCm: 85 }])
    expect(list).toEqual([d])
  })

  it("WS-04: битые окна отбрасываются, окно с подоконником 0 восстанавливается", () => {
    const zero: WallWindow = { ...x, id: "zero", sillCm: 0 }
    const { sillCm: _omit, ...noSill } = x
    void _omit
    const bad = [
      { ...noSill, id: "nosill" },
      { ...x, id: "neg", sillCm: -10 },
      { ...x, id: "str", sillCm: "85" },
      { ...x, id: "nul", sillCm: null },
      { ...x, id: "door", kind: "door" },
      { ...x, id: "noh", heightCm: 0 },
      { ...x, id: "now", widthCm: 0 },
      { ...x, id: "orphan", wallId: "gone" },
      zero,
    ]
    expect(loaded(bad)).toEqual([zero])
  })
})

describe("история", () => {
  const history = (): DrawingHistory => ({ past: [], future: [] })
  const sceneOf = (doorways: WallElement[]): Scene => ({ walls: [W], dimensions: [], doorways })
  const elementsOf = (e: HistoryEntry | null | undefined): WallElement[] => {
    expect(e?.kind).toBe("walls")
    return e && e.kind === "walls" ? (e.doorways ?? []) : []
  }
  const rawHistory = (doorways: unknown[]): string =>
    JSON.stringify({ version: 2, histories: { a: { past: [{ kind: "walls", walls: [W], dimensions: [], doorways }], future: [] } }, trash: [] })

  it("WS-05: снимок с окном переживает сериализацию с подоконником", () => {
    const h = history()
    record(h, sceneOf([d, x]))
    const hs: HistoryStore = { version: 2, histories: { a: h }, trash: [] }
    const back = parseHistory(serializeHistory(hs))
    expect(back).not.toBeNull()
    expect(elementsOf(back?.history.histories.a.past[0])).toEqual([d, x])
  })

  it("WS-06: проёмы без вида в снимках читаются как проёмы", () => {
    const back = parseHistory(rawHistory([d]))
    expect(back).not.toBeNull()
    const [e] = elementsOf(back?.history.histories.a.past[0])
    expect(e?.kind ?? "doorway").toBe("doorway")
    expect(e).toMatchObject(d)
  })

  it("WS-07: одно «Отменить» возвращает и проём, и окно", () => {
    const h = history()
    record(h, sceneOf([d, x]))
    expect(elementsOf(undoEntry(h, sceneOf([])))).toEqual([d, x])
  })

  it("WS-08: битое окно в снимке — история не принимается", () => {
    expect(parseHistory(rawHistory([{ ...x, sillCm: -10 }]))).toBeNull()
    expect(parseHistory(rawHistory([{ ...x, sillCm: "85" }]))).toBeNull()
    const { sillCm: _omit, ...noSill } = x
    void _omit
    expect(parseHistory(rawHistory([noSill]))).toBeNull()
    expect(parseHistory(rawHistory([{ ...x, kind: "door" }]))).toBeNull()
    expect(parseHistory(rawHistory([{ ...x, sillCm: 0 }]))).not.toBeNull()
  })
})
