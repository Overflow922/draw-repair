import { isScale, DEFAULT_SCALE, normalizeMaterial } from "./types"
import type { Dimension, Drawing, DrawingStore, DimPoint, EdgeRef, Point, View, Wall } from "./types"

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

const isWallBase = (w: unknown): w is Wall =>
  typeof w === "object" && w !== null && isPoint((w as Wall).a) && isPoint((w as Wall).b) &&
  typeof (w as Wall).thicknessCm === "number" && (w as Wall).thicknessCm > 0 &&
  typeof (w as Wall).type === "string"

export const isWall = (w: unknown): w is Wall =>
  isWallBase(w) && typeof (w as Wall).id === "string" && (w as Wall).id !== ""

const isEdgeRef = (e: unknown): e is EdgeRef =>
  typeof e === "object" && e !== null && typeof (e as EdgeRef).wallId === "string" && (e as EdgeRef).wallId !== "" &&
  typeof (e as EdgeRef).edge === "number" && Number.isInteger((e as EdgeRef).edge) &&
  (e as EdgeRef).edge >= 0 && (e as EdgeRef).edge <= 3

const isDimPoint = (p: unknown): p is DimPoint =>
  typeof p === "object" && p !== null && isEdgeRef((p as DimPoint).a) && isEdgeRef((p as DimPoint).b)

export const isDimension = (dim: unknown): dim is Dimension =>
  typeof dim === "object" && dim !== null && isDimPoint((dim as Dimension).from) && isDimPoint((dim as Dimension).to) &&
  typeof (dim as Dimension).offset === "number" && Number.isFinite((dim as Dimension).offset)

export const isDrawing = (d: unknown, version: number = 3): d is Drawing =>
  typeof d === "object" && d !== null && typeof (d as Drawing).id === "string" &&
  typeof (d as Drawing).name === "string" && Array.isArray((d as Drawing).walls) &&
  (d as Drawing).walls.every(version >= 3 ? isWall : isWallBase) &&
  (version < 3 || Array.isArray((d as Drawing).dimensions)) &&
  isView((d as Drawing).view) && (version < 2 || isScale((d as Drawing).scale))

const assignIds = (walls: Wall[]): Wall[] =>
  walls.map((w) => ({ ...w, id: w.id || crypto.randomUUID(), type: normalizeMaterial(w.type) }))

const emptyDrawing = (name: string): Drawing => ({
  id: crypto.randomUUID(),
  name,
  walls: [],
  dimensions: [],
  view: { zoom: 1, pan: { x: 0, y: 0 } },
  scale: DEFAULT_SCALE,
})

const emptyStore = (): DrawingStore => {
  const drawing = emptyDrawing("Чертёж 1")
  return { version: 3, activeId: drawing.id, drawings: [drawing] }
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
  if (typeof d.version === "number" && d.version > 3) return { store: emptyStore(), readOnly: true }
  if (d.version !== 1 && d.version !== 2 && d.version !== 3) return null
  const version = d.version as 1 | 2 | 3
  if (Array.isArray(d.drawings)) {
    if (
      typeof d.activeId === "string" && d.drawings.every((x) => isDrawing(x, version)) &&
      d.drawings.some((x) => (x as Drawing).id === d.activeId)
    ) {
      const drawings = (d.drawings as Drawing[]).map((dr) => ({
        ...dr,
        walls: assignIds(dr.walls),
        dimensions: (Array.isArray(dr.dimensions) ? dr.dimensions : []).filter(isDimension)
          .map((dim) => ({ from: { ...dim.from }, to: { ...dim.to }, offset: dim.offset })),
        ...(version === 1 ? { scale: DEFAULT_SCALE } : null),
      }))
      return { store: { version: 3, activeId: d.activeId, drawings }, readOnly: false }
    }
    return null
  }
  if (version === 1 && Array.isArray(d.walls) && (d.walls as Wall[]).every(isWallBase) && isView(d.view)) {
    const drawing: Drawing = {
      id: crypto.randomUUID(),
      name: "Чертёж 1",
      walls: assignIds(d.walls as Wall[]),
      dimensions: [],
      view: d.view,
      scale: DEFAULT_SCALE,
    }
    return { store: { version: 3, activeId: drawing.id, drawings: [drawing] }, readOnly: false }
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
