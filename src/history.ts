import { isDrawing, isWall } from "./storage"
import type { Drawing, Wall } from "./types"

const KEY = "draw-repair:history"
export const HISTORY_LIMIT = 50

export type HistoryEntry =
  | { kind: "walls"; walls: Wall[] }
  | { kind: "close"; index: number; drawingId: string }

export interface DrawingHistory {
  past: HistoryEntry[]
  future: HistoryEntry[]
}

export interface TrashEntry {
  index: number
  drawing: Drawing
}

export interface HistoryStore {
  version: 1
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

export function cloneWalls(walls: Wall[]): Wall[] {
  return walls.map((w) => ({ a: { x: w.a.x, y: w.a.y }, b: { x: w.b.x, y: w.b.y }, thicknessCm: w.thicknessCm, type: w.type }))
}

export function record(history: DrawingHistory, walls: Wall[]): void {
  recordSnapshot(history, cloneWalls(walls))
}

export function recordSnapshot(history: DrawingHistory, snapshot: Wall[]): void {
  history.past.push({ kind: "walls", walls: snapshot })
  if (history.past.length > HISTORY_LIMIT) history.past.shift()
  history.future = []
}

export function undoEntry(history: DrawingHistory, walls: Wall[]): HistoryEntry | null {
  const e = history.past.pop()
  if (!e) return null
  history.future.push(e.kind === "walls" ? { kind: "walls", walls: cloneWalls(walls) } : e)
  return e
}

export function redoEntry(history: DrawingHistory, walls: Wall[]): HistoryEntry | null {
  const e = history.future.pop()
  if (!e) return null
  history.past.push(e.kind === "walls" ? { kind: "walls", walls: cloneWalls(walls) } : e)
  return e
}

export function emptyHistory(): HistoryStore {
  return { version: 1, histories: {}, trash: [] }
}

export function serializeHistory(history: HistoryStore): string {
  return JSON.stringify(history)
}

const isHistoryEntry = (e: unknown): e is HistoryEntry => {
  if (typeof e !== "object" || e === null) return false
  const x = e as Record<string, unknown>
  if (x.kind === "walls") return Array.isArray(x.walls) && x.walls.every(isWall)
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
  if (typeof d !== "object" || d === null || (d as HistoryStore).version !== 1) return false
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
  if (typeof d.version === "number" && d.version > 1) return { history: emptyHistory(), readOnly: true }
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
