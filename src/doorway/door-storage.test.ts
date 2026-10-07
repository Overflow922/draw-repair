import { describe, expect, it } from "vitest"
import { parseHistory, record, redoEntry, serializeHistory, undoEntry } from "../history"
import type { DrawingHistory, HistoryEntry, HistoryStore, Scene } from "../history"
import { parseStore, serializeStore } from "../storage"
import type { Doorway, Drawing, DrawingStore, Wall, WallDoor, WallElement, WallWindow } from "../types"

// change add-door: хранение и история дверей (spec drawing-storage «Формат документа»;
// drawing-history «Отменяемые действия», «Персистентность истории»; design D7).

const W: Wall = { id: "W", a: { x: 0, y: 0 }, b: { x: 500, y: 0 }, thicknessCm: 20, type: "brick" }
const p: Doorway = { id: "d0", wallId: "W", anchor: "b", offsetCm: 241, widthCm: 90, heightCm: 200 }
const x: WallWindow = { kind: "window", id: "w0", wallId: "W", anchor: "a", offsetCm: 100, widthCm: 120, heightCm: 150, sillCm: 85 }
const d: WallDoor = { kind: "door", id: "dr0", wallId: "W", anchor: "a", offsetCm: 300, widthCm: 80, heightCm: 210, hinge: "b", swing: "right" }

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
  it("DS-01: дверь сохраняется с видом, концом петель и стороной открывания и восстанавливается", () => {
    const raw = JSON.parse(serializeStore(store(drawing([d])))) as { drawings: { doorways: Record<string, unknown>[] }[] }
    expect(raw.drawings[0].doorways[0]).toEqual({ ...d })
    expect(loaded([p, x, d])).toEqual([p, x, d])
  })

  it("DS-01b: все четыре направления проходят roundtrip", () => {
    const all: WallDoor[] = []
    for (const hinge of ["a", "b"] as const)
      for (const swing of ["left", "right"] as const) all.push({ ...d, id: `${hinge}${swing}`, hinge, swing })
    expect(loaded(all)).toEqual(all)
  })

  it("DS-02: лишние поля у двери не сохраняются при загрузке; проём остаётся без вида", () => {
    const list = loaded([{ ...d, sillCm: 85, extra: 1 }, p])
    expect(list).toEqual([d, p])
    const first = list?.[0]
    expect(first && "sillCm" in first).toBe(false)
    const second = list?.[1]
    expect(second && "kind" in second).toBe(false)
  })

  it("DS-03: битые двери отбрасываются, корректная восстанавливается", () => {
    const { hinge: _h, ...noHinge } = d
    const { swing: _s, ...noSwing } = d
    void _h
    void _s
    const bad = [
      { ...noHinge, id: "nohinge" },
      { ...noSwing, id: "noswing" },
      { ...d, id: "up", swing: "up" },
      { ...d, id: "c", hinge: "c" },
      { ...d, id: "num", hinge: 1 },
      { ...d, id: "nul", swing: null },
      { ...d, id: "L", swing: "LEFT" },
    ]
    expect(loaded([...bad, d])).toEqual([d])
  })

  it("DS-04: дверь с неверными общими полями или без стены отбрасывается", () => {
    const { heightCm: _h, ...noHeight } = d
    void _h
    const bad = [
      { ...noHeight, id: "noh" },
      { ...d, id: "w0w", widthCm: 0 },
      { ...d, id: "neg", offsetCm: -1 },
      { ...d, id: "orphan", wallId: "gone" },
      { ...d, id: "anchor", anchor: "c" },
    ]
    expect(loaded([...bad, d])).toEqual([d])
  })
})

describe("история", () => {
  const history = (): DrawingHistory => ({ past: [], future: [] })
  const sceneOf = (doorways: WallElement[]): Scene => ({ walls: [W], dimensions: [], doorways })
  const historyStore = (h: DrawingHistory): HistoryStore => ({ version: 2, histories: { a: h }, trash: [] })

  it("DH-01: снимок с дверью переживает сериализацию; undo возвращает дверь с направлением", () => {
    const h = history()
    record(h, sceneOf([p, d]))
    const parsed = parseHistory(serializeHistory(historyStore(h)))
    expect(parsed).not.toBeNull()
    const restored = parsed?.history.histories.a
    expect(restored).toBeDefined()
    if (!restored) return
    const e: HistoryEntry | null = undoEntry(restored, sceneOf([]))
    expect(e?.kind).toBe("walls")
    if (e?.kind === "walls") expect(e.doorways).toEqual([p, d])
  })

  it("DH-02: поворот двери — отменяемый шаг: undo возвращает прежнее направление, redo — повёрнутое", () => {
    const h = history()
    const before = sceneOf([d])
    const rotated: WallDoor = { ...d, hinge: "a", swing: "right" }
    record(h, before)
    const now = sceneOf([rotated])
    const undone = undoEntry(h, now)
    expect(undone?.kind).toBe("walls")
    if (undone?.kind === "walls") expect(undone.doorways).toEqual([d])
    const redone = redoEntry(h, before)
    expect(redone?.kind).toBe("walls")
    if (redone?.kind === "walls") expect(redone.doorways).toEqual([rotated])
  })

  it("DH-03: битая дверь в снимке ломает структуру истории", () => {
    for (const broken of [{ ...d, swing: "up" }, { ...d, hinge: "c" }, (({ hinge: _h, ...rest }) => rest)(d)]) {
      const h = { past: [{ kind: "walls", walls: [W], dimensions: [], doorways: [broken] }], future: [] }
      const raw = JSON.stringify({ version: 2, histories: { a: h }, trash: [] })
      expect(parseHistory(raw)).toBeNull()
    }
  })

  it("DH-03b: корректная дверь в снимке не ломает историю (контроль)", () => {
    const h = { past: [{ kind: "walls", walls: [W], dimensions: [], doorways: [d] }], future: [] }
    const raw = JSON.stringify({ version: 2, histories: { a: h }, trash: [] })
    expect(parseHistory(raw)).not.toBeNull()
  })
})
