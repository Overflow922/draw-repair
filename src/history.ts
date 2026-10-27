import { isNoteList } from "./notes/notes-store"
import { historyKey } from "./plans"
import type { PlanId } from "./plans"
import { copyLightFixture, copyStretchCeiling, isBattery, isLightFixture, isBatteryMark, isCallout, isCommunication, isDemolitionMark, isDimension, isDrawing, isDrywallWall, isPlasterMark, isRightAngle, isRoomRecord, isScreed, isFurnitureItem, isPlumbingDimension, isStretchCeiling, isWall, isWallElement, readFurnitureItem } from "./storage"
import type { Battery, BatteryMark, Callout, Communication, DemolitionMark, Dimension, DimPoint, Drawing, LightFixture, PlasterMark, RightAngleMark, RoomRecord, Screed, FurnitureItem, StretchCeiling, Wall, WallElement } from "./types"

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
  // шаг примечаний плана (change add-plan-notes, design D3): список примечаний плана до правки
  | { kind: "notes"; notes: string[] }
  // шаг плана «Черновые работы» (change add-rough-works-plan, design D7): списки штукатурки и стяжек до операции
  // и прямых углов (change plaster-right-angle, design D4); у записи, сохранённой до введения углов, поля нет
  | { kind: "rough"; plaster: PlasterMark[]; screeds: Screed[]; angles?: RightAngleMark[] }
  // шаг плана «Мебель» (change furniture-plan-table, design D9): столы и размеры плана до операции
  | { kind: "furniture"; items: FurnitureItem[]; dimensions: Dimension[] }
  // шаг плана «Сантехника» (change add-plumbing-plan, design D6): размеры плана до операции; приборы — объекты «Мебели»
  | { kind: "plumbing"; dimensions: Dimension[] }
  // шаг плана «Потолки и освещение» (change add-ceiling-plan, design D6): натяжные потолки плана до операции и объекты освещения
  // (change add-ceiling-lighting, design D9); у записи, сохранённой до введения освещения, поля нет
  | { kind: "ceiling"; ceilings: StretchCeiling[]; lights?: LightFixture[] }

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

const cloneDimPoint = (p: DimPoint): DimPoint => {
  if (p.kind === undefined) return { a: { ...p.a }, b: { ...p.b } }
  if (p.kind === "item") return { ...p, at: { ...p.at } }
  return { ...p }
}

export function cloneScene(scene: Scene): Scene {
  return {
    // поля стены переносятся целиком: у стены ГКЛ плана «Реконструкция» есть высота (change reconstruction-plan, design D1)
    walls: scene.walls.map((w) => ({ ...w, a: { x: w.a.x, y: w.a.y }, b: { x: w.b.x, y: w.b.y } })),
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

// Примечания (change add-plan-notes, design D3): как у выносок — работают только с верхней записью вида «notes»,
// при другой записи возвращают null и стеки не меняют; прежние функции отмены записи «notes» не забирают
export function recordNotes(history: DrawingHistory, notes: readonly string[]): void {
  history.past.push({ kind: "notes", notes: [...notes] })
  if (history.past.length > HISTORY_LIMIT) history.past.shift()
  history.future = []
}

export function undoNotes(history: DrawingHistory, current: readonly string[]): string[] | null {
  const e = history.past[history.past.length - 1]
  if (!e || e.kind !== "notes") return null
  history.past.pop()
  history.future.push({ kind: "notes", notes: [...current] })
  return [...e.notes]
}

export function redoNotes(history: DrawingHistory, current: readonly string[]): string[] | null {
  const e = history.future[history.future.length - 1]
  if (!e || e.kind !== "notes") return null
  history.future.pop()
  history.past.push({ kind: "notes", notes: [...current] })
  return [...e.notes]
}

// Штукатурка и стяжки (change add-rough-works-plan, design D7): как у выносок — работают только с верхней записью вида «rough»,
// при другой записи возвращают null и стеки не меняют; прежние функции отмены записи «rough» не забирают
export interface RoughState {
  plaster: PlasterMark[]
  screeds: Screed[]
  angles?: RightAngleMark[]
}

const copyAngle = (a: RightAngleMark): RightAngleMark => ({ id: a.id, corner: [{ ...a.corner[0] }, { ...a.corner[1] }] })

const copyRough = (state: RoughState): RoughState => ({
  plaster: state.plaster.map((m) => ({ ...m })),
  screeds: state.screeds.map((s) => ({ id: s.id, at: { ...s.at }, thicknessMm: s.thicknessMm })),
  ...(state.angles === undefined ? null : { angles: state.angles.map(copyAngle) }),
})

const roughEntry = (state: RoughState): HistoryEntry => ({ kind: "rough", ...copyRough(state) })

export function recordRough(history: DrawingHistory, state: RoughState): void {
  history.past.push(roughEntry(state))
  if (history.past.length > HISTORY_LIMIT) history.past.shift()
  history.future = []
}

export function undoRough(history: DrawingHistory, current: RoughState): RoughState | null {
  const e = history.past[history.past.length - 1]
  if (!e || e.kind !== "rough") return null
  history.past.pop()
  history.future.push(roughEntry(current))
  return copyRough(e)
}

export function redoRough(history: DrawingHistory, current: RoughState): RoughState | null {
  const e = history.future[history.future.length - 1]
  if (!e || e.kind !== "rough") return null
  history.future.pop()
  history.past.push(roughEntry(current))
  return copyRough(e)
}

// Столы и размеры плана «Мебель» (change furniture-plan-table, design D9): как у «Черновых работ» — работают только с верхней
// записью вида «furniture», при другой записи возвращают null и стеки не меняют; прежние функции отмены её не забирают
export interface FurnitureState {
  items: FurnitureItem[]
  dimensions: Dimension[]
}

const copyFurniture = (state: FurnitureState): FurnitureState => ({
  items: state.items.map((t) => ({ ...t })),
  dimensions: cloneScene({ walls: [], dimensions: state.dimensions }).dimensions,
})

const furnitureEntry = (state: FurnitureState): HistoryEntry => ({ kind: "furniture", ...copyFurniture(state) })

export function recordFurniture(history: DrawingHistory, state: FurnitureState): void {
  history.past.push(furnitureEntry(state))
  if (history.past.length > HISTORY_LIMIT) history.past.shift()
  history.future = []
}

export function undoFurniture(history: DrawingHistory, current: FurnitureState): FurnitureState | null {
  const e = history.past[history.past.length - 1]
  if (!e || e.kind !== "furniture") return null
  history.past.pop()
  history.future.push(furnitureEntry(current))
  return copyFurniture(e)
}

export function redoFurniture(history: DrawingHistory, current: FurnitureState): FurnitureState | null {
  const e = history.future[history.future.length - 1]
  if (!e || e.kind !== "furniture") return null
  history.future.pop()
  history.past.push(furnitureEntry(current))
  return copyFurniture(e)
}

// Размеры плана «Сантехника» (change add-plumbing-plan, design D6): как у «Мебели» — работают только с верхней записью вида
// «plumbing», при другой записи возвращают null и стеки не меняют; прежние функции отмены её не забирают
const copyDimensions = (dimensions: readonly Dimension[]): Dimension[] => cloneScene({ walls: [], dimensions: [...dimensions] }).dimensions

const plumbingEntry = (dimensions: readonly Dimension[]): HistoryEntry => ({ kind: "plumbing", dimensions: copyDimensions(dimensions) })

export function recordPlumbing(history: DrawingHistory, dimensions: readonly Dimension[]): void {
  history.past.push(plumbingEntry(dimensions))
  if (history.past.length > HISTORY_LIMIT) history.past.shift()
  history.future = []
}

export function undoPlumbing(history: DrawingHistory, current: readonly Dimension[]): Dimension[] | null {
  const e = history.past[history.past.length - 1]
  if (!e || e.kind !== "plumbing") return null
  history.past.pop()
  history.future.push(plumbingEntry(current))
  return copyDimensions(e.dimensions)
}

export function redoPlumbing(history: DrawingHistory, current: readonly Dimension[]): Dimension[] | null {
  const e = history.future[history.future.length - 1]
  if (!e || e.kind !== "plumbing") return null
  history.future.pop()
  history.past.push(plumbingEntry(current))
  return copyDimensions(e.dimensions)
}

// Натяжные потолки плана «Потолки и освещение» (change add-ceiling-plan, design D6): как у «Сантехники» — работают только с
// верхней записью вида «ceiling», при другой записи возвращают null и стеки не меняют
const ceilingEntry = (ceilings: readonly StretchCeiling[]): HistoryEntry => ({ kind: "ceiling", ceilings: ceilings.map(copyStretchCeiling) })

export function recordCeiling(history: DrawingHistory, ceilings: readonly StretchCeiling[]): void {
  history.past.push(ceilingEntry(ceilings))
  if (history.past.length > HISTORY_LIMIT) history.past.shift()
  history.future = []
}

export function undoCeiling(history: DrawingHistory, current: readonly StretchCeiling[]): StretchCeiling[] | null {
  const e = history.past[history.past.length - 1]
  if (!e || e.kind !== "ceiling") return null
  history.past.pop()
  history.future.push(ceilingEntry(current))
  return e.ceilings.map(copyStretchCeiling)
}

export function redoCeiling(history: DrawingHistory, current: readonly StretchCeiling[]): StretchCeiling[] | null {
  const e = history.future[history.future.length - 1]
  if (!e || e.kind !== "ceiling") return null
  history.future.pop()
  history.past.push(ceilingEntry(current))
  return e.ceilings.map(copyStretchCeiling)
}

// Весь план «Потолки и освещение» (change add-ceiling-lighting, design D9): снимок потолков и объектов освещения; запись без
// поля объектов освещения при отмене и повторе список объектов не меняет
export interface CeilingState {
  ceilings: readonly StretchCeiling[]
  lights: readonly LightFixture[]
}

const ceilingPlanEntry = (s: CeilingState): HistoryEntry => ({ kind: "ceiling", ceilings: s.ceilings.map(copyStretchCeiling), lights: s.lights.map(copyLightFixture) })

const ceilingStateOf = (e: { ceilings: StretchCeiling[]; lights?: LightFixture[] }, current: CeilingState): { ceilings: StretchCeiling[]; lights: LightFixture[] } => ({
  ceilings: e.ceilings.map(copyStretchCeiling),
  lights: (e.lights ?? current.lights).map(copyLightFixture),
})

export function recordCeilingPlan(history: DrawingHistory, state: CeilingState): void {
  history.past.push(ceilingPlanEntry(state))
  if (history.past.length > HISTORY_LIMIT) history.past.shift()
  history.future = []
}

export function undoCeilingPlan(history: DrawingHistory, current: CeilingState): { ceilings: StretchCeiling[]; lights: LightFixture[] } | null {
  const e = history.past[history.past.length - 1]
  if (!e || e.kind !== "ceiling") return null
  history.past.pop()
  history.future.push(ceilingPlanEntry(current))
  return ceilingStateOf(e, current)
}

export function redoCeilingPlan(history: DrawingHistory, current: CeilingState): { ceilings: StretchCeiling[]; lights: LightFixture[] } | null {
  const e = history.future[history.future.length - 1]
  if (!e || e.kind !== "ceiling") return null
  history.future.pop()
  history.past.push(ceilingPlanEntry(current))
  return ceilingStateOf(e, current)
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
  if (!e || e.kind === "callouts" || e.kind === "notes" || e.kind === "rough" || e.kind === "furniture" || e.kind === "plumbing" || e.kind === "ceiling") return null
  history.past.pop()
  history.future.push(e.kind === "walls" ? { kind: "walls", ...cloneScene(scene) } : e)
  return e
}

export function redoEntry(history: DrawingHistory, scene: Scene): HistoryEntry | null {
  const e = history.future[history.future.length - 1]
  if (!e || e.kind === "callouts" || e.kind === "notes" || e.kind === "rough" || e.kind === "furniture" || e.kind === "plumbing" || e.kind === "ceiling") return null
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
  if (x.kind === "notes") return isNoteList(x.notes)
  if (x.kind === "rough")
    return Array.isArray(x.plaster) && x.plaster.every(isPlasterMark) && Array.isArray(x.screeds) && x.screeds.every(isScreed) &&
      (x.angles === undefined || (Array.isArray(x.angles) && x.angles.every(isRightAngle)))
  if (x.kind === "furniture") return Array.isArray(x.items) && x.items.every(isFurnitureItem) && Array.isArray(x.dimensions) && x.dimensions.every(isDimension)
  if (x.kind === "plumbing") return Array.isArray(x.dimensions) && x.dimensions.every(isPlumbingDimension)
  if (x.kind === "ceiling")
    return Array.isArray(x.ceilings) && x.ceilings.every(isStretchCeiling) && (x.lights === undefined || (Array.isArray(x.lights) && x.lights.every(isLightFixture)))
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

// история плана «Реконструкция» (ключ «<id>:reconstruction»): стены снимков — стены ГКЛ с высотой
// (change reconstruction-plan, design D7)
const RECONSTRUCTION_SUFFIX = ":reconstruction"
const isReconstructionHistory = (h: DrawingHistory): boolean =>
  [...h.past, ...h.future].every((e) => e.kind !== "walls" || e.walls.every(isDrywallWall))

const isHistoryStore = (d: unknown): d is HistoryStore => {
  if (typeof d !== "object" || d === null || (d as HistoryStore).version !== 2) return false
  const histories = (d as HistoryStore).histories
  return typeof histories === "object" && histories !== null && !Array.isArray(histories) &&
    Object.entries(histories).every(([key, h]) => isDrawingHistory(h) && (!key.endsWith(RECONSTRUCTION_SUFFIX) || isReconstructionHistory(h))) &&
    Array.isArray((d as HistoryStore).trash) && (d as HistoryStore).trash.every(isTrashEntry)
}

const asRecord = (v: unknown): Record<string, unknown> | null => (typeof v === "object" && v !== null && !Array.isArray(v) ? Object.fromEntries(Object.entries(v)) : null)

// записи «Мебели», сохранённые до каталога видов (change furniture-items-catalog, design D5): предметы лежат в поле tables и
// без вида — переносятся в items и читаются как столы; всё прочее остаётся как есть и проверяется общими правилами
function upgradeFurnitureEntry(entry: unknown): unknown {
  const e = asRecord(entry)
  if (e === null || e.kind !== "furniture" || e.items !== undefined || !Array.isArray(e.tables)) return entry
  const { tables, ...rest } = e
  return { ...rest, items: Array.isArray(tables) ? tables.map((t) => readFurnitureItem(t) ?? t) : tables }
}

function upgradeHistory(data: unknown): unknown {
  const store = asRecord(data)
  const histories = asRecord(store?.histories)
  if (store === null || histories === null) return data
  const upgraded = Object.fromEntries(
    Object.entries(histories).map(([key, h]) => {
      const hist = asRecord(h)
      if (hist === null || !Array.isArray(hist.past) || !Array.isArray(hist.future)) return [key, h]
      return [key, { ...hist, past: hist.past.map(upgradeFurnitureEntry), future: hist.future.map(upgradeFurnitureEntry) }]
    }),
  )
  return { ...store, histories: upgraded }
}

export function parseHistory(raw: string): LoadedHistory | null {
  let data: unknown
  try {
    data = upgradeHistory(JSON.parse(raw))
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
