import { historyKey } from "./plans"
import type { PlanId } from "./plans"
import { isBattery, isBatteryMark, isCallout, isCommunication, isDemolitionMark, isDimension, isDrawing, isRoomRecord, isWall, isWallElement } from "./storage"
import type { Battery, BatteryMark, Callout, Communication, DemolitionMark, Dimension, DimPoint, Drawing, RoomRecord, Wall, WallElement } from "./types"

const KEY = "draw-repair:history"
export const HISTORY_LIMIT = 50

// doorways: отсутствие — пустой список (change add-doorway, design D9)
export interface Scene {
  walls: Wall[]
  dimensions: Dimension[]
  doorways?: WallElement[]
  // коммуникации: запись без поля при отмене и повторе список не меняет (change add-communications, design D11)
  communications?: Communication[]
  // батареи: запись без поля при отмене и повторе список не меняет (change add-battery, design D6)
  batteries?: Battery[]
  // данные помещений плана «Монтаж»: запись без поля при отмене и повторе данные не меняет (change add-room-explication, design D2)
  rooms?: RoomRecord[]
}

export type HistoryEntry =
  | { kind: "walls"; walls: Wall[]; dimensions: Dimension[]; doorways?: WallElement[]; communications?: Communication[]; batteries?: Battery[]; rooms?: RoomRecord[] }
  | { kind: "close"; index: number; drawingId: string }
  // шаг плана «Демонтаж» (change demolition-plan, design D7): список пометок чертежа до операции; пометки сноса
  // батарей — в той же записи (change add-battery, design D8), в старой записи их нет
  | { kind: "demolition"; marks: DemolitionMark[]; batteryMarks?: BatteryMark[] }
  // шаг выносок плана (change add-callout, design D3): список выносок плана до операции; стек истории — того плана, чей список
  | { kind: "callouts"; callouts: Callout[] }

export interface DrawingHistory {
  past: HistoryEntry[]
  future: HistoryEntry[]
}

export interface TrashEntry {
  index: number
  drawing: Drawing
}

export interface HistoryStore {
  version: 2
  histories: Record<string, DrawingHistory>
  trash: TrashEntry[]
}

export interface LoadedHistory {
  history: HistoryStore
  readOnly: boolean
}

export function drawingHistory(history: HistoryStore, id: string): DrawingHistory {
  return (history.histories[id] ??= { past: [], future: [] })
}

// история плана чертежа; у обмерочного плана это прежняя история чертежа (change drawing-plans, design D4)
export function planHistory(history: HistoryStore, drawingId: string, plan: PlanId): DrawingHistory {
  return drawingHistory(history, historyKey(drawingId, plan))
}

const cloneDimPoint = (p: DimPoint): DimPoint => (p.kind === undefined ? { a: { ...p.a }, b: { ...p.b } } : { ...p })

export function cloneScene(scene: Scene): Scene {
  return {
    walls: scene.walls.map((w) => ({ id: w.id, a: { x: w.a.x, y: w.a.y }, b: { x: w.b.x, y: w.b.y }, thicknessCm: w.thicknessCm, type: w.type })),
    dimensions: scene.dimensions.map((d) => ({
      from: cloneDimPoint(d.from),
      to: cloneDimPoint(d.to),
      offset: d.offset,
      ...(d.auto !== undefined ? { auto: d.auto } : null),
    })),
    ...(scene.doorways ? { doorways: scene.doorways.map((d) => ({ ...d })) } : null),
    ...(scene.communications ? { communications: scene.communications.map((c) => ({ ...c })) } : null),
    ...(scene.batteries ? { batteries: scene.batteries.map((b) => ({ ...b })) } : null),
    ...(scene.rooms ? { rooms: scene.rooms.map((r) => ({ ...r, anchor: { ...r.anchor } })) } : null),
  }
}

export function record(history: DrawingHistory, scene: Scene): void {
  recordSnapshot(history, cloneScene(scene))
}

export function recordSnapshot(history: DrawingHistory, snapshot: Scene): void {
  history.past.push({ kind: "walls", ...snapshot })
  if (history.past.length > HISTORY_LIMIT) history.past.shift()
  history.future = []
}

const copyMarks = (marks: readonly DemolitionMark[]): DemolitionMark[] => marks.map((m) => ({ ...m }))

export function recordMarks(history: DrawingHistory, marks: readonly DemolitionMark[]): void {
  history.past.push({ kind: "demolition", marks: copyMarks(marks) })
  if (history.past.length > HISTORY_LIMIT) history.past.shift()
  history.future = []
}

const copyCallouts = (list: readonly Callout[]): Callout[] => list.map((c) => ({ id: c.id, target: { ...c.target }, at: { ...c.at }, text: c.text }))

// Выноски (change add-callout, design D3): отмена и повтор работают только с верхней записью вида «callouts» — при другой
// записи возвращают null и стеки не меняют; прежние функции отмены записи «callouts» не забирают
export function recordCallouts(history: DrawingHistory, callouts: readonly Callout[]): void {
  history.past.push({ kind: "callouts", callouts: copyCallouts(callouts) })
  if (history.past.length > HISTORY_LIMIT) history.past.shift()
  history.future = []
}

export function undoCallouts(history: DrawingHistory, current: readonly Callout[]): Callout[] | null {
  const e = history.past[history.past.length - 1]
  if (!e || e.kind !== "callouts") return null
  history.past.pop()
  history.future.push({ kind: "callouts", callouts: copyCallouts(current) })
  return copyCallouts(e.callouts)
}

export function redoCallouts(history: DrawingHistory, current: readonly Callout[]): Callout[] | null {
  const e = history.future[history.future.length - 1]
  if (!e || e.kind !== "callouts") return null
  history.future.pop()
  history.past.push({ kind: "callouts", callouts: copyCallouts(current) })
  return copyCallouts(e.callouts)
}

// отмена: снимок из past возвращается, текущие пометки кладутся в future (в истории плана «Демонтаж» только такие записи)
export function undoMarks(history: DrawingHistory, current: readonly DemolitionMark[]): DemolitionMark[] | null {
  const e = history.past[history.past.length - 1]
  if (!e || e.kind !== "demolition") return null
  history.past.pop()
  history.future.push({ kind: "demolition", marks: copyMarks(current) })
  return copyMarks(e.marks)
}

export function redoMarks(history: DrawingHistory, current: readonly DemolitionMark[]): DemolitionMark[] | null {
  const e = history.future[history.future.length - 1]
  if (!e || e.kind !== "demolition") return null
  history.future.pop()
  history.past.push({ kind: "demolition", marks: copyMarks(current) })
  return copyMarks(e.marks)
}

// состояние плана «Демонтаж»: пометки стен и пометки сноса батарей (change add-battery, design D8)
export interface DemolitionState {
  marks: DemolitionMark[]
  batteryMarks: BatteryMark[]
}

const copyBatteryMarks = (marks: readonly BatteryMark[]): BatteryMark[] => marks.map((m) => ({ ...m }))

const demolitionEntry = (state: DemolitionState): HistoryEntry => ({ kind: "demolition", marks: copyMarks(state.marks), batteryMarks: copyBatteryMarks(state.batteryMarks) })

export function recordDemolition(history: DrawingHistory, state: DemolitionState): void {
  history.past.push(demolitionEntry(state))
  if (history.past.length > HISTORY_LIMIT) history.past.shift()
  history.future = []
}

// состояние из записи; запись без пометок батарей (прежний формат) оставляет текущие пометки батарей как есть
const stateOf = (e: HistoryEntry & { kind: "demolition" }, current: DemolitionState): DemolitionState => ({
  marks: copyMarks(e.marks),
  batteryMarks: copyBatteryMarks(e.batteryMarks ?? current.batteryMarks),
})

export function undoDemolition(history: DrawingHistory, current: DemolitionState): DemolitionState | null {
  const e = history.past[history.past.length - 1]
  if (!e || e.kind !== "demolition") return null
  history.past.pop()
  history.future.push(demolitionEntry(current))
  return stateOf(e, current)
}

export function redoDemolition(history: DrawingHistory, current: DemolitionState): DemolitionState | null {
  const e = history.future[history.future.length - 1]
  if (!e || e.kind !== "demolition") return null
  history.future.pop()
  history.past.push(demolitionEntry(current))
  return stateOf(e, current)
}

export function undoEntry(history: DrawingHistory, scene: Scene): HistoryEntry | null {
  const e = history.past[history.past.length - 1]
  if (!e || e.kind === "callouts") return null
  history.past.pop()
  history.future.push(e.kind === "walls" ? { kind: "walls", ...cloneScene(scene) } : e)
  return e
}

export function redoEntry(history: DrawingHistory, scene: Scene): HistoryEntry | null {
  const e = history.future[history.future.length - 1]
  if (!e || e.kind === "callouts") return null
  history.future.pop()
  history.past.push(e.kind === "walls" ? { kind: "walls", ...cloneScene(scene) } : e)
  return e
}

export function emptyHistory(): HistoryStore {
  return { version: 2, histories: {}, trash: [] }
}

export function serializeHistory(history: HistoryStore): string {
  return JSON.stringify(history)
}

const isHistoryEntry = (e: unknown): e is HistoryEntry => {
  if (typeof e !== "object" || e === null) return false
  const x = e as Record<string, unknown>
  if (x.kind === "walls")
    return Array.isArray(x.walls) && x.walls.every(isWall) &&
      Array.isArray(x.dimensions) && x.dimensions.every(isDimension) &&
      (x.doorways === undefined || (Array.isArray(x.doorways) && x.doorways.every(isWallElement))) &&
      (x.communications === undefined || (Array.isArray(x.communications) && x.communications.every(isCommunication))) &&
      (x.batteries === undefined || (Array.isArray(x.batteries) && x.batteries.every(isBattery))) &&
      (x.rooms === undefined || (Array.isArray(x.rooms) && x.rooms.every(isRoomRecord)))
  if (x.kind === "demolition")
    return Array.isArray(x.marks) && x.marks.every(isDemolitionMark) &&
      (x.batteryMarks === undefined || (Array.isArray(x.batteryMarks) && x.batteryMarks.every(isBatteryMark)))
  if (x.kind === "callouts") return Array.isArray(x.callouts) && x.callouts.every(isCallout)
  return x.kind === "close" && typeof x.drawingId === "string" &&
    typeof x.index === "number" && Number.isInteger(x.index) && x.index >= 0
}

const isDrawingHistory = (h: unknown): h is DrawingHistory =>
  typeof h === "object" && h !== null && Array.isArray((h as DrawingHistory).past) &&
  Array.isArray((h as DrawingHistory).future) &&
  (h as DrawingHistory).past.every(isHistoryEntry) && (h as DrawingHistory).future.every(isHistoryEntry)

const isTrashEntry = (t: unknown): t is TrashEntry =>
  typeof t === "object" && t !== null && typeof (t as TrashEntry).index === "number" &&
  Number.isInteger((t as TrashEntry).index) && (t as TrashEntry).index >= 0 &&
  isDrawing((t as TrashEntry).drawing)

const isHistoryStore = (d: unknown): d is HistoryStore => {
  if (typeof d !== "object" || d === null || (d as HistoryStore).version !== 2) return false
  const histories = (d as HistoryStore).histories
  return typeof histories === "object" && histories !== null && !Array.isArray(histories) &&
    Object.values(histories).every(isDrawingHistory) &&
    Array.isArray((d as HistoryStore).trash) && (d as HistoryStore).trash.every(isTrashEntry)
}

export function parseHistory(raw: string): LoadedHistory | null {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof data !== "object" || data === null) return null
  const d = data as Record<string, unknown>
  if (typeof d.version === "number" && d.version > 2) return { history: emptyHistory(), readOnly: true }
  if (d.version === 1) return { history: emptyHistory(), readOnly: false }
  if (!isHistoryStore(data)) return null
  return { history: data, readOnly: false }
}

export function loadHistory(): LoadedHistory {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw === null ? null : parseHistory(raw)
    if (parsed) return parsed
  } catch {}
  return { history: emptyHistory(), readOnly: false }
}

export function saveHistory(history: HistoryStore): void {
  try {
    localStorage.setItem(KEY, serializeHistory(history))
  } catch {}
}
