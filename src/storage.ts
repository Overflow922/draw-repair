import { mergeAll } from "./demolition/marks"
import { isFurnitureKind } from "./furniture/furniture-kinds"
import { normalizeAngle } from "./furniture/item"
import { loadNoteList } from "./notes/notes-store"
import { isPlanId } from "./plans"
import { mergeAllPlaster } from "./rough/plaster-marks"
import { PLASTER_THICKNESS, SCREED_THICKNESS, isThickness } from "./rough/rough-model"
import { isDoor, isWindow, normalizeMaterial } from "./types"
import type { Battery, BatteryCornerPoint, BatteryMark, Callout, Communication, CornerRef, DemolitionMark, Dimension, DimPoint, Doorway, Drawing, DrawingStore, DrywallWall, EdgePoint, EdgeRef, FurnitureContent, JambPoint, MountingContent, PlasterMark, Point, ReconstructionContent, RightAngleMark, RoomRecord, Screed, FurnitureItem, View, Wall, WallDoor, WallElement, WallWindow } from "./types"

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

// точка-откос: kind "jamb", непустой идентификатор элемента, откос a/b, грань 1/-1 (change add-opening-dimension-anchors, design D7)
const isJambPoint = (p: object): p is JambPoint => {
  const x = p as Record<string, unknown>
  return x.kind === "jamb" && typeof x.elementId === "string" && x.elementId !== "" &&
    (x.jamb === "a" || x.jamb === "b") && (x.face === 1 || x.face === -1)
}

// угол батареи: kind "corner", непустой идентификатор батареи, торец a/b, сторона back/front (change add-battery, design D5)
const isCornerPoint = (p: object): p is BatteryCornerPoint => {
  const x = p as Record<string, unknown>
  return x.kind === "corner" && typeof x.batteryId === "string" && x.batteryId !== "" &&
    (x.end === "a" || x.end === "b") && (x.side === "back" || x.side === "front")
}

// без признака вида — пара граней (формат до этого change); любой другой вид, кроме "jamb" и "corner", не принимается
const isDimPoint = (p: unknown): p is DimPoint =>
  typeof p === "object" && p !== null &&
  ((p as DimPoint).kind === undefined ? isEdgeRef((p as EdgePoint).a) && isEdgeRef((p as EdgePoint).b) : isJambPoint(p) || isCornerPoint(p))

export const isDimension = (dim: unknown): dim is Dimension =>
  typeof dim === "object" && dim !== null && isDimPoint((dim as Dimension).from) && isDimPoint((dim as Dimension).to) &&
  typeof (dim as Dimension).offset === "number" && Number.isFinite((dim as Dimension).offset) &&
  ((dim as Dimension).auto === undefined || typeof (dim as Dimension).auto === "string")

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v)

// выноска документа (change add-callout, design D1): строковый id, обе точки, непустой после trim текст
export const isCallout = (c: unknown): c is Callout => {
  if (typeof c !== "object" || c === null) return false
  const x = c as Record<string, unknown>
  return typeof x.id === "string" && x.id !== "" && isPoint(x.target) && isPoint(x.at) && typeof x.text === "string" && x.text.trim() !== ""
}

const copyCallout = (c: Callout): Callout => ({ id: c.id, target: { x: c.target.x, y: c.target.y }, at: { x: c.at.x, y: c.at.y }, text: c.text })

const loadCalloutList = (raw: unknown): Callout[] => (Array.isArray(raw) ? raw.filter(isCallout).map(copyCallout) : [])

// запись помещения (change add-room-explication, design D1): натуральный номер, строка названия, целая высота 1–99999 мм, опорная точка
export const isRoomRecord = (r: unknown): r is RoomRecord => {
  if (typeof r !== "object" || r === null) return false
  const x = r as Record<string, unknown>
  return num(x.number) && Number.isInteger(x.number) && x.number >= 1 && typeof x.name === "string" &&
    num(x.heightMm) && Number.isInteger(x.heightMm) && x.heightMm >= 1 && x.heightMm <= 99999 && isPoint(x.anchor)
}

const copyRoomRecord = (r: RoomRecord): RoomRecord => ({ number: r.number, name: r.name, heightMm: r.heightMm, anchor: { x: r.anchor.x, y: r.anchor.y } })

// записи помещений при загрузке: корректные по одному, при повторе номера остаётся первая; отсутствие поля сохраняется
function loadRooms(raw: unknown): { rooms?: RoomRecord[] } {
  if (!Array.isArray(raw)) return {}
  const seen = new Set<number>()
  const rooms: RoomRecord[] = []
  for (const r of raw.filter(isRoomRecord)) {
    if (seen.has(r.number)) continue
    seen.add(r.number)
    rooms.push(copyRoomRecord(r))
  }
  return { rooms }
}

// общие поля элемента стены (spec drawing-storage «Формат документа»); расстояние привязки — любое конечное число:
// на выступе тела стены за конец оси оно отрицательное, положение вне стены разбирает правило нарушенных документов
// (change fix-opening-reach-body-end, design D3)
const hasElementFields = (x: Record<string, unknown>): boolean =>
  typeof x.id === "string" && x.id !== "" && typeof x.wallId === "string" && x.wallId !== "" &&
  (x.anchor === "a" || x.anchor === "b") && num(x.offsetCm) &&
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

// коммуникация: стояк с диаметром или воздуховод с шириной и глубиной (change add-communications, design D11)
export const isCommunication = (c: unknown): c is Communication => {
  if (typeof c !== "object" || c === null) return false
  const x = c as Record<string, unknown>
  if (typeof x.id !== "string" || x.id === "" || !num(x.x) || !num(x.y)) return false
  if (x.kind === "riser") return num(x.diameterCm) && x.diameterCm > 0
  return x.kind === "duct" && num(x.widthCm) && x.widthCm > 0 && num(x.depthCm) && x.depthCm > 0
}

// копия коммуникации только с полями её вида
const copyCommunication = (c: Communication): Communication =>
  c.kind === "riser"
    ? { kind: "riser", id: c.id, x: c.x, y: c.y, diameterCm: c.diameterCm }
    : { kind: "duct", id: c.id, x: c.x, y: c.y, widthCm: c.widthCm, depthCm: c.depthCm }

// коммуникации чертежа при загрузке: корректные по одному; поле, не являющееся списком, читается как отсутствующее
function loadCommunications(raw: unknown): { communications?: Communication[] } {
  if (!Array.isArray(raw)) return {}
  return { communications: raw.filter(isCommunication).map(copyCommunication) }
}

// пометка сноса (change demolition-plan, design D7): идентификаторы, конец привязки и 0 ≤ fromCm < toCm
export const isDemolitionMark = (m: unknown): m is DemolitionMark => {
  if (typeof m !== "object" || m === null) return false
  const x = m as Record<string, unknown>
  return typeof x.id === "string" && x.id !== "" && typeof x.wallId === "string" && x.wallId !== "" &&
    (x.anchor === "a" || x.anchor === "b") && num(x.fromCm) && num(x.toCm) && x.fromCm >= 0 && x.toCm > x.fromCm
}

// пометки чертежа при загрузке: корректные и со своей стеной, слитые; отсутствие поля сохраняется
function loadDemolition(raw: unknown, walls: Wall[]): { demolition?: DemolitionMark[] } {
  if (!Array.isArray(raw)) return {}
  const ids = new Set(walls.map((w) => w.id))
  return { demolition: mergeAll(raw.filter(isDemolitionMark).filter((m) => ids.has(m.wallId)), walls) }
}

// пометка штукатурки (change add-rough-works-plan, design D7): идентификаторы, грань 1/-1, конец привязки, 0 ≤ fromCm < toCm и
// целая толщина 5–100 мм
export const isPlasterMark = (m: unknown): m is PlasterMark => {
  if (typeof m !== "object" || m === null) return false
  const x = m as Record<string, unknown>
  // откос (change plaster-opening-reveals, design D6): элемент стены и откос вместо стены и конца привязки
  if (x.face === "reveal") {
    return typeof x.id === "string" && x.id !== "" && typeof x.elementId === "string" && x.elementId !== "" &&
      (x.jamb === "a" || x.jamb === "b") && isThickness(x.thicknessMm, PLASTER_THICKNESS)
  }
  const common = typeof x.id === "string" && x.id !== "" && typeof x.wallId === "string" && x.wallId !== "" &&
    (x.anchor === "a" || x.anchor === "b") && isThickness(x.thicknessMm, PLASTER_THICKNESS)
  if (!common) return false
  // торец (change plaster-wall-end-face, design D9): грань «end», участка вдоль оси нет
  if (x.face === "end") return true
  return (x.face === 1 || x.face === -1) && num(x.fromCm) && num(x.toCm) && x.fromCm >= 0 && x.toCm > x.fromCm
}

// стяжка: непустой идентификатор, опорная точка и целая толщина 10–200 мм
export const isScreed = (s: unknown): s is Screed => {
  if (typeof s !== "object" || s === null) return false
  const x = s as Record<string, unknown>
  return typeof x.id === "string" && x.id !== "" && isPoint(x.at) && isThickness(x.thicknessMm, SCREED_THICKNESS)
}

const isCornerRef = (r: unknown): r is CornerRef => {
  if (typeof r !== "object" || r === null) return false
  const x = r as Record<string, unknown>
  return typeof x.markId === "string" && x.markId !== "" && (x.at === "from" || x.at === "to" || x.at === "through")
}

// пометка прямого угла (change plaster-right-angle, design D3): идентификатор и две ссылки на пометки штукатурки, не более одной сквозной
export const isRightAngle = (a: unknown): a is RightAngleMark => {
  if (typeof a !== "object" || a === null) return false
  const x = a as Record<string, unknown>
  if (typeof x.id !== "string" || x.id === "" || !Array.isArray(x.corner) || x.corner.length !== 2) return false
  const [first, second] = x.corner
  return isCornerRef(first) && isCornerRef(second) && !(first.at === "through" && second.at === "through")
}

const copyRightAngle = (a: RightAngleMark): RightAngleMark => ({
  id: a.id,
  corner: [{ markId: a.corner[0].markId, at: a.corner[0].at }, { markId: a.corner[1].markId, at: a.corner[1].at }],
})

const copyPlaster = (m: PlasterMark): PlasterMark => {
  if (m.face === "reveal") return { id: m.id, face: "reveal", elementId: m.elementId, jamb: m.jamb, thicknessMm: m.thicknessMm }
  return m.face === "end"
    ? { id: m.id, wallId: m.wallId, face: "end", anchor: m.anchor, thicknessMm: m.thicknessMm }
    : { id: m.id, wallId: m.wallId, face: m.face, anchor: m.anchor, fromCm: m.fromCm, toCm: m.toCm, thicknessMm: m.thicknessMm }
}

const copyScreed = (s: Screed): Screed => ({ id: s.id, at: { x: s.at.x, y: s.at.y }, thicknessMm: s.thicknessMm })

// штукатурка плана «Черновые работы» при загрузке: корректные пометки, слитые на существующих стенах (обмера и «Монтажа»);
// пометки на отсутствующие стены сохраняются; отсутствие поля и не-список читаются как отсутствие
function loadPlaster(raw: unknown, sources: readonly Wall[]): { roughPlaster?: PlasterMark[] } {
  if (!Array.isArray(raw)) return {}
  return { roughPlaster: mergeAllPlaster(raw.filter(isPlasterMark).map(copyPlaster), sources) }
}

function loadScreeds(raw: unknown): { roughScreeds?: Screed[] } {
  if (!Array.isArray(raw)) return {}
  return { roughScreeds: raw.filter(isScreed).map(copyScreed) }
}

// прямые углы при загрузке: корректные пометки; ссылки на отсутствующую штукатурку сохраняются; отсутствие поля и не-список — отсутствие
function loadRightAngles(raw: unknown): { roughAngles?: RightAngleMark[] } {
  if (!Array.isArray(raw)) return {}
  return { roughAngles: raw.filter(isRightAngle).map(copyRightAngle) }
}

// батарея (change add-battery, design D1): непустые id и стена, грань 1/-1, привязка a/b, конечное расстояние,
// длина и толщина больше нуля, отступ не меньше нуля
export const isBattery = (b: unknown): b is Battery => {
  if (typeof b !== "object" || b === null) return false
  const x = b as Record<string, unknown>
  return typeof x.id === "string" && x.id !== "" && typeof x.wallId === "string" && x.wallId !== "" &&
    (x.face === 1 || x.face === -1) && (x.anchor === "a" || x.anchor === "b") && num(x.offsetCm) &&
    num(x.lengthCm) && x.lengthCm > 0 && num(x.thicknessCm) && x.thicknessCm > 0 && num(x.gapCm) && x.gapCm >= 0
}

const copyBattery = (b: Battery): Battery => ({
  id: b.id,
  wallId: b.wallId,
  face: b.face,
  anchor: b.anchor,
  offsetCm: b.offsetCm,
  lengthCm: b.lengthCm,
  thicknessCm: b.thicknessCm,
  gapCm: b.gapCm,
})

// батареи обмерочного плана при загрузке: корректные и со своей стеной; отсутствие поля сохраняется
function loadBatteries(raw: unknown, walls: Wall[]): { batteries?: Battery[] } {
  if (!Array.isArray(raw)) return {}
  const ids = new Set(walls.map((w) => w.id))
  return { batteries: raw.filter(isBattery).filter((b) => ids.has(b.wallId)).map(copyBattery) }
}

// пометка сноса батареи: непустые идентификаторы пометки и батареи (change add-battery, design D8)
export const isBatteryMark = (m: unknown): m is BatteryMark => {
  if (typeof m !== "object" || m === null) return false
  const x = m as Record<string, unknown>
  return typeof x.id === "string" && x.id !== "" && typeof x.batteryId === "string" && x.batteryId !== ""
}

// пометки сноса батарей при загрузке: корректные и на существующую батарею; отсутствие поля сохраняется
function loadBatteryDemolition(raw: unknown, batteries: readonly Battery[]): { batteryDemolition?: BatteryMark[] } {
  if (!Array.isArray(raw)) return {}
  const ids = new Set(batteries.map((b) => b.id))
  return { batteryDemolition: raw.filter(isBatteryMark).filter((m) => ids.has(m.batteryId)).map((m) => ({ id: m.id, batteryId: m.batteryId })) }
}

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
  isView((d as Drawing).view)

const assignIds = (walls: Wall[]): Wall[] =>
  walls.map((w) => ({ ...w, id: w.id || crypto.randomUUID(), type: normalizeMaterial(w.type) }))

const copyDimPoint = (p: DimPoint): DimPoint => {
  if (p.kind === "jamb") return { kind: "jamb", elementId: p.elementId, jamb: p.jamb, face: p.face }
  if (p.kind === "corner") return { kind: "corner", batteryId: p.batteryId, end: p.end, side: p.side }
  return { a: { ...p.a }, b: { ...p.b } }
}

const copyDimension = (dim: Dimension): Dimension =>
  ({ from: copyDimPoint(dim.from), to: copyDimPoint(dim.to), offset: dim.offset, ...(dim.auto !== undefined ? { auto: dim.auto } : null) })

// объекты плана «Монтаж» при загрузке (change mounting-plan, design D4): некорректные стены, размеры и элементы
// отбрасываются по одному; ссылки на отсутствующие стены сохраняются (объект может вернуться); поле, не являющееся
// объектом, читается как отсутствующее; список элементов не дописывается
function loadMounting(raw: unknown): { mounting?: MountingContent } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {}
  const x = raw as Record<string, unknown>
  const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
  const notes = loadNoteList(x.notes) // примечания плана (change add-plan-notes, design D1): не список — как отсутствующее поле
  return {
    mounting: {
      walls: assignIds(list(x.walls).filter(isWallBase)),
      dimensions: list(x.dimensions).filter(isDimension).map(copyDimension),
      ...(x.doorways === undefined ? null : { doorways: list(x.doorways).filter(isWallElement).map(normalizeElement) }),
      ...(x.batteries === undefined ? null : { batteries: list(x.batteries).filter(isBattery).map(copyBattery) }),
      ...(x.callouts === undefined ? null : { callouts: loadCalloutList(x.callouts) }),
      ...(notes === undefined ? null : { notes }),
    },
  }
}

// стена ГКЛ плана «Реконструкция» (change reconstruction-plan, design D7): непустой идентификатор, обе точки, толщина и высота
// больше нуля; тип при загрузке не читается — стена всегда «ГКЛ». Идентификатор не восстанавливается: стена без него отбрасывается
const isStoredDrywall = (w: unknown): boolean => {
  if (typeof w !== "object" || w === null) return false
  const x = w as Record<string, unknown>
  return typeof x.id === "string" && x.id !== "" && isPoint(x.a) && isPoint(x.b) && num(x.thicknessCm) && x.thicknessCm > 0 && num(x.heightCm) && x.heightCm > 0
}

// стена ГКЛ в истории: та же проверка, что в документе, плюс тип «ГКЛ» снимка
export const isDrywallWall = (w: unknown): w is DrywallWall => isStoredDrywall(w) && (w as Wall).type === "gkl"

const copyDrywall = (w: DrywallWall): DrywallWall => ({
  id: w.id,
  a: { x: w.a.x, y: w.a.y },
  b: { x: w.b.x, y: w.b.y },
  thicknessCm: w.thicknessCm,
  type: "gkl",
  heightCm: w.heightCm,
})

// объекты плана «Реконструкция» при загрузке: некорректные стены и размеры отбрасываются по одному; размеры на отсутствующие стены
// сохраняются; поле, не являющееся объектом, читается как отсутствующее; выноски и примечания — по общим правилам
function loadReconstruction(raw: unknown): { reconstruction?: ReconstructionContent } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {}
  const x = raw as Record<string, unknown>
  const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
  const notes = loadNoteList(x.notes)
  return {
    reconstruction: {
      walls: list(x.walls).filter(isStoredDrywall).map((w) => copyDrywall(w as DrywallWall)),
      dimensions: list(x.dimensions).filter(isDimension).map(copyDimension),
      ...(x.callouts === undefined ? null : { callouts: loadCalloutList(x.callouts) }),
      ...(notes === undefined ? null : { notes }),
    },
  }
}

// предмет мебели плана «Мебель» (change furniture-plan-table, design D9; change furniture-items-catalog, design D1): вид из
// каталога, непустой идентификатор, числа центра и угла, ширина и длина больше нуля
export const isFurnitureItem = (t: unknown): t is FurnitureItem => {
  if (typeof t !== "object" || t === null) return false
  const x = t as Record<string, unknown>
  return isFurnitureKind(x.kind) && typeof x.id === "string" && x.id !== "" && num(x.x) && num(x.y) && num(x.angleDeg) && num(x.widthCm) && x.widthCm > 0 && num(x.lengthCm) && x.lengthCm > 0
}

// предмет из документа или истории: без вида (до введения каталога видов) читается как стол, неизвестный вид — битый (null);
// угол вне диапазона [0, 360) приводится при загрузке
export function readFurnitureItem(raw: unknown): FurnitureItem | null {
  if (typeof raw !== "object" || raw === null) return null
  const item = "kind" in raw ? raw : { ...raw, kind: "table" }
  if (!isFurnitureItem(item)) return null
  return { id: item.id, kind: item.kind, x: item.x, y: item.y, widthCm: item.widthCm, lengthCm: item.lengthCm, angleDeg: normalizeAngle(item.angleDeg) }
}

// объекты плана «Мебель» при загрузке: некорректные столы и размеры отбрасываются по одному; размеры на отсутствующие стены
// сохраняются; поле, не являющееся объектом, читается как отсутствующее; выноски и примечания — по общим правилам
function loadFurniture(raw: unknown): { furniture?: FurnitureContent } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {}
  const x = raw as Record<string, unknown>
  const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
  const notes = loadNoteList(x.notes)
  return {
    furniture: {
      // чертёж до введения каталога видов хранил предметы в поле tables
      items: list(x.items ?? x.tables).flatMap((i) => readFurnitureItem(i) ?? []),
      dimensions: list(x.dimensions).filter(isDimension).map(copyDimension),
      ...(x.callouts === undefined ? null : { callouts: loadCalloutList(x.callouts) }),
      ...(notes === undefined ? null : { notes }),
    },
  }
}

const emptyDrawing = (name: string): Drawing => ({
  id: crypto.randomUUID(),
  name,
  walls: [],
  dimensions: [],
  view: { zoom: 1, pan: { x: 0, y: 0 } },
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
      const drawings = (d.drawings as Drawing[]).map(({ activePlan, demolition, mounting, batteryDemolition, ...dr }): Drawing => {
        const batteries = loadBatteries(dr.batteries, dr.walls)
        const notes = loadNoteList(dr.notes)
        const demolitionNotes = loadNoteList(dr.demolitionNotes)
        const roughNotes = loadNoteList(dr.roughNotes)
        const mountingPart = loadMounting(mounting)
        const walls = assignIds(dr.walls)
        return {
          // поля чертежа перечислены явно: масштаб, записанный прежними версиями, в модель не попадает (drawing-storage)
          id: dr.id,
          name: dr.name,
          view: dr.view,
          // активный план — необязательное поле: допустимое сохраняется, остальное отбрасывается (drawing-plans design D3)
          ...(isPlanId(activePlan) ? { activePlan } : null),
          walls,
          ...loadDemolition(demolition, dr.walls),
          ...mountingPart,
          ...loadDoorways(dr.doorways, dr.walls),
          ...loadCommunications(dr.communications),
          ...batteries,
          ...loadBatteryDemolition(batteryDemolition, batteries.batteries ?? []),
          ...(Array.isArray(dr.callouts) ? { callouts: loadCalloutList(dr.callouts) } : null),
          ...(Array.isArray(dr.demolitionCallouts) ? { demolitionCallouts: loadCalloutList(dr.demolitionCallouts) } : null),
          ...(notes === undefined ? null : { notes }),
          ...(demolitionNotes === undefined ? null : { demolitionNotes }),
          ...loadPlaster(dr.roughPlaster, [...walls, ...(mountingPart.mounting?.walls ?? [])]),
          ...loadScreeds(dr.roughScreeds),
          ...loadRightAngles(dr.roughAngles),
          ...(Array.isArray(dr.roughCallouts) ? { roughCallouts: loadCalloutList(dr.roughCallouts) } : null),
          ...(roughNotes === undefined ? null : { roughNotes }),
          ...loadRooms(dr.rooms),
          ...loadReconstruction(dr.reconstruction),
          ...loadFurniture(dr.furniture),
          dimensions: (Array.isArray(dr.dimensions) ? dr.dimensions : []).filter(isDimension).map(copyDimension),
        }
      })
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
