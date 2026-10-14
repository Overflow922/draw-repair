import { describe, expect, it } from "vitest"
import { cloneScene, parseHistory, record, redoDemolition, recordDemolition, recordMarks, redoEntry, serializeHistory, undoDemolition, undoEntry } from "../history"
import type { DrawingHistory, HistoryStore, Scene } from "../history"
import { isBattery, parseStore, serializeStore } from "../storage"
import type { Dimension, Drawing, DrawingStore, Wall } from "../types"
import { bat } from "./battery.test-utils"

// change add-battery: хранение батарей и пометок их сноса, история (spec drawing-storage «Батареи в документе»; drawing-history;
// design D6, D8, D11; test-plan B-STO-*, B-HIS-*, B-INV-5, B-INV-7).

const W: Wall = { id: "W", a: { x: 0, y: 0 }, b: { x: 500, y: 0 }, thicknessCm: 20, type: "brick" }
const X = bat("W", "a", 100)
const half = bat("W", "a", 224.5, { id: "h", lengthCm: 71 })

const drawing = (extra: Record<string, unknown> = {}): Drawing =>
  ({ id: "a", name: "Чертёж 1", walls: [W], dimensions: [], view: { zoom: 1, pan: { x: 0, y: 0 } }, ...extra }) as Drawing
const store = (dr: Drawing): DrawingStore => ({ version: 3, activeId: dr.id, drawings: [dr] })
const roundTrip = (dr: Drawing): Drawing | undefined => parseStore(serializeStore(store(dr)))?.store.drawings[0]
const loadRaw = (extra: Record<string, unknown>): Drawing | undefined => parseStore(JSON.stringify(store(drawing(extra))))?.store.drawings[0]

describe("документ: батареи обмерочного плана", () => {
  it("B-STO-1: батареи сохраняются и восстанавливаются целиком, включая дробное расстояние 224,5 и грань −1", () => {
    const outer = bat("W", "b", 40, { id: "o", face: -1 })
    expect(roundTrip(drawing({ batteries: [X, half, outer] }))?.batteries).toEqual([X, half, outer])
  })

  it("B-STO-2: старый документ без списка читается без ошибок, список не дописывается, остальное прежнее", () => {
    const loaded = roundTrip(drawing())
    expect(loaded).toBeDefined()
    expect(loaded?.batteries).toBeUndefined()
    expect(loaded?.walls).toEqual([W])
  })

  it("B-STO-2b: версия документа остаётся 3, другие данные не затронуты", () => {
    const raw = JSON.parse(serializeStore(store(drawing({ batteries: [X] })))) as { version: number }
    expect(raw.version).toBe(3)
  })

  it("B-STO-3: пустой список сохраняется пустым", () => {
    expect(roundTrip(drawing({ batteries: [] }))?.batteries).toEqual([])
  })

  it("B-STO-4: недопустимые числа — длина 0, длина −1, толщина 0, отступ −1, строка вместо числа: пропускаются по одной, остальные загружены", () => {
    const bad = [
      { ...X, id: "e1", lengthCm: 0 },
      { ...X, id: "e2", lengthCm: -1 },
      { ...X, id: "e3", thicknessCm: 0 },
      { ...X, id: "e4", gapCm: -1 },
      { ...X, id: "e5", offsetCm: "100" },
      { ...X, id: "e6", face: 2 },
      { ...X, id: "e7", anchor: "c" },
      { ...X, id: "e8", wallId: 5 },
    ]
    const ok = bat("W", "a", 300, { id: "ok" })
    expect(loadRaw({ batteries: [...bad, X, ok] })?.batteries).toEqual([X, ok])
  })

  it("B-STO-4b: отступ 0 допустим (граница), длина и толщина 0,01 допустимы", () => {
    const edge = bat("W", "a", 10, { id: "edge", gapCm: 0, lengthCm: 0.01, thicknessCm: 0.01 })
    expect(loadRaw({ batteries: [edge] })?.batteries).toEqual([edge])
  })

  it("B-STO-5: батарея на отсутствующей стене при загрузке не показывается и не сохраняется", () => {
    const loaded = loadRaw({ batteries: [X, bat("Z", "a", 100, { id: "lost" })] })
    expect(loaded?.batteries).toEqual([X])
    expect(parseStore(serializeStore(store(loaded as Drawing)))?.store.drawings[0].batteries).toEqual([X])
  })

  it("B-STO-5b: поле batteries не массив читается как отсутствующее, остальное загружено", () => {
    const loaded = loadRaw({ batteries: "oops" })
    expect(loaded?.batteries ?? []).toEqual([])
    expect(loaded?.walls).toEqual([W])
  })

  it("B-STO-6: батареи плана «Монтаж» хранятся в содержимом «Монтажа» и не попадают в список обмера", () => {
    const own = bat("W", "a", 300, { id: "own" })
    const loaded = roundTrip(drawing({ mounting: { walls: [], dimensions: [], batteries: [own] } }))
    expect(loaded?.mounting?.batteries).toEqual([own])
    expect(loaded?.batteries).toBeUndefined()
  })

  it("B-STO-6b: «Монтаж» без списка батарей читается как прежде: поле не дописывается", () => {
    const loaded = roundTrip(drawing({ mounting: { walls: [], dimensions: [] } }))
    expect(loaded?.mounting?.batteries).toBeUndefined()
  })

  it("B-STO-6d: батарея «Монтажа» на отсутствующей стене сохраняется в данных (ссылка может вернуться), а такая же батарея обмера пропускается", () => {
    const lost = bat("Z", "a", 100, { id: "lost" })
    const loaded = loadRaw({ batteries: [lost], mounting: { walls: [], dimensions: [], batteries: [lost] } })
    expect(loaded?.batteries).toEqual([])
    expect(loaded?.mounting?.batteries).toEqual([lost])
    expect(roundTrip(loaded as Drawing)?.mounting?.batteries).toEqual([lost])
  })

  it("B-STO-6c: недопустимая батарея «Монтажа» пропускается, допустимая загружается", () => {
    const own = bat("W", "a", 300, { id: "own" })
    const loaded = roundTrip(drawing({ mounting: { walls: [], dimensions: [], batteries: [{ ...own, id: "x", lengthCm: 0 }, own] } }))
    expect(loaded?.mounting?.batteries).toEqual([own])
  })
})

describe("isBattery", () => {
  it("B-STO-4c: распознаёт допустимую батарею и отвергает не-объекты и неполные записи", () => {
    expect(isBattery(X)).toBe(true)
    for (const v of [null, undefined, 5, "b", [], {}, { ...X, id: undefined }, { ...X, id: "" }, { ...X, wallId: "" }, { ...X, offsetCm: Number.NaN }, { ...X, gapCm: Number.POSITIVE_INFINITY }]) {
      expect(isBattery(v)).toBe(false)
    }
  })
})

describe("документ: пометки сноса батарей и размеры к углам", () => {
  it("B-STO-8: пометки сноса сохраняются и восстанавливаются", () => {
    const marks = [{ id: "m1", batteryId: "b0" }]
    expect(roundTrip(drawing({ batteries: [X], batteryDemolition: marks }))?.batteryDemolition).toEqual(marks)
  })

  it("B-STO-8b: пометка на отсутствующую батарею не загружается; пометка существующей остаётся", () => {
    const loaded = loadRaw({ batteries: [X], batteryDemolition: [{ id: "m1", batteryId: "gone" }, { id: "m2", batteryId: "b0" }] })
    expect(loaded?.batteryDemolition).toEqual([{ id: "m2", batteryId: "b0" }])
  })

  it("B-STO-8c: старый документ — списка пометок батарей нет", () => {
    expect(roundTrip(drawing({ batteries: [X] }))?.batteryDemolition).toBeUndefined()
  })

  it("B-STO-7: размер с углом батареи сохраняется и восстанавливается с теми же точками замера", () => {
    const d: Dimension = { from: { kind: "corner", batteryId: "b0", end: "b", side: "front" }, to: { kind: "jamb", elementId: "w0", jamb: "a", face: 1 }, offset: 20 }
    const loaded = roundTrip(drawing({ batteries: [X], dimensions: [d] }))
    expect(loaded?.dimensions).toEqual([d])
  })

  it("B-STO-7b: размер с недопустимым углом (end не a/b) не загружается, прочие размеры остаются", () => {
    const good: Dimension = { from: { kind: "corner", batteryId: "b0", end: "a", side: "back" }, to: { kind: "corner", batteryId: "b0", end: "b", side: "back" }, offset: 5 }
    const bad = { from: { kind: "corner", batteryId: "b0", end: "c", side: "back" }, to: good.to, offset: 5 }
    expect(loadRaw({ batteries: [X], dimensions: [bad, good] })?.dimensions).toEqual([good])
  })

  it("B-STO-7c: угол с side вне back/front и угол с пустым batteryId не загружаются", () => {
    const good: Dimension = { from: { kind: "corner", batteryId: "b0", end: "a", side: "back" }, to: { kind: "corner", batteryId: "b0", end: "b", side: "front" }, offset: 5 }
    const badSide = { from: { kind: "corner", batteryId: "b0", end: "a", side: "left" }, to: good.to, offset: 5 }
    const badId = { from: { kind: "corner", batteryId: "", end: "a", side: "back" }, to: good.to, offset: 5 }
    expect(loadRaw({ batteries: [X], dimensions: [badSide, badId, good] })?.dimensions).toEqual([good])
  })

  it("B-INV-7: загрузка → сохранение → загрузка даёт тот же набор данных", () => {
    const own = bat("W", "a", 300, { id: "own" })
    const dr = drawing({ batteries: [X, half], batteryDemolition: [{ id: "m1", batteryId: "b0" }], mounting: { walls: [], dimensions: [], batteries: [own] } })
    const once = roundTrip(dr)
    const twice = once ? roundTrip(once) : undefined
    expect(twice).toEqual(once)
    expect(once?.batteries).toEqual([X, half])
  })
})

describe("история: сцена с батареями", () => {
  const s0: Scene = { walls: [W], dimensions: [], doorways: [], batteries: [] }
  const s1: Scene = { walls: [W], dimensions: [], doorways: [], batteries: [X] }
  const fresh = (): DrawingHistory => ({ past: [], future: [] })

  it("B-HIS-3: установка отменяется и повторяется: undo возвращает пустой список, redo — батарею", () => {
    const h = fresh()
    record(h, s0)
    const undone = undoEntry(h, s1)
    expect(undone?.kind === "walls" ? undone.batteries : undefined).toEqual([])
    const redone = redoEntry(h, s0)
    expect(redone?.kind === "walls" ? redone.batteries : undefined).toEqual([X])
  })

  it("B-HIS-6: запись без поля batteries список не меняет (поле в записи отсутствует)", () => {
    const h = fresh()
    record(h, { walls: [W], dimensions: [] })
    const e = undoEntry(h, s1)
    expect(e?.kind).toBe("walls")
    expect(e && "batteries" in e).toBe(false)
  })

  it("B-HIS-7: снимок глубоко копируется: правка батареи после записи не меняет запись", () => {
    const h = fresh()
    const scene: Scene = { walls: [W], dimensions: [], batteries: [{ ...X }] }
    record(h, scene)
    if (scene.batteries) scene.batteries[0].offsetCm = 999
    const e = undoEntry(h, s1)
    expect(e?.kind === "walls" ? e.batteries?.[0].offsetCm : undefined).toBe(100)
  })

  it("B-HIS-7b: cloneScene копирует батареи", () => {
    const copy = cloneScene(s1)
    expect(copy.batteries).toEqual([X])
    expect(copy.batteries?.[0]).not.toBe(s1.batteries?.[0])
  })

  it("B-HIS-8: история с батареями сохраняется и читается", () => {
    const h = fresh()
    record(h, s1)
    const raw: HistoryStore = { version: 2, histories: { a: h }, trash: [] }
    const parsed = parseHistory(serializeHistory(raw))
    expect(parsed?.readOnly).toBe(false)
    const entry = parsed?.history.histories.a.past[0]
    expect(entry?.kind === "walls" ? entry.batteries : undefined).toEqual([X])
  })
})

describe("история сноса: пометки стен и батарей одной записью", () => {
  const state = (marks: { id: string; wallId: string; anchor: "a" | "b"; fromCm: number; toCm: number }[], batteryMarks: { id: string; batteryId: string }[]) => ({ marks, batteryMarks })
  const wallMark = { id: "w1", wallId: "W", anchor: "a" as const, fromCm: 0, toCm: 50 }
  const bMark = { id: "m1", batteryId: "b0" }

  it("B-HIS-5: пометка батареи ставится одной записью и отменяется/повторяется вместе с пометками стен", () => {
    const h: DrawingHistory = { past: [], future: [] }
    recordDemolition(h, state([wallMark], []))
    expect(undoDemolition(h, state([wallMark], [bMark]))).toEqual(state([wallMark], []))
    expect(redoDemolition(h, state([wallMark], []))).toEqual(state([wallMark], [bMark]))
  })

  it("B-HIS-5b: запись без списка пометок батарей (старый recordMarks) при отмене оставляет пометки батарей как есть", () => {
    const h: DrawingHistory = { past: [], future: [] }
    recordMarks(h, [wallMark])
    expect(undoDemolition(h, state([], [bMark]))).toEqual(state([wallMark], [bMark]))
  })

  it("B-HIS-5c: отмена на пустой истории — null", () => {
    expect(undoDemolition({ past: [], future: [] }, state([], []))).toBeNull()
    expect(redoDemolition({ past: [], future: [] }, state([], []))).toBeNull()
  })

  it("B-INV-5: undo(redo) возвращает исходное состояние", () => {
    const h: DrawingHistory = { past: [], future: [] }
    const before = state([wallMark], [])
    const after = state([wallMark], [bMark])
    recordDemolition(h, before)
    const undone = undoDemolition(h, after)
    expect(undone).toEqual(before)
    expect(redoDemolition(h, before)).toEqual(after)
  })
})

describe("история: размеры с углами и пометки батарей", () => {
  const cornerDim: Dimension = { from: { kind: "corner", batteryId: "b0", end: "b", side: "front" }, to: { kind: "jamb", elementId: "w0", jamb: "a", face: 1 }, offset: 20 }
  const wallMark = { id: "w1", wallId: "W", anchor: "a" as const, fromCm: 0, toCm: 50 }
  const state = (marks: (typeof wallMark)[], batteryMarks: { id: string; batteryId: string }[]) => ({ marks, batteryMarks })

  it("B-HIS-9: размер с углом батареи входит в снимок и возвращается при отмене тем же (глубокая копия, kind: corner сохранён)", () => {
    const h: DrawingHistory = { past: [], future: [] }
    const scene: Scene = { walls: [W], dimensions: [cornerDim], batteries: [X] }
    const expected = structuredClone([cornerDim])
    record(h, scene)
    scene.dimensions[0].from = { kind: "corner", batteryId: "other", end: "a", side: "back" } // правка после записи не влияет на снимок
    const e = undoEntry(h, { walls: [W], dimensions: [], batteries: [] })
    expect(e?.kind === "walls" ? e.dimensions : undefined).toEqual(expected)
  })

  it("B-HIS-9b: cloneScene копирует точку-угол глубоко", () => {
    const scene: Scene = { walls: [W], dimensions: [cornerDim] }
    const copy = cloneScene(scene)
    expect(copy.dimensions[0]).toEqual(cornerDim)
    expect(copy.dimensions[0].from).not.toBe(cornerDim.from)
  })

  it("B-HIS-10: отмена → повтор → отмена возвращает то же состояние пометок стен и батарей", () => {
    const h: DrawingHistory = { past: [], future: [] }
    const before = state([wallMark], [])
    const after = state([wallMark], [{ id: "m1", batteryId: "b0" }])
    recordDemolition(h, before)
    expect(undoDemolition(h, after)).toEqual(before)
    expect(redoDemolition(h, before)).toEqual(after)
    expect(undoDemolition(h, after)).toEqual(before)
  })

  it("B-HIS-10b: новая запись после отмены очищает повтор: redoDemolition → null", () => {
    const h: DrawingHistory = { past: [], future: [] }
    recordDemolition(h, state([], []))
    undoDemolition(h, state([], [{ id: "m1", batteryId: "b0" }]))
    recordDemolition(h, state([], [{ id: "m2", batteryId: "y" }]))
    expect(redoDemolition(h, state([], []))).toBeNull()
  })

  it("B-HIS-10c: запись копирует пометки: изменение исходного массива после recordDemolition на отмену не влияет", () => {
    const h: DrawingHistory = { past: [], future: [] }
    const batteryMarks = [{ id: "m1", batteryId: "b0" }]
    recordDemolition(h, state([], batteryMarks))
    batteryMarks[0].batteryId = "tampered"
    batteryMarks.push({ id: "m2", batteryId: "y" })
    expect(undoDemolition(h, state([], []))).toEqual(state([], [{ id: "m1", batteryId: "b0" }]))
  })

  it("B-HIS-10d: сериализованная история с пометками батарей читается обратно", () => {
    const h: DrawingHistory = { past: [], future: [] }
    recordDemolition(h, state([wallMark], [{ id: "m1", batteryId: "b0" }]))
    const raw: HistoryStore = { version: 2, histories: { a: h }, trash: [] }
    const parsed = parseHistory(serializeHistory(raw))
    expect(parsed?.readOnly).toBe(false)
    expect(undoDemolition(parsed?.history.histories.a ?? { past: [], future: [] }, state([], []))).toEqual(state([wallMark], [{ id: "m1", batteryId: "b0" }]))
  })
})
