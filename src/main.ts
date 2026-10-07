import "./style.css"
import { cloneScene, drawingHistory, loadHistory, record, recordSnapshot, redoEntry, saveHistory, undoEntry } from "./history"
import type { Scene } from "./history"
import { dimGeometry, dimHitDistance, dimLevelSnap, dimensionOffsetAt, endpointAt, hitWall, midpointAt, nearestEdgeIntersection, dimPointPoint, pointsEqual, segmentIntersectsRect, snap, snapOthers, snapWithSource, zoomAt } from "./geometry"
import type { DimGeometry, SnapResult } from "./geometry"
import { moveEndpointBounded, moveWallsBounded, resizeWallBounded } from "./wall-edit"
import type { EditMode } from "./wall-edit"
import { chainEndSquare, placementSquare, snapRadiusCm, snapStartVertex, wallClickAction } from "./wall-snap"
import type { VertexSnap } from "./wall-snap"
import { parseAngleDeg, startRefOf } from "./wall-angle"
import { orthoGestureStep, startOrthoGesture } from "./ortho-gesture"
import type { OrthoGesture } from "./ortho-gesture"
import type { StartRef } from "./wall-angle"
import { chainSegment } from "./wall-chain"
import type { ChainSegment } from "./wall-chain"
import { drawPatternPreview, render } from "./render"
import { rulerReading } from "./ruler"
import { availableFormats, exportDrawing, PAGE_FORMATS_MM } from "./export/pdf"
import type { PageFormat } from "./export/pdf"
import { loadStore, saveStore } from "./storage"
import { thicknessAllowed, violatesDoorways } from "./doorway/doorway-guard"
import { deleteObjects, doorwaysInRect, erasePick, wallsInRect } from "./doorway/doorway-scene"
import { createElementTool } from "./doorway/doorway-tool"
import type { ElementToolHost } from "./doorway/doorway-tool"
import { loadThemeChoice, paletteOf, resolveTheme, saveThemeChoice, themeToggleTitle, toggledTheme } from "./theme"
import type { Theme } from "./theme"
import { GRID_STEP_CM, MATERIALS, PX_PER_CM, isWindow } from "./types"
import type { Dimension, DimPoint, Drawing, Material, Point, Unit, View, Wall, WallElement } from "./types"

const canvas = document.querySelector<HTMLCanvasElement>("#canvas")!
const canvasWrap = document.querySelector<HTMLElement>("#canvas-wrap")!
const thicknessInput = document.querySelector<HTMLInputElement>("#thickness")!
const thicknessUnitLabel = document.querySelector<HTMLElement>("#thickness-unit")!
const lengthInput = document.querySelector<HTMLInputElement>("#length")!
const angleInput = document.querySelector<HTMLInputElement>("#angle")!
const unitRow = document.querySelector<HTMLElement>("#unit-row")!
const wallTypesRow = document.querySelector<HTMLElement>("#wall-types")!
const orthoToggle = document.querySelector<HTMLButtonElement>("#ortho-toggle")!
const themeToggle = document.querySelector<HTMLButtonElement>("#theme-toggle")!
const tabsEl = document.querySelector<HTMLElement>("#tabs")!
const tabAdd = document.querySelector<HTMLButtonElement>("#tab-add")!
const undoBtn = document.querySelector<HTMLButtonElement>("#undo-btn")!
const redoBtn = document.querySelector<HTMLButtonElement>("#redo-btn")!
const toolWallBtn = document.querySelector<HTMLButtonElement>("#tool-wall")!
const toolDimensionBtn = document.querySelector<HTMLButtonElement>("#tool-dimension")!
const toolEraserBtn = document.querySelector<HTMLButtonElement>("#tool-eraser")!
const toolRulerBtn = document.querySelector<HTMLButtonElement>("#tool-ruler")!
const wallPanel = document.querySelector<HTMLElement>("#wall-panel")!
const pdfScale = document.querySelector<HTMLSelectElement>("#pdf-scale")!
const pdfFormat = document.querySelector<HTMLSelectElement>("#pdf-format")!
const pdfExportBtn = document.querySelector<HTMLButtonElement>("#pdf-export")!
const dimPanel = document.querySelector<HTMLElement>("#dim-panel")!
const dimOffsetInput = document.querySelector<HTMLInputElement>("#dim-offset")!
const dimOffsetUnitLabel = document.querySelector<HTMLElement>("#dim-offset-unit")!
const dimValueInput = document.querySelector<HTMLInputElement>("#dim-value")!
const toolDoorwayBtn = document.querySelector<HTMLButtonElement>("#tool-doorway")!
const doorwayPanel = document.querySelector<HTMLElement>("#doorway-panel")!
const doorwayWidthInput = document.querySelector<HTMLInputElement>("#doorway-width")!
const doorwayHeightInput = document.querySelector<HTMLInputElement>("#doorway-height")!
const toolWindowBtn = document.querySelector<HTMLButtonElement>("#tool-window")!
const windowPanel = document.querySelector<HTMLElement>("#window-panel")!
const windowWidthInput = document.querySelector<HTMLInputElement>("#window-width")!
const windowHeightInput = document.querySelector<HTMLInputElement>("#window-height")!
const windowSillInput = document.querySelector<HTMLInputElement>("#window-sill")!

const loaded = loadStore()
const readOnly = loaded.readOnly
const store = loaded.store
const loadedHistory = loadHistory()
const historyReadOnly = loadedHistory.readOnly
const historyStore = loadedHistory.history
const current = () => store.drawings.find((d) => d.id === store.activeId)!
let walls: Wall[] = current().walls
let dimensions: Dimension[] = current().dimensions
// элементы стен (проёмы и окна) активного чертежа (change add-doorway, add-window); в чертёж пишутся
// при первом изменении
let doorways: WallElement[] = current().doorways ?? []
let selectedDoorways: WallElement[] = []
let chainStart: Point | null = null
let cursor: Point | null = null
let chainRef: StartRef | null = null // стена примыкания начала (из прилипания первого клика)
let segment: ChainSegment | null = null // сегмент построения: превью и фиксация
let cursorSnap: VertexSnap | null = null // сам результат привязки: normal в нём неперечислима
let wallCursorRaw: Point | null = null // сырая позиция курсора последней привязки — для пересчёта
let thicknessCm = 20
let wallMaterial: Material = "brick"
let unit: Unit = "mm"
let lengthDirty = false
let angleDirty = false
let view: View = current().view
let dirty = false
let selectedWalls: Wall[] = []
let selectedDimensions: Dimension[] = []
let endpointDrag: { wall: Wall; end: "a" | "b"; base: Point; snapshot: Scene; gesture: OrthoGesture } | null = null
let groupMove: { group: Wall[]; pressed: Wall; baseA: Point; grab: Point; others: Wall[]; snapshot: Scene; gesture: OrthoGesture } | null = null
let dimDraft: { a: DimPoint | null; b: DimPoint | null } = { a: null, b: null }
let dimDrag: { dim: Dimension; baseOffset: number; snapshot: Scene } | null = null
let suppressClick = false
let ortho = true
let wallPanelOpen = false
let nudgeBurst = false
let marqueePending: { x: number; y: number } | null = null
let marquee: { x1: number; y1: number; x2: number; y2: number } | null = null
let marqueeHits: { walls: Wall[]; dims: Dimension[]; doorways: WallElement[] } | null = null
const MARQUEE_THRESHOLD_PX = 5
type Tool = "wall" | "dimension" | "doorway" | "window" | "eraser" | "ruler" | "none"
let tool: Tool = "wall"
const systemDark = window.matchMedia("(prefers-color-scheme: dark)")
let themeChoice: Theme | null = loadThemeChoice(localStorage) // null — следовать системной настройке
let theme: Theme = resolveTheme(themeChoice, systemDark.matches)

const emptyDraft = (): { a: DimPoint | null; b: DimPoint | null } => ({ a: null, b: null })

const endPoint = (end: DimPoint): Point | null => dimPointPoint(end, walls)

const radiusCm = (): number => snapRadiusCm(view.zoom)

// текущая сцена чертежа: стены, размеры, проёмы (снимок истории — change add-doorway)
const scene = (): Scene => ({ walls, dimensions, doorways })

const pushRecord = (): void => {
  nudgeBurst = false
  record(drawingHistory(historyStore, store.activeId), scene())
}

// список проёмов заменяется целиком: правки проёма возвращают новый объект
function setDoorways(next: WallElement[]): void {
  doorways = next
  current().doorways = next
  selectedDoorways = selectedDoorways.filter((d) => next.includes(d))
}

function replaceDoorway(prev: WallElement, next: WallElement): void {
  selectedDoorways = selectedDoorways.map((d) => (d === prev ? next : d))
  setDoorways(doorways.map((d) => (d === prev ? next : d)))
}

// инструменты «Проём» и «Окно» (change add-doorway design D8, add-window design D4): состояние чертежа
// и выделения — здесь; выбор, перетаскивание, числа и стрелки — через doorwayTool для элементов любого вида
const elementHost: ElementToolHost = {
    walls: () => walls,
    elements: () => doorways,
    selectedElements: () => selectedDoorways,
    othersSelected: () => selectedWalls.length > 0 || selectedDimensions.length > 0,
    view: () => view,
    radiusCm: () => radiusCm(),
    formatCm: (cm) => formatCm(cm, unit),
    parseCm: (text) => parseFloat(text.replace(",", ".")) * UNIT_TO_CM[unit],
    unitLabel: () => UNIT_LABEL[unit],
    editorParent: canvasWrap,
    snapshot: () => cloneScene(scene()),
    record: () => pushRecord(),
    recordSnapshot: (s) => pushSnapshot(s),
    recordNudge: (before) => {
      if (!nudgeBurst) pushSnapshot(before)
      nudgeBurst = true
    },
    add: (d) => setDoorways([...doorways, d]),
    replace: (prev, next) => replaceDoorway(prev, next),
    select: (d) => selectDoorway(d),
    clearSelection: () => clearSelection(),
    changed: () => {
      dirty = true
    },
    redraw: () => redraw(),
}
const doorwayTool = createElementTool("doorway", elementHost, { root: doorwayPanel, width: doorwayWidthInput, height: doorwayHeightInput })
const windowTool = createElementTool("window", elementHost, {
  root: windowPanel,
  width: windowWidthInput,
  height: windowHeightInput,
  sill: windowSillInput,
})
const elementTools = [doorwayTool, windowTool]

// инструмент установки активного вида; null — вне инструментов «Проём» и «Окно»
const placingTool = () => (tool === "window" ? windowTool : tool === "doorway" ? doorwayTool : null)

// открыта панель вида одиночного выделенного элемента, иначе — активного инструмента
function setDoorwayPanel(open: boolean): void {
  const sel = selectedDoorways.length === 1 ? selectedDoorways[0] : null
  const windowKind = sel ? isWindow(sel) : tool === "window"
  doorwayTool.setPanel(open && !windowKind)
  windowTool.setPanel(open && windowKind)
}

const closeDoorwayEditor = (): void => {
  for (const t of elementTools) t.closeEditor()
}

const resetElementTools = (): void => {
  for (const t of elementTools) t.reset()
}

function selectDoorway(d: WallElement): void {
  closeDoorwayEditor()
  selectedDoorways = [d]
  selectedWalls = []
  selectedDimensions = []
  lengthDirty = false
  setWallPanel(false)
  setDimPanel(false)
  setDoorwayPanel(true)
  redraw()
}

const pushSnapshot = (snapshot: Scene): void => {
  nudgeBurst = false
  recordSnapshot(drawingHistory(historyStore, store.activeId), snapshot)
}

function setWallPanel(open: boolean): void {
  wallPanelOpen = open
  wallPanel.classList.toggle("open", open)
}

function setDimPanel(open: boolean): void {
  dimPanel.classList.toggle("open", open)
}

function selectDimension(dim: Dimension): void {
  closeDoorwayEditor()
  selectedDimensions = [dim]
  selectedWalls = []
  selectedDoorways = []
  lengthDirty = false
  setWallPanel(false)
  setDoorwayPanel(false)
  setDimPanel(true)
  redraw()
}

function clearDimSelection(): void {
  if (!selectedDimensions.length) return
  selectedDimensions = []
  setDimPanel(false)
  redraw()
}

function selectWall(wall: Wall): void {
  closeDoorwayEditor()
  selectedWalls = [wall]
  selectedDimensions = []
  selectedDoorways = []
  lengthDirty = false
  setDimPanel(false)
  setDoorwayPanel(false)
  syncThicknessBox()
  setWallMaterial(wall.type)
  setWallPanel(true)
}

function clearSelection(): void {
  closeDoorwayEditor()
  selectedWalls = []
  selectedDimensions = []
  selectedDoorways = []
  lengthDirty = false
  nudgeBurst = false
  setWallPanel(false)
  setDimPanel(false)
  redraw()
}

function syncToolUI(): void {
  toolWallBtn.classList.toggle("active", tool === "wall")
  toolDimensionBtn.classList.toggle("active", tool === "dimension")
  toolEraserBtn.classList.toggle("active", tool === "eraser")
  toolRulerBtn.classList.toggle("active", tool === "ruler")
  toolDoorwayBtn.classList.toggle("active", tool === "doorway")
  toolWindowBtn.classList.toggle("active", tool === "window")
  canvas.classList.toggle("tool-eraser", tool === "eraser")
}

function setTool(next: Tool): void {
  if (tool === next) return
  tool = next
  clearChain()
  closeDoorwayEditor()
  dimDraft = emptyDraft()
  lengthDirty = false
  selectedWalls = []
  selectedDimensions = []
  selectedDoorways = []
  resetElementTools()
  suppressClick = false
  nudgeBurst = false
  groupMove = null
  marquee = null
  marqueeHits = null
  marqueePending = null
  setWallPanel(false)
  setDimPanel(false)
  setDoorwayPanel(false)
  syncToolUI()
  syncThicknessBox()
  redraw()
}

const UNIT_TO_CM: Record<Unit, number> = { m: 100, cm: 1, mm: 0.1 }
const UNIT_LABEL: Record<Unit, string> = { m: "м", cm: "см", mm: "мм" }

function formatCm(cm: number, u: Unit): string {
  if (u === "m") return (Math.round(cm) / 100).toString()
  if (u === "cm") return String(Math.round(cm))
  return String(Math.round(cm / UNIT_TO_CM[u]))
}

function syncThicknessBox(): void {
  thicknessInput.value = formatCm(selectedWalls.length === 1 ? selectedWalls[0].thicknessCm : thicknessCm, unit)
  thicknessUnitLabel.textContent = UNIT_LABEL[unit]
}

function syncDimPanel(): void {
  dimOffsetUnitLabel.textContent = UNIT_LABEL[unit]
  if (selectedDimensions.length !== 1) return
  const dim = selectedDimensions[0]
  const a = endPoint(dim.from)
  const b = endPoint(dim.to)
  dimValueInput.value = a && b ? formatCm(Math.hypot(b.x - a.x, b.y - a.y), unit) : ""
  if (dimDrag || document.activeElement !== dimOffsetInput) dimOffsetInput.value = formatCm(dim.offset, unit)
}

function typedLengthCm(): number | null {
  const v = parseFloat(lengthInput.value.replace(",", "."))
  return Number.isFinite(v) && v > 0 ? v * UNIT_TO_CM[unit] : null
}

function previewLengthCm(): number | null {
  // конец превью — с учётом трекинга по узлам, а не точка привязки к сетке
  const end = segment?.end ?? cursor
  if (!chainStart || !end) return null
  const base = chainStart
  if (pointsEqual(base, end)) return null
  return Math.hypot(end.x - base.x, end.y - base.y)
}

function typedAngleDeg(): number | null {
  return angleDirty ? parseAngleDeg(angleInput.value) : null
}

// сброс незавершённой стены: начало, опора, сегмент, введённый угол
function clearChain(): void {
  chainStart = null
  chainRef = null
  segment = null
  angleDirty = false
}

function liveLengthCm(): number | null {
  if (chainStart) return previewLengthCm()
  const sel = selectedWalls.length === 1 ? selectedWalls[0] : null
  if (!sel || pointsEqual(sel.a, sel.b)) return null
  return Math.hypot(sel.b.x - sel.a.x, sel.b.y - sel.a.y)
}

// ввод длины с ограничениями (change wall-move-bounds, design D7): подвижный — непримкнутый конец,
// длина ограничивается касанием; поле приводится к фактической длине при фиксации ввода
function resizeSelected(): void {
  const len = typedLengthCm()
  if (!len || selectedWalls.length !== 1) return
  const before = cloneScene(scene())
  const result = resizeWallBounded(walls, selectedWalls[0], len, { ortho, doorways })
  if (result.kind === "rejected") return
  pushSnapshot(before)
  dirty = true
}

function updateLengthBox(): void {
  if (lengthDirty) return
  const cm = liveLengthCm()
  lengthInput.value = cm === null ? "" : formatCm(cm, unit)
  if (document.activeElement === lengthInput) lengthInput.select()
}

// поле угла активно только при построении от стены примыкания
function updateAngleBox(): void {
  const active = tool === "wall" && chainStart !== null && chainRef !== null
  angleInput.disabled = !active
  if (!active) {
    angleInput.value = ""
    return
  }
  if (angleDirty) return
  const deg = segment?.angleDeg ?? null
  angleInput.value = deg === null ? "" : String(Math.round(deg))
  if (document.activeElement === angleInput) angleInput.select()
}

function syncHistoryButtons(): void {
  const h = drawingHistory(historyStore, store.activeId)
  undoBtn.disabled = h.past.length === 0
  redoBtn.disabled = h.future.length === 0
}

function drawPatternPreviews(): void {
  for (const btn of wallTypesRow.querySelectorAll<HTMLButtonElement>(".wall-type"))
    drawPatternPreview(btn.querySelector("canvas")!, btn.dataset.material as Material, paletteOf(theme))
}

function redraw(): void {
  const p = chainStart && segment ? segment.end : null
  const target = tool === "eraser" && cursor ? eraserTarget(cursor) : { wall: null, dim: null, doorway: null }
  const draft = dimDraftGeometry()
  const snapHit = tool === "dimension" && cursor && (!dimDraft.a || !dimDraft.b) ? nearestEdgeIntersection(cursor, walls, radiusCm()) : null
  let previewWall: Wall | null = null
  if (chainStart && p) previewWall = { id: "", a: chainStart, b: p, thicknessCm, type: wallMaterial }
  let square: Point[] | null = null
  if (tool === "wall" && cursor) {
    // на свободном конце: прилип к стене — квадрат установки у грани, иначе последний блок вдоль сегмента
    if (chainStart && p && segment?.dir) square = chainEndSquare(p, segment.dir, segment.snap, thicknessCm)
    // до первого клика — квадрат, приставленный к грани/торцу снаружи, или по осям без прилипания
    else if (!chainStart && cursorSnap) square = placementSquare(cursorSnap, thicknessCm)
  }
  render(canvas, walls, previewWall, unit, view, selectedWalls, {
    hover: target.wall,
    hoverDim: target.dim,
    dimensions,
    dimDraft: draft,
    dimRubber: !dimDraft.a || dimDraft.b || !cursor ? null : draftRubber(snapHit?.point ?? cursor),
    dimSnap: snapHit?.point ?? null,
    selectedDims: selectedDimensions,
    doorways,
    selectedDoorways,
    doorwayGhost: placingTool()?.ghost() ?? null,
    hoverDoorway: target.doorway,
    marquee,
    marqueeHits,
    square,
    angle:
      chainStart && segment?.dir && segment.refRay && segment.angleDeg !== null
        ? { at: chainStart, from: segment.refRay, to: segment.dir, deg: segment.angleDeg }
        : null,
    tracks: tool === "wall" && chainStart && segment ? segment.tracks : null,
    ruler: tool === "ruler" && cursor && !gestureActive() ? rulerReading(cursor, walls) : null,
    palette: paletteOf(theme),
  })
  updateLengthBox()
  updateAngleBox()
  syncDimPanel()
  for (const t of elementTools) t.syncPanel()
  syncHistoryButtons()
  syncFormats()
  if (dirty) {
    dirty = false
    if (!readOnly) saveStore(store)
    if (!readOnly && !historyReadOnly) saveHistory(historyStore)
  }
}

// нажатая кнопка мыши: рамка, перетаскивание стен или размера, сдвиг вида
function gestureActive(): boolean {
  return !!(marquee || marqueePending || groupMove || endpointDrag || dimDrag || doorwayTool.dragging() || panDrag)
}

// ластик: размер → проём → стена (wall-deletion «Инструмент «Ластик»»)
function eraserTarget(p: Point): { wall: Wall | null; dim: Dimension | null; doorway: WallElement | null } {
  const pick = erasePick(p, { walls, dimensions, doorways }, radiusCm(), 2)
  return {
    wall: pick?.kind === "wall" ? pick.wall : null,
    dim: pick?.kind === "dimension" ? pick.dimension : null,
    doorway: pick?.kind === "doorway" ? pick.doorway : null,
  }
}

function dimDraftGeometry(): DimGeometry | null {
  if (!dimDraft.a || !dimDraft.b || !cursor) return null
  const ea = endPoint(dimDraft.a)
  const eb = endPoint(dimDraft.b)
  if (!ea || !eb || pointsEqual(ea, eb)) return null
  const axis = dimGeometry(ea, eb, 0)!
  return dimGeometry(ea, eb, dimLevelSnap(cursor, axis, dimensions, walls, radiusCm())?.offset ?? dimensionOffsetAt(cursor, axis))
}

function draftRubber(end: Point): [Point, Point] | null {
  const ea = dimDraft.a ? endPoint(dimDraft.a) : null
  return ea ? [ea, end] : null
}

let unavailableFormats: PageFormat[] | null = null

function hideFitPopup(): void {
  document.querySelector("#fit-popup")?.remove()
}

function showFitPopup(unavailable: PageFormat[]): void {
  hideFitPopup()
  const el = document.createElement("div")
  el.id = "fit-popup"
  el.className = "panel"
  el.textContent = `Невозможно экспортировать в ${unavailable.join(", ")} — чертёж не влезает`
  el.addEventListener("click", hideFitPopup)
  canvasWrap.append(el)
}

function syncFormats(): void {
  const available = availableFormats(walls, dimensions, current().scale, doorways)
  const all = Object.keys(PAGE_FORMATS_MM) as PageFormat[]
  const unavailable = all.filter((f) => !available.includes(f))
  pdfFormat.replaceChildren(...available.map((f) => new Option(f, f)))
  if (!available.includes(pdfFormat.value as PageFormat)) pdfFormat.value = available[0] ?? ""
  pdfFormat.disabled = available.length === 0
  pdfExportBtn.disabled = walls.length === 0 || available.length === 0
  if (unavailableFormats !== null && unavailable.length > unavailableFormats.length) showFitPopup(unavailable)
  else if (unavailableFormats !== null && unavailable.length < unavailableFormats.length) hideFitPopup()
  unavailableFormats = unavailable
}

function syncScaleSelector(): void {
  pdfScale.value = String(current().scale)
}

function toWorld(e: MouseEvent): Point {
  const r = canvas.getBoundingClientRect()
  const k = PX_PER_CM * view.zoom
  return { x: (e.clientX - r.left) / k + view.pan.x, y: (e.clientY - r.top) / k + view.pan.y }
}

function toSnappedPoint(e: MouseEvent): Point {
  return snap(toWorld(e), walls, GRID_STEP_CM, radiusCm(), ortho ? (chainStart ?? undefined) : undefined)
}

function updateWallCursor(e: MouseEvent): void {
  snapWallCursor(toWorld(e))
}

function snapWallCursor(raw: Point): void {
  wallCursorRaw = raw
  if (!chainStart) {
    // до первого клика — квадрат установки у грани/торца или на сетке
    const r = snapStartVertex(raw, walls, snapRadiusCm(view.zoom), GRID_STEP_CM, thicknessCm, doorways)
    cursor = r.point
    cursorSnap = r
    segment = null
    return
  }
  // старт зафиксирован кликом; один расчёт сегмента для превью и фиксации (design D5)
  segment = chainSegment({
    start: chainStart,
    ref: chainRef,
    raw,
    walls,
    radiusCm: snapRadiusCm(view.zoom),
    gridStepCm: GRID_STEP_CM,
    thicknessCm,
    ortho,
    typedAngleDeg: typedAngleDeg(),
    typedLengthCm: lengthDirty ? typedLengthCm() : null,
    doorways,
  })
  cursor = segment.snap.point
  cursorSnap = segment.snap
}

// пересчёт привязки без движения курсора (изменились ввод, толщина, орто)
function refreshWallCursor(): void {
  if (tool === "wall" && wallCursorRaw) snapWallCursor(wallCursorRaw)
}

function commitPoint(): void {
  if (!chainStart) {
    if (!cursor) return
    chainStart = cursor
    chainRef = cursorSnap ? startRefOf(cursorSnap) : null
    segment = null
    lengthDirty = false
    angleDirty = false
    lengthInput.focus()
    redraw()
    return
  }
  const a = chainStart
  const end = segment?.end ?? cursor ?? chainStart
  if (!pointsEqual(a, end)) {
    const wall: Wall = { id: crypto.randomUUID(), a, b: end, thicknessCm, type: wallMaterial }
    // стена, нарушающая проём, не фиксируется: цепочка продолжается (spec wall-drawing)
    if (violatesDoorways(walls, [...walls, wall], doorways)) return
    pushRecord()
    dirty = true
    walls.push(wall)
  }
  // стена не продолжается автоматически: инструмент ждёт новый старт
  clearChain()
  lengthDirty = false
  // квадрат снова — квадрат установки под курсором, а не конец по лучу
  refreshWallCursor()
  lengthInput.focus()
  redraw()
}

let panDrag: { start: Point; pan: Point } | null = null

// орто-растяжение (change ortho-stretch-move, design D3–D4): жест применяется от снимка его
// начала полным вектором, план строится по исходной геометрии — итог не зависит от пути указателя
function restoreWalls(scene: Scene): void {
  walls.forEach((w, i) => {
    const s = scene.walls[i]
    if (!s) return
    w.a = { x: s.a.x, y: s.a.y }
    w.b = { x: s.b.x, y: s.b.y }
  })
}

// режим правки с ограничениями (change wall-move-bounds, design D8): привязка к линии оси стены
// передаётся как snappedAxis
function editMode(snapped: SnapResult): EditMode {
  return snapped.axisWall ? { ortho, snappedAxis: snapped.axisWall, doorways } : { ortho, doorways }
}

canvas.addEventListener("pointermove", (e) => {
  if (doorwayTool.dragging()) {
    doorwayTool.dragTo(toWorld(e))
    redraw()
    return
  }
  if (groupMove) {
    const { group, baseA, grab, others, snapshot } = groupMove
    const p = toWorld(e)
    // правка от снимка жеста полным вектором в обоих режимах (design D6)
    restoreWalls(snapshot)
    if (ortho) {
      // ось жеста защёлкивается при первом смещении до отпускания (change ortho-axis-lock, design D2)
      const step = orthoGestureStep(groupMove.gesture, p, walls, { kind: "walls", walls: group }, GRID_STEP_CM, radiusCm())
      groupMove.gesture = step.gesture
      if (step.target) moveWallsBounded(walls, group, { x: step.target.point.x - baseA.x, y: step.target.point.y - baseA.y }, editMode(step.target))
    } else {
      const target = snapWithSource({ x: baseA.x + p.x - grab.x, y: baseA.y + p.y - grab.y }, others, GRID_STEP_CM, radiusCm())
      moveWallsBounded(walls, group, { x: target.point.x - baseA.x, y: target.point.y - baseA.y }, editMode(target))
    }
    dirty = true
    redraw()
    return
  }
  if (dimDrag) {
    const p = toWorld(e)
    const ea = endPoint(dimDrag.dim.from)
    const eb = endPoint(dimDrag.dim.to)
    if (ea && eb) {
      const axis = dimGeometry(ea, eb, 0)
      if (axis) {
        const dragged = dimDrag.dim
        const level = dimLevelSnap(p, axis, dimensions.filter((d) => d !== dragged), walls, radiusCm())
        dragged.offset = level ? level.offset : dimensionOffsetAt(p, axis)
        syncDimPanel()
        dirty = true
        redraw()
      }
    }
    return
  }
  if (endpointDrag) {
    const { wall, end, snapshot } = endpointDrag
    const p = toWorld(e)
    restoreWalls(snapshot)
    const other = end === "a" ? wall.b : wall.a
    let target: SnapResult | null
    if (ortho) {
      // ось через противоположный конец, защёлкнута до отпускания (change ortho-axis-lock, design D2)
      const step = orthoGestureStep(endpointDrag.gesture, p, walls, { kind: "end", wall, end }, GRID_STEP_CM, radiusCm())
      endpointDrag.gesture = step.gesture
      target = step.target
    } else target = snapWithSource(p, walls.filter((w) => w !== wall), GRID_STEP_CM, radiusCm())
    if (target && !pointsEqual(target.point, other)) moveEndpointBounded(walls, wall, end, target.point, editMode(target))
    dirty = true
    redraw()
    return
  }
  if (panDrag) {
    const r = canvas.getBoundingClientRect()
    const k = PX_PER_CM * view.zoom
    view.pan = {
      x: panDrag.pan.x - (e.clientX - r.left - panDrag.start.x) / k,
      y: panDrag.pan.y - (e.clientY - r.top - panDrag.start.y) / k,
    }
    dirty = true
    redraw()
    return
  }
  if (marqueePending) {
    const r = canvas.getBoundingClientRect()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    if (marquee || Math.hypot(x - marqueePending.x, y - marqueePending.y) > MARQUEE_THRESHOLD_PX) {
      marquee = { x1: marqueePending.x, y1: marqueePending.y, x2: x, y2: y }
      marqueeHits = marqueePicks(marquee)
      suppressClick = true
      redraw()
    }
    return
  }
  if (tool === "wall") updateWallCursor(e)
  else if (tool === "dimension" || tool === "ruler") cursor = toWorld(e)
  else if (tool === "doorway" || tool === "window") {
    cursor = toWorld(e)
    placingTool()?.hover(cursor)
  }
  else cursor = toSnappedPoint(e)
  redraw()
})

// линейка показывает замеры только пока курсор над холстом
canvas.addEventListener("pointerleave", () => {
  if (tool !== "ruler" || !cursor) return
  cursor = null
  redraw()
})

// перетаскивание выделенных стен за стену pressed
function startGroupMove(pressed: Wall, p: Point, e: PointerEvent): void {
  const group = [...selectedWalls]
  groupMove = {
    group,
    pressed,
    baseA: { ...pressed.a },
    grab: p,
    others: snapOthers(walls, group),
    snapshot: cloneScene(scene()),
    gesture: startOrthoGesture("move", p, { ...pressed.a }),
  }
  suppressClick = true
  canvas.setPointerCapture(e.pointerId)
}

canvas.addEventListener("pointerdown", (e) => {
  suppressClick = false
  if (e.button === 1) {
    e.preventDefault()
    canvas.setPointerCapture(e.pointerId)
    const r = canvas.getBoundingClientRect()
    panDrag = { start: { x: e.clientX - r.left, y: e.clientY - r.top }, pan: view.pan }
    return
  }
  if (e.button !== 0) return
  if (tool !== "eraser") {
    if (doorwayTool.pressNumber(toWorld(e))) {
      suppressClick = true
      return
    }
  }
  if (selectedWalls.length === 1) {
    const sel = selectedWalls[0]
    const press = toWorld(e)
    const handle = endpointAt(press, sel, radiusCm())
    if (handle) {
      suppressClick = true
      const other = sel[handle === "a" ? "b" : "a"]
      endpointDrag = {
        wall: sel,
        end: handle,
        base: sel[handle],
        snapshot: cloneScene(scene()),
        gesture: startOrthoGesture("end", press, { ...other }),
      }
      canvas.setPointerCapture(e.pointerId)
      return
    }
    // средний маркер перемещает стену, даже если под ним проём (wall-selection)
    if (tool !== "eraser" && !placingTool() && midpointAt(press, sel, radiusCm())) {
      startGroupMove(sel, press, e)
      return
    }
  }
  if (tool !== "eraser") {
    const p = toWorld(e)
    const dim = dimensions.find((d) => (dimHitDistance(p, d, walls, 2) ?? Infinity) <= radiusCm())
    if (dim) {
      dimDrag = { dim, baseOffset: dim.offset, snapshot: cloneScene(scene()) }
      suppressClick = true
      if (!dimDraft.a && !dimDraft.b) selectDimension(dim)
      canvas.setPointerCapture(e.pointerId)
      return
    }
    // проём выше стены: выделение и перетаскивание вдоль опорной стены (вне цепочки и «Размера»)
    if (!chainStart && tool !== "dimension" && doorwayTool.pressDoorway(p)) {
      suppressClick = true
      canvas.setPointerCapture(e.pointerId)
      return
    }
    const wallHit = hitWall(p, walls, radiusCm())
    if ((tool === "doorway" || tool === "window") && wallHit) return
    if (wallHit && selectedWalls.length > 0) {
      if (!selectedWalls.includes(wallHit)) selectWall(wallHit)
      startGroupMove(wallHit, p, e)
      return
    }
    if (!wallHit) {
      const r = canvas.getBoundingClientRect()
      marqueePending = { x: e.clientX - r.left, y: e.clientY - r.top }
      canvas.setPointerCapture(e.pointerId)
    }
  }
})

// нажатие начинает жест (рамка, перетаскивание, сдвиг вида) — замеры линейки скрываются сразу
canvas.addEventListener("pointerdown", () => {
  if (tool === "ruler" && gestureActive()) redraw()
})

canvas.addEventListener("pointerup", (e) => {
  if (marquee) {
    if (e.button === 0) {
      const rect = marquee
      marquee = null
      marqueePending = null
      finishMarquee(rect, e.shiftKey)
    }
    return
  }
  marqueePending = null
  if (doorwayTool.dragging()) {
    if (e.button === 0) {
      doorwayTool.endDrag()
      redraw()
    }
    return
  }
  if (endpointDrag) {
    if (e.button === 0) {
      if (!pointsEqual(endpointDrag.wall[endpointDrag.end], endpointDrag.base)) {
        pushSnapshot(endpointDrag.snapshot)
        dirty = true
      }
      endpointDrag = null
    }
    return
  }
  if (groupMove) {
    if (e.button === 0) {
      if (!pointsEqual(groupMove.pressed.a, groupMove.baseA)) {
        pushSnapshot(groupMove.snapshot)
        dirty = true
      }
      groupMove = null
    }
    return
  }
  if (dimDrag) {
    if (e.button === 0) {
      if (dimDrag.dim.offset !== dimDrag.baseOffset) {
        pushSnapshot(dimDrag.snapshot)
        dirty = true
      }
      dimDrag = null
    }
    return
  }
  if (!panDrag || e.button !== 1) return
  panDrag = null
  if (tool === "wall") updateWallCursor(e)
  else if (tool === "dimension" || tool === "ruler") cursor = toWorld(e)
  else cursor = toSnappedPoint(e)
  redraw()
})

function marqueePicks(rect: { x1: number; y1: number; x2: number; y2: number }): { walls: Wall[]; dims: Dimension[]; doorways: WallElement[] } {
  const k = PX_PER_CM * view.zoom
  const min = { x: Math.min(rect.x1, rect.x2) / k + view.pan.x, y: Math.min(rect.y1, rect.y2) / k + view.pan.y }
  const max = { x: Math.max(rect.x1, rect.x2) / k + view.pan.x, y: Math.max(rect.y1, rect.y2) / k + view.pan.y }
  // ось стены на участке её проёма стену не выделяет (multi-selection «Рамка выделения»)
  const wallsPicked = wallsInRect(min, max, walls, doorways)
  const dimsPicked = dimensions.filter((d) => {
    const a = dimPointPoint(d.from, walls)
    const b = dimPointPoint(d.to, walls)
    const geom = a && b ? dimGeometry(a, b, d.offset) : null
    return !!geom && segmentIntersectsRect(geom.p1, geom.p2, min, max)
  })
  return { walls: wallsPicked, dims: dimsPicked, doorways: doorwaysInRect(min, max, walls, doorways) }
}

function finishMarquee(rect: { x1: number; y1: number; x2: number; y2: number }, additive: boolean): void {
  const picks = marqueePicks(rect)
  marqueeHits = null
  selectedWalls = additive ? [...selectedWalls, ...picks.walls.filter((w) => !selectedWalls.includes(w))] : picks.walls
  selectedDimensions = additive ? [...selectedDimensions, ...picks.dims.filter((d) => !selectedDimensions.includes(d))] : picks.dims
  selectedDoorways = additive ? [...selectedDoorways, ...picks.doorways.filter((d) => !selectedDoorways.includes(d))] : picks.doorways
  lengthDirty = false
  closeDoorwayEditor()
  setDoorwayPanel(selectedDoorways.length === 1 && !selectedWalls.length && !selectedDimensions.length)
  if (selectedDoorways.length) {
    setWallPanel(false)
    setDimPanel(false)
  } else if (selectedWalls.length === 1 && !selectedDimensions.length) {
    setDimPanel(false)
    syncThicknessBox()
    setWallMaterial(selectedWalls[0].type)
    setWallPanel(true)
  } else if (selectedDimensions.length === 1 && !selectedWalls.length) {
    setWallPanel(false)
    setDimPanel(true)
  } else {
    setWallPanel(false)
    setDimPanel(false)
  }
  redraw()
}

canvas.addEventListener("auxclick", (e) => e.preventDefault())

canvas.addEventListener("wheel", (e) => {
  e.preventDefault()
  const r = canvas.getBoundingClientRect()
  view = zoomAt(view, 1.1 ** -Math.sign(e.deltaY), { x: e.clientX - r.left, y: e.clientY - r.top }, PX_PER_CM)
  current().view = view
  dirty = true
  redraw()
}, { passive: false })

canvas.addEventListener("click", (e) => {
  if (suppressClick) {
    suppressClick = false
    return
  }
  const p = toSnappedPoint(e)
  const raw = toWorld(e)
  if (tool === "eraser") {
    const { wall, dim, doorway } = eraserTarget(p)
    if (dim) deleteDimension(dim)
    else if (doorway) deleteDoorway(doorway)
    else if (wall) deleteWall(wall)
    return
  }
  const placing = placingTool()
  if (placing) {
    placing.place(raw)
    return
  }
  if (tool === "dimension") {
    placeDimension(raw)
    return
  }
  if (!chainStart) {
    // в инструменте «Стена» тело выделяет (и у торца, и у стыка), прилипший квадрат рисует;
    // без инструмента — прежнее попадание с полосным допуском
    let wall: Wall | null
    if (tool === "wall") {
      const action = wallClickAction(raw, snapStartVertex(raw, walls, radiusCm(), GRID_STEP_CM, thicknessCm, doorways), walls, radiusCm())
      wall = action.kind === "select" ? action.wall : null
    } else wall = hitWall(raw, walls, radiusCm())
    if (wall) {
      selectWall(wall)
      return
    }
    selectedWalls = []
    lengthDirty = false
    clearDimSelection()
    if (tool !== "wall") {
      redraw()
      return
    }
  }
  if (tool === "wall") updateWallCursor(e)
  commitPoint()
})

function placeDimension(p: Point): void {
  if (!dimDraft.a || !dimDraft.b) {
    const hit = nearestEdgeIntersection(p, walls, radiusCm())
    if (!hit) {
      clearDimSelection()
      return
    }
    const point: DimPoint = { a: hit.a, b: hit.b }
    if (!dimDraft.a) dimDraft.a = point
    else dimDraft.b = point
    redraw()
    return
  }
  const ea = dimPointPoint(dimDraft.a, walls)
  const eb = dimPointPoint(dimDraft.b, walls)
  if (!ea || !eb || pointsEqual(ea, eb)) {
    dimDraft = emptyDraft()
    redraw()
    return
  }
  const axis = dimGeometry(ea, eb, 0)!
  pushRecord()
  dimensions.push({ from: dimDraft.a, to: dimDraft.b, offset: dimLevelSnap(p, axis, dimensions, walls, radiusCm())?.offset ?? dimensionOffsetAt(p, axis) })
  dimDraft = emptyDraft()
  dirty = true
  redraw()
}

lengthInput.addEventListener("focus", () => lengthInput.select())

lengthInput.addEventListener("input", () => {
  lengthDirty = true
  if (selectedWalls.length === 1) resizeSelected()
  refreshWallCursor()
  redraw()
})

// фиксация ввода (Enter, уход фокуса): поле показывает фактическую длину выделенной стены —
// отвергнутый ввод возвращается к текущей длине, укороченный до касания — к фактической
lengthInput.addEventListener("change", () => {
  if (chainStart || selectedWalls.length !== 1) return
  lengthDirty = false
  updateLengthBox()
})

lengthInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && chainStart) commitPoint()
  else if (e.key === "Tab" && e.shiftKey && !angleInput.disabled) {
    e.preventDefault()
    angleInput.focus()
  }
})

angleInput.addEventListener("focus", () => angleInput.select())

angleInput.addEventListener("input", () => {
  angleDirty = true
  refreshWallCursor()
  redraw()
})

angleInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && chainStart) commitPoint()
  else if (e.key === "Tab" && !e.shiftKey) {
    // круговой переход длина <-> угол, без ухода на кнопки блока размеров
    e.preventDefault()
    lengthInput.focus()
  }
})

function endChain(): void {
  if (!chainStart) return
  clearChain()
  lengthDirty = false
  lengthInput.blur()
  refreshWallCursor()
  redraw()
}

// удаление выбранного с каскадом размеров и проёмов удаляемых стен (wall-deletion)
function removeObjects(picked: { walls: Wall[]; dimensions: Dimension[]; doorways: WallElement[] }): void {
  const next = deleteObjects(scene(), picked)
  for (const w of picked.walls) walls.splice(walls.indexOf(w), 1)
  dimensions = next.dimensions
  current().dimensions = dimensions
  setDoorways(next.doorways ?? [])
}

function deleteDoorway(d: WallElement): void {
  pushRecord()
  closeDoorwayEditor()
  removeObjects({ walls: [], dimensions: [], doorways: [d] })
  if (!selectedDoorways.length) setDoorwayPanel(false)
  dirty = true
  redraw()
}

function deleteWall(wall: Wall): void {
  pushRecord()
  removeObjects({ walls: [wall], dimensions: [], doorways: [] })
  if (selectedDimensions.some((d) => !dimensions.includes(d))) {
    selectedDimensions = selectedDimensions.filter((d) => dimensions.includes(d))
    if (!selectedDimensions.length) setDimPanel(false)
  }
  if (selectedWalls.includes(wall)) {
    selectedWalls = selectedWalls.filter((w) => w !== wall)
    lengthDirty = false
    syncThicknessBox()
  }
  dirty = true
  redraw()
}

function deleteDimension(dim: Dimension): void {
  pushRecord()
  dimensions.splice(dimensions.indexOf(dim), 1)
  if (selectedDimensions.includes(dim)) {
    selectedDimensions = selectedDimensions.filter((d) => d !== dim)
    if (!selectedDimensions.length) setDimPanel(false)
  }
  dirty = true
  redraw()
}

function deleteSelection(): void {
  if (!selectedWalls.length && !selectedDimensions.length && !selectedDoorways.length) return
  pushRecord()
  closeDoorwayEditor()
  removeObjects({ walls: selectedWalls, dimensions: selectedDimensions, doorways: selectedDoorways })
  selectedWalls = []
  selectedDimensions = []
  selectedDoorways = []
  setDoorwayPanel(false)
  lengthDirty = false
  nudgeBurst = false
  setWallPanel(false)
  setDimPanel(false)
  syncThicknessBox()
  dirty = true
  redraw()
}

canvas.addEventListener("dblclick", () => {
  endChain()
  if (dimDraft.a || dimDraft.b) {
    dimDraft = emptyDraft()
    redraw()
  }
})

thicknessInput.addEventListener("input", () => {
  const v = parseFloat(thicknessInput.value.replace(",", "."))
  if (!Number.isFinite(v) || v <= 0) return
  thicknessCm = v * UNIT_TO_CM[unit]
  // толщина, нарушающая проём, не применяется (spec wall-collision «Правки стен не нарушают проёмы»)
  if (
    selectedWalls.length === 1 &&
    selectedWalls[0].thicknessCm !== thicknessCm &&
    thicknessAllowed(walls, selectedWalls[0], thicknessCm, doorways)
  ) {
    pushRecord()
    selectedWalls[0].thicknessCm = thicknessCm
    dirty = true
  }
  // привязка зависит от толщины новой стены (и сцены): пересчитать без движения курсора
  refreshWallCursor()
  redraw()
})

// фиксация ввода: поле показывает фактическую толщину выделенной стены
thicknessInput.addEventListener("change", syncThicknessBox)

dimOffsetInput.addEventListener("input", () => {
  if (selectedDimensions.length !== 1) return
  const v = parseFloat(dimOffsetInput.value.replace(",", "."))
  if (!Number.isFinite(v)) return
  const next = v * UNIT_TO_CM[unit]
  if (next === selectedDimensions[0].offset) return
  pushRecord()
  selectedDimensions[0].offset = next
  dirty = true
  redraw()
})

unitRow.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".unit")
  if (!btn) return
  unit = btn.dataset.unit as Unit
  unitRow.querySelectorAll(".unit").forEach((b) => b.classList.toggle("active", b === btn))
  syncThicknessBox()
  redraw()
})

function setWallMaterial(m: Material): void {
  wallMaterial = m
  if (selectedWalls.length === 1 && selectedWalls[0].type !== m) {
    pushRecord()
    selectedWalls[0].type = m
    dirty = true
  }
  wallTypesRow.querySelectorAll(".wall-type").forEach((b) => b.classList.toggle("active", b.getAttribute("data-material") === m))
  redraw()
}

orthoToggle.addEventListener("click", () => {
  ortho = !ortho
  orthoToggle.classList.toggle("active", ortho)
  refreshWallCursor()
  redraw()
})

function applyTheme(): void {
  theme = resolveTheme(themeChoice, systemDark.matches)
  document.documentElement.dataset.theme = theme
  themeToggle.title = themeToggleTitle(theme)
  drawPatternPreviews()
  redraw()
}

themeToggle.addEventListener("click", () => {
  themeChoice = toggledTheme(theme)
  saveThemeChoice(localStorage, themeChoice)
  applyTheme()
})

// без выбора кнопкой схема следует системной настройке на лету
systemDark.addEventListener("change", () => {
  if (themeChoice === null) applyTheme()
})

toolWallBtn.addEventListener("click", () => {
  if (tool !== "wall") setTool("wall")
  else setWallPanel(!wallPanelOpen)
})

toolDimensionBtn.addEventListener("click", () => setTool("dimension"))

toolEraserBtn.addEventListener("click", () => setTool("eraser"))

toolDoorwayBtn.addEventListener("click", () => {
  if (tool !== "doorway") {
    setTool("doorway")
    setDoorwayPanel(true)
  } else doorwayTool.togglePanel()
})

toolWindowBtn.addEventListener("click", () => {
  if (tool !== "window") {
    setTool("window")
    setDoorwayPanel(true)
  } else windowTool.togglePanel()
})

toolRulerBtn.addEventListener("click", () => setTool("ruler"))

wallTypesRow.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".wall-type")
  if (btn) setWallMaterial(btn.dataset.material as Material)
})

function renderTabs(): void {
  for (const el of [...tabsEl.children]) el.remove()
  for (const d of store.drawings) {
    const tab = document.createElement("div")
    tab.className = d.id === store.activeId ? "tab active" : "tab"
    tab.dataset.id = d.id
    const name = document.createElement("span")
    name.className = "tab-name"
    name.textContent = d.name
    const close = document.createElement("button")
    close.className = "tab-close"
    close.type = "button"
    close.textContent = "×"
    tab.append(name, close)
    tabsEl.append(tab)
  }
}

function nextName(): string {
  const used = new Set(store.drawings.map((d) => d.name))
  for (let n = 1; ; n++) if (!used.has(`Чертёж ${n}`)) return `Чертёж ${n}`
}

function newDrawing(): void {
  const drawing: Drawing = { id: crypto.randomUUID(), name: nextName(), walls: [], dimensions: [], view: { zoom: 1, pan: { x: 0, y: 0 } }, scale: 100 }
  store.drawings.push(drawing)
  dirty = true
  activate(drawing.id)
}

function activate(id: string): void {
  store.activeId = id
  walls = current().walls
  dimensions = current().dimensions
  doorways = current().doorways ?? []
  view = current().view
  tool = "wall"
  syncToolUI()
  clearChain()
  closeDoorwayEditor()
  selectedWalls = []
  selectedDimensions = []
  selectedDoorways = []
  resetElementTools()
  setDoorwayPanel(false)
  dimDraft = emptyDraft()
  dimDrag = null
  lengthDirty = false
  endpointDrag = null
  groupMove = null
  marquee = null
  marqueeHits = null
  marqueePending = null
  nudgeBurst = false
  setDimPanel(false)
  unavailableFormats = null
  hideFitPopup()
  syncScaleSelector()
  dirty = true
  renderTabs()
  redraw()
}

function closeDrawing(id: string): void {
  const drawing = store.drawings.find((d) => d.id === id)!
  if (!confirm(`Удалить чертёж «${drawing.name}»?`)) return
  const idx = store.drawings.indexOf(drawing)
  removeDrawing(id, idx)
  const h = drawingHistory(historyStore, store.activeId)
  h.past.push({ kind: "close", index: idx, drawingId: id })
  h.future = []
  dirty = true
  redraw()
}

function removeDrawing(id: string, index: number): void {
  const [drawing] = store.drawings.splice(index, 1)
  historyStore.trash.push({ index, drawing })
  if (store.drawings.length === 0) newDrawing()
  else if (store.activeId === id) activate(store.drawings[Math.min(index, store.drawings.length - 1)].id)
  else {
    dirty = true
    renderTabs()
    redraw()
  }
}

function resetEditing(): void {
  clearChain()
  closeDoorwayEditor()
  selectedWalls = []
  selectedDimensions = []
  selectedDoorways = []
  resetElementTools()
  setDimPanel(false)
  dimDraft = emptyDraft()
  lengthDirty = false
  suppressClick = false
  nudgeBurst = false
  marqueeHits = null
  syncThicknessBox()
}

function undo(): void {
  if (groupMove || endpointDrag || panDrag || dimDrag || doorwayTool.dragging()) return
  const h = drawingHistory(historyStore, store.activeId)
  const e = undoEntry(h, scene())
  if (!e) return
  if (e.kind === "walls") {
    current().walls = e.walls
    current().dimensions = e.dimensions
    walls = e.walls
    dimensions = e.dimensions
    setDoorways(e.doorways ?? [])
  } else {
    const i = historyStore.trash.findIndex((t) => t.drawing.id === e.drawingId)
    if (i < 0) return
    const { drawing } = historyStore.trash.splice(i, 1)[0]
    store.drawings.splice(e.index, 0, drawing)
    activate(drawing.id)
  }
  dirty = true
  resetEditing()
  redraw()
}

function redo(): void {
  if (groupMove || endpointDrag || panDrag || dimDrag || doorwayTool.dragging()) return
  const h = drawingHistory(historyStore, store.activeId)
  const e = redoEntry(h, scene())
  if (!e) return
  if (e.kind === "walls") {
    current().walls = e.walls
    current().dimensions = e.dimensions
    walls = e.walls
    dimensions = e.dimensions
    setDoorways(e.doorways ?? [])
  } else {
    const idx = store.drawings.findIndex((d) => d.id === e.drawingId)
    if (idx < 0) return
    removeDrawing(e.drawingId, idx)
  }
  dirty = true
  resetEditing()
  redraw()
}

undoBtn.addEventListener("click", undo)
redoBtn.addEventListener("click", redo)

pdfExportBtn.addEventListener("click", () => {
  const drawing = current()
  exportDrawing(drawing.walls, drawing.dimensions, unit, drawing.scale, pdfFormat.value as PageFormat, drawing.name, drawing.doorways ?? [])
})

pdfScale.addEventListener("change", () => {
  current().scale = Number(pdfScale.value) as Drawing["scale"]
  dirty = true
  redraw()
})

tabsEl.addEventListener("click", (e) => {
  const tab = (e.target as HTMLElement).closest<HTMLElement>(".tab")
  if (!tab) return
  const { id } = tab.dataset
  if (!id) return
  if ((e.target as HTMLElement).closest(".tab-close")) closeDrawing(id)
  else if (id !== store.activeId) activate(id)
})

tabAdd.addEventListener("click", newDrawing)

tabsEl.addEventListener("dblclick", (e) => {
  const tab = (e.target as HTMLElement).closest<HTMLElement>(".tab")
  if (tab && (e.target as HTMLElement).closest(".tab-name")) startRename(tab)
})

function startRename(tab: HTMLElement): void {
  const drawing = store.drawings.find((d) => d.id === tab.dataset.id)
  const nameEl = tab.querySelector<HTMLElement>(".tab-name")
  if (!drawing || !nameEl || tab.querySelector(".tab-rename")) return
  const input = document.createElement("input")
  input.className = "tab-rename"
  input.value = drawing.name
  nameEl.replaceWith(input)
  input.focus()
  input.select()
  let finishing = false
  const finish = () => {
    if (finishing) return
    finishing = true
    const name = input.value.trim()
    if (name && name !== drawing.name) {
      drawing.name = name
      dirty = true
      redraw()
    }
    renderTabs()
  }
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") input.blur()
    else if (e.key === "Escape") {
      input.value = drawing.name
      input.blur()
    }
  })
  input.addEventListener("blur", finish)
}

window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && !e.altKey) {
    const undoKey = e.code === "KeyZ"
    const redoKey = e.code === "KeyY"
    if (!undoKey && !redoKey) return
    e.preventDefault()
    if (redoKey || e.shiftKey) redo()
    else undo()
    return
  }
  if (e.key === "Delete") {
    if (e.target instanceof HTMLInputElement) return
    if (groupMove || endpointDrag || panDrag || dimDrag || doorwayTool.dragging()) return
    deleteSelection()
    return
  }
  if (e.key === "Escape") {
    if (chainStart) endChain()
    else if (dimDraft.a || dimDraft.b) {
      dimDraft = emptyDraft()
      redraw()
    } else if (selectedDimensions.length || selectedWalls.length || selectedDoorways.length) clearSelection()
    else if (tool === "eraser" || tool === "dimension" || tool === "ruler" || tool === "doorway" || tool === "window") setTool("none")
  }
  if (e.key !== "ArrowUp" && e.key !== "ArrowDown" && e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
  if (e.target instanceof HTMLInputElement) return
  if (groupMove || endpointDrag || panDrag || dimDrag || doorwayTool.dragging()) return
  if (selectedWalls.length || selectedDimensions.length || selectedDoorways.length) {
    if (!selectedWalls.length) {
      if (!selectedDoorways.length) return
      e.preventDefault()
      const step = e.shiftKey ? 1 : GRID_STEP_CM
      const arrow = e.key === "ArrowUp" ? { x: 0, y: -1 } : e.key === "ArrowDown" ? { x: 0, y: 1 } : e.key === "ArrowLeft" ? { x: -1, y: 0 } : { x: 1, y: 0 }
      if (doorwayTool.nudge(arrow, step)) redraw()
      return
    }
    e.preventDefault()
    const step = e.shiftKey ? 1 : GRID_STEP_CM
    const delta = e.key === "ArrowUp" ? { x: 0, y: -step }
      : e.key === "ArrowDown" ? { x: 0, y: step }
      : e.key === "ArrowLeft" ? { x: -step, y: 0 }
      : { x: step, y: 0 }
    // запись истории открывает только нажатие, давшее сдвиг (design D8)
    const before = cloneScene(scene())
    const applied = moveWallsBounded(walls, selectedWalls, delta, { ortho, doorways })
    if (applied.x === 0 && applied.y === 0) return
    if (!nudgeBurst) pushSnapshot(before)
    nudgeBurst = true
    dirty = true
    redraw()
    return
  }
  if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return
  const delta = e.key === "ArrowUp" ? -1 : 1
  const idx = MATERIALS.findIndex((m) => m.id === wallMaterial)
  setWallMaterial(MATERIALS[(idx + delta + MATERIALS.length) % MATERIALS.length].id)
})

window.addEventListener("resize", redraw)
syncThicknessBox()
syncToolUI()
renderTabs()
applyTheme()
