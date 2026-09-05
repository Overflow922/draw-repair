import { isScale, DEFAULT_SCALE, normalizeMaterial } from "./types"
import type { Drawing, DrawingStore, Point, View, Wall } from "./types"

const KEY = "draw-repair:drawing"

export interface LoadedStore {
  store: DrawingStore
  readOnly: boolean
}

const isPoint = (p: unknown): p is Point =>
  typeof p === "object" && p !== null && Number.isFinite((p as Point).x) && Number.isFinite((p as Point).y)

const isView = (v: unknown): v is View =>
  typeof v === "object" && v !== null && isPoint((v as View).pan) &&
  Number.isFinite((v as View).zoom) && (v as View).zoom > 0

export const isWall = (w: unknown): w is Wall =>
  typeof w === "object" && w !== null && isPoint((w as Wall).a) && isPoint((w as Wall).b) &&
  typeof (w as Wall).thicknessCm === "number" && (w as Wall).thicknessCm > 0 &&
  typeof (w as Wall).type === "string"

const normalizeWalls = (walls: Wall[]): Wall[] => walls.map((w) => ({ ...w, type: normalizeMaterial(w.type) }))

export const isDrawing = (d: unknown, requireScale: boolean = false): d is Drawing =>
  typeof d === "object" && d !== null && typeof (d as Drawing).id === "string" &&
  typeof (d as Drawing).name === "string" && Array.isArray((d as Drawing).walls) &&
  (d as Drawing).walls.every(isWall) && isView((d as Drawing).view) &&
  (!requireScale || isScale((d as Drawing).scale))

const emptyDrawing = (name: string): Drawing => ({
  id: crypto.randomUUID(),
  name,
  walls: [],
  view: { zoom: 1, pan: { x: 0, y: 0 } },
  scale: DEFAULT_SCALE,
})

const emptyStore = (): DrawingStore => {
  const drawing = emptyDrawing("Чертёж 1")
  return { version: 2, activeId: drawing.id, drawings: [drawing] }
}

export function serializeStore(store: DrawingStore): string {
  return JSON.stringify(store)
}

export function parseStore(raw: string): LoadedStore | null {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof data !== "object" || data === null) return null
  const d = data as Record<string, unknown>
  if (typeof d.version === "number" && d.version > 2) return { store: emptyStore(), readOnly: true }
  if (d.version !== 1 && d.version !== 2) return null
  const v2 = d.version === 2
  if (Array.isArray(d.drawings)) {
    if (
      typeof d.activeId === "string" && d.drawings.every((x) => isDrawing(x, v2)) &&
      d.drawings.some((x) => (x as Drawing).id === d.activeId)
    ) {
      const drawings = (d.drawings as Drawing[]).map((dr) => ({
        ...dr,
        walls: normalizeWalls(dr.walls),
        ...(v2 ? null : { scale: DEFAULT_SCALE }),
      }))
      return { store: { version: 2, activeId: d.activeId, drawings }, readOnly: false }
    }
    return null
  }
  if (!v2 && Array.isArray(d.walls) && d.walls.every(isWall) && isView(d.view)) {
    const drawing: Drawing = {
      id: crypto.randomUUID(),
      name: "Чертёж 1",
      walls: normalizeWalls(d.walls as Wall[]),
      view: d.view,
      scale: DEFAULT_SCALE,
    }
    return { store: { version: 2, activeId: drawing.id, drawings: [drawing] }, readOnly: false }
  }
  return null
}

export function loadStore(): LoadedStore {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw === null ? null : parseStore(raw)
    if (parsed) return parsed
  } catch {}
  return { store: emptyStore(), readOnly: false }
}

export function saveStore(store: DrawingStore): void {
  try {
    localStorage.setItem(KEY, serializeStore(store))
  } catch {}
}
