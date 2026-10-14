import "./style.css"
import { cloneScene, loadHistory, planHistory, record, recordDemolition, recordSnapshot, redoDemolition, redoEntry, saveHistory, undoDemolition, undoEntry } from "./history"
import type { Scene } from "./history"
import { dimLevelSnap, dimensionGeometry, dimensionOffsetAt, hitWall, nearestDimAnchor, dimPointPoint, pointsEqual, segmentIntersectsRect, snap, snapOthers, snapWithSource, zoomAt } from "./geometry"
import type { DimGeometry, SnapResult } from "./geometry"
import { addBatteryMark, batteryMarkAt, demolishedBatteries, removeBatteryMark } from "./battery/battery-demolition"
import { limitNewWallByBatteries, squareAllowedForBatteries, thicknessAllowedForBatteries } from "./battery/battery-guard"
import { batteriesInRect, hitBattery } from "./battery/battery-pick"
import { createBatteryTool } from "./battery/battery-tool"
import type { BatteryToolHost } from "./battery/battery-tool"
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
import { drawPatternPreview, render, SCREEN_METRICS } from "./render"
import { demolitionColor, renderDemolition } from "./demolition/demolition-render"
import { reanchorMarks } from "./demolition/mark-follow"
import { effectiveMarks } from "./demolition/marks"
import { createDemolitionTool } from "./demolition/demolition-tool"
import type { DemolitionToolHost } from "./demolition/demolition-tool"
import { findRooms } from "./room-area"
import { rulerReading } from "./ruler"
import { exportPages, pagesOf } from "./export/pdf"
import { fitScale, scaleLabel } from "./export/fit-scale"
import type { PageFormat } from "./export/pdf"
import { PLANS, activePlanOf, defaultToolOf, isPlanId, toolsOf } from "./plans"
import type { PlanId } from "./plans"
import { loadStore, saveStore } from "./storage"
import { placeWall, syncAutoDimensions } from "./auto-dimensions"
import { mergeContinuation } from "./wall-merge"
import { axisLengthForEdgeCm, edgeLengthCm, previewEdgeLengthCm } from "./wall-length"
import { openWorkspace, storedContent } from "./mounting/mounting-workspace"
import type { Workspace } from "./mounting/mounting-workspace"
import { thicknessAllowed } from "./doorway/doorway-guard"
import { communicationBodyTolCm, createCommunicationTool } from "./communications/communications-tool"
import type { CommunicationToolHost } from "./communications/communications-tool"
import { afterPlaceCommunication, groupButtonActive as communicationsGroupActive, groupButtonClick as communicationsGroupClick, groupPick as communicationsGroupPick } from "./communications/communications-group"
import type { CommunicationTool, GroupState as CommunicationsGroupState } from "./communications/communications-group"
import { limitNewWall, squareAllowed, thicknessAllowedForCommunications } from "./communications/guard"
import { hitCommunication } from "./communications/pick"
import { deleteObjects, doorwaysInRect, erasePick, pressPick, wallsInRect } from "./doorway/doorway-scene"
import { createElementTool, createSelectionEditing, openNumberEditor } from "./doorway/doorway-tool"
import type { NumberEditor } from "./doorway/doorway-tool"
import { initialParams, inheritFrom } from "./doorway/element-kind"
import type { ElementToolHost } from "./doorway/doorway-tool"
import { groupButtonActive, groupButtonClick, groupPick } from "./doorway/openings-group"
import type { GroupState, GroupTool, Tool } from "./doorway/openings-group"
import { afterPlace, escapeAction, resumesAfterSelectionCleared, selectionAllowed } from "./tool-mode"
import { loadThemeChoice, paletteOf, resolveTheme, saveThemeChoice, themeToggleTitle, toggledTheme } from "./theme"
import type { Theme } from "./theme"
import { GRID_STEP_CM, MATERIALS, PX_PER_CM } from "./types"
import type { Battery, BatteryMark, Communication, DemolitionMark, Dimension, DimPoint, Drawing, Material, Point, Unit, View, Wall, WallElement } from "./types"

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
const planSwitch = document.querySelector<HTMLElement>("#plan-switch")!
const undoBtn = document.querySelector<HTMLButtonElement>("#undo-btn")!
const redoBtn = document.querySelector<HTMLButtonElement>("#redo-btn")!
const toolWallBtn = document.querySelector<HTMLButtonElement>("#tool-wall")!
const toolDimensionBtn = document.querySelector<HTMLButtonElement>("#tool-dimension")!
const toolEraserBtn = document.querySelector<HTMLButtonElement>("#tool-eraser")!
const toolRulerBtn = document.querySelector<HTMLButtonElement>("#tool-ruler")!
const toolDemolitionBtn = document.querySelector<HTMLButtonElement>("#tool-demolition")!
const toolbar = document.querySelector<HTMLElement>("#toolbar")!
const wallPanel = document.querySelector<HTMLElement>("#wall-panel")!
const scaleLabelEl = document.querySelector<HTMLElement>("#scale-label")!
const pdfFormat = document.querySelector<HTMLSelectElement>("#pdf-format")!
const pdfExportBtn = document.querySelector<HTMLButtonElement>("#pdf-export")!
const toolOpeningsBtn = document.querySelector<HTMLButtonElement>("#tool-openings")!
const openingsPanel = document.querySelector<HTMLElement>("#openings-panel")!
const toolDoorwayBtn = document.querySelector<HTMLButtonElement>("#tool-doorway")!
const toolDoorBtn = document.querySelector<HTMLButtonElement>("#tool-door")!
const toolWindowBtn = document.querySelector<HTMLButtonElement>("#tool-window")!
const toolBatteryBtn = document.querySelector<HTMLButtonElement>("#tool-battery")!
const toolCommunicationsBtn = document.querySelector<HTMLButtonElement>("#tool-communications")!
const communicationsPanel = document.querySelector<HTMLElement>("#communications-panel")!
const toolRiserBtn = document.querySelector<HTMLButtonElement>("#tool-riser")!
const toolDuctBtn = document.querySelector<HTMLButtonElement>("#tool-duct")!

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
// батареи активного плана (change add-battery): на обмерочном плане — батареи обмера, на «Монтаже» — видимые батареи обмера
// и собственные; в чертёж пишутся при первом изменении
let batteries: Battery[] = current().batteries ?? []
let selectedBatteries: Battery[] = []
// рабочий набор плана «Монтаж» (change mounting-plan, design D5): на этом плане walls, dimensions и doorways — сцена
// «остатки + собственные объекты», а в чертёж пишется хранимое представление; null на остальных планах
let workspace: Workspace | null = null
let remnantHome = new Map<string, { a: Point; b: Point }>() // исходные концы остатков: остатки не двигаются
let selectedDoorways: WallElement[] = []
// выделенная коммуникация (change add-communications): выделяется только на обмерочном плане, ровно одна
let selectedCommunication: Communication | null = null
// параметры новых проёмов, дверей и окон (change popups-buttons-only): общие для вкладок, в чертёж не входят
let newParams = initialParams()
let chainStart: Point | null = null
let cursor: Point | null = null
let hoverWorld: Point | null = null // сырая точка курсора для подсветки тени направления двери
let chainRef: StartRef | null = null // стена примыкания начала (из прилипания первого клика)
let segment: ChainSegment | null = null // сегмент построения: превью и фиксация
let cursorSnap: VertexSnap | null = null // сам результат привязки: normal в нём неперечислима
let wallCursorRaw: Point | null = null // сырая позиция курсора последней привязки — для пересчёта
let endBlocked = false // конец стены обрезан коммуникацией до нулевой длины: второй клик стену не ставит
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
let marqueeHits: { walls: Wall[]; dims: Dimension[]; doorways: WallElement[]; batteries: Battery[] } | null = null
const MARQUEE_THRESHOLD_PX = 5
const BATTERY_CLICK_PX = 4 // нажатие и отпускание на плане «Демонтаж» в пределах этого расстояния — клик по батарее
let tool: Tool = defaultToolOf(activePlanOf(current()))
// группа «Проёмы» (change add-door, design D6): текущий инструмент группы и видимость её панели;
// активный инструмент группы выводится из tool
let openingsCurrent: GroupTool = "doorway"
let openingsPanelOpen = false
// группа «Коммуникации» (change add-communications, design D9): то же устройство, что у группы «Проёмы»
let communicationsCurrent: CommunicationTool = "riser"
let communicationsPanelOpen = false
const systemDark = window.matchMedia("(prefers-color-scheme: dark)")
let themeChoice: Theme | null = loadThemeChoice(localStorage) // null — следовать системной настройке
let theme: Theme = resolveTheme(themeChoice, systemDark.matches)

const emptyDraft = (): { a: DimPoint | null; b: DimPoint | null } => ({ a: null, b: null })

const endPoint = (end: DimPoint): Point | null => dimPointPoint(end, walls, doorways, batteries)

const radiusCm = (): number => snapRadiusCm(view.zoom)

// коммуникации чертежа общие для всех планов (change add-communications, design D1): список лежит в чертеже,
// на плане «Монтаж» и «Демонтаж» он только читается
const NO_COMMUNICATIONS: Communication[] = []
const communicationsOf = (): readonly Communication[] => current().communications ?? NO_COMMUNICATIONS

// правятся коммуникации только на обмерочном плане (spec communications «Коммуникации на всех планах»)
const communicationsEditable = (): boolean => activePlanOf(current()) === "measure"

// текущая сцена чертежа: стены, размеры, проёмы, коммуникации (снимок истории — change add-doorway); на плане
// «Монтаж» коммуникации в историю не попадают (historyOf)
const scene = (): Scene => ({ walls, dimensions, doorways, communications: [...communicationsOf()], batteries: [...batteries] })

// история активного плана активного чертежа (change drawing-plans, design D4)
const activeHistory = () => planHistory(historyStore, store.activeId, activePlanOf(current()))

// сцена в представлении чертежа и истории: на плане «Монтаж» — только собственные объекты, без остатков и старых
// элементов (design D6); на остальных планах — сама сцена
const historyOf = (s: Scene): Scene => {
  if (!workspace) return s
  const stored = storedContent(s, workspace, current())
  return { walls: stored.walls, dimensions: stored.dimensions, ...(stored.doorways ? { doorways: stored.doorways } : null), ...(stored.batteries ? { batteries: stored.batteries } : null) }
}

const pushRecord = (): void => {
  nudgeBurst = false
  record(activeHistory(), historyOf(scene()))
}

// список проёмов заменяется целиком: правки проёма возвращают новый объект
function setDoorways(next: WallElement[]): void {
  doorways = next
  if (!workspace) current().doorways = next
  selectedDoorways = selectedDoorways.filter((d) => next.includes(d))
}

// список батарей заменяется целиком: правки батареи возвращают новый объект; пометки сноса остаются в чертеже и скрыты, пока
// батареи нет (отмена удаления возвращает и пометку)
function setBatteries(next: Battery[]): void {
  batteries = next
  if (!workspace) current().batteries = next
  selectedBatteries = selectedBatteries.filter((b) => next.includes(b))
}

// список размеров заменяется целиком; размеры плана «Монтаж» пишутся в чертёж при фиксации (commitMounting)
function setDimensions(next: Dimension[]): void {
  if (!workspace) {
    dimensions = next
    current().dimensions = next
    return
  }
  // остаток автоматических размеров не получает
  const remnants = workspace.remnantIds
  dimensions = next.filter((d) => d.auto === undefined || !remnants.has(d.auto))
}

// рабочие списки активного плана активного чертежа; «Монтаж» — сцена из остатков и собственных объектов
function loadWorking(): void {
  const d = current()
  if (activePlanOf(d) !== "mounting") {
    walls = d.walls
    dimensions = d.dimensions
    doorways = d.doorways ?? []
    batteries = d.batteries ?? []
    workspace = null
    remnantHome = new Map()
    return
  }
  const opened = openWorkspace(d)
  walls = opened.scene.walls
  dimensions = opened.scene.dimensions
  doorways = opened.scene.doorways
  batteries = opened.scene.batteries
  workspace = opened.workspace
  remnantHome = new Map(walls.filter((w) => opened.workspace.remnantIds.has(w.id)).map((w) => [w.id, { a: { ...w.a }, b: { ...w.b } }]))
}

// запись собственных объектов «Монтажа» в чертёж; пока их нет и поля не было, оно не создаётся
function commitMounting(): void {
  const drawing = store.drawings.find((d) => d.id === store.activeId)
  if (!workspace || !drawing) return // вкладка уже закрыта — писать некуда
  const next = storedContent(scene(), workspace, drawing)
  if (next.walls.length === 0 && next.dimensions.length === 0 && next.doorways === undefined && next.batteries === undefined && drawing.mounting === undefined) return
  drawing.mounting = next
}

// остатки и старые элементы только для чтения: правка соседа не должна сдвигать остаток
function restoreRemnants(): void {
  for (const w of walls) {
    const home = remnantHome.get(w.id)
    if (home && (!pointsEqual(w.a, home.a) || !pointsEqual(w.b, home.b))) {
      w.a = { ...home.a }
      w.b = { ...home.b }
    }
  }
}

const editableWall = (w: Wall): boolean => !workspace?.remnantIds.has(w.id)
const editableElement = (e: WallElement): boolean => !workspace?.oldElementIds.has(e.id)
const editableBattery = (b: Battery): boolean => !workspace?.oldBatteryIds.has(b.id)

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
    unit: () => unit,
    rooms: () => findRooms(walls),
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
    params: () => newParams,
    inherit: (e) => {
      newParams = inheritFrom(newParams, e)
    },
}
const doorwayTool = createElementTool("doorway", elementHost)
const doorTool = createElementTool("door", elementHost)
const windowTool = createElementTool("window", elementHost)
const elementTools = [doorwayTool, doorTool, windowTool]
const selectionEditing = createSelectionEditing(elementHost)

function replaceBattery(prev: Battery, next: Battery): void {
  // выделение переходит на новый объект до замены списка: setBatteries снимает выделение с пропавшего объекта
  selectedBatteries = selectedBatteries.map((b) => (b === prev ? next : b))
  setBatteries(batteries.map((b) => (b === prev ? next : b)))
}

function selectBattery(b: Battery): void {
  closeNumberEditor()
  selectedBatteries = [b]
  selectedCommunication = null
  selectedWalls = []
  selectedDimensions = []
  selectedDoorways = []
  lengthDirty = false
  setWallPanel(false)
  redraw()
}

// инструмент «Батарея» и правка выделенных батарей (change add-battery, design D10)
const batteryHost: BatteryToolHost = {
  walls: () => walls,
  batteries: () => batteries,
  communications: () => communicationsOf(),
  elements: () => doorways,
  selectedBatteries: () => selectedBatteries,
  editable: editableBattery,
  view: () => view,
  unit: () => unit,
  radiusCm: () => radiusCm(),
  formatCm: (cm) => formatCm(cm, unit),
  parseCm: (text) => parseFloat(text.replace(",", ".")) * UNIT_TO_CM[unit],
  editorParent: canvasWrap,
  snapshot: () => cloneScene(scene()),
  record: () => pushRecord(),
  recordSnapshot: (s) => pushSnapshot(s),
  recordNudge: (before) => {
    if (!nudgeBurst) pushSnapshot(before)
    nudgeBurst = true
  },
  add: (b) => setBatteries([...batteries, b]),
  replace: (prev, next) => replaceBattery(prev, next),
  select: (b) => selectBattery(b),
  changed: () => {
    dirty = true
  },
  redraw: () => redraw(),
}
const batteryTool = createBatteryTool(batteryHost)

// инструменты «Стояк» и «Воздуховод» и правка выделенной коммуникации (change add-communications, design D9)
function setCommunications(next: Communication[]): void {
  current().communications = next
  if (selectedCommunication && !next.includes(selectedCommunication)) selectedCommunication = null
}

function selectCommunication(c: Communication): void {
  closeNumberEditor()
  selectedBatteries = []
  selectedCommunication = c
  selectedWalls = []
  selectedDimensions = []
  selectedDoorways = []
  lengthDirty = false
  setWallPanel(false)
  redraw()
}

function replaceCommunication(prev: Communication, next: Communication): void {
  // выделение переходит на новый объект до замены списка: setCommunications снимает выделение с пропавшего объекта
  if (selectedCommunication === prev) selectedCommunication = next
  setCommunications(communicationsOf().map((c) => (c === prev ? next : c)))
}

const communicationHost: CommunicationToolHost = {
  walls: () => walls,
  communications: () => communicationsOf(),
  selected: () => selectedCommunication,
  view: () => view,
  unit: () => unit,
  formatCm: (cm) => formatCm(cm, unit),
  parseCm: (text) => parseFloat(text.replace(",", ".")) * UNIT_TO_CM[unit],
  editorParent: canvasWrap,
  snapshot: () => cloneScene(scene()),
  record: () => pushRecord(),
  recordSnapshot: (s) => pushSnapshot(s),
  add: (c) => {
    setCommunications([...communicationsOf(), c])
    selectCommunication(c)
  },
  replace: (prev, next) => replaceCommunication(prev, next),
  select: (c) => selectCommunication(c),
  changed: () => {
    dirty = true
  },
  redraw: () => redraw(),
}
const communicationTool = createCommunicationTool(communicationHost)

// инструмент установки коммуникации; null — вне инструментов «Стояк» и «Воздуховод»
const communicationKind = (): CommunicationTool | null => (tool === "riser" || tool === "duct" ? tool : null)

function hoverCommunicationGhost(raw: Point): void {
  const kind = communicationKind()
  if (kind) communicationTool.hover(kind, raw)
}

const communicationsGroupState = (): CommunicationsGroupState => ({
  current: communicationsCurrent,
  active: tool === "riser" || tool === "duct" ? tool : "other",
  panelOpen: communicationsPanelOpen,
})

function applyCommunicationsGroup(next: CommunicationsGroupState): void {
  if (next.active !== "other" && next.active !== tool) setTool(next.active)
  communicationsCurrent = next.current
  communicationsPanelOpen = next.panelOpen
  syncCommunicationsUI()
}

function syncCommunicationsUI(): void {
  const s = communicationsGroupState()
  communicationsPanel.classList.toggle("open", s.panelOpen)
  toolCommunicationsBtn.classList.toggle("active", communicationsGroupActive(s))
  toolRiserBtn.classList.toggle("active", s.current === "riser")
  toolDuctBtn.classList.toggle("active", s.current === "duct")
}

function closeCommunicationsPanel(): void {
  communicationsPanelOpen = false
  syncCommunicationsUI()
}

// план «Демонтаж» (change demolition-plan, design D10): пометки чертежа лежат в current().demolition; пока их нет —
// общий неизменяемый пустой список (тот же экземпляр: инструмент по нему узнаёт, что операция ничего не изменила)
const onDemolition = (): boolean => activePlanOf(current()) === "demolition"
const NO_MARKS: DemolitionMark[] = []
const NO_BATTERY_MARKS: BatteryMark[] = []
const batteryMarksOf = (): BatteryMark[] => current().batteryDemolition ?? NO_BATTERY_MARKS
// нажатие инструментом «Демонтаж» внутри батареи: пометка ставится отпусканием в мёртвой зоне
let batteryPress: { id: string; px: Point } | null = null
const demolitionHost: DemolitionToolHost = {
  walls: () => walls,
  elements: () => doorways,
  marks: () => current().demolition ?? NO_MARKS,
  setMarks: (next) => {
    current().demolition = next
  },
  record: () => recordDemolition(activeHistory(), { marks: current().demolition ?? NO_MARKS, batteryMarks: batteryMarksOf() }),
  changed: () => {
    dirty = true
  },
  redraw: () => redraw(),
  radiusCm: () => radiusCm(),
  newId: () => crypto.randomUUID(),
}
const demolitionTool = createDemolitionTool(demolitionHost)
const NUMBER_HIT_PX = 4 // допуск попадания в правимое число участка, как у чисел проёма
let demolitionEditor: NumberEditor | null = null

const closeDemolitionEditor = (): void => {
  demolitionEditor?.close()
  demolitionEditor = null
}

// сброс жеста, выделения и поля ввода плана «Демонтаж» (смена плана, чертежа и инструмента, отмена и повтор)
const resetDemolition = (): void => {
  resumeDemolition = false
  batteryPress = null
  demolitionTool.cancel()
  demolitionTool.clearSelection()
  closeDemolitionEditor()
}

// инструмент «Демонтаж» снят постановкой пометки и должен вернуться, когда выделение будет снято
let resumeDemolition = false

// вернуть инструмент «Демонтаж», если он снят постановкой и выделение пометки уже снято
function resumeDemolitionTool(): void {
  if (!resumesAfterSelectionCleared(resumeDemolition, demolitionTool.selectedId() !== null)) return
  resumeDemolition = false
  setTool("demolition")
}

// снять инструмент «Демонтаж» без сброса выделения (setTool выделение снимает)
function leaveDemolitionTool(): void {
  resumeDemolition = true
  tool = "none"
  syncToolUI()
  redraw()
}

// нажатие на правимое число выделенной пометки — поле ввода на месте (как у чисел проёма); Enter применяет
function pressDemolitionNumber(p: Point): boolean {
  const k = PX_PER_CM * view.zoom
  const spot = demolitionTool.numberAt(p, unit, k, SCREEN_METRICS.labelPx, NUMBER_HIT_PX / k)
  if (!spot) return false
  closeDemolitionEditor()
  const at = { x: (spot.center.x - view.pan.x) * k, y: (spot.center.y - view.pan.y) * k }
  demolitionEditor = openNumberEditor(
    canvasWrap,
    at,
    formatCm(spot.valueCm, unit),
    (text) => {
      demolitionTool.applyNumber(spot, parseFloat(text.replace(",", ".")) * UNIT_TO_CM[unit])
      redraw()
    },
    () => {
      demolitionEditor = null
    },
  )
  return true
}

// инструмент установки активного вида; null — вне инструментов «Проём», «Дверь» и «Окно»
const placingTool = () => (tool === "window" ? windowTool : tool === "door" ? doorTool : tool === "doorway" ? doorwayTool : null)

const groupState = (): GroupState => ({
  current: openingsCurrent,
  active: tool === "doorway" || tool === "door" ? tool : "other",
  panelOpen: openingsPanelOpen,
})

// переход группы: активный инструмент — через setTool (он закрывает панели), затем панель и вид кнопок
function applyGroup(next: GroupState): void {
  if (next.active !== "other" && next.active !== tool) setTool(next.active)
  openingsCurrent = next.current
  openingsPanelOpen = next.panelOpen
  syncOpeningsUI()
}

function syncOpeningsUI(): void {
  const s = groupState()
  openingsPanel.classList.toggle("open", s.panelOpen)
  toolOpeningsBtn.classList.toggle("active", groupButtonActive(s))
  toolDoorwayBtn.classList.toggle("active", s.current === "doorway")
  toolDoorBtn.classList.toggle("active", s.current === "door")
}

// панель группы «Проёмы» закрывается при смене инструмента; выделение объектов панелей не открывает
function closeOpeningsPanel(): void {
  openingsPanelOpen = false
  syncOpeningsUI()
}

// поле ввода числа выделенного объекта: элемента стены или коммуникации
const closeNumberEditor = (): void => {
  selectionEditing.closeEditor()
  communicationTool.closeEditor()
  batteryTool.closeEditor()
}

const resetElementTools = (): void => {
  for (const t of elementTools) t.reset()
  communicationTool.reset()
  batteryTool.reset()
}

function selectDoorway(d: WallElement): void {
  closeNumberEditor()
  selectedBatteries = []
  selectedDoorways = [d]
  selectedCommunication = null
  selectedWalls = []
  selectedDimensions = []
  lengthDirty = false
  setWallPanel(false)
  redraw()
}

const pushSnapshot = (snapshot: Scene): void => {
  nudgeBurst = false
  recordSnapshot(activeHistory(), historyOf(snapshot))
}

function setWallPanel(open: boolean): void {
  wallPanelOpen = open
  wallPanel.classList.toggle("open", open)
}

function selectDimension(dim: Dimension): void {
  closeNumberEditor()
  selectedBatteries = []
  selectedDimensions = [dim]
  selectedCommunication = null
  selectedWalls = []
  selectedDoorways = []
  lengthDirty = false
  setWallPanel(false)
  redraw()
}

function clearDimSelection(): void {
  if (!selectedDimensions.length) return
  selectedDimensions = []
  redraw()
}

function selectWall(wall: Wall): void {
  closeNumberEditor()
  selectedBatteries = []
  selectedWalls = [wall]
  selectedCommunication = null
  selectedDimensions = []
  selectedDoorways = []
  lengthDirty = false
  syncThicknessBox()
  setWallMaterial(wall.type)
  setWallPanel(true)
}

function clearSelection(): void {
  closeNumberEditor()
  selectedBatteries = []
  selectedCommunication = null
  selectedWalls = []
  selectedDimensions = []
  selectedDoorways = []
  lengthDirty = false
  nudgeBurst = false
  setWallPanel(false)
  redraw()
}

// панель инструментов показывает только инструменты активного плана (change demolition-plan, spec drawing-plans
// «Инструменты плана»): элементы с data-tools скрыты, если ни один их инструмент не входит в набор плана;
// элементы с data-plan (разделители) показаны только на своём плане
function syncToolbar(): void {
  const plan = activePlanOf(current())
  const tools = toolsOf(plan)
  for (const el of toolbar.querySelectorAll<HTMLElement>("[data-tools]")) {
    el.hidden = !(el.dataset.tools ?? "").split(" ").some((t) => tools.some((own) => own === t))
  }
  for (const el of toolbar.querySelectorAll<HTMLElement>("[data-plan]")) el.hidden = !(el.dataset.plan ?? "").split(" ").includes(plan)
}

function syncToolUI(): void {
  toolWallBtn.classList.toggle("active", tool === "wall")
  toolDimensionBtn.classList.toggle("active", tool === "dimension")
  toolEraserBtn.classList.toggle("active", tool === "eraser")
  toolRulerBtn.classList.toggle("active", tool === "ruler")
  toolWindowBtn.classList.toggle("active", tool === "window")
  toolBatteryBtn.classList.toggle("active", tool === "battery")
  toolDemolitionBtn.classList.toggle("active", tool === "demolition")
  syncOpeningsUI()
  syncCommunicationsUI()
  syncToolbar()
  canvas.classList.toggle("tool-eraser", tool === "eraser")
}

function setTool(next: Tool): void {
  if (tool === next) return
  tool = next
  clearChain()
  closeNumberEditor()
  dimDraft = emptyDraft()
  lengthDirty = false
  selectedWalls = []
  selectedDimensions = []
  selectedDoorways = []
  selectedBatteries = []
  selectedCommunication = null
  resetElementTools()
  suppressClick = false
  nudgeBurst = false
  groupMove = null
  marquee = null
  marqueeHits = null
  marqueePending = null
  resetDemolition()
  setWallPanel(false)
  closeOpeningsPanel()
  closeCommunicationsPanel()
  syncToolUI()
  syncThicknessBox()
  redraw()
}

// выход из установки без снятия выделения (change select-only-without-tool, design D2): setTool снимает
// выделение, а установка уже выделила поставленный элемент
function leavePlacing(group: GroupState): void {
  tool = "none"
  for (const t of elementTools) t.clearGhost()
  openingsCurrent = group.current
  openingsPanelOpen = group.panelOpen
  syncToolUI()
  redraw()
}

// выход из установки батареи без снятия выделения: поставленная батарея остаётся выделенной (spec battery «Инструмент «Батарея»…»)
function leaveBatteryPlacing(): void {
  tool = "none"
  batteryTool.clearGhost()
  syncToolUI()
  redraw()
}

// выход из установки коммуникации без снятия выделения: поставленная коммуникация остаётся выделенной, панель группы
// закрывается, текущий инструмент группы помнится (spec communications «Установка коммуникации»)
function leaveCommunicationPlacing(): void {
  tool = "none"
  communicationTool.clearGhost()
  const group = afterPlaceCommunication(communicationsGroupState())
  communicationsCurrent = group.current
  communicationsPanelOpen = group.panelOpen
  syncToolUI()
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


function typedLengthCm(): number | null {
  const v = parseFloat(lengthInput.value.replace(",", "."))
  return Number.isFinite(v) && v > 0 ? v * UNIT_TO_CM[unit] : null
}

function previewLengthCm(): number | null {
  // конец превью — с учётом трекинга по узлам, а не точка привязки к сетке
  const end = segment?.end ?? cursor
  if (!chainStart || !end) return null
  if (pointsEqual(chainStart, end)) return null
  // длина от кромки до кромки: у коллинеарного продолжения от торца учитывается выступ начала
  return previewEdgeLengthCm(chainRef, chainStart, end)
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
  return edgeLengthCm(sel, walls)
}

// ввод длины с ограничениями (change wall-move-bounds, design D7): подвижный — непримкнутый конец,
// длина ограничивается касанием; поле приводится к фактической длине при фиксации ввода
function resizeSelected(): void {
  const typed = typedLengthCm()
  if (!typed || selectedWalls.length !== 1) return
  // введённая длина — от кромки до кромки: ось короче на выступы торцов (change fix-collinear-edge-to-edge-length)
  const len = axisLengthForEdgeCm(selectedWalls[0], walls, typed)
  if (len === null) return
  const before = cloneScene(scene())
  const result = resizeWallBounded(walls, selectedWalls[0], len, { ortho, doorways, communications: communicationsOf(), batteries })
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
  const h = activeHistory()
  undoBtn.disabled = h.past.length === 0
  redoBtn.disabled = h.future.length === 0
}

function drawPatternPreviews(): void {
  for (const btn of wallTypesRow.querySelectorAll<HTMLButtonElement>(".wall-type"))
    drawPatternPreview(btn.querySelector("canvas")!, btn.dataset.material as Material, paletteOf(theme))
}

function redraw(): void {
  if (workspace) {
    restoreRemnants()
    if (dirty) commitMounting()
  }
  if (onDemolition()) drawDemolitionPlan()
  else drawMeasurePlan()
  updateLengthBox()
  updateAngleBox()
  syncHistoryButtons()
  syncScale()
  if (dirty) {
    dirty = false
    if (!readOnly) saveStore(store)
    if (!readOnly && !historyReadOnly) saveHistory(historyStore)
  }
}

// план «Демонтаж»: подложка из стен обмерочного плана без сносимых элементов, область сноса, выделение и превью
function drawDemolitionPlan(): void {
  const marks = effectiveMarks(demolitionHost.marks(), walls, doorways)
  renderDemolition(
    canvas,
    {
      walls,
      doorways,
      communications: communicationsOf(),
      batteries,
      demolishedBatteryIds: new Set(demolishedBatteries(batteryMarksOf(), batteries).map((b) => b.id)),
      marks,
      selectedId: demolitionTool.selectedId(),
      ghost: demolitionTool.ghost(),
      ruler: tool === "ruler" && cursor && !gestureActive() ? rulerReading(cursor, walls) : null,
      erasing: tool === "eraser" && cursor ? demolitionTool.eraseTarget(cursor) : null,
    },
    unit,
    view,
    { color: demolitionColor(theme), palette: paletteOf(theme) },
  )
}

function drawMeasurePlan(): void {
  const p = chainStart && segment ? segment.end : null
  const target = tool === "eraser" && cursor ? eraserTarget(cursor) : { wall: null, dim: null, doorway: null, communication: null, battery: null }
  const draft = dimDraftGeometry()
  const snapHit = tool === "dimension" && cursor && (!dimDraft.a || !dimDraft.b) ? nearestDimAnchor(cursor, walls, doorways, radiusCm(), batteries.filter(editableBattery)) : null
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
    communications: communicationsOf(),
    selectedCommunications: selectedCommunication ? [selectedCommunication] : [],
    communicationGhost: communicationKind() ? communicationTool.ghost() : null,
    hoverCommunication: target.communication,
    batteries,
    selectedBatteries,
    batteryGhost: tool === "battery" ? batteryTool.ghost() : null,
    hoverBattery: target.battery,
    hoverDoorDirection: tool !== "eraser" && hoverWorld ? selectionEditing.hoverDirection(hoverWorld) : null,
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
}

// нажатая кнопка мыши: рамка, перетаскивание стен или размера, протяжка пометки, сдвиг вида
function gestureActive(): boolean {
  return !!(marquee || marqueePending || groupMove || endpointDrag || dimDrag || doorwayTool.dragging() || communicationTool.dragging() || batteryTool.dragging() || demolitionTool.dragging() || panDrag)
}

// ластик: размер → коммуникация → батарея → проём → стена (wall-deletion «Инструмент «Ластик»», «Ластик и удаление
// коммуникаций»); коммуникации стираются только на обмерочном плане
function eraserTarget(p: Point): {
  wall: Wall | null
  dim: Dimension | null
  doorway: WallElement | null
  communication: Communication | null
  battery: Battery | null
} {
  const found = erasePick(p, { walls, dimensions, doorways, batteries }, radiusCm(), 2)
  const communication = found?.kind === "dimension" || !communicationsEditable() ? null : hitCommunication(p, communicationsOf(), radiusCm())
  // остатки, старые элементы и старые батареи ластиком не стираются
  const readOnly = found && (found.kind === "doorway" ? !editableElement(found.doorway) : found.kind === "battery" ? !editableBattery(found.battery) : found.kind === "wall" && !editableWall(found.wall))
  const pick = readOnly ? null : found
  return {
    wall: !communication && pick?.kind === "wall" ? pick.wall : null,
    dim: pick?.kind === "dimension" ? pick.dimension : null,
    doorway: !communication && pick?.kind === "doorway" ? pick.doorway : null,
    communication,
    battery: !communication && pick?.kind === "battery" ? pick.battery : null,
  }
}

function dimDraftGeometry(): (DimGeometry & { valueCm: number }) | null {
  if (!dimDraft.a || !dimDraft.b || !cursor) return null
  const ea = endPoint(dimDraft.a)
  const eb = endPoint(dimDraft.b)
  if (!ea || !eb || pointsEqual(ea, eb)) return null
  const axis = draftGeometry(0)
  if (!axis) return null
  return draftGeometry(dimLevelSnap(cursor, axis, dimensions, walls, radiusCm(), doorways)?.offset ?? dimensionOffsetAt(cursor, axis))
}

// геометрия размера между точками черновика с заданным смещением (число размера с углом батареи — по оси стены батареи)
function draftGeometry(offset: number): (DimGeometry & { valueCm: number }) | null {
  if (!dimDraft.a || !dimDraft.b) return null
  return dimensionGeometry({ from: dimDraft.a, to: dimDraft.b, offset }, walls, doorways, batteries)
}

function draftRubber(end: Point): [Point, Point] | null {
  const ea = dimDraft.a ? endPoint(dimDraft.a) : null
  return ea ? [ea, end] : null
}

// подпись подобранного масштаба и доступность экспорта (spec drawing-scale «Показ подобранного масштаба»)
function syncScale(): void {
  const pages = pagesOf(current())
  scaleLabelEl.textContent = scaleLabel(pages, pdfFormat.value as PageFormat)
  pdfExportBtn.disabled = pages.every((p) => p.walls.length === 0)
}
function toWorld(e: MouseEvent): Point {
  const r = canvas.getBoundingClientRect()
  const k = PX_PER_CM * view.zoom
  return { x: (e.clientX - r.left) / k + view.pan.x, y: (e.clientY - r.top) / k + view.pan.y }
}

// экранная точка курсора относительно холста, px (мёртвая зона жеста пометки)
function screenPoint(e: MouseEvent): Point {
  const r = canvas.getBoundingClientRect()
  return { x: e.clientX - r.left, y: e.clientY - r.top }
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
    const r = snapStartVertex(raw, walls, snapRadiusCm(view.zoom), GRID_STEP_CM, thicknessCm, doorways, communicationsOf())
    cursor = r.point
    cursorSnap = r
    segment = null
    endBlocked = false
    return
  }
  // старт зафиксирован кликом; один расчёт сегмента для превью и фиксации (design D5)
  const computed = chainSegment({
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
    communications: communicationsOf(),
  })
  // конец стены, налагающийся на коммуникацию, обрезается до касания; нулевая стена не ставится (spec wall-collision
  // «Стены не налагаются на коммуникации»)
  const byCommunications = limitNewWall(chainStart, computed.end, thicknessCm, communicationsOf())
  const limited = byCommunications && limitNewWallByBatteries(chainStart, byCommunications, thicknessCm, walls, batteries)
  endBlocked = limited === null
  segment = limited === null ? { ...computed, end: chainStart } : pointsEqual(limited, computed.end) ? computed : { ...computed, end: limited }
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
    // квадрат установки, налагающийся на коммуникацию, начала стены не фиксирует
    const startSquare = cursorSnap ? placementSquare(cursorSnap, thicknessCm) : null
    if (startSquare && !(squareAllowed(startSquare, communicationsOf()) && squareAllowedForBatteries(startSquare, walls, batteries))) return
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
  if (endBlocked) return
  if (!pointsEqual(a, end)) {
    const wall: Wall = { id: crypto.randomUUID(), a, b: end, thicknessCm, type: wallMaterial }
    // продолжение свободного конца стены той же толщины и материала удлиняет её (change merge-collinear-walls)
    const merge = mergeContinuation(scene(), wall)
    // стена, нарушающая проём, не фиксируется: цепочка продолжается (spec wall-drawing)
    if (merge.kind === "blocked") return
    // остаток стены обмера не удлиняется: на плане «Монтаж» продолжение остатка остаётся отдельной стеной
    const extendsRemnant =
      workspace !== null &&
      merge.kind === "merged" &&
      merge.scene.walls.some((w, i) => workspace?.remnantIds.has(w.id) === true && !(pointsEqual(w.a, walls[i].a) && pointsEqual(w.b, walls[i].b)))
    if (merge.kind === "merged" && !extendsRemnant) {
      // удлинённая стена пересчитывает свои автоматические размеры в той же записи истории
      const next = syncAutoDimensions(merge.scene)
      pushRecord()
      dirty = true
      const wallsBefore = [...walls]
      next.walls.forEach((w, i) => {
        walls[i] = w
      })
      // пометки сноса удлинённой стены остаются на месте в плане (change demolition-plan, design D6)
      const marks = current().demolition
      if (marks && !workspace) current().demolition = reanchorMarks(marks, wallsBefore, next.walls)
      setDimensions(next.dimensions)
      setDoorways(next.doorways ?? [])
    } else {
      // новая стена получает размеры и пересчитывает размеры соседей в той же записи истории (design D1, D6)
      const placed = placeWall(scene(), wall)
      if (!placed) return
      pushRecord()
      dirty = true
      walls.push(wall)
      setDimensions(placed.dimensions)
    }
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
  const communications = communicationsOf()
  return snapped.axisWall ? { ortho, snappedAxis: snapped.axisWall, doorways, communications, batteries } : { ortho, doorways, communications, batteries }
}

canvas.addEventListener("pointermove", (e) => {
  if (doorwayTool.dragging()) {
    doorwayTool.dragTo(toWorld(e))
    redraw()
    return
  }
  if (communicationTool.dragging()) {
    communicationTool.dragTo(toWorld(e))
    redraw()
    return
  }
  if (batteryTool.dragging()) {
    batteryTool.dragTo(toWorld(e))
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
    const axis = dimensionGeometry({ ...dimDrag.dim, offset: 0 }, walls, doorways, batteries)
    if (axis) {
      const dragged = dimDrag.dim
      const level = dimLevelSnap(p, axis, dimensions.filter((d) => d !== dragged), walls, radiusCm(), doorways)
      dragged.offset = level ? level.offset : dimensionOffsetAt(p, axis)
      // передвинутый пользователем размер больше не автоматический: пересчёт его не заменяет (change auto-wall-dimensions, design D5)
      delete dragged.auto
      dirty = true
      redraw()
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
  if (onDemolition()) {
    // протяжка пометки перерисовывает сама; «Линейка» и «Ластик» следят за курсором
    if (tool === "demolition") demolitionTool.move(toWorld(e), screenPoint(e))
    else if (tool === "ruler" || tool === "eraser") {
      cursor = toWorld(e)
      redraw()
    }
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
  else if (placingTool()) {
    cursor = toWorld(e)
    placingTool()?.hover(cursor)
  } else if (communicationKind()) {
    cursor = toWorld(e)
    hoverCommunicationGhost(cursor)
  } else if (tool === "battery") {
    cursor = toWorld(e)
    batteryTool.hover(cursor)
  } else cursor = toSnappedPoint(e)
  hoverWorld = toWorld(e)
  redraw()
})

// линейка показывает замеры только пока курсор над холстом; подсветка тени направления двери — тоже
canvas.addEventListener("pointerleave", () => {
  hoverWorld = null
  if ((tool === "ruler" || (tool === "eraser" && onDemolition())) && cursor) cursor = null
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
  hoverWorld = null // нажатие начинает жест — подсветка до следующего движения не нужна
  if (onDemolition()) {
    const p = toWorld(e)
    if (tool === "demolition") {
      // нажатие внутри батареи — пометка батареи кликом; иначе протяжка по стене (spec demolition-plan «Снос батареи»)
      const battery = hitBattery(p, walls, batteries, 0)
      if (battery) batteryPress = { id: battery.id, px: screenPoint(e) }
      else demolitionTool.down(p, screenPoint(e))
      canvas.setPointerCapture(e.pointerId) // отпускание за пределами холста завершает протяжку
    } else if (selectionAllowed(tool)) {
      // без инструмента: правимое число выделенной пометки, иначе выделение пометки под точкой
      if (!pressDemolitionNumber(p)) {
        demolitionTool.select(p)
        resumeDemolitionTool()
      }
    }
    return
  }
  // при активном инструменте нажатие ничего не выделяет и не правит: его действие выполняет click
  // (change select-only-without-tool, spec canvas-app «Выделение и правка только без инструмента»)
  if (!selectionAllowed(tool)) return
  // правка выделенного элемента на месте (change popups-buttons-only, design D6): правимое число, затем зона
  // направления выделенной двери — главнее любой цели нажатия
  const p = toWorld(e)
  if (selectionEditing.pressNumber(p) || selectionEditing.pressZone(p) || (communicationsEditable() && communicationTool.pressNumber(p)) || batteryTool.pressNumber(p)) {
    suppressClick = true
    return
  }
  // цель нажатия (change fix-midpoint-marker-priority, design D2): маркеры выделенной стены главнее
  // размера, проёма и тела стены
  const found = pressPick(p, { walls, dimensions, doorways, batteries }, radiusCm(), 2, {
    selectedWall: selectedWalls.length === 1 ? selectedWalls[0] : null,
    middleMarker: true,
    dimensions: true,
    elements: true,
    batteries: true,
  }, communicationsEditable() ? { items: communicationsOf(), tolCm: communicationBodyTolCm(PX_PER_CM * view.zoom) } : undefined)
  // остатки и старые элементы только для чтения: нажатие по ним ничего не выделяет (spec mounting-plan)
  const readOnly =
    found && (found.kind === "doorway" ? !editableElement(found.doorway) : found.kind === "battery" ? !editableBattery(found.battery) : "wall" in found && !editableWall(found.wall))
  const pick = readOnly ? null : found
  if (pick?.kind === "end") {
    suppressClick = true
    const other = pick.wall[pick.end === "a" ? "b" : "a"]
    endpointDrag = {
      wall: pick.wall,
      end: pick.end,
      base: pick.wall[pick.end],
      snapshot: cloneScene(scene()),
      gesture: startOrthoGesture("end", p, { ...other }),
    }
    canvas.setPointerCapture(e.pointerId)
    return
  }
  switch (pick?.kind) {
    case "middle":
      startGroupMove(pick.wall, p, e)
      return
    case "dimension":
      dimDrag = { dim: pick.dimension, baseOffset: pick.dimension.offset, snapshot: cloneScene(scene()) }
      suppressClick = true
      selectDimension(pick.dimension)
      canvas.setPointerCapture(e.pointerId)
      return
    case "communication":
      // коммуникация под курсором: после размера, до проёма и тела стены (spec dimension-selection «Нажатие по размеру
      // главнее тела коммуникации»); только на обмерочном плане
      if (communicationTool.pressBody(p)) {
        suppressClick = true
        canvas.setPointerCapture(e.pointerId)
      }
      return
    case "battery":
      // выделение и перетаскивание батареи вдоль опорной стены
      if (batteryTool.pressBody(p)) {
        suppressClick = true
        canvas.setPointerCapture(e.pointerId)
      }
      return
    case "doorway":
      // выделение и перетаскивание элемента вдоль опорной стены
      if (doorwayTool.pressDoorway(p)) {
        suppressClick = true
        canvas.setPointerCapture(e.pointerId)
      }
      return
    case "wall":
      if (!selectedWalls.length) return
      if (!selectedWalls.includes(pick.wall)) selectWall(pick.wall)
      startGroupMove(pick.wall, p, e)
      return
    case undefined: {
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
  if (onDemolition() && e.button === 0) {
    // поставленная пометка остаётся выделенной, инструмент снимается — как у проёма (change demolition-select-after-mark)
    if (tool === "demolition" && batteryPress) {
      const press = batteryPress
      batteryPress = null
      if (Math.hypot(screenPoint(e).x - press.px.x, screenPoint(e).y - press.px.y) <= BATTERY_CLICK_PX) markBattery(press.id)
    } else if (tool === "demolition" && demolitionTool.up(toWorld(e), screenPoint(e)) !== null) leaveDemolitionTool()
    return
  }
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
  if (communicationTool.dragging()) {
    if (e.button === 0) {
      communicationTool.endDrag()
      redraw()
    }
    return
  }
  if (batteryTool.dragging()) {
    if (e.button === 0) {
      batteryTool.endDrag()
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

function marqueePicks(rect: { x1: number; y1: number; x2: number; y2: number }): { walls: Wall[]; dims: Dimension[]; doorways: WallElement[]; batteries: Battery[] } {
  const k = PX_PER_CM * view.zoom
  const min = { x: Math.min(rect.x1, rect.x2) / k + view.pan.x, y: Math.min(rect.y1, rect.y2) / k + view.pan.y }
  const max = { x: Math.max(rect.x1, rect.x2) / k + view.pan.x, y: Math.max(rect.y1, rect.y2) / k + view.pan.y }
  // ось стены на участке её проёма стену не выделяет (multi-selection «Рамка выделения»)
  const wallsPicked = wallsInRect(min, max, walls, doorways).filter(editableWall)
  const dimsPicked = dimensions.filter((d) => {
    const geom = dimensionGeometry(d, walls, doorways, batteries)
    return !!geom && segmentIntersectsRect(geom.p1, geom.p2, min, max)
  })
  return {
    walls: wallsPicked,
    dims: dimsPicked,
    doorways: doorwaysInRect(min, max, walls, doorways).filter(editableElement),
    batteries: batteriesInRect(min, max, walls, batteries).filter(editableBattery),
  }
}

function finishMarquee(rect: { x1: number; y1: number; x2: number; y2: number }, additive: boolean): void {
  const picks = marqueePicks(rect)
  marqueeHits = null
  selectedCommunication = null // рамка коммуникации не захватывает (spec communications)
  selectedWalls = additive ? [...selectedWalls, ...picks.walls.filter((w) => !selectedWalls.includes(w))] : picks.walls
  selectedDimensions = additive ? [...selectedDimensions, ...picks.dims.filter((d) => !selectedDimensions.includes(d))] : picks.dims
  selectedDoorways = additive ? [...selectedDoorways, ...picks.doorways.filter((d) => !selectedDoorways.includes(d))] : picks.doorways
  selectedBatteries = additive ? [...selectedBatteries, ...picks.batteries.filter((b) => !selectedBatteries.includes(b))] : picks.batteries
  lengthDirty = false
  closeNumberEditor()
  if (!selectedDoorways.length && !selectedBatteries.length && selectedWalls.length === 1 && !selectedDimensions.length) {
    syncThicknessBox()
    setWallMaterial(selectedWalls[0].type)
    setWallPanel(true)
  } else setWallPanel(false)
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
  // на плане «Демонтаж» жесты разбирает адаптер по нажатию и отпусканию (change demolition-plan, design D10);
  // «Ластик» снимает пометку под курсором по клику (change demolition-doorway-sizes, design D5)
  if (onDemolition()) {
    if (tool === "eraser" && !demolitionTool.erase(toWorld(e))) eraseBatteryMark(toWorld(e))
    return
  }
  const p = toSnappedPoint(e)
  const raw = toWorld(e)
  if (tool === "eraser") {
    const { wall, dim, doorway, communication, battery } = eraserTarget(p)
    if (dim) deleteDimension(dim)
    else if (communication) deleteCommunication(communication)
    else if (battery) deleteBattery(battery)
    else if (doorway) deleteDoorway(doorway)
    else if (wall) deleteWall(wall)
    return
  }
  const kind = communicationKind()
  if (kind) {
    // установка снимает инструмент, поставленная коммуникация остаётся выделенной (spec communications «Установка»)
    if (communicationTool.place(kind, raw)) leaveCommunicationPlacing()
    return
  }
  if (tool === "battery") {
    // установка снимает инструмент, поставленная батарея остаётся выделенной (spec battery «Инструмент «Батарея»…»)
    if (batteryTool.place(raw)) leaveBatteryPlacing()
    return
  }
  const placing = placingTool()
  if (placing) {
    const placed = doorways.length
    placing.place(raw)
    // установка снимает инструмент, поставленный элемент остаётся выделенным (spec doorway «Установка проёма»)
    if (doorways.length > placed) leavePlacing(afterPlace(tool, groupState()).group)
    return
  }
  if (tool === "dimension") {
    placeDimension(raw)
    return
  }
  if (selectionAllowed(tool)) {
    const wall = hitWall(raw, walls.filter(editableWall), radiusCm())
    if (wall) {
      selectWall(wall)
      return
    }
    selectedWalls = []
    selectedBatteries = []
    selectedCommunication = null
    lengthDirty = false
    clearDimSelection()
    redraw()
    return
  }
  // остался инструмент «Стена» (линейка не кликает): тело существующей стены стену не выделяет и не начинает,
  // прилипший квадрат рисует (change select-only-without-tool, spec wall-drawing «Квадрат при установке стены»)
  if (tool !== "wall") return
  if (!chainStart && wallClickAction(raw, snapStartVertex(raw, walls, radiusCm(), GRID_STEP_CM, thicknessCm, doorways, communicationsOf()), walls, radiusCm()).kind === "select") return
  updateWallCursor(e)
  commitPoint()
})

function placeDimension(p: Point): void {
  if (!dimDraft.a || !dimDraft.b) {
    const hit = nearestDimAnchor(p, walls, doorways, radiusCm(), batteries.filter(editableBattery))
    if (!hit) return
    const point = hit.anchor
    if (!dimDraft.a) dimDraft.a = point
    else dimDraft.b = point
    redraw()
    return
  }
  const ea = endPoint(dimDraft.a)
  const eb = endPoint(dimDraft.b)
  const axis = draftGeometry(0)
  if (!ea || !eb || pointsEqual(ea, eb) || !axis) {
    dimDraft = emptyDraft()
    redraw()
    return
  }
  pushRecord()
  dimensions.push({ from: dimDraft.a, to: dimDraft.b, offset: dimLevelSnap(p, axis, dimensions, walls, radiusCm(), doorways)?.offset ?? dimensionOffsetAt(p, axis) })
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
function removeObjects(picked: { walls: Wall[]; dimensions: Dimension[]; doorways: WallElement[]; batteries?: Battery[] }): void {
  const next = deleteObjects(scene(), picked)
  for (const w of picked.walls) walls.splice(walls.indexOf(w), 1)
  setDimensions(next.dimensions)
  setDoorways(next.doorways ?? [])
  setBatteries(next.batteries ?? batteries)
}

function deleteBattery(b: Battery): void {
  pushRecord()
  closeNumberEditor()
  removeObjects({ walls: [], dimensions: [], doorways: [], batteries: [b] })
  dirty = true
  redraw()
}

// пометка сноса батареи кликом инструмента «Демонтаж»: один шаг истории плана «Демонтаж»; уже помеченная — без изменений
function markBattery(id: string): void {
  const next = addBatteryMark(batteryMarksOf(), id, crypto.randomUUID())
  if (next === batteryMarksOf()) return
  recordDemolition(activeHistory(), { marks: current().demolition ?? NO_MARKS, batteryMarks: batteryMarksOf() })
  current().batteryDemolition = next
  dirty = true
  redraw()
}

// «Ластик» плана «Демонтаж» снимает пометку батареи под курсором
function eraseBatteryMark(p: Point): void {
  const mark = batteryMarkAt(p, batteryMarksOf(), batteries, walls, radiusCm())
  if (!mark) return
  recordDemolition(activeHistory(), { marks: current().demolition ?? NO_MARKS, batteryMarks: batteryMarksOf() })
  current().batteryDemolition = removeBatteryMark(batteryMarksOf(), mark.id)
  dirty = true
  redraw()
}

function deleteDoorway(d: WallElement): void {
  pushRecord()
  closeNumberEditor()
  removeObjects({ walls: [], dimensions: [], doorways: [d] })
  dirty = true
  redraw()
}

function deleteCommunication(c: Communication): void {
  pushRecord()
  closeNumberEditor()
  setCommunications(communicationsOf().filter((o) => o !== c))
  dirty = true
  redraw()
}

function deleteWall(wall: Wall): void {
  pushRecord()
  removeObjects({ walls: [wall], dimensions: [], doorways: [] })
  if (selectedDimensions.some((d) => !dimensions.includes(d))) {
    selectedDimensions = selectedDimensions.filter((d) => dimensions.includes(d))
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
  }
  dirty = true
  redraw()
}

function deleteSelection(): void {
  if (selectedCommunication) {
    deleteCommunication(selectedCommunication)
    return
  }
  if (!selectedWalls.length && !selectedDimensions.length && !selectedDoorways.length && !selectedBatteries.length) return
  pushRecord()
  closeNumberEditor()
  removeObjects({ walls: selectedWalls, dimensions: selectedDimensions, doorways: selectedDoorways, batteries: selectedBatteries })
  selectedWalls = []
  selectedDimensions = []
  selectedDoorways = []
  selectedBatteries = []
  lengthDirty = false
  nudgeBurst = false
  setWallPanel(false)
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
    thicknessAllowed(walls, selectedWalls[0], thicknessCm, doorways) &&
    thicknessAllowedForCommunications(walls, selectedWalls[0], thicknessCm, communicationsOf()) &&
    thicknessAllowedForBatteries(walls, selectedWalls[0], thicknessCm, batteries, communicationsOf())
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
  if (tool !== "wall") {
    setTool("wall")
    setWallPanel(true)
  } else setWallPanel(!wallPanelOpen)
})

toolDimensionBtn.addEventListener("click", () => setTool("dimension"))

toolEraserBtn.addEventListener("click", () => setTool("eraser"))

// кнопка группы «Проёмы» и кнопки её инструментов (spec canvas-app «Группа «Проёмы»»)
toolOpeningsBtn.addEventListener("click", () => applyGroup(groupButtonClick(groupState())))
toolDoorwayBtn.addEventListener("click", () => applyGroup(groupPick(groupState(), "doorway")))
toolDoorBtn.addEventListener("click", () => applyGroup(groupPick(groupState(), "door")))

// кнопка группы «Коммуникации» и кнопки её инструментов (spec canvas-app «Панель группы «Коммуникации»»)
toolCommunicationsBtn.addEventListener("click", () => applyCommunicationsGroup(communicationsGroupClick(communicationsGroupState())))
toolRiserBtn.addEventListener("click", () => applyCommunicationsGroup(communicationsGroupPick(communicationsGroupState(), "riser")))
toolDuctBtn.addEventListener("click", () => applyCommunicationsGroup(communicationsGroupPick(communicationsGroupState(), "duct")))

// у инструментов без кнопок-параметров («Окно», «Размер», «Линейка», «Ластик») панели нет: клик только активирует
toolWindowBtn.addEventListener("click", () => setTool("window"))
toolBatteryBtn.addEventListener("click", () => setTool("battery"))

toolRulerBtn.addEventListener("click", () => setTool("ruler"))
toolDemolitionBtn.addEventListener("click", () => setTool("demolition"))

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

// переключатель планов: по кнопке на план каталога, активный план активного чертежа выделен
function renderPlanSwitch(): void {
  const active = activePlanOf(current())
  planSwitch.replaceChildren(
    ...PLANS.map((p) => {
      const btn = document.createElement("button")
      btn.className = p.id === active ? "plan-btn active" : "plan-btn"
      btn.type = "button"
      btn.dataset.plan = p.id
      btn.textContent = p.label
      return btn
    }),
  )
}

function setPlan(id: PlanId): void {
  if (id === activePlanOf(current())) return
  commitMounting()
  current().activePlan = id
  activate(store.activeId)
}

planSwitch.addEventListener("click", (e) => {
  const id = (e.target as HTMLElement).closest<HTMLElement>(".plan-btn")?.dataset.plan
  if (isPlanId(id)) setPlan(id)
})

function nextName(): string {
  const used = new Set(store.drawings.map((d) => d.name))
  for (let n = 1; ; n++) if (!used.has(`Чертёж ${n}`)) return `Чертёж ${n}`
}

function newDrawing(): void {
  const drawing: Drawing = { id: crypto.randomUUID(), name: nextName(), walls: [], dimensions: [], view: { zoom: 1, pan: { x: 0, y: 0 } } }
  store.drawings.push(drawing)
  dirty = true
  activate(drawing.id)
}

function activate(id: string): void {
  commitMounting()
  store.activeId = id
  loadWorking()
  view = current().view
  tool = defaultToolOf(activePlanOf(current()))
  syncToolUI()
  resetDemolition()
  clearChain()
  closeNumberEditor()
  selectedWalls = []
  selectedDimensions = []
  selectedDoorways = []
  selectedBatteries = []
  selectedCommunication = null
  resetElementTools()
  closeOpeningsPanel()
  closeCommunicationsPanel()
  dimDraft = emptyDraft()
  dimDrag = null
  lengthDirty = false
  endpointDrag = null
  groupMove = null
  marquee = null
  marqueeHits = null
  marqueePending = null
  nudgeBurst = false
  dirty = true
  renderTabs()
  renderPlanSwitch()
  redraw()
}

function closeDrawing(id: string): void {
  const drawing = store.drawings.find((d) => d.id === id)!
  if (!confirm(`Удалить чертёж «${drawing.name}»?`)) return
  const idx = store.drawings.indexOf(drawing)
  removeDrawing(id, idx)
  const h = activeHistory()
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
  resetDemolition()
  clearChain()
  closeNumberEditor()
  selectedWalls = []
  selectedDimensions = []
  selectedDoorways = []
  selectedBatteries = []
  selectedCommunication = null
  resetElementTools()
  dimDraft = emptyDraft()
  lengthDirty = false
  suppressClick = false
  nudgeBurst = false
  marqueeHits = null
  syncThicknessBox()
}

// отмена или повтор шага пометок плана «Демонтаж» (change demolition-plan, design D7)
function stepMarks(step: typeof undoDemolition): void {
  const next = step(activeHistory(), { marks: current().demolition ?? NO_MARKS, batteryMarks: batteryMarksOf() })
  if (!next) return
  current().demolition = next.marks
  if (next.batteryMarks.length > 0 || current().batteryDemolition !== undefined) current().batteryDemolition = next.batteryMarks
  dirty = true
  resetEditing()
  redraw()
}

// сцена из записи истории: на плане «Монтаж» запись хранит содержимое «Монтажа» — рабочая сцена строится заново
// (остатки берутся по текущему обмеру и демонтажу), на остальных планах запись подставляется как есть
function restoreScene(e: Scene): void {
  if (workspace) {
    current().mounting = { walls: e.walls, dimensions: e.dimensions, ...(e.doorways ? { doorways: e.doorways } : null), ...(e.batteries ? { batteries: e.batteries } : null) }
    loadWorking()
    return
  }
  current().walls = e.walls
  current().dimensions = e.dimensions
  walls = e.walls
  dimensions = e.dimensions
  setDoorways(e.doorways ?? [])
  // запись без поля коммуникаций (история до их введения) список не меняет (spec communications «История коммуникаций»)
  if (e.communications) setCommunications(e.communications)
  // запись без поля батарей список не меняет (spec drawing-history)
  if (e.batteries) setBatteries(e.batteries)
}

function undo(): void {
  if (groupMove || endpointDrag || panDrag || dimDrag || doorwayTool.dragging() || communicationTool.dragging() || batteryTool.dragging() || demolitionTool.dragging()) return
  const h = activeHistory()
  if (h.past[h.past.length - 1]?.kind === "demolition") {
    stepMarks(undoDemolition)
    return
  }
  const e = undoEntry(h, historyOf(scene()))
  if (!e) return
  if (e.kind === "walls") {
    restoreScene(e)
  } else if (e.kind === "close") {
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
  if (groupMove || endpointDrag || panDrag || dimDrag || doorwayTool.dragging() || communicationTool.dragging() || batteryTool.dragging() || demolitionTool.dragging()) return
  const h = activeHistory()
  if (h.future[h.future.length - 1]?.kind === "demolition") {
    stepMarks(redoDemolition)
    return
  }
  const e = redoEntry(h, historyOf(scene()))
  if (!e) return
  if (e.kind === "walls") {
    restoreScene(e)
  } else if (e.kind === "close") {
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
  const pages = pagesOf(drawing)
  const format = pdfFormat.value as PageFormat
  const scale = fitScale(pages, format)
  if (scale === null) return
  exportPages(pages, unit, scale, format, drawing.name)
})

// масштаб зависит от формата: подпись пересчитывается при его смене
pdfFormat.addEventListener("change", () => {
  syncScale()
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
    if (onDemolition()) {
      if (!demolitionTool.dragging()) {
        demolitionTool.deleteSelected()
        resumeDemolitionTool()
      }
      return
    }
    if (groupMove || endpointDrag || panDrag || dimDrag || doorwayTool.dragging() || communicationTool.dragging() || batteryTool.dragging()) return
    deleteSelection()
    return
  }
  if (e.key === "Escape" && onDemolition()) {
    const action = escapeAction({
      tool,
      gestureActive: demolitionTool.dragging(),
      dimensionDraft: false,
      hasSelection: demolitionTool.selectedId() !== null,
    })
    if (action === "end-gesture") demolitionTool.cancel()
    else if (action === "clear-selection") {
      demolitionTool.clearSelection()
      resumeDemolitionTool()
    } else if (action === "deactivate-tool") setTool("none")
    return
  }
  if (e.key === "Escape") {
    const action = escapeAction({
      tool,
      gestureActive: !!chainStart,
      dimensionDraft: !!(dimDraft.a || dimDraft.b),
      hasSelection: selectedDimensions.length + selectedWalls.length + selectedDoorways.length + selectedBatteries.length > 0 || selectedCommunication !== null,
    })
    if (action === "end-gesture") endChain()
    else if (action === "cancel-dimension-draft") {
      dimDraft = emptyDraft()
      redraw()
    } else if (action === "clear-selection") clearSelection()
    else if (action === "deactivate-tool") setTool("none")
  }
  if (e.key !== "ArrowUp" && e.key !== "ArrowDown" && e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
  if (e.target instanceof HTMLInputElement) return
  // на плане «Демонтаж» нет стен, материалов и элементов: стрелки ничего не двигают и не переключают
  if (onDemolition()) return
  if (groupMove || endpointDrag || panDrag || dimDrag || doorwayTool.dragging() || communicationTool.dragging() || batteryTool.dragging()) return
  // выделенная коммуникация стрелками не двигается и материал не переключается (spec communications)
  if (selectedCommunication) return
  if (selectedWalls.length || selectedDimensions.length || selectedDoorways.length || selectedBatteries.length) {
    if (!selectedWalls.length) {
      if (!selectedDoorways.length && !selectedBatteries.length) return
      e.preventDefault()
      const step = e.shiftKey ? 1 : GRID_STEP_CM
      const arrow = e.key === "ArrowUp" ? { x: 0, y: -1 } : e.key === "ArrowDown" ? { x: 0, y: 1 } : e.key === "ArrowLeft" ? { x: -1, y: 0 } : { x: 1, y: 0 }
      // одна серия стрелок — одна запись истории: запись открывает первое изменившее сцену нажатие
      const movedElements = selectedDoorways.length > 0 && doorwayTool.nudge(arrow, step)
      const movedBatteries = selectedBatteries.length > 0 && batteryTool.nudge(arrow, step)
      if (movedElements || movedBatteries) redraw()
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
    const applied = moveWallsBounded(walls, selectedWalls, delta, { ortho, doorways, communications: communicationsOf(), batteries })
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
loadWorking()
syncThicknessBox()
syncToolUI()
renderTabs()
renderPlanSwitch()
applyTheme()
