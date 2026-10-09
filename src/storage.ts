import { isPlanId } from "./plans"
import { isDoor, isScale, isWindow, DEFAULT_SCALE, normalizeMaterial } from "./types"
import type { Dimension, DimPoint, Doorway, Drawing, DrawingStore, EdgeRef, Point, View, Wall, WallDoor, WallElement, WallWindow } from "./types"

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
  typeof (dim as Dimension).offset === "number" && Number.isFinite((dim as Dimension).offset) &&
  ((dim as Dimension).auto === undefined || typeof (dim as Dimension).auto === "string")

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v)

// общие поля элемента стены (spec drawing-storage «Формат документа»)
const hasElementFields = (x: Record<string, unknown>): boolean =>
  typeof x.id === "string" && x.id !== "" && typeof x.wallId === "string" && x.wallId !== "" &&
  (x.anchor === "a" || x.anchor === "b") && num(x.offsetCm) && x.offsetCm >= 0 &&
  num(x.widthCm) && x.widthCm > 0 && num(x.heightCm) && x.heightCm > 0

// проём: без вида или с видом "doorway" (change add-window, design D7)
export const isDoorway = (d: unknown): d is Doorway => {
  if (typeof d !== "object" || d === null) return false
  const x = d as Record<string, unknown>
  return (x.kind === undefined || x.kind === "doorway") && hasElementFields(x)
}

export const isWallWindow = (d: unknown): d is WallWindow => {
  if (typeof d !== "object" || d === null) return false
  const x = d as Record<string, unknown>
  return x.kind === "window" && hasElementFields(x) && num(x.sillCm) && x.sillCm >= 0
}

// дверь: конец петель a/b и сторона открывания left/right (change add-door, design D7)
export const isWallDoor = (d: unknown): d is WallDoor => {
  if (typeof d !== "object" || d === null) return false
  const x = d as Record<string, unknown>
  return x.kind === "door" && hasElementFields(x) && (x.hinge === "a" || x.hinge === "b") && (x.swing === "left" || x.swing === "right")
}

export const isWallElement = (d: unknown): d is WallElement => isDoorway(d) || isWallWindow(d) || isWallDoor(d)

// копия элемента только с полями его вида: проём — без kind и sillCm
export function normalizeElement(e: WallElement): WallElement {
  const base = { id: e.id, wallId: e.wallId, anchor: e.anchor, offsetCm: e.offsetCm, widthCm: e.widthCm, heightCm: e.heightCm }
  if (isWindow(e)) return { kind: "window", ...base, sillCm: e.sillCm }
  if (isDoor(e)) return { kind: "door", ...base, hinge: e.hinge, swing: e.swing }
  return base
}

// элементы чертежа при загрузке: корректные и со своей стеной; отсутствие поля сохраняется (add-doorway design D9)
function loadDoorways(raw: unknown, walls: Wall[]): { doorways?: WallElement[] } {
  if (raw === undefined) return {}
  const ids = new Set(walls.map((w) => w.id))
  const list = Array.isArray(raw) ? raw : []
  return { doorways: list.filter(isWallElement).filter((d) => ids.has(d.wallId)).map(normalizeElement) }
}

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
      const drawings = (d.drawings as Drawing[]).map(({ activePlan, ...dr }) => ({
        ...dr,
        // активный план — необязательное поле: допустимое сохраняется, остальное отбрасывается (drawing-plans design D3)
        ...(isPlanId(activePlan) ? { activePlan } : null),
        walls: assignIds(dr.walls),
        ...loadDoorways(dr.doorways, dr.walls),
        dimensions: (Array.isArray(dr.dimensions) ? dr.dimensions : []).filter(isDimension)
          .map((dim) => ({ from: { ...dim.from }, to: { ...dim.to }, offset: dim.offset, ...(dim.auto !== undefined ? { auto: dim.auto } : null) })),
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
