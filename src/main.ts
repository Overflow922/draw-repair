import "./style.css"
import { cloneScene, loadHistory, planHistory, record, recordCallouts, recordCeilingPlan, recordDemolition, recordFurniture, recordNotes, recordPlumbing, recordRough, recordSnapshot, redoCallouts, redoCeilingPlan, redoDemolition, redoEntry, redoFurniture, redoNotes, redoPlumbing, redoRough, saveHistory, undoCallouts, undoCeilingPlan, undoDemolition, undoEntry, undoFurniture, undoNotes, undoPlumbing, undoRough, recordSwitchingLines, redoSwitchingLines, undoSwitchingLines, recordSwitches, redoSwitches, undoSwitches, recordExhausts, redoExhausts, undoExhausts } from "./history"
import type { Scene } from "./history"
import { dimLevelSnap, dimensionGeometry, dimensionOffsetAt, hitWall, nearestDimAnchor, dimPointPoint, pointsEqual, segmentIntersectsRect, snap, snapOthers, snapWithSource, zoomAt } from "./geometry"
import type { DimGeometry, SnapResult } from "./geometry"
import { addBatteryMark, batteryMarkAt, demolishedBatteries, removeBatteryMark } from "./battery/battery-demolition"
import { limitNewWallByBatteries, squareAllowedForBatteries, thicknessAllowedForBatteries } from "./battery/battery-guard"
import { batteriesInRect, hitBattery } from "./battery/battery-pick"
import { createBatteryTool } from "./battery/battery-tool"
import type { BatteryToolHost } from "./battery/battery-tool"
import { calloutsOf, withCallouts } from "./callout/callout-store"
import { createCalloutTool } from "./callout/callout-tool"
import type { CalloutToolHost } from "./callout/callout-tool"
import { applyNotesText, notesText } from "./notes/notes-actions"
import { notesOf, withNotes } from "./notes/notes-store"
import { moveEndpointBounded, moveWallsBounded, resizeWallBounded } from "./wall-edit"
import type { EditMode } from "./wall-edit"
import { centerSnapRadiusCm, chainEndSquare, placementSquare, snapRadiusCm, snapStartVertex, wallClickAction } from "./wall-snap"
import type { VertexSnap } from "./wall-snap"
import type { TrackLine } from "./battery/battery-guide"
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
import { createPlasterTool } from "./rough/plaster-tool"
import type { PlasterToolHost } from "./rough/plaster-tool"
import { PLASTER_THICKNESS, SCREED_THICKNESS, parseThickness } from "./rough/rough-model"
import { renderRough, rightAngleArmPx } from "./rough/rough-render"
import { roughScene } from "./rough/rough-scene"
import type { RoughScene } from "./rough/rough-scene"
import { cornerStrips } from "./rough/right-angle"
import { createRightAngleTool } from "./rough/right-angle-tool"
import type { RightAngleToolHost } from "./rough/right-angle-tool"
import { createScreedTool } from "./rough/screed-tool"
import type { ScreedToolHost } from "./rough/screed-tool"
import { findRooms } from "./room-area"
import { roomBlockAt, roomBlockLayout, roomBlocksOf } from "./room-block"
import { formatRoomHeight, parseRoomHeight, reconcileRooms } from "./room-explication"
import { rulerReading } from "./ruler"
import type { RulerReading } from "./ruler"
import { rulerObjectsOf } from "./ruler-objects"
import { exportPages, pagesOf } from "./export/pdf"
import { fitScale, scaleLabel } from "./export/fit-scale"
import type { PageFormat } from "./export/pdf"
import { PLANS, activePlanOf, defaultToolOf, isPlanId, toolsOf } from "./plans"
import type { PlanId } from "./plans"
import { createDeferredSave } from "./deferred-save"
import { createFrameScheduler } from "./frame-scheduler"
import { UNIT_TO_CM } from "./format-length"
import { isDrywallWall, loadStore, saveStore } from "./storage"
import { DRYWALL_DEFAULTS, editParams, newDrywallWall, panelValues, parseLengthField } from "./reconstruction/drywall-params"
import type { DrywallParams } from "./reconstruction/drywall-params"
import { FURNITURE_KIND_ORDER, kindEntry } from "./furniture/furniture-kinds"
import type { FurnitureKind } from "./furniture/furniture-kinds"
import { renderFurniture } from "./furniture/furniture-render"
import { furnitureScene } from "./furniture/furniture-scene"
import type { FurnitureScene } from "./furniture/furniture-scene"
import { openFurniture, storedFurniture } from "./furniture/furniture-workspace"
import type { Workspace as FurnitureWorkspace } from "./furniture/furniture-workspace"
import { furnitureOverlaps, obstaclesOf, itemOverlaps } from "./furniture/overlap"
import type { Obstacle, Overlap } from "./furniture/overlap"
import { applyItemNumber, itemsInRect } from "./furniture/item-edit"
import type { ItemNumber } from "./furniture/item-number"
import { itemSizeLayout } from "./furniture/item-size-layout"
import { furnitureReachBodies, itemDistanceLayout } from "./furniture/item-wall-reach"
import type { Shape } from "./communications/shape"
import { numberAt } from "./doorway/editable-numbers"
import { editParams as editItemParams, initialKindParams, panelValues as itemPanelValues, parseAngleField, paramsOfKind, withKindParams } from "./furniture/item-params"
import type { ItemParams } from "./furniture/item-params"
import { createItemTool } from "./furniture/item-tool"
import type { ItemToolHost } from "./furniture/item-tool"
import { warningText } from "./furniture/warning"
import { CEILING_DROP_DEFAULT, parseDropMm } from "./ceiling/ceiling"
import { ceilingScene } from "./ceiling/ceiling-scene"
import type { CeilingScene } from "./ceiling/ceiling-scene"
import { createCeilingTool } from "./ceiling/ceiling-tool"
import type { CeilingToolHost } from "./ceiling/ceiling-tool"
import { openCeiling, storedCeiling } from "./ceiling/ceiling-workspace"
import { groupButtonActive as lightGroupActive, groupButtonClick as lightGroupClick, groupPick as lightGroupPick, LIGHT_GROUP_DEFAULT } from "./ceiling/light-group"
import type { LightGroupState } from "./ceiling/light-group"
import type { LightNumber } from "./ceiling/light-numbers"
import { createLightTool } from "./ceiling/light-tool"
import type { LightToolHost } from "./ceiling/light-tool"
import { isLightKind } from "./ceiling/lights"
import { plumbingScene } from "./plumbing/plumbing-scene"
import type { PlumbingScene } from "./plumbing/plumbing-scene"
import { renderPlumbing } from "./plumbing/plumbing-render"
import { openPlumbing, storedPlumbing } from "./plumbing/plumbing-workspace"
import type { PlumbingWorkspace } from "./plumbing/plumbing-workspace"
import { renderSwitching } from "./switching/switching-render"
import { createLightLineTool } from "./switching/light-line-tool"
import type { LightLineToolHost } from "./switching/light-line-tool"
import { lineLabelBox } from "./switching/light-line-label"
import { createExhaustTool } from "./switching/exhaust-tool"
import type { ExhaustToolHost } from "./switching/exhaust-tool"
import { storedExhausts } from "./switching/exhaust"
import { lineNumber, lineLabel, parseLineName, prefixOfName, storedLines, visibleLines } from "./switching/light-lines"
import { keyLabel, parseKeyCount, parseKeyLines, storedSwitches } from "./switching/light-switch"
import { openingBodies } from "./switching/switch-reach"
import { keyGeometry } from "./switching/switch-symbol"
import { createSwitchTool } from "./switching/switch-tool"
import type { SwitchToolHost } from "./switching/switch-tool"
import { PLASTER_OBSTACLE_PREFIX } from "./reconstruction/plaster-obstacles"
import { renderReconstruction } from "./reconstruction/reconstruction-render"
import { reconstructionScene } from "./reconstruction/reconstruction-scene"
import type { ReconstructionScene } from "./reconstruction/reconstruction-scene"
import { openReconstruction, storedReconstruction } from "./reconstruction/reconstruction-workspace"
import type { Workspace as ReconstructionWorkspace } from "./reconstruction/reconstruction-workspace"
import { placeWall, syncAutoDimensions } from "./auto-dimensions"
import { mergeContinuation } from "./wall-merge"
import { axisLengthForEdgeCm, edgeLengthCm } from "./wall-length"
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
import type { Battery, BatteryMark, Communication, DemolitionMark, Dimension, DimPoint, Drawing, DrywallWall, ExhaustFan, Material, PlasterMark, Point, RightAngleMark, RoomRecord, Screed, StretchCeiling, FurnitureItem, LightFixture, LightKind, LightLine, LightSwitch, Unit, View, Wall, WallElement } from "./types"

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
const toolPlasterBtn = document.querySelector<HTMLButtonElement>("#tool-plaster")!
const plasterPanel = document.querySelector<HTMLElement>("#plaster-panel")!
const plasterThicknessInput = document.querySelector<HTMLInputElement>("#plaster-thickness")!
const toolRightAngleBtn = document.querySelector<HTMLButtonElement>("#tool-right-angle")!
const toolScreedBtn = document.querySelector<HTMLButtonElement>("#tool-screed")!
const screedPanel = document.querySelector<HTMLElement>("#screed-panel")!
const screedThicknessInput = document.querySelector<HTMLInputElement>("#screed-thickness")!
const toolStretchCeilingBtn = document.querySelector<HTMLButtonElement>("#tool-stretch-ceiling")!
const ceilingPanel = document.querySelector<HTMLElement>("#ceiling-panel")!
const ceilingDropInput = document.querySelector<HTMLInputElement>("#ceiling-drop")!
const toolLightLineBtn = document.querySelector<HTMLButtonElement>("#tool-light-line")!
const lightLinePanel = document.querySelector<HTMLElement>("#light-line-panel")!
const lightLineInput = document.querySelector<HTMLInputElement>("#light-line-number")!
const toolLightSwitchBtn = document.querySelector<HTMLButtonElement>("#tool-light-switch")!
const toolExhaustBtn = document.querySelector<HTMLButtonElement>("#tool-exhaust")!
const lightSwitchPanel =document.querySelector<HTMLElement>("#light-switch-panel")!
const lightSwitchInput = document.querySelector<HTMLInputElement>("#light-switch-keys")!
const toolLightBtn = document.querySelector<HTMLButtonElement>("#tool-light")!
const lightPanel = document.querySelector<HTMLElement>("#light-panel")!
const lightKindButtons = [...lightPanel.querySelectorAll<HTMLButtonElement>("[data-light]")].flatMap((button): [LightKind, HTMLButtonElement][] => {
  const kind = button.dataset.light
  return kind !== undefined && isLightKind(kind) ? [[kind, button]] : []
})
const toolbar = document.querySelector<HTMLElement>("#toolbar")!
const wallPanel = document.querySelector<HTMLElement>("#wall-panel")!
const toolDrywallBtn = document.querySelector<HTMLButtonElement>("#tool-drywall")!
const drywallPanel = document.querySelector<HTMLElement>("#drywall-panel")!
const drywallThicknessInput = document.querySelector<HTMLInputElement>("#drywall-thickness")!
const drywallHeightInput = document.querySelector<HTMLInputElement>("#drywall-height")!
const drywallThicknessUnit = document.querySelector<HTMLElement>("#drywall-thickness-unit")!
const drywallHeightUnit = document.querySelector<HTMLElement>("#drywall-height-unit")!
const toolFurnitureBtn = document.querySelector<HTMLButtonElement>("#tool-furniture")!
const furniturePanel = document.querySelector<HTMLElement>("#furniture-panel")!
// кнопки видов в панели группы «Мебель» — по одной на вид каталога, в порядке каталога (spec furniture-plan «Каталог видов мебели»)
const furnitureKindsRow = document.querySelector<HTMLElement>("#furniture-kinds")!
const furnitureKindButtons = new Map<FurnitureKind, HTMLButtonElement>(
  FURNITURE_KIND_ORDER.map((kind) => {
    const entry = kindEntry(kind)
    const button = document.createElement("button")
    button.id = `tool-furniture-${kind}`
    button.className = "group-tool"
    button.type = "button"
    button.title = entry.label
    button.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">${entry.icon}</svg><span>${entry.label}</span>`
    furnitureKindsRow.append(button)
    return [kind, button]
  }),
)
const furnitureWidthInput = document.querySelector<HTMLInputElement>("#furniture-width")!
const furnitureLengthInput = document.querySelector<HTMLInputElement>("#furniture-length")!
const furnitureAngleInput = document.querySelector<HTMLInputElement>("#furniture-angle")!
const furnitureWidthUnit = document.querySelector<HTMLElement>("#furniture-width-unit")!
const furnitureLengthUnit = document.querySelector<HTMLElement>("#furniture-length-unit")!
const furnitureWarning = document.querySelector<HTMLElement>("#furniture-warning")!
const roomEditor = document.querySelector<HTMLElement>("#room-editor")!
const roomNameInput = document.querySelector<HTMLInputElement>("#room-name")!
const roomHeightInput = document.querySelector<HTMLInputElement>("#room-height")!
const scaleLabelEl = document.querySelector<HTMLElement>("#scale-label")!
const pdfFormat = document.querySelector<HTMLSelectElement>("#pdf-format")!
const pdfExportBtn = document.querySelector<HTMLButtonElement>("#pdf-export")!
const toolOpeningsBtn = document.querySelector<HTMLButtonElement>("#tool-openings")!
const openingsPanel = document.querySelector<HTMLElement>("#openings-panel")!
const toolDoorwayBtn = document.querySelector<HTMLButtonElement>("#tool-doorway")!
const toolDoorBtn = document.querySelector<HTMLButtonElement>("#tool-door")!
const toolWindowBtn = document.querySelector<HTMLButtonElement>("#tool-window")!
const toolBatteryBtn = document.querySelector<HTMLButtonElement>("#tool-battery")!
const toolCalloutBtn = document.querySelector<HTMLButtonElement>("#tool-callout")!
const toolNotesBtn = document.querySelector<HTMLButtonElement>("#tool-notes")!
const notesPanel = document.querySelector<HTMLElement>("#notes-panel")!
const notesInput = document.querySelector<HTMLTextAreaElement>("#notes-input")!
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
// рабочий набор плана «Реконструкция» (change reconstruction-plan, design D2): walls — подложка и стены гипсокартона, полосы
// штукатурки лежат отдельно как виртуальные стены-препятствия; в чертёж пишутся только стены гипсокартона и размеры
let reconWorkspace: ReconstructionWorkspace | null = null
let obstacles: Wall[] = []
let reconCache: ReconstructionScene | null = null
// толщина и высота новых стен гипсокартона: запоминаются в сеансе, в чертёж не входят
let drywallParams: DrywallParams = { ...DRYWALL_DEFAULTS }
let drywallPanelOpen = false
// рабочий набор плана «Мебель» (change furniture-plan-table, design D3): walls — вся подложка только для чтения, dimensions —
// видимые размеры плана, items — столы; в чертёж пишутся столы и размеры (commitFurniture). Препятствия считаются при загрузке
let furnitureWorkspace: FurnitureWorkspace | null = null
let items: FurnitureItem[] = []
let furnitureObstacles: Obstacle[] = []
// тела граней для расстояний выделенного предмета до стен (change furniture-dimensions, design D2)
let furnitureBodies: Shape[] = []
// поле ввода правимого числа выделенного предмета
let itemNumberEditor: NumberEditor | null = null
let furnitureCache: FurnitureScene | null = null
// значения для новых столов: запоминаются в сеансе, в чертёж не входят
// активный вид инструмента «Мебель» и значения для новых предметов по видам: в сеансе, в чертеже не сохраняются
let furnitureKind: FurnitureKind = "table"
let kindParams = initialKindParams()
const itemParamsOf = (kind: FurnitureKind): ItemParams => paramsOfKind(kindParams, kind)
let furniturePanelOpen = false
// рабочий набор плана «Сантехника» (change add-plumbing-plan, design D3): walls — подложка «Мебели» только для чтения, fixtures —
// приборы «Мебели» только для чтения (по ним разрешаются точки размеров); в чертёж пишутся только размеры плана (commitPlumbing)
let plumbingWorkspace: PlumbingWorkspace | null = null
let plumbingCache: PlumbingScene | null = null
let fixtures: readonly FurnitureItem[] = []
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
// смена вида пишется по завершении жеста, а не при каждом событии (change render-pan-perf, design D3):
// пан — по отпусканию кнопки, колесо — после паузы, остаток — при скрытии страницы; история при этом не пишется
const VIEW_SAVE_DELAY_MS = 300
const viewSave = createDeferredSave(
  () => {
    if (!readOnly) saveStore(store)
  },
  VIEW_SAVE_DELAY_MS,
  { set: (fn, ms) => window.setTimeout(fn, ms), clear: (handle) => window.clearTimeout(handle) },
)
// отрисовка не чаще раза за кадр: серия событий между кадрами даёт одну отрисовку (design D2)
const frame = createFrameScheduler(drawPlan, { request: (fn) => requestAnimationFrame(fn), cancel: (handle) => cancelAnimationFrame(handle) })
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

const endPoint = (end: DimPoint): Point | null => dimPointPoint(end, walls, doorways, batteries, fixtures)

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
  // на плане «Реконструкция» — только стены гипсокартона и размеры плана (design D7)
  if (reconWorkspace) {
    const stored = storedReconstruction(s, reconWorkspace, current())
    return { walls: stored.walls, dimensions: stored.dimensions }
  }
  if (!workspace) return s
  const stored = storedContent(s, workspace, current())
  // данные помещений — часть шага истории «Монтажа»: снимок берётся до операции, записи ещё не пересмотрены (design D2)
  return { walls: stored.walls, dimensions: stored.dimensions, ...(stored.doorways ? { doorways: stored.doorways } : null), ...(stored.batteries ? { batteries: stored.batteries } : null), rooms: current().rooms ?? [] }
}

// помещения экспликации плана «Монтаж» (change add-room-explication): данные привязаны к помещениям, вычисленным по стенам сцены
let selectedRoom: number | null = null
const ROOM_NAME_GAP_PX = 6
const roomItems = () => (workspace ? reconcileRooms(findRooms(walls), current().rooms ?? []) : [])

// записи помещений пересматриваются при фиксации действия, не во время жеста (spec room-explication «Привязка данных к помещению»)
function commitRooms(drawing: Drawing): void {
  if (gestureActive()) return
  const records = reconcileRooms(findRooms(walls), drawing.rooms ?? []).map((i) => i.record)
  if (records.length === 0 && drawing.rooms === undefined) return
  drawing.rooms = records
}

// состояние редактирования выделенного помещения: поля на холсте — название над блоком, высота поверх правой ячейки блока
// (spec room-explication «Выделение и редактирование блока»); следуют за блоком при сдвиге и масштабе вида
function syncRoomEditor(): void {
  if (selectedRoom === null) return
  const item = roomItems().find((i) => i.record.number === selectedRoom)
  if (!item) {
    deselectRoom()
    return
  }
  const k = PX_PER_CM * view.zoom
  const c = { x: (item.room.labelAt.x - view.pan.x) * k, y: (item.room.labelAt.y - view.pan.y) * k }
  const l = roomBlockLayout(c, String(item.record.number), formatRoomHeight(item.record.heightMm), SCREEN_METRICS.labelPx)
  roomEditor.hidden = false
  roomNameInput.style.left = `${c.x}px`
  roomNameInput.style.top = `${l.y - ROOM_NAME_GAP_PX}px`
  roomHeightInput.style.left = `${l.heightAt.x}px`
  roomHeightInput.style.top = `${l.heightAt.y}px`
  roomHeightInput.style.width = `${l.x + l.w - l.dividerX}px`
  if (document.activeElement !== roomNameInput) roomNameInput.value = item.record.name
  if (document.activeElement !== roomHeightInput) roomHeightInput.value = String(item.record.heightMm)
}

function selectRoom(number: number): void {
  closeNumberEditor()
  selectedBatteries = []
  selectedCommunication = null
  selectedWalls = []
  selectedDimensions = []
  selectedDoorways = []
  lengthDirty = false
  setWallPanel(false)
  selectedRoom = number
  redraw()
}

function deselectRoom(): void {
  if (selectedRoom === null) return
  selectedRoom = null
  roomEditor.hidden = true
}

// правка названия или высоты выделенного помещения — один шаг истории; ничего не изменившая правка шага не создаёт
function editRoom(patch: Partial<Pick<RoomRecord, "name" | "heightMm">>): void {
  const records = roomItems().map((i) => i.record)
  const target = records.find((r) => r.number === selectedRoom)
  if (!target) return
  if ((patch.name ?? target.name) === target.name && (patch.heightMm ?? target.heightMm) === target.heightMm) return
  pushRecord()
  current().rooms = records.map((r) => (r === target ? { ...r, ...patch } : r))
  dirty = true
  redraw()
}

roomNameInput.addEventListener("change", () => editRoom({ name: roomNameInput.value.trim() }))
roomHeightInput.addEventListener("change", () => {
  const heightMm = parseRoomHeight(roomHeightInput.value)
  if (heightMm !== null) editRoom({ heightMm })
  else {
    // недопустимая высота не применяется: поле возвращает прежнее значение
    const item = roomItems().find((i) => i.record.number === selectedRoom)
    if (item) roomHeightInput.value = String(item.record.heightMm)
  }
})
for (const input of [roomNameInput, roomHeightInput]) {
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") input.blur()
  })
}

const pushRecord = (): void => {
  nudgeBurst = false
  itemTool.endBurst()
  // на плане «Мебель» шаг истории хранит столы и размеры плана (change furniture-plan-table, design D7)
  if (furnitureWorkspace) recordFurniture(activeHistory(), { items, dimensions })
  // на плане «Сантехника» — размеры плана (change add-plumbing-plan, design D6)
  else if (plumbingWorkspace) recordPlumbing(activeHistory(), dimensions)
  else record(activeHistory(), historyOf(scene()))
}

// список проёмов заменяется целиком: правки проёма возвращают новый объект
function setDoorways(next: WallElement[]): void {
  doorways = next
  if (!workspace && !reconWorkspace && !furnitureWorkspace && !plumbingWorkspace) current().doorways = next
  selectedDoorways = selectedDoorways.filter((d) => next.includes(d))
}

// список батарей заменяется целиком: правки батареи возвращают новый объект; пометки сноса остаются в чертеже и скрыты, пока
// батареи нет (отмена удаления возвращает и пометку)
function setBatteries(next: Battery[]): void {
  batteries = next
  if (!workspace && !reconWorkspace && !furnitureWorkspace && !plumbingWorkspace) current().batteries = next
  selectedBatteries = selectedBatteries.filter((b) => next.includes(b))
}

// список размеров заменяется целиком; размеры плана «Монтаж» пишутся в чертёж при фиксации (commitMounting)
function setDimensions(next: Dimension[]): void {
  // размеры планов «Реконструкция», «Мебель» и «Сантехника» пишутся в чертёж при фиксации (commitReconstruction, commitFurniture,
  // commitPlumbing)
  if (reconWorkspace || furnitureWorkspace || plumbingWorkspace) {
    dimensions = next
    return
  }
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
  roughCache = null
  reconCache = null
  reconWorkspace = null
  furnitureCache = null
  furnitureWorkspace = null
  items = []
  furnitureObstacles = []
  furnitureBodies = []
  plumbingCache = null
  plumbingWorkspace = null
  fixtures = []
  ceilingCache = null
  ceilingItems = []
  obstacles = []
  if (activePlanOf(d) === "ceiling") {
    // подложка и мебель «Мебели» только для чтения: инструменты плана правят потолки, освещение, метки линий, выключатели и
    // вытяжки (design D4; слит с планом «Группы включения», change merge-lighting-plans)
    const s = ceilingNow()
    const opened = openCeiling(d, s)
    walls = opened.scene.walls
    ceilingItems = opened.scene.items
    dimensions = []
    doorways = s.base.base.doorways
    batteries = s.base.base.batteries
    workspace = null
    remnantHome = new Map()
    return
  }
  if (activePlanOf(d) === "plumbing") {
    // подложка — та же, что у «Мебели», приборы — из «Мебели»; всё только для чтения, правятся размеры плана (design D3)
    const s = plumbingNow()
    const opened = openPlumbing(d, s)
    walls = opened.scene.walls
    dimensions = opened.scene.dimensions
    fixtures = opened.scene.items
    doorways = s.base.base.doorways
    batteries = s.base.base.batteries
    workspace = null
    plumbingWorkspace = opened.workspace
    remnantHome = new Map(walls.map((w) => [w.id, { a: { ...w.a }, b: { ...w.b } }]))
    return
  }
  if (activePlanOf(d) === "furniture") {
    // подложка — результат «Реконструкции», целиком только для чтения; правятся столы и собственные размеры плана
    const s = furnitureNow()
    const opened = openFurniture(d, s)
    walls = opened.scene.walls
    dimensions = opened.scene.dimensions
    items = opened.scene.items
    doorways = s.base.base.doorways
    batteries = s.base.base.batteries
    workspace = null
    furnitureWorkspace = opened.workspace
    remnantHome = new Map(walls.map((w) => [w.id, { a: { ...w.a }, b: { ...w.b } }]))
    furnitureObstacles = obstaclesOf({ walls: s.base.underlay, drywall: s.base.own, plaster: opened.obstacles, elements: doorways, batteries, communications: communicationsOf() })
    furnitureBodies = furnitureReachBodies(s.base)
    return
  }
  if (activePlanOf(d) === "reconstruction") {
    // подложка — результат «Черновых работ» без стяжки, только для чтения; стены гипсокартона правятся как стены
    const opened = openReconstruction(d)
    const isObstacle = (w: Wall): boolean => w.id.startsWith(PLASTER_OBSTACLE_PREFIX)
    const base = reconNow().base
    obstacles = opened.scene.walls.filter(isObstacle)
    walls = opened.scene.walls.filter((w) => !isObstacle(w))
    dimensions = opened.scene.dimensions
    doorways = base.doorways
    batteries = base.batteries
    workspace = null
    reconWorkspace = opened.workspace
    remnantHome = new Map(walls.filter((w) => opened.workspace.readOnlyIds.has(w.id)).map((w) => [w.id, { a: { ...w.a }, b: { ...w.b } }]))
    return
  }
  if (activePlanOf(d) === "rough") {
    // подложка «Черновых работ» — результат «Монтажа», только для чтения: инструменты плана правят свои списки, а не стены
    const base = roughNow().base
    walls = base.walls
    dimensions = []
    doorways = base.doorways
    batteries = base.batteries
    workspace = null
    remnantHome = new Map()
    return
  }
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
  commitRooms(drawing)
  const next = storedContent(scene(), workspace, drawing)
  if (next.walls.length === 0 && next.dimensions.length === 0 && next.doorways === undefined && next.batteries === undefined && drawing.mounting === undefined) return
  drawing.mounting = next
}

// запись стен гипсокартона и размеров плана «Реконструкция» в чертёж; пока их нет и поля не было, оно не создаётся
function commitReconstruction(): void {
  const drawing = store.drawings.find((d) => d.id === store.activeId)
  if (!reconWorkspace || !drawing) return // вкладка уже закрыта — писать некуда
  const next = storedReconstruction({ walls, dimensions }, reconWorkspace, drawing)
  if (next.walls.length === 0 && next.dimensions.length === 0 && drawing.reconstruction === undefined) return
  drawing.reconstruction = next
}

// запись столов и размеров плана «Мебель» в чертёж; пока их нет и поля не было, оно не создаётся
function commitFurniture(): void {
  const drawing = store.drawings.find((d) => d.id === store.activeId)
  if (!furnitureWorkspace || !drawing) return // вкладка уже закрыта — писать некуда
  const next = storedFurniture(items, dimensions, furnitureWorkspace, drawing)
  if (next.items.length === 0 && next.dimensions.length === 0 && drawing.furniture === undefined) return
  drawing.furniture = next
}

// запись размеров плана «Сантехника» в чертёж; пока их нет и поля не было, оно не создаётся (change add-plumbing-plan, design D5)
function commitPlumbing(): void {
  const drawing = store.drawings.find((d) => d.id === store.activeId)
  if (!plumbingWorkspace || !drawing) return // вкладка уже закрыта — писать некуда
  const next = storedPlumbing(dimensions, plumbingWorkspace, drawing)
  if (next.dimensions.length === 0 && drawing.plumbing === undefined) return
  drawing.plumbing = next
}

const commitWorking = (): void => {
  commitMounting()
  commitReconstruction()
  commitFurniture()
  commitPlumbing()
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

const editableWall = (w: Wall): boolean => !workspace?.remnantIds.has(w.id) && !reconWorkspace?.readOnlyIds.has(w.id) && !furnitureWorkspace?.readOnlyIds.has(w.id) && !plumbingWorkspace?.readOnlyIds.has(w.id)
// на планах «Реконструкция», «Мебель» и «Сантехника» элементы и батареи — подложка, их правят на своих планах
const editableElement = (e: WallElement): boolean => reconWorkspace === null && furnitureWorkspace === null && plumbingWorkspace === null && !workspace?.oldElementIds.has(e.id)
const editableBattery = (b: Battery): boolean => reconWorkspace === null && furnitureWorkspace === null && plumbingWorkspace === null && !workspace?.oldBatteryIds.has(b.id)

// стены, которые видят привязка и ограничения правки: стены плана и полосы штукатурки подложки (design D3)
const solid = (): Wall[] => (obstacles.length ? [...walls, ...obstacles] : walls)

// «Гипсокартон» рисуется теми же жестами, что «Стена» (spec reconstruction-plan «Рисование стен гипсокартона»); толщина — из своей панели
const isWallTool = (): boolean => tool === "wall" || tool === "drywall"
const newWallThickness = (): number => (tool === "drywall" ? drywallParams.thicknessCm : thicknessCm)

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
  centerRadiusCm: () => centerSnapRadiusCm(view.zoom),
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

// план «Черновые работы» (change add-rough-works-plan, design D8): штукатурка и стяжки лежат в чертеже; сцена (подложка,
// куски штукатурки, действующие стяжки, помещения) вычисляется и держится в кэше до изменения данных или смены плана
const onRough = (): boolean => activePlanOf(current()) === "rough"
const onReconstruction = (): boolean => activePlanOf(current()) === "reconstruction"
const reconNow = (): ReconstructionScene => (reconCache ??= reconstructionScene(current()))
const onFurniture = (): boolean => activePlanOf(current()) === "furniture"
const furnitureNow = (): FurnitureScene => (furnitureCache ??= furnitureScene(current()))
const onPlumbing = (): boolean => activePlanOf(current()) === "plumbing"
const plumbingNow = (): PlumbingScene => (plumbingCache ??= plumbingScene(current()))
const NO_PLASTER: PlasterMark[] = []
const NO_SCREEDS: Screed[] = []
const NO_ANGLES: RightAngleMark[] = []
let roughCache: RoughScene | null = null
const roughNow = (): RoughScene => (roughCache ??= roughScene(current()))
const plasterOf = (): PlasterMark[] => current().roughPlaster ?? NO_PLASTER
const screedsOf = (): Screed[] => current().roughScreeds ?? NO_SCREEDS
const anglesOf = (): RightAngleMark[] => current().roughAngles ?? NO_ANGLES
// толщины для новых объектов: запоминаются в сеансе, в чертёж не входят
let plasterThicknessMm: number = PLASTER_THICKNESS.default
let screedThicknessMm: number = SCREED_THICKNESS.default
let plasterPanelOpen = false
let screedPanelOpen = false

const recordRoughStep = (): void => {
  nudgeBurst = false
  recordRough(activeHistory(), { plaster: plasterOf(), screeds: screedsOf(), angles: anglesOf() })
}

const plasterHost: PlasterToolHost = {
  drawing: () => current(),
  scene: roughNow,
  marks: plasterOf,
  setMarks: (next) => {
    current().roughPlaster = next
    roughCache = null
  },
  record: recordRoughStep,
  changed: () => {
    dirty = true
  },
  redraw: () => redraw(),
  radiusCm: () => radiusCm(),
  newId: () => crypto.randomUUID(),
  newThicknessMm: () => plasterThicknessMm,
}
const plasterTool = createPlasterTool(plasterHost)

const screedHost: ScreedToolHost = {
  scene: roughNow,
  screeds: screedsOf,
  setScreeds: (next) => {
    current().roughScreeds = next
    roughCache = null
  },
  record: recordRoughStep,
  changed: () => {
    dirty = true
  },
  redraw: () => redraw(),
  newId: () => crypto.randomUUID(),
  newThicknessMm: () => screedThicknessMm,
  view: () => view,
  labelPx: SCREEN_METRICS.labelPx,
}
const screedTool = createScreedTool(screedHost)

const rightAngleHost: RightAngleToolHost = {
  scene: roughNow,
  marks: anglesOf,
  setMarks: (next) => {
    current().roughAngles = next
    roughCache = null
  },
  record: recordRoughStep,
  changed: () => {
    dirty = true
  },
  redraw: () => redraw(),
  radiusCm: () => radiusCm(),
  armCm: () => rightAngleArmPx(SCREEN_METRICS) / (PX_PER_CM * view.zoom),
  newId: () => crypto.randomUUID(),
}
const rightAngleTool = createRightAngleTool(rightAngleHost)

let roughEditor: NumberEditor | null = null

const closeRoughEditor = (): void => {
  roughEditor?.close()
  roughEditor = null
}

// панели «Штукатурка» и «Стяжка»: значение выделенного объекта, иначе значение для новых; открыта панель — по кнопке
// инструмента или выбором объекта
function syncRoughPanels(): void {
  plasterPanel.classList.toggle("open", plasterPanelOpen)
  screedPanel.classList.toggle("open", screedPanelOpen)
  toolPlasterBtn.classList.toggle("active", tool === "plaster")
  toolRightAngleBtn.classList.toggle("active", tool === "rightAngle")
  toolScreedBtn.classList.toggle("active", tool === "screed")
  if (document.activeElement !== plasterThicknessInput) plasterThicknessInput.value = String(plasterTool.selectedMark()?.thicknessMm ?? plasterThicknessMm)
  if (document.activeElement !== screedThicknessInput) screedThicknessInput.value = String(screedTool.selected()?.thicknessMm ?? screedThicknessMm)
}

const closeRoughPanels = (): void => {
  plasterPanelOpen = false
  screedPanelOpen = false
  syncRoughPanels()
}

// инструмент «Штукатурка» снят протяжкой и должен вернуться, когда выделение пометки будет снято (change plaster-partial-drag)
let resumePlaster = false

// вернуть инструмент «Штукатурка», если он снят протяжкой и выделение пометки уже снято
function resumePlasterTool(): void {
  if (!resumesAfterSelectionCleared(resumePlaster, plasterTool.selectedId() !== null)) return
  resumePlaster = false
  setTool("plaster")
}

// снять инструмент «Штукатурка» после протяжки: пометка остаётся выделенной, панель открыта с её толщиной
// (setTool выделение снимает)
function leavePlasterTool(): void {
  resumePlaster = true
  tool = "none"
  plasterPanelOpen = true
  screedPanelOpen = false
  syncToolUI()
  redraw()
}

// сброс жеста, выделения, поля ввода и панелей плана «Черновые работы» (смена плана, чертежа и инструмента, отмена и повтор)
const resetRough = (): void => {
  resumePlaster = false
  plasterTool.cancel()
  plasterTool.clearSelection()
  screedTool.clearSelection()
  rightAngleTool.cancel()
  rightAngleTool.clearSelection()
  closeRoughEditor()
  closeRoughPanels()
}

// снять выделение штукатурки, стяжки и прямого угла (Escape, клик мимо, Delete)
function clearRoughSelection(): void {
  closeRoughEditor()
  plasterTool.clearSelection()
  screedTool.clearSelection()
  rightAngleTool.clearSelection()
  closeRoughPanels()
}

// нажатие на подпись стяжки выделяет её и открывает на месте поле толщины; Enter применяет значение из допустимых
function pressScreedLabel(p: Point): boolean {
  const screed = screedTool.labelAt(p)
  if (!screed) return false
  closeRoughEditor()
  plasterTool.clearSelection()
  rightAngleTool.clearSelection()
  screedTool.select(p)
  screedPanelOpen = true
  plasterPanelOpen = false
  const k = PX_PER_CM * view.zoom
  const at = { x: (screed.at.x - view.pan.x) * k, y: (screed.at.y - view.pan.y) * k + SCREEN_METRICS.labelPx }
  roughEditor = openNumberEditor(
    canvasWrap,
    at,
    String(screed.thicknessMm),
    (text) => {
      const mm = parseThickness(text, SCREED_THICKNESS)
      if (mm !== null) screedTool.setThicknessOf(screed.id, mm)
      redraw()
    },
    () => {
      roughEditor = null
    },
  )
  redraw()
  return true
}

// выделение на плане «Черновые работы» без инструмента: подпись стяжки, число размера (выделение остаётся), пометка штукатурки, иначе снятие
function pressRough(p: Point): void {
  if (pressScreedLabel(p)) return
  // клик по числу размера выделенной пометки штукатурки ничего не меняет: число не правится, выделение остаётся
  const k = PX_PER_CM * view.zoom
  if (plasterTool.dimensionAt(p, unit, k, SCREEN_METRICS.labelPx, NUMBER_HIT_PX / k)) return
  closeRoughEditor()
  // знак прямого угла лежит над полосой штукатурки: его нажатие главнее; у пометки нет параметров, панели нет
  if (rightAngleTool.select(p)) {
    plasterTool.clearSelection()
    screedTool.clearSelection()
    closeRoughPanels()
    return
  }
  if (plasterTool.select(p)) {
    screedTool.clearSelection()
    rightAngleTool.clearSelection()
    plasterPanelOpen = true
    screedPanelOpen = false
    syncRoughPanels()
    return
  }
  clearRoughSelection()
}

// план «Потолки и освещение» (change add-ceiling-plan, design D4, D5): потолки лежат в чертеже, подложка и мебель «Мебели» — только
// для чтения; сцена держится в кэше до изменения данных или смены плана
const onCeiling = (): boolean => activePlanOf(current()) === "ceiling"
let ceilingCache: CeilingScene | null = null
const ceilingNow = (): CeilingScene => (ceilingCache ??= ceilingScene(current()))
const NO_CEILINGS: StretchCeiling[] = []
const ceilingsOf = (): StretchCeiling[] => current().ceiling?.ceilings ?? NO_CEILINGS
// мебель «Мебели» для «Линейки»: замер до предметов, как на «Мебели»
let ceilingItems: readonly FurnitureItem[] = []
// опускание для новых потолков: запоминается в сеансе, в чертёж не входит
let ceilingDropMm = CEILING_DROP_DEFAULT
let ceilingPanelOpen = false
let ceilingEditor: { editor: NumberEditor; id: string } | null = null

// объекты освещения (change add-ceiling-lighting, design D5–D7) лежат рядом с потолками; шаг истории плана — снимок обоих списков
const NO_LIGHTS: LightFixture[] = []
const lightsOf = (): LightFixture[] => current().ceiling?.lights ?? NO_LIGHTS
const recordCeilingStep = (): void => {
  nudgeBurst = false
  recordCeilingPlan(activeHistory(), { ceilings: ceilingsOf(), lights: lightsOf() })
}
// чистовые грани подложки для расстояний освещения: считаются один раз на сцену
let lightBodiesCache: { scene: CeilingScene; bodies: Shape[] } | null = null
function lightBodies(): Shape[] {
  const s = ceilingNow()
  if (lightBodiesCache?.scene !== s) lightBodiesCache = { scene: s, bodies: furnitureReachBodies(s.base) }
  return lightBodiesCache.bodies
}
// вид для новых объектов и панель группы «Освещение»: запоминаются в сеансе
let lightCurrent: LightKind = LIGHT_GROUP_DEFAULT
let lightPanelOpen = false
let lightEditor: NumberEditor | null = null

const ceilingHost: CeilingToolHost = {
  scene: ceilingNow,
  ceilings: ceilingsOf,
  setCeilings: (next) => {
    current().ceiling = storedCeiling(next, current())
    ceilingCache = null
  },
  record: recordCeilingStep,
  changed: () => {
    dirty = true
  },
  redraw: () => redraw(),
  newId: () => crypto.randomUUID(),
  newDropMm: () => ceilingDropMm,
  view: () => view,
  labelPx: SCREEN_METRICS.labelPx,
}
const ceilingTool = createCeilingTool(ceilingHost)

const lightHost: LightToolHost = {
  bodies: lightBodies,
  lights: lightsOf,
  setLights: (next) => {
    current().ceiling = storedCeiling(ceilingsOf(), current(), next)
  },
  record: recordCeilingStep,
  changed: () => {
    dirty = true
  },
  redraw: () => redraw(),
  newId: () => crypto.randomUUID(),
  kind: () => lightCurrent,
  view: () => view,
  unit: () => unit,
  metrics: SCREEN_METRICS,
}
const lightTool = createLightTool(lightHost)

// метки линий освещения плана «Группы включения» (change add-light-lines, design D4): номер для новых меток хранится в сеансе,
// шаг истории — снимок списка меток до операции
const NO_LINES: LightLine[] = []
const linesOf = (): LightLine[] => current().switching?.lines ?? NO_LINES
let lineNumberCurrent = 1
let linePanelOpen = false
let lineEditor: { editor: NumberEditor; id: string } | null = null

const lineHost: LightLineToolHost = {
  lines: linesOf,
  setLines: (next) => {
    const stored = storedLines(current().switching, next)
    if (stored) current().switching = stored
    else delete current().switching
  },
  lights: lightsOf,
  exhausts: () => exhaustsOf(),
  record: () => {
    nudgeBurst = false
    recordSwitchingLines(activeHistory(), linesOf())
  },
  changed: () => {
    dirty = true
  },
  redraw: () => redraw(),
  newId: () => crypto.randomUUID(),
  newName: () => lineLabel(lineNumberCurrent),
  view: () => view,
  unitsPerMm: SCREEN_METRICS.symbolMmPx,
}
const lineTool = createLightLineTool(lineHost)

// панель «Линия освещения»: номер выделенной метки, иначе значение для новых
function syncLinePanel(): void {
  lightLinePanel.classList.toggle("open", linePanelOpen)
  toolLightLineBtn.classList.toggle("active", tool === "lightLine")
  const selected = lineTool.selected()
  if (document.activeElement !== lightLineInput) lightLineInput.value = String(selected ? lineNumber(selected.name) : lineNumberCurrent)
}

const closeLineEditor = (): void => {
  lineEditor?.editor.close()
  lineEditor = null
}

// поле на месте применяет допустимое значение при смене плана и вкладки; недопустимое не применяется
function commitLineEditor(): void {
  if (!lineEditor) return
  const { editor, id } = lineEditor
  const name = parseLineName(editor.text(), prefixOfName(lineOf(id)?.name ?? ""))
  closeLineEditor()
  if (name !== null) lineTool.setNameOf(id, name)
}

const lineOf = (id: string): LightLine | undefined => linesOf().find((l) => l.id === id)

// сброс поля на месте, выделения и панели (смена плана, чертежа и инструмента, отмена и повтор)
const resetLines = (): void => {
  closeLineEditor()
  lineTool.clearSelection()
  linePanelOpen = false
  syncLinePanel()
}

// поле правки имени на месте текста метки (экранные координаты — по рамке текста)
function openLineEditor(line: LightLine): void {
  closeLineEditor()
  const light = visibleLines([line], lightsOf(), exhaustsOf())[0]?.light
  if (!light) return
  const k = PX_PER_CM * view.zoom
  const box = lineLabelBox({ x: (light.x - view.pan.x) * k, y: (light.y - view.pan.y) * k }, line.name, SCREEN_METRICS.symbolMmPx)
  const editor = openNumberEditor(
    canvasWrap,
    { x: box.x + box.w / 2, y: box.y + box.h / 2 },
    line.name,
    (text) => {
      const name = parseLineName(text, prefixOfName(line.name))
      if (name !== null) lineTool.setNameOf(line.id, name)
      redraw()
    },
    () => {
      if (lineEditor?.editor === editor) lineEditor = null
    },
  )
  lineEditor = { editor, id: line.id }
}

// без инструмента: нажатие на текст метки выделяет её и открывает панель; нажатие на выделенную открывает поле на месте;
// иначе выделение снимается (светильники и мебель не выделяются)
function pressLines(p: Point): void {
  const hit = lineTool.labelAt(p)
  if (!hit) {
    resetLines()
    redraw()
    return
  }
  const wasSelected = lineTool.selectedId() === hit.id
  closeLineEditor()
  lineTool.select(p)
  linePanelOpen = true
  if (wasSelected) openLineEditor(hit)
  redraw()
}

// выключатели плана «Группы включения» (change add-light-switch, design D5): число клавиш для новых выключателей хранится в сеансе,
// шаг истории — снимок списка выключателей до операции; грани и проёмы считаются один раз на сцену
const NO_SWITCHES: LightSwitch[] = []
const switchesOf = (): LightSwitch[] => current().switching?.switches ?? NO_SWITCHES
let switchKeysCurrent = 1
let switchPanelOpen = false
let switchEditor: { editor: NumberEditor; id: string; index: number } | null = null
// нажатие на кружок или подпись выделенного выключателя: поле на месте откроется при отпускании без сдвига
let switchPressEdit: { id: string; index: number } | null = null
let switchGeometryCache: { scene: CeilingScene; bodies: Shape[]; openings: Shape[] } | null = null
function switchGeometry(): { bodies: Shape[]; openings: Shape[] } {
  const s = ceilingNow()
  if (switchGeometryCache?.scene !== s) switchGeometryCache = { scene: s, bodies: furnitureReachBodies(s.base), openings: openingBodies(s.base.underlay, s.base.base.doorways) }
  return switchGeometryCache
}

const switchHost: SwitchToolHost = {
  bodies: () => switchGeometry().bodies,
  openings: () => switchGeometry().openings,
  switches: switchesOf,
  setSwitches: (next) => {
    const stored = storedSwitches(current().switching, next)
    if (stored) current().switching = stored
    else delete current().switching
  },
  record: () => {
    nudgeBurst = false
    recordSwitches(activeHistory(), switchesOf())
  },
  changed: () => {
    dirty = true
  },
  redraw: () => redraw(),
  newId: () => crypto.randomUUID(),
  keyCount: () => switchKeysCurrent,
  view: () => view,
  unitsPerMm: SCREEN_METRICS.symbolMmPx,
}
const switchTool = createSwitchTool(switchHost)

// панель «Выключатель»: число клавиш выделенного выключателя, иначе значение для новых
function syncSwitchPanel(): void {
  lightSwitchPanel.classList.toggle("open", switchPanelOpen)
  toolLightSwitchBtn.classList.toggle("active", tool === "lightSwitch")
  const selected = switchTool.selected()
  if (document.activeElement !== lightSwitchInput) lightSwitchInput.value = String(selected ? selected.keys.length : switchKeysCurrent)
}

const closeSwitchEditor = (): void => {
  switchEditor?.editor.close()
  switchEditor = null
}

// сброс поля на месте, выделения и панели (смена плана, чертежа и инструмента, отмена и повтор)
const resetSwitches = (): void => {
  closeSwitchEditor()
  switchPressEdit = null
  switchTool.clearSelection()
  switchPanelOpen = false
  syncSwitchPanel()
}

// поле правки списка линий клавиши на месте её подписи; Enter, Escape и потеря фокуса применяют допустимое значение, недопустимое
// не применяется (spec light-switch «Выделение, перемещение, правка линий и удаление выключателя»)
function openSwitchEditor(sw: LightSwitch, index: number): void {
  closeSwitchEditor()
  const k = PX_PER_CM * view.zoom
  const at = keyGeometry(sw, index, { x: (sw.at.x - view.pan.x) * k, y: (sw.at.y - view.pan.y) * k }, SCREEN_METRICS.symbolMmPx).label
  const apply = (text: string): void => {
    const lines = parseKeyLines(text)
    if (lines !== null) switchTool.setKeyLines(sw.id, index, lines)
  }
  const editor = openNumberEditor(canvasWrap, at, keyLabel(sw.keys[index]?.lines ?? []), apply, () => {
    if (switchEditor?.editor !== editor) return
    switchEditor = null
    apply(editor.text())
    redraw()
  })
  switchEditor = { editor, id: sw.id, index }
}

// без инструмента: нажатие на знак выключателя выделяет его и открывает панель; нажатие на кружок или подпись выделенного
// открывает поле на месте (при отпускании без сдвига); иначе выделение снимается. Приоритет: метка линии главнее выключателя
function pressSwitches(p: Point, e: PointerEvent): boolean {
  closeSwitchEditor()
  const hit = lineTool.labelAt(p) ? null : switchTool.press(p)
  if (!hit) {
    resetSwitches()
    return false
  }
  resetLines()
  switchPanelOpen = true
  if (hit.wasSelected && (hit.hit.part === "circle" || hit.hit.part === "label")) switchPressEdit = { id: hit.switch.id, index: hit.hit.keyIndex }
  if (switchTool.beginDrag(p)) canvas.setPointerCapture(e.pointerId)
  syncSwitchPanel()
  redraw()
  return true
}

// отпускание после нажатия на выключатель: перенос завершается шагом истории, нажатие без сдвига на кружок или подпись открывает поле
function releaseSwitch(): void {
  if (!switchTool.dragging()) return
  const edit = switchPressEdit
  switchPressEdit = null
  const moved = switchTool.endDrag()
  const sw = edit && !moved ? switchesOf().find((s) => s.id === edit.id) : undefined
  if (edit && sw) openSwitchEditor(sw, edit.index)
  syncSwitchPanel()
}

// вытяжки плана «Группы включения» (change add-exhaust-fan, design D3): шаг истории — снимок вытяжек и меток линий до операции
// (удаление вытяжки забирает её метку одним шагом)
const NO_EXHAUSTS: ExhaustFan[] = []
const exhaustsOf = (): ExhaustFan[] => current().switching?.exhausts ?? NO_EXHAUSTS

const exhaustHost: ExhaustToolHost = {
  bodies: () => switchGeometry().bodies,
  state: () => ({ exhausts: exhaustsOf(), lines: linesOf() }),
  setState: (next) => {
    const stored = storedExhausts(current().switching, next.exhausts, next.lines)
    if (stored) current().switching = stored
    else delete current().switching
  },
  record: () => {
    nudgeBurst = false
    recordExhausts(activeHistory(), { exhausts: exhaustsOf(), lines: linesOf() })
  },
  changed: () => {
    dirty = true
  },
  redraw: () => redraw(),
  newId: () => crypto.randomUUID(),
  view: () => view,
}
const exhaustTool = createExhaustTool(exhaustHost)

const resetExhausts = (): void => {
  exhaustTool.clearSelection()
}

// без инструмента: нажатие на знак вытяжки выделяет её и начинает перетаскивание (панели у вытяжки нет); выноска, метка линии
// и выключатель главнее вытяжки (их нажатия разбираются раньше)
function pressExhausts(p: Point, e: PointerEvent): boolean {
  const hit = lineTool.labelAt(p) ? null : exhaustTool.press(p)
  if (!hit) {
    resetExhausts()
    return false
  }
  resetLines()
  resetSwitches()
  if (exhaustTool.beginDrag(p)) canvas.setPointerCapture(e.pointerId)
  redraw()
  return true
}

const lightGroupState = (): LightGroupState => ({ current: lightCurrent, active: tool === "light" ? lightCurrent : "other", panelOpen: lightPanelOpen })

function applyLightGroup(next: LightGroupState): void {
  if (next.active !== "other" && tool !== "light") setTool("light")
  lightCurrent = next.current
  lightPanelOpen = next.panelOpen
  syncLightUI()
  redraw()
}

function syncLightUI(): void {
  const s = lightGroupState()
  lightPanel.classList.toggle("open", s.panelOpen)
  toolLightBtn.classList.toggle("active", lightGroupActive(s))
  for (const [kind, button] of lightKindButtons) button.classList.toggle("active", kind === s.current)
}

function closeLightPanel(): void {
  lightPanelOpen = false
  syncLightUI()
}

const closeLightEditor = (): void => {
  lightEditor?.close()
  lightEditor = null
}

// поле на месте числа выделенного объекта освещения: Enter применяет (одним шагом, если объект сдвинулся), как у чисел мебели
function openLightEditor(n: LightNumber): void {
  closeEditors()
  const k = PX_PER_CM * view.zoom
  const at = { x: (n.center.x - view.pan.x) * k, y: (n.center.y - view.pan.y) * k }
  lightEditor = openNumberEditor(
    canvasWrap,
    at,
    formatCm(n.valueCm, unit),
    (text) => {
      lightTool.setDistance(n.lightId, n.axis, parseFloat(text.replace(",", ".")) * UNIT_TO_CM[unit])
      redraw()
    },
    () => {
      lightEditor = null
    },
  )
}

// панель «Натяжной потолок»: опускание выделенного потолка, иначе значение для новых
function syncCeilingPanel(): void {
  ceilingPanel.classList.toggle("open", ceilingPanelOpen)
  toolStretchCeilingBtn.classList.toggle("active", tool === "stretchCeiling")
  if (document.activeElement !== ceilingDropInput) ceilingDropInput.value = String(ceilingTool.selected()?.dropMm ?? ceilingDropMm)
}

const closeCeilingEditor = (): void => {
  ceilingEditor?.editor.close()
  ceilingEditor = null
}

// поле на месте применяет набранное значение при смене плана и вкладки (spec drawing-plans «Правка подписи потолка при
// переключении»); недопустимое значение не применяется
function commitCeilingEditor(): void {
  if (!ceilingEditor) return
  const { editor, id } = ceilingEditor
  const mm = parseDropMm(editor.text())
  closeCeilingEditor()
  if (mm !== null) ceilingTool.setDropOf(id, mm)
}

// сброс поля ввода, выделения и панели (смена плана, чертежа и инструмента, отмена и повтор)
const resetCeiling = (): void => {
  closeCeilingEditor()
  closeLightEditor()
  lightTool.clearSelection()
  ceilingTool.clearSelection()
  ceilingPanelOpen = false
  syncCeilingPanel()
}

// без инструмента: нажатие на подпись потолка выделяет его, открывает панель и поле на месте; иначе выделение снимается
// (мебель не выделяется)
function pressCeiling(p: Point): void {
  closeCeilingEditor()
  closeLightEditor()
  lightTool.clearSelection()
  const ceiling = ceilingTool.labelAt(p)
  if (!ceiling) {
    resetCeiling()
    return
  }
  ceilingTool.select(p)
  ceilingPanelOpen = true
  const k = PX_PER_CM * view.zoom
  const at = { x: (ceiling.at.x - view.pan.x) * k, y: (ceiling.at.y - view.pan.y) * k + SCREEN_METRICS.labelPx }
  const editor = openNumberEditor(
    canvasWrap,
    at,
    String(ceiling.dropMm),
    (text) => {
      const mm = parseDropMm(text)
      if (mm !== null) ceilingTool.setDropOf(ceiling.id, mm)
      redraw()
    },
    () => {
      if (ceilingEditor?.editor === editor) ceilingEditor = null
    },
  )
  ceilingEditor = { editor, id: ceiling.id }
  redraw()
}

// примечания активного плана (change add-plan-notes, design D4): панель с полем; правка применяется при потере фокуса,
// закрытии панели, смене инструмента, плана и вкладки, Esc — одним шагом истории плана, если список изменился
let notesPanelOpen = false
const activeNotes = (): string[] => notesOf(current(), activePlanOf(current()))

function syncNotesUI(): void {
  notesPanel.classList.toggle("open", notesPanelOpen)
  toolNotesBtn.classList.toggle("active", tool === "notes")
}

function showNotes(): void {
  notesInput.value = notesText(activeNotes())
}

function commitNotes(): void {
  if (!notesPanelOpen) return
  const before = activeNotes()
  const applied = applyNotesText(before, notesInput.value)
  notesInput.value = notesText(applied.list)
  if (!applied.changed) return
  nudgeBurst = false
  recordNotes(activeHistory(), before)
  Object.assign(current(), withNotes(current(), activePlanOf(current()), applied.list))
  dirty = true
  redraw()
}

function openNotesPanel(): void {
  notesPanelOpen = true
  showNotes()
  syncNotesUI()
}

function closeNotesPanel(): void {
  commitNotes()
  notesPanelOpen = false
  syncNotesUI()
}

// выноски активного плана (change add-callout, design D4, D5, D8): список лежит в чертеже по правилам плана (callout-store);
// выделение, жест и поле ввода ведёт адаптер, а запись истории — один шаг со списком до операции
const calloutHost: CalloutToolHost = {
  callouts: () => calloutsOf(current(), activePlanOf(current())),
  setCallouts: (next) => {
    Object.assign(current(), withCallouts(current(), activePlanOf(current()), next))
  },
  recordBefore: (before) => {
    nudgeBurst = false
    recordCallouts(activeHistory(), before)
  },
  view: () => view,
  radiusCm: () => radiusCm(),
  editorParent: canvasWrap,
  newId: () => crypto.randomUUID(),
  // одно выделение на холсте: выделение выноски снимает выделение остальных объектов
  selected: () => {
    selectionEditing.closeEditor()
    communicationTool.closeEditor()
    batteryTool.closeEditor()
    selectedBatteries = []
    selectedCommunication = null
    selectedWalls = []
    selectedDimensions = []
    selectedDoorways = []
    lengthDirty = false
    demolitionTool.clearSelection()
    plasterTool.clearSelection()
    screedTool.clearSelection()
    rightAngleTool.cancel()
    rightAngleTool.clearSelection()
    itemTool.clearSelection()
    closeRoughEditor()
    closeRoughPanels()
    resetCeiling()
    setWallPanel(false)
  },
  changed: () => {
    dirty = true
  },
  redraw: () => redraw(),
}
const calloutTool = createCalloutTool(calloutHost)

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
// (каждое выделение другого объекта и снятие выделения начинаются с этого вызова, поэтому он же снимает выделение выноски)
const closeEditors = (): void => {
  itemNumberEditor?.close()
  itemNumberEditor = null
  selectionEditing.closeEditor()
  communicationTool.closeEditor()
  batteryTool.closeEditor()
  calloutTool.deselect()
  deselectRoom()
}

// выделение стола — тоже выделение «другого объекта»: любое выделение и снятие выделения снимает его
const closeNumberEditor = (): void => {
  closeEditors()
  itemTool.clearSelection()
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
  itemTool.endBurst()
  if (furnitureWorkspace) recordFurniture(activeHistory(), { items, dimensions: snapshot.dimensions })
  else if (plumbingWorkspace) recordPlumbing(activeHistory(), snapshot.dimensions)
  else recordSnapshot(activeHistory(), historyOf(snapshot))
}

// панель выделенной стены: на плане «Реконструкция» это панель «Гипсокартон», на остальных — панель «Стена»
function setWallPanel(open: boolean): void {
  if (onReconstruction()) {
    drywallPanelOpen = open
    syncDrywallPanel()
    return
  }
  wallPanelOpen = open
  wallPanel.classList.toggle("open", open)
}

// выделенная стена гипсокартона: ровно одна, не подложка
const selectedDrywall = (): DrywallWall | null => {
  const only = selectedWalls.length === 1 ? selectedWalls[0] : null
  return only && isDrywallWall(only) ? only : null
}

// панель «Гипсокартон»: значения выделенной стены, иначе значения для новых; единицы — текущие (spec reconstruction-plan)
function syncDrywallPanel(): void {
  drywallPanel.classList.toggle("open", drywallPanelOpen)
  toolDrywallBtn.classList.toggle("active", tool === "drywall")
  drywallThicknessUnit.textContent = `Толщина, ${UNIT_LABEL[unit]}`
  drywallHeightUnit.textContent = `Высота, ${UNIT_LABEL[unit]}`
  const shown = panelValues(drywallParams, selectedDrywall())
  if (document.activeElement !== drywallThicknessInput) drywallThicknessInput.value = formatCm(shown.thicknessCm, unit)
  if (document.activeElement !== drywallHeightInput) drywallHeightInput.value = formatCm(shown.heightCm, unit)
}

// стена гипсокартона заменяется новым объектом одним шагом истории
function replaceDrywall(prev: DrywallWall, next: DrywallWall): void {
  pushRecord()
  walls[walls.indexOf(prev)] = next
  selectedWalls = selectedWalls.map((w) => (w === prev ? next : w))
  dirty = true
  redraw()
}

// правка поля панели: выделенная стена меняется одним шагом, иначе меняются значения для новых; недопустимое значение не применяется
function applyDrywallField(field: keyof DrywallParams, input: HTMLInputElement): void {
  const cm = parseLengthField(input.value, unit)
  const selected = selectedDrywall()
  if (cm !== null) {
    const edited = editParams(drywallParams, selected, { [field]: cm })
    drywallParams = edited.params
    if (selected && edited.wall) replaceDrywall(selected, edited.wall)
  }
  input.blur()
  syncDrywallPanel()
  refreshWallCursor()
  redraw()
}

// план «Мебель» (change furniture-plan-table, design D6, D7): жесты над столами ведёт itemTool; здесь — состояние чертежа,
// одно выделение на холсте и панель группы «Мебель»
function clearNonItemSelection(): void {
  closeEditors()
  selectedBatteries = []
  selectedCommunication = null
  selectedWalls = []
  selectedDimensions = []
  selectedDoorways = []
  lengthDirty = false
}

const itemHost: ItemToolHost = {
  items: () => items,
  setItems: (next) => {
    items = next
  },
  kind: () => furnitureKind,
  params: () => itemParamsOf(furnitureKind),
  record: (before) => {
    nudgeBurst = false
    recordFurniture(activeHistory(), { items: [...before], dimensions })
  },
  changed: () => {
    dirty = true
  },
  redraw: () => redraw(),
  selected: () => {
    clearNonItemSelection()
    furniturePanelOpen = true
  },
  newId: () => crypto.randomUUID(),
  walls: () => walls,
  pxPerCm: () => PX_PER_CM * view.zoom,
}
const itemTool = createItemTool(itemHost)

// панель группы «Мебель»: значения единственного выделенного стола, иначе значения для новых; единицы — текущие
function syncFurniturePanel(): void {
  furniturePanel.classList.toggle("open", furniturePanelOpen)
  toolFurnitureBtn.classList.toggle("active", tool === "furniture")
  for (const [kind, button] of furnitureKindButtons) button.classList.toggle("active", tool === "furniture" && kind === furnitureKind)
  furnitureWidthUnit.textContent = `Ширина, ${UNIT_LABEL[unit]}`
  furnitureLengthUnit.textContent = `Длина, ${UNIT_LABEL[unit]}`
  const shown = itemPanelValues(itemParamsOf(furnitureKind), itemTool.selectedItem())
  if (document.activeElement !== furnitureWidthInput) furnitureWidthInput.value = formatCm(shown.widthCm, unit)
  if (document.activeElement !== furnitureLengthInput) furnitureLengthInput.value = formatCm(shown.lengthCm, unit)
  if (document.activeElement !== furnitureAngleInput) furnitureAngleInput.value = String(Math.round(shown.angleDeg * 100) / 100)
}

// правка поля панели: единственный выделенный стол меняется одним шагом, иначе меняются значения для новых; недопустимое значение не применяется
function applyItemField(field: keyof ItemParams, input: HTMLInputElement): void {
  const value = field === "angleDeg" ? parseAngleField(input.value) : parseLengthField(input.value, unit)
  if (value !== null) {
    const edited = editItemParams(itemParamsOf(furnitureKind), itemTool.selectedItem(), { [field]: value })
    kindParams = withKindParams(kindParams, furnitureKind, edited.params)
    if (edited.table) itemTool.replaceSelected(edited.table)
  }
  input.blur()
  syncFurniturePanel()
  redraw()
}

const furnitureGroupState = (): GroupState<FurnitureKind> => ({ current: furnitureKind, active: tool === "furniture" ? furnitureKind : "other", panelOpen: furniturePanelOpen })

function applyFurnitureGroup(next: GroupState<FurnitureKind>): void {
  furnitureKind = next.current
  if (next.active !== "other" && tool !== "furniture") setTool("furniture")
  furniturePanelOpen = next.panelOpen
  syncFurniturePanel()
}

// установка стола снимает инструмент, поставленный стол остаётся выделенным, панель остаётся открытой (spec furniture-plan «Постановка стола»)
function leaveItemPlacing(): void {
  tool = "none"
  itemTool.hover(null)
  furniturePanelOpen = true
  syncToolUI()
  redraw()
}

// выделенные столы и размеры удаляются одним шагом истории
function deleteFurnitureSelection(): void {
  if (!itemTool.hasSelection() && selectedDimensions.length === 0) return
  pushRecord()
  const picked = new Set(selectedDimensions)
  setDimensions(dimensions.filter((d) => !picked.has(d)))
  items = items.filter((t) => !itemTool.selectedIds().has(t.id))
  itemTool.clearSelection()
  selectedDimensions = []
  dirty = true
  redraw()
}

// пересечения столов и призрака с препятствиями подложки; не хранятся, считаются по текущему состоянию
function currentOverlaps(): Overlap[] {
  const ghost = tool === "furniture" ? itemTool.ghost() : null
  return [...furnitureOverlaps(items, furnitureObstacles), ...(ghost ? itemOverlaps(ghost, furnitureObstacles, items) : [])]
}

// числа ровно одного выделенного предмета на экране — габариты и расстояния до стен; при активном инструменте их нет
// (change furniture-dimensions, design D4, D5)
function selectedItemNumbers(): { itemId: string; numbers: ItemNumber[] } | null {
  const t = tool === "furniture" ? null : itemTool.selectedItem()
  if (!t) return null
  const k = PX_PER_CM * view.zoom
  return { itemId: t.id, numbers: [...itemSizeLayout(t, unit, k, SCREEN_METRICS), ...itemDistanceLayout(t, furnitureBodies, unit, k, SCREEN_METRICS)] }
}

// нажатие на правимое число выделенного предмета: поле на месте числа; Enter — правка одним шагом истории, как поле панели
function pressFurnitureNumber(p: Point): boolean {
  const t = onFurniture() ? itemTool.selectedItem() : null
  const editable = t ? selectedItemNumbers() : null
  const k = PX_PER_CM * view.zoom
  const n = editable ? numberAt(p, editable.numbers, NUMBER_HIT_PX / k) : null
  if (!t || !n) return false
  closeEditors()
  const at = { x: (n.center.x - view.pan.x) * k, y: (n.center.y - view.pan.y) * k }
  itemNumberEditor = openNumberEditor(
    canvasWrap,
    at,
    formatCm(n.valueCm, unit),
    (text) => {
      const next = applyItemNumber(t, n.field, parseFloat(text.replace(",", ".")) * UNIT_TO_CM[unit], furnitureBodies)
      if (next) itemTool.replaceSelected(next)
      syncFurniturePanel()
      redraw()
    },
    () => {
      itemNumberEditor = null
    },
  )
  return true
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
  // у стены гипсокартона материала нет: панель «Гипсокартон» открывается сама, материал стены новым стенам не передаётся
  if (!onReconstruction()) setWallMaterial(wall.type)
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
  toolExhaustBtn.classList.toggle("active", tool === "exhaust")
  toolRulerBtn.classList.toggle("active", tool === "ruler")
  toolWindowBtn.classList.toggle("active", tool === "window")
  toolBatteryBtn.classList.toggle("active", tool === "battery")
  toolCalloutBtn.classList.toggle("active", tool === "callout")
  syncNotesUI()
  toolDemolitionBtn.classList.toggle("active", tool === "demolition")
  syncRoughPanels()
  syncDrywallPanel()
  syncFurniturePanel()
  syncOpeningsUI()
  syncCommunicationsUI()
  syncLightUI()
  syncToolbar()
  canvas.classList.toggle("tool-eraser", tool === "eraser")
}

function setTool(next: Tool): void {
  if (tool === next) return
  closeNotesPanel()
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
  calloutTool.reset()
  suppressClick = false
  nudgeBurst = false
  groupMove = null
  marquee = null
  marqueeHits = null
  marqueePending = null
  resetDemolition()
  resetRough()
  resetCeiling()
  resetLines()
  resetSwitches()
  resetExhausts()
  itemTool.reset()
  furniturePanelOpen = false
  setWallPanel(false)
  closeOpeningsPanel()
  closeCommunicationsPanel()
  closeLightPanel()
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
  // конец превью — конец сегмента (с учётом привязки), а не точка курсора
  const end = segment?.end ?? cursor
  const start = wallStart()
  if (!start || !end) return null
  if (pointsEqual(start, end)) return null
  // у строящейся стены оси сходятся с соседом (change collinear-axes-meet): длина оси равна длине кромка-кромка
  return Math.hypot(end.x - start.x, end.y - start.y)
}

// начало строящейся стены: у угла торца в параллельном направлении оно смещено от точки первого клика
// (change fix-corner-snap-parallel-start); превью, угол и фиксация берут его отсюда
function wallStart(): Point | null {
  return segment?.start ?? chainStart
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
  const result = resizeWallBounded(solid(), selectedWalls[0], len, { ortho, doorways, communications: communicationsOf(), batteries })
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
  const active = isWallTool() && chainStart !== null && chainRef !== null
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
  } else if (reconWorkspace) {
    restoreRemnants()
    if (dirty) commitReconstruction()
  } else if (furnitureWorkspace) {
    restoreRemnants()
    if (dirty) commitFurniture()
  } else if (plumbingWorkspace) {
    restoreRemnants()
    if (dirty) commitPlumbing()
  }
  frame.request()
  syncRoughPanels()
  syncCeilingPanel()
  syncLinePanel()
  syncSwitchPanel()
  syncDrywallPanel()
  syncFurniturePanel()
  updateLengthBox()
  updateAngleBox()
  syncHistoryButtons()
  syncRoomEditor()
  syncScale()
  if (dirty) {
    dirty = false
    if (!readOnly) saveStore(store)
    if (!readOnly && !historyReadOnly) saveHistory(historyStore)
  }
}

// замер линейки под курсором: стены плана и его объекты — батареи, коммуникации и (на плане «Мебель») мебель (change ruler-objects-span, design D6)
function rulerOf(planWalls: Wall[], planBatteries: readonly Battery[], planItems: readonly FurnitureItem[] = []): RulerReading | null {
  if (tool !== "ruler" || !cursor || gestureActive()) return null
  return rulerReading(cursor, planWalls, rulerObjectsOf({ walls: planWalls, batteries: planBatteries, communications: communicationsOf(), items: planItems }))
}

function drawPlan(): void {
  if (!onFurniture()) furnitureWarning.hidden = true
  if (onFurniture()) drawFurniturePlan()
  else if (onPlumbing()) drawPlumbingPlan()
  else if (onCeiling()) drawCeilingPlan()
  else if (onReconstruction()) drawReconstructionPlan()
  else if (onRough()) drawRoughPlan()
  else if (onDemolition()) drawDemolitionPlan()
  else drawMeasurePlan()
}

// план «Мебель»: подложка «Реконструкции» (только для чтения), столы поверх неё, подсветка пересечений, размеры плана; плашка
// предупреждения показывается, пока есть пересечения (change furniture-plan-table, design D8)
function drawFurniturePlan(): void {
  const s = furnitureNow()
  const palette = paletteOf(theme)
  const erasingCallout = tool === "eraser" && hoverWorld ? calloutTool.pick(hoverWorld) : null
  const target = tool === "eraser" && cursor && !erasingCallout ? eraserTarget(cursor) : { wall: null, dim: null, doorway: null, communication: null, battery: null }
  const erasingItem = tool === "eraser" && hoverWorld && !erasingCallout && !target.dim ? itemTool.eraseTarget(hoverWorld) : null
  const draft = dimDraftGeometry()
  const snapHit = tool === "dimension" && cursor && (!dimDraft.a || !dimDraft.b) ? nearestDimAnchor(cursor, walls, doorways, radiusCm(), []) : null
  const overlaps = currentOverlaps()
  const text = warningText(overlaps)
  furnitureWarning.hidden = text === null
  furnitureWarning.textContent = text ?? ""
  renderFurniture(
    canvas,
    {
      walls: s.base.underlay,
      doorways,
      communications: communicationsOf(),
      batteries,
      pieces: s.base.pieces,
      drywall: s.base.own,
      callouts: calloutTool.displayList(),
      selectedCalloutId: calloutTool.selectedId(),
      erasingCalloutId: erasingCallout?.id ?? null,
      items,
      selectedItemIds: itemTool.selectedIds(),
      erasingItemId: erasingItem?.id ?? null,
      itemGhost: tool === "furniture" ? itemTool.ghost() : null,
      overlaps,
      editable: selectedItemNumbers(),
    },
    unit,
    view,
    {
      palette,
      theme,
      dimensions,
      dimDraft: draft,
      dimRubber: !dimDraft.a || dimDraft.b || !cursor ? null : draftRubber(snapHit?.point ?? cursor),
      dimSnap: snapHit?.point ?? null,
      selectedDims: selectedDimensions,
      hoverDim: target.dim,
      marqueeHits,
      marquee,
      tracks: centerGuideTracks(),
      ruler: rulerOf(walls, batteries, items),
    },
  )
}

// план «Сантехника» (change add-plumbing-plan, design D7): подложка «Мебели», приборы с габаритами только для чтения — без
// подсветки выделения, пересечений и плашки, без правимых чисел; поверх — размеры плана, выноски и жесты «Размера» и «Линейки»
function drawPlumbingPlan(): void {
  const s = plumbingNow()
  const erasingCallout = tool === "eraser" && hoverWorld ? calloutTool.pick(hoverWorld) : null
  const target = tool === "eraser" && cursor && !erasingCallout ? eraserTarget(cursor) : { wall: null, dim: null, doorway: null, communication: null, battery: null }
  const draft = dimDraftGeometry()
  const snapHit = tool === "dimension" && cursor && (!dimDraft.a || !dimDraft.b) ? nearestDimAnchor(cursor, walls, doorways, radiusCm(), [], fixtures) : null
  renderPlumbing(
    canvas,
    {
      walls: s.base.underlay,
      doorways,
      communications: communicationsOf(),
      batteries,
      pieces: s.base.pieces,
      drywall: s.base.own,
      callouts: calloutTool.displayList(),
      selectedCalloutId: calloutTool.selectedId(),
      erasingCalloutId: erasingCallout?.id ?? null,
      items: fixtures,
    },
    unit,
    view,
    {
      palette: paletteOf(theme),
      theme,
      dimensions,
      dimDraft: draft,
      dimRubber: !dimDraft.a || dimDraft.b || !cursor ? null : draftRubber(snapHit?.point ?? cursor),
      dimSnap: snapHit?.point ?? null,
      selectedDims: selectedDimensions,
      hoverDim: target.dim,
      marqueeHits,
      marquee,
      ruler: rulerOf(walls, batteries, fixtures),
    },
  )
}

// план «Потолки и освещение» (change add-ceiling-plan, design D7; слит с планом «Группы включения», change merge-lighting-plans,
// design D3): заливка потолков, подложка «Мебели», мебель серыми линиями, подписи потолков, освещение с расстояниями, вытяжки,
// метки линий, выключатели, выноски; «Линейка» меряет до мебели. Подсветка ластика — по приоритету плана: выноска, метка линии,
// выключатель, вытяжка, объект освещения, потолок (spec ceiling-plan «Ластик на плане «Потолки и освещение»»)
function drawCeilingPlan(): void {
  const s = ceilingNow()
  const erasing = tool === "eraser" && cursor ? cursor : null
  const erasingCallout = erasing ? calloutTool.pick(erasing) : null
  const erasingLine = erasing && !erasingCallout ? lineTool.eraseTarget(erasing) : null
  const hoveredLight = tool === "lightLine" && cursor ? lineTool.hoverTarget(cursor) : null
  const erasingSwitch = erasing && !erasingCallout && !erasingLine ? switchTool.eraseTarget(erasing) : null
  const erasingExhaust = erasing && !erasingCallout && !erasingLine && !erasingSwitch ? exhaustTool.eraseTarget(erasing) : null
  const erasingLight = erasing && !erasingCallout && !erasingLine && !erasingSwitch && !erasingExhaust ? lightTool.eraseTarget(erasing) : null
  const erasingCeiling = erasing && !erasingCallout && !erasingLine && !erasingSwitch && !erasingExhaust && !erasingLight && !lightTool.numberAt(erasing) ? ceilingTool.eraseTarget(erasing) : null
  const lights = lightTool.displayed()
  const fans = exhaustTool.displayed()
  renderSwitching(
    canvas,
    {
      walls: s.base.underlay,
      doorways,
      communications: communicationsOf(),
      batteries,
      pieces: s.base.pieces,
      drywall: s.base.own,
      items: ceilingItems,
      ceilings: s.ceilings.map((a) => ({ ceiling: a.object, room: a.item.room })),
      selectedCeilingId: ceilingTool.selectedId(),
      erasingCeilingId: erasingCeiling,
      lights,
      lightBodies: lightBodies(),
      lightGhost: tool === "light" && cursor ? lightTool.ghost(cursor) : null,
      selectedLightId: hoveredLight ?? lightTool.selectedId(),
      erasingLightId: erasingLight,
      exhausts: fans,
      exhaustGhost: tool === "exhaust" && cursor ? exhaustTool.ghost(cursor) : null,
      selectedExhaustId: hoveredLight ?? exhaustTool.selectedId(),
      erasingExhaustId: erasingExhaust,
      lineLabels: visibleLines(linesOf(), lights, fans).map(({ line, light }) => ({ id: line.id, name: line.name, at: { x: light.x, y: light.y } })),
      selectedLineId: lineTool.selectedId(),
      erasingLineId: erasingLine,
      switches: switchTool.displayed(),
      switchGhost: tool === "lightSwitch" && cursor ? switchTool.ghost(cursor) : null,
      selectedSwitchId: switchTool.selectedId(),
      erasingSwitchId: erasingSwitch,
      callouts: calloutTool.displayList(),
      selectedCalloutId: calloutTool.selectedId(),
      erasingCalloutId: erasingCallout?.id ?? null,
    },
    unit,
    view,
    { palette: paletteOf(theme), theme, ruler: rulerOf(walls, batteries, ceilingItems) },
  )
}

// план «Реконструкция»: подложка «Черновых работ» серым, стены гипсокартона зелёным, размеры и жесты построения как на обмере
function drawReconstructionPlan(): void {
  const palette = paletteOf(theme)
  const underlay = walls.filter((w) => reconWorkspace?.readOnlyIds.has(w.id) === true)
  const own = walls.filter(isDrywallWall)
  const erasingCallout = tool === "eraser" && hoverWorld ? calloutTool.pick(hoverWorld) : null
  const target = tool === "eraser" && cursor && !erasingCallout ? eraserTarget(cursor) : { wall: null, dim: null, doorway: null, communication: null, battery: null }
  const draft = dimDraftGeometry()
  const snapHit = tool === "dimension" && cursor && (!dimDraft.a || !dimDraft.b) ? nearestDimAnchor(cursor, walls, doorways, radiusCm(), []) : null
  const outlines: { wall: DrywallWall; color: string }[] = []
  for (const wall of own) {
    if (target.wall === wall) outlines.push({ wall, color: palette.erase })
    else if (selectedWalls.includes(wall)) outlines.push({ wall, color: palette.selection })
    else if (marqueeHits?.walls.includes(wall)) outlines.push({ wall, color: palette.marqueeWall })
  }
  const start = wallStart()
  const p = chainStart && segment ? segment.end : null
  const preview = start && p ? newDrywallWall("", start, p, drywallParams) : null
  let square: Point[] | null = null
  if (tool === "drywall" && cursor) {
    if (chainStart && p && segment?.dir) square = chainEndSquare(p, segment.dir, segment.snap, newWallThickness())
    else if (!chainStart && cursorSnap) square = placementSquare(cursorSnap, newWallThickness())
  }
  const only = selectedWalls.length === 1 ? selectedWalls[0] : null
  renderReconstruction(
    canvas,
    {
      walls: underlay,
      doorways,
      communications: communicationsOf(),
      batteries,
      pieces: reconNow().pieces,
      drywall: own,
      preview,
      outlines,
      handles: only && isDrywallWall(only) && selectedDimensions.length === 0 ? only : null,
      callouts: calloutTool.displayList(),
      selectedCalloutId: calloutTool.selectedId(),
      erasingCalloutId: erasingCallout?.id ?? null,
    },
    unit,
    view,
    {
      palette,
      theme,
      dimensions,
      dimDraft: draft,
      dimRubber: !dimDraft.a || dimDraft.b || !cursor ? null : draftRubber(snapHit?.point ?? cursor),
      dimSnap: snapHit?.point ?? null,
      selectedDims: selectedDimensions,
      hoverDim: target.dim,
      marqueeHits,
      marquee,
      square,
      angle:
        chainStart && segment?.dir && segment.refRay && segment.angleDeg !== null
          ? { at: segment.start, from: segment.refRay, to: segment.dir, deg: segment.angleDeg }
          : null,
      ruler: rulerOf(walls, batteries),
    },
  )
}

// план «Черновые работы»: подложка «Монтажа» серым, стяжка штриховкой, штукатурка полосой, блоки помещений, выделение и превью
function drawRoughPlan(): void {
  const s = roughNow()
  // выноска главнее остальных объектов под курсором ластика, затем штукатурка, затем стяжка (spec rough-works-plan «Ластик»)
  const erasingCallout = tool === "eraser" && cursor ? calloutTool.pick(cursor) : null
  // порядок под курсором ластика: выноска, прямой угол, штукатурка, стяжка
  const eraseAngle = tool === "eraser" && cursor && !erasingCallout ? rightAngleTool.eraseTarget(cursor) : null
  const erasePlaster = tool === "eraser" && cursor && !erasingCallout && !eraseAngle ? plasterTool.eraseTarget(cursor) : null
  const eraseScreed = tool === "eraser" && cursor && !erasingCallout && !eraseAngle && !erasePlaster ? screedTool.eraseTarget(cursor) : null
  const angleGhost = rightAngleTool.ghost()
  renderRough(
    canvas,
    {
      walls: s.base.walls,
      doorways: s.base.doorways,
      communications: communicationsOf(),
      batteries: s.base.batteries,
      pieces: s.pieces,
      screeds: s.screeds.map((a) => ({ screed: a.screed, room: a.item.room })),
      blocks: roomBlocksOf(s.netItems),
      selectedPlasterId: plasterTool.selectedId(),
      selectedScreedId: screedTool.selectedId(),
      ghost: plasterTool.ghost(),
      ruler: rulerOf(s.base.walls, s.base.batteries),
      rightAngles: s.rightAngles.map((a) => ({ id: a.mark.id, point: a.corner.point, arms: a.corner.arms })),
      selectedRightAngleId: rightAngleTool.selectedId(),
      angleGhost: angleGhost && tool === "rightAngle" ? { point: angleGhost.point, arms: angleGhost.arms, strips: cornerStrips(angleGhost, s.pieces) } : null,
      erasing: eraseAngle
        ? { kind: "angle", id: eraseAngle }
        : erasePlaster
          ? { kind: "plaster", id: erasePlaster }
          : eraseScreed
            ? { kind: "screed", id: eraseScreed }
            : null,
      callouts: calloutTool.displayList(),
      selectedCalloutId: calloutTool.selectedId(),
      erasingCalloutId: erasingCallout?.id ?? null,
    },
    unit,
    view,
    { palette: paletteOf(theme), theme },
  )
}

// план «Демонтаж»: подложка из стен обмерочного плана без сносимых элементов, область сноса, выделение и превью
function drawDemolitionPlan(): void {
  const marks = effectiveMarks(demolitionHost.marks(), walls, doorways)
  // выноска главнее пометки под курсором ластика (spec callout «Удаление выноски ластиком»)
  const erasingCallout = tool === "eraser" && cursor ? calloutTool.pick(cursor) : null
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
      ruler: rulerOf(walls, batteries),
      erasing: tool === "eraser" && cursor && !erasingCallout ? demolitionTool.eraseTarget(cursor) : null,
      callouts: calloutTool.displayList(),
      selectedCalloutId: calloutTool.selectedId(),
      erasingCalloutId: erasingCallout?.id ?? null,
    },
    unit,
    view,
    { color: demolitionColor(theme), palette: paletteOf(theme) },
  )
}

function drawMeasurePlan(): void {
  const p = chainStart && segment ? segment.end : null
  // выноска главнее остальных объектов под курсором ластика (spec callout «Удаление выноски ластиком»); берётся по сырой точке
  const erasingCallout = tool === "eraser" && hoverWorld ? calloutTool.pick(hoverWorld) : null
  const target = tool === "eraser" && cursor && !erasingCallout ? eraserTarget(cursor) : { wall: null, dim: null, doorway: null, communication: null, battery: null }
  const draft = dimDraftGeometry()
  const snapHit = tool === "dimension" && cursor && (!dimDraft.a || !dimDraft.b) ? nearestDimAnchor(cursor, walls, doorways, radiusCm(), batteries.filter(editableBattery)) : null
  let previewWall: Wall | null = null
  const start = wallStart()
  if (start && p) previewWall = { id: "", a: start, b: p, thicknessCm, type: wallMaterial }
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
    callouts: calloutTool.displayList(),
    selectedCallout: calloutTool.selectedId(),
    erasingCallout: erasingCallout?.id ?? null,
    ...(workspace ? { roomRecords: current().rooms ?? [], selectedRoom } : null),
    hoverDoorDirection: tool !== "eraser" && hoverWorld ? selectionEditing.hoverDirection(hoverWorld) : null,
    marquee,
    marqueeHits,
    square,
    angle:
      chainStart && segment?.dir && segment.refRay && segment.angleDeg !== null
        ? { at: segment.start, from: segment.refRay, to: segment.dir, deg: segment.angleDeg }
        : null,
    tracks: centerGuideTracks(),
    ruler: rulerOf(walls, batteries),
    palette: paletteOf(theme),
  })
}

// риски центровки: батареи по окну (change fix-battery-centering-and-numbers, design D2) и мебели (change furniture-center-snap)
function centerGuideTracks(): TrackLine[] | null {
  const guide = tool === "battery" || batteryTool.dragging() ? batteryTool.guide() : null
  const furnitureGuides = tool === "furniture" || itemTool.dragging() ? itemTool.guides() : []
  const tracks = [...(guide ? [guide] : []), ...furnitureGuides]
  return tracks.length > 0 ? tracks : null
}

// нажатая кнопка мыши: рамка, перетаскивание стен или размера, протяжка пометки, сдвиг вида
function gestureActive(): boolean {
  return !!(marquee || marqueePending || groupMove || endpointDrag || dimDrag || doorwayTool.dragging() || communicationTool.dragging() || batteryTool.dragging() || calloutTool.dragging() || demolitionTool.dragging() || plasterTool.dragging() || itemTool.dragging() || panDrag)
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
  const found = erasePick(p, { walls, dimensions, doorways, batteries, items: fixtures }, radiusCm(), 2)
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
  return dimensionGeometry({ from: dimDraft.a, to: dimDraft.b, offset }, walls, doorways, batteries, fixtures)
}

function draftRubber(end: Point): [Point, Point] | null {
  const ea = dimDraft.a ? endPoint(dimDraft.a) : null
  return ea ? [ea, end] : null
}

// подпись подобранного масштаба и доступность экспорта (spec drawing-scale «Показ подобранного масштаба»)
function syncScale(): void {
  const pages = pagesOf(current())
  scaleLabelEl.textContent = scaleLabel(pages, pdfFormat.value as PageFormat)
  pdfExportBtn.disabled = pages.every((p) => p.walls.length === 0 && !p.callouts?.length)
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
    const r = snapStartVertex(raw, solid(), snapRadiusCm(view.zoom), GRID_STEP_CM, newWallThickness(), doorways, communicationsOf())
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
    walls: solid(),
    radiusCm: snapRadiusCm(view.zoom),
    gridStepCm: GRID_STEP_CM,
    thicknessCm: newWallThickness(),
    ortho,
    typedAngleDeg: typedAngleDeg(),
    typedLengthCm: lengthDirty ? typedLengthCm() : null,
    doorways,
    communications: communicationsOf(),
  })
  // конец стены, налагающийся на коммуникацию, обрезается до касания; нулевая стена не ставится (spec wall-collision
  // «Стены не налагаются на коммуникации»)
  const byCommunications = limitNewWall(computed.start, computed.end, newWallThickness(), communicationsOf())
  const limited = byCommunications && limitNewWallByBatteries(computed.start, byCommunications, newWallThickness(), walls, batteries)
  endBlocked = limited === null
  segment = limited === null ? { ...computed, end: computed.start } : pointsEqual(limited, computed.end) ? computed : { ...computed, end: limited }
  cursor = segment.snap.point
  cursorSnap = segment.snap
}

// пересчёт привязки без движения курсора (изменились ввод, толщина, орто)
function refreshWallCursor(): void {
  if (isWallTool() && wallCursorRaw) snapWallCursor(wallCursorRaw)
}

// стена гипсокартона: продолжение свободного конца своей стены той же толщины и высоты удлиняет её, иначе добавляется новая стена;
// автоматических размеров у стен гипсокартона нет — размеры ставятся инструментом «Размер»
function placeDrywall(a: Point, end: Point): void {
  const wall = newDrywallWall(crypto.randomUUID(), a, end, drywallParams)
  const own = walls.filter(isDrywallWall).filter((w) => w.heightCm === wall.heightCm)
  const merge = mergeContinuation({ walls: own, dimensions: [] }, wall)
  pushRecord()
  dirty = true
  if (merge.kind === "merged") {
    merge.scene.walls.forEach((w, i) => {
      walls[walls.indexOf(own[i])] = w
    })
    return
  }
  walls.push(wall)
}

function commitPoint(): void {
  if (!chainStart) {
    if (!cursor) return
    // квадрат установки, налагающийся на коммуникацию, начала стены не фиксирует
    const startSquare = cursorSnap ? placementSquare(cursorSnap, newWallThickness()) : null
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
  const a = segment?.start ?? chainStart
  const end = segment?.end ?? cursor ?? chainStart
  if (endBlocked) return
  if (!pointsEqual(a, end) && tool === "drywall") placeDrywall(a, end)
  else if (!pointsEqual(a, end)) {
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
  if (calloutTool.dragging()) {
    calloutTool.dragTo(toWorld(e))
    redraw()
    return
  }
  if (itemTool.dragging()) {
    itemTool.dragTo(toWorld(e))
    redraw()
    return
  }
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
      const step = orthoGestureStep(groupMove.gesture, p, solid(), { kind: "walls", walls: group }, GRID_STEP_CM, radiusCm())
      groupMove.gesture = step.gesture
      if (step.target) moveWallsBounded(solid(), group, { x: step.target.point.x - baseA.x, y: step.target.point.y - baseA.y }, editMode(step.target))
    } else {
      const target = snapWithSource({ x: baseA.x + p.x - grab.x, y: baseA.y + p.y - grab.y }, others, GRID_STEP_CM, radiusCm())
      moveWallsBounded(solid(), group, { x: target.point.x - baseA.x, y: target.point.y - baseA.y }, editMode(target))
    }
    dirty = true
    redraw()
    return
  }
  if (dimDrag) {
    const p = toWorld(e)
    const axis = dimensionGeometry({ ...dimDrag.dim, offset: 0 }, walls, doorways, batteries, fixtures)
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
      const step = orthoGestureStep(endpointDrag.gesture, p, solid(), { kind: "end", wall, end }, GRID_STEP_CM, radiusCm())
      endpointDrag.gesture = step.gesture
      target = step.target
    } else target = snapWithSource(p, solid().filter((w) => w !== wall), GRID_STEP_CM, radiusCm())
    if (target && !pointsEqual(target.point, other)) moveEndpointBounded(solid(), wall, end, target.point, editMode(target))
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
    viewSave.schedule()
    redraw()
    return
  }
  if (onRough()) {
    // «Штукатурка»: протяжка и подсветка цели под курсором перерисовывают сами; «Линейка», «Ластик» и «Выноска» следят за курсором
    if (tool === "plaster") {
      plasterTool.move(toWorld(e), screenPoint(e))
      plasterTool.hover(toWorld(e))
    } else if (tool === "rightAngle") {
      rightAngleTool.hover(toWorld(e))
    } else if (tool === "ruler" || tool === "eraser" || tool === "callout") {
      cursor = toWorld(e)
      if (tool === "callout") calloutTool.hover(cursor)
      redraw()
    }
    return
  }
  if (onCeiling()) {
    // перетаскивание объекта освещения, выключателя или вытяжки; «Освещение», «Линия освещения» (подсветка светильника),
    // «Выключатель» и «Вытяжка» (призрак), «Линейка», «Ластик» и «Выноска» следят за курсором
    if (lightTool.dragging()) {
      lightTool.dragTo(toWorld(e))
      return
    }
    if (switchTool.dragging()) {
      switchTool.dragTo(toWorld(e))
      return
    }
    if (exhaustTool.dragging()) {
      exhaustTool.dragTo(toWorld(e))
      return
    }
    if (tool === "light" || tool === "lightLine" || tool === "lightSwitch" || tool === "exhaust" || tool === "ruler" || tool === "eraser" || tool === "callout") {
      cursor = toWorld(e)
      if (tool === "callout") calloutTool.hover(cursor)
      redraw()
    }
    return
  }
  if (onDemolition()) {
    // протяжка пометки перерисовывает сама; «Линейка» и «Ластик» следят за курсором
    if (tool === "demolition") demolitionTool.move(toWorld(e), screenPoint(e))
    else if (tool === "ruler" || tool === "eraser" || tool === "callout") {
      cursor = toWorld(e)
      if (tool === "callout") calloutTool.hover(cursor)
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
  if (isWallTool()) updateWallCursor(e)
  else if (tool === "dimension" || tool === "ruler") cursor = toWorld(e)
  else if (tool === "callout") {
    cursor = toWorld(e)
    calloutTool.hover(cursor)
  } else if (placingTool()) {
    cursor = toWorld(e)
    placingTool()?.hover(cursor)
  } else if (communicationKind()) {
    cursor = toWorld(e)
    hoverCommunicationGhost(cursor)
  } else if (tool === "battery") {
    cursor = toWorld(e)
    batteryTool.hover(cursor)
  } else if (tool === "furniture") {
    cursor = toWorld(e)
    itemTool.hover(cursor)
  } else cursor = toSnappedPoint(e)
  hoverWorld = toWorld(e)
  redraw()
})

// линейка показывает замеры только пока курсор над холстом; подсветка тени направления двери — тоже
canvas.addEventListener("pointerleave", () => {
  hoverWorld = null
  if (tool === "plaster") plasterTool.hover(null)
  if (tool === "rightAngle") rightAngleTool.hover(null)
  if (tool === "furniture") itemTool.hover(null)
  if ((tool === "ruler" || (tool === "eraser" && (onDemolition() || onRough() || onCeiling())) || ((tool === "light" || tool === "lightLine" || tool === "lightSwitch" || tool === "exhaust") && onCeiling())) && cursor) cursor = null
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
    others: snapOthers(solid(), group),
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
  // поле ввода выноски открыто: нажатие вне поля только сохраняет текст (по blur) и ничего не начинает, в том числе click
  if (calloutTool.editing()) {
    suppressClick = true
    return
  }
  hoverWorld = null // нажатие начинает жест — подсветка до следующего движения не нужна
  if (onRough()) {
    const p = toWorld(e)
    if (tool === "plaster") {
      plasterTool.down(screenPoint(e), p)
      canvas.setPointerCapture(e.pointerId) // отпускание за пределами холста завершает протяжку
    } else if (selectionAllowed(tool)) {
      // без инструмента: выноска, иначе число выделенной пометки, подпись стяжки или пометка штукатурки под точкой
      if (calloutTool.press(p)) {
        suppressClick = true
        canvas.setPointerCapture(e.pointerId)
      } else {
        if (calloutTool.selectedId() !== null) {
          calloutTool.deselect()
          redraw()
        }
        pressRough(p)
        resumePlasterTool()
      }
    }
    return
  }
  if (onCeiling()) {
    // без инструмента в порядке приоритета плана (spec ceiling-plan «Выделение и приоритет объектов…»): выноска, текст метки линии,
    // знак выключателя, знак вытяжки, число и знак объекта освещения, подпись потолка; мебель и подложка не выделяются
    if (!selectionAllowed(tool)) return
    const p = toWorld(e)
    if (calloutTool.press(p)) {
      suppressClick = true
      canvas.setPointerCapture(e.pointerId)
      resetCeiling()
      resetLines()
      resetSwitches()
      resetExhausts()
      return
    }
    if (calloutTool.selectedId() !== null) calloutTool.deselect()
    if (lineTool.labelAt(p)) {
      resetCeiling()
      resetSwitches()
      resetExhausts()
      pressLines(p)
      return
    }
    if (pressSwitches(p, e)) {
      resetCeiling()
      resetExhausts()
      return
    }
    if (pressExhausts(p, e)) {
      resetCeiling()
      return
    }
    resetLines()
    closeLightEditor()
    const hit = lightTool.press(p)
    if (hit) {
      closeCeilingEditor()
      ceilingTool.clearSelection()
      ceilingPanelOpen = false
      if (hit.kind === "number") {
        if (hit.wasSelected) openLightEditor(hit.number)
      } else if (lightTool.beginDrag(p)) canvas.setPointerCapture(e.pointerId)
      redraw()
      return
    }
    pressCeiling(p)
    return
  }
  if (onDemolition()) {
    const p = toWorld(e)
    if (tool === "demolition") {
      // нажатие внутри батареи — пометка батареи кликом; иначе протяжка по стене (spec demolition-plan «Снос батареи»)
      const battery = hitBattery(p, walls, batteries, 0)
      if (battery) batteryPress = { id: battery.id, px: screenPoint(e) }
      else demolitionTool.down(p, screenPoint(e))
      canvas.setPointerCapture(e.pointerId) // отпускание за пределами холста завершает протяжку
    } else if (selectionAllowed(tool)) {
      // без инструмента: выноска, иначе правимое число выделенной пометки, иначе выделение пометки под точкой
      if (calloutTool.press(p)) {
        suppressClick = true
        canvas.setPointerCapture(e.pointerId)
      } else {
        if (calloutTool.selectedId() !== null) {
          calloutTool.deselect()
          redraw()
        }
        if (!pressDemolitionNumber(p)) {
          demolitionTool.select(p)
          resumeDemolitionTool()
        }
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
  if (selectionEditing.pressNumber(p) || selectionEditing.pressZone(p) || (communicationsEditable() && communicationTool.pressNumber(p)) || batteryTool.pressNumber(p) || pressFurnitureNumber(p)) {
    suppressClick = true
    return
  }
  // выноска рисуется поверх остальных объектов: нажатие по ней главнее остальных целей (spec callout «Выделение, перенос и правка»)
  if (calloutTool.press(p)) {
    suppressClick = true
    canvas.setPointerCapture(e.pointerId)
    return
  }
  // цель нажатия (change fix-midpoint-marker-priority, design D2): маркеры выделенной стены главнее
  // размера, проёма и тела стены
  const found = pressPick(p, { walls, dimensions, doorways, batteries, items: fixtures }, radiusCm(), 2, {
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
      // стол плана «Мебель»: размеры и выноска главнее, подложка не выделяется; нажатие выделяет стол и начинает перетаскивание
      if (onFurniture() && itemTool.press(p)) {
        suppressClick = true
        canvas.setPointerCapture(e.pointerId)
        return
      }
      // блок помещения — цель с самым низким приоритетом: стены, размеры, элементы и батареи главнее (spec room-explication)
      const room = workspace ? roomBlockAt(p, roomBlocksOf(roomItems()), view, SCREEN_METRICS.labelPx) : null
      if (room !== null) {
        suppressClick = true
        selectRoom(room)
        return
      }
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
  if (calloutTool.dragging()) {
    if (e.button === 0) calloutTool.endDrag()
    return
  }
  if (itemTool.dragging()) {
    if (e.button === 0) {
      itemTool.endDrag()
      redraw()
    }
    return
  }
  if (onRough() && e.button === 0) {
    // поставленная кликом пометка не выделяется, инструмент остаётся включённым — как у «Стяжки»; поставленная протяжкой
    // остаётся выделенной, инструмент снимается — как у «Демонтажа» (change plaster-partial-drag)
    if (tool === "plaster" && plasterTool.up(toWorld(e), screenPoint(e)) !== null && plasterTool.selectedId() !== null) leavePlasterTool()
    return
  }
  if (onCeiling() && e.button === 0) {
    if (lightTool.dragging()) lightTool.endDrag()
    releaseSwitch()
    if (exhaustTool.dragging()) exhaustTool.endDrag()
    return
  }
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
  viewSave.flush()
  if (isWallTool()) updateWallCursor(e)
  else if (tool === "dimension" || tool === "ruler") cursor = toWorld(e)
  else cursor = toSnappedPoint(e)
  redraw()
})

function marqueePicks(rect: { x1: number; y1: number; x2: number; y2: number }): { walls: Wall[]; dims: Dimension[]; doorways: WallElement[]; batteries: Battery[]; items: FurnitureItem[] } {
  const k = PX_PER_CM * view.zoom
  const min = { x: Math.min(rect.x1, rect.x2) / k + view.pan.x, y: Math.min(rect.y1, rect.y2) / k + view.pan.y }
  const max = { x: Math.max(rect.x1, rect.x2) / k + view.pan.x, y: Math.max(rect.y1, rect.y2) / k + view.pan.y }
  // ось стены на участке её проёма стену не выделяет (multi-selection «Рамка выделения»)
  const wallsPicked = wallsInRect(min, max, walls, doorways).filter(editableWall)
  const dimsPicked = dimensions.filter((d) => {
    const geom = dimensionGeometry(d, walls, doorways, batteries, fixtures)
    return !!geom && segmentIntersectsRect(geom.p1, geom.p2, min, max)
  })
  return {
    walls: wallsPicked,
    dims: dimsPicked,
    doorways: doorwaysInRect(min, max, walls, doorways).filter(editableElement),
    batteries: batteriesInRect(min, max, walls, batteries).filter(editableBattery),
    items: onFurniture() ? itemsInRect(items, min, max) : [],
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
  const previousItems = itemTool.selectedIds()
  closeNumberEditor()
  if (onFurniture()) {
    // столы плана «Мебель» выделяются рамкой вместе с размерами; с Shift — добавляются к выделенным
    itemTool.select([...(additive ? previousItems : []), ...picks.items.map((t) => t.id)])
    if (itemTool.hasSelection()) furniturePanelOpen = true
  }
  if (!selectedDoorways.length && !selectedBatteries.length && selectedWalls.length === 1 && !selectedDimensions.length) {
    syncThicknessBox()
    if (!onReconstruction()) setWallMaterial(selectedWalls[0].type)
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
  viewSave.schedule()
  redraw()
}, { passive: false })

canvas.addEventListener("click", (e) => {
  if (suppressClick) {
    suppressClick = false
    return
  }
  // на плане «Черновые работы»: «Стяжка» ставится кликом, «Ластик» стирает выноску, штукатурку или стяжку под курсором
  if (onRough()) {
    const at = toWorld(e)
    if (tool === "callout") calloutTool.click(at)
    else if (tool === "screed") screedTool.place(at)
    else if (tool === "rightAngle") rightAngleTool.place(at)
    else if (tool === "eraser" && !calloutTool.eraseAt(at) && !rightAngleTool.erase(at) && !plasterTool.erase(at)) screedTool.erase(at)
    return
  }
  // на плане «Потолки и освещение»: «Натяжной потолок», «Освещение», «Линия освещения», «Выключатель» и «Вытяжка» ставятся кликом,
  // «Ластик» стирает один объект по приоритету плана: выноска, метка линии, выключатель, вытяжка, объект освещения, потолок
  // (число расстояния ничего не стирает)
  if (onCeiling()) {
    const at = toWorld(e)
    if (tool === "callout") calloutTool.click(at)
    else if (tool === "stretchCeiling") ceilingTool.place(at)
    else if (tool === "light") lightTool.place(at)
    else if (tool === "lightLine") lineTool.place(at)
    else if (tool === "lightSwitch") switchTool.place(at)
    else if (tool === "exhaust") exhaustTool.place(at)
    else if (tool === "eraser" && !calloutTool.eraseAt(at) && !lineTool.erase(at) && !switchTool.erase(at) && !exhaustTool.erase(at) && !lightTool.erase(at) && !lightTool.numberAt(at)) ceilingTool.erase(at)
    return
  }
  // на плане «Демонтаж» жесты разбирает адаптер по нажатию и отпусканию (change demolition-plan, design D10);
  // «Ластик» снимает пометку под курсором по клику (change demolition-doorway-sizes, design D5)
  if (onDemolition()) {
    const at = toWorld(e)
    if (tool === "callout") calloutTool.click(at)
    else if (tool === "eraser" && !calloutTool.eraseAt(at) && !demolitionTool.erase(at)) eraseBatteryMark(at)
    return
  }
  const p = toSnappedPoint(e)
  const raw = toWorld(e)
  if (tool === "callout") {
    calloutTool.click(raw)
    return
  }
  if (tool === "eraser") {
    // выноска главнее остальных объектов под курсором ластика
    if (calloutTool.eraseAt(raw)) return
    const { wall, dim, doorway, communication, battery } = eraserTarget(p)
    if (dim) deleteDimension(dim)
    // план «Мебель»: ластик стирает столы, подложка (стены, штукатурка, гипсокартон, элементы) не стирается
    else if (onFurniture()) itemTool.erase(raw)
    else if (communication) deleteCommunication(communication)
    else if (battery) deleteBattery(battery)
    else if (doorway) deleteDoorway(doorway)
    else if (wall) deleteWall(wall)
    return
  }
  if (tool === "furniture") {
    // стол ставится всегда, пересечения только показываются; установка снимает инструмент, стол остаётся выделенным
    itemTool.place(raw)
    leaveItemPlacing()
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
    calloutTool.deselect()
    deselectRoom()
    itemTool.clearSelection()
    lengthDirty = false
    clearDimSelection()
    redraw()
    return
  }
  // остался инструмент «Стена» (линейка не кликает): тело существующей стены стену не выделяет и не начинает,
  // прилипший квадрат рисует (change select-only-without-tool, spec wall-drawing «Квадрат при установке стены»)
  if (!isWallTool()) return
  if (!chainStart && wallClickAction(raw, snapStartVertex(raw, solid(), radiusCm(), GRID_STEP_CM, newWallThickness(), doorways, communicationsOf()), walls, radiusCm()).kind === "select") return
  updateWallCursor(e)
  commitPoint()
})

function placeDimension(p: Point): void {
  if (!dimDraft.a || !dimDraft.b) {
    const hit = nearestDimAnchor(p, walls, doorways, radiusCm(), batteries.filter(editableBattery), fixtures)
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
  if (calloutTool.hasDraft()) calloutTool.cancelDraft()
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

// «Гипсокартон»: кнопка включает инструмент и открывает панель, повторный клик по активному — переключает панель (как «Стена»)
toolDrywallBtn.addEventListener("click", () => {
  if (tool !== "drywall") {
    setTool("drywall")
    setWallPanel(true)
  } else setWallPanel(!drywallPanelOpen)
})
// поля панели применяются по фиксации ввода: выделенная стена меняется одним шагом истории; клавиши поля не доходят до холста
drywallThicknessInput.addEventListener("change", () => applyDrywallField("thicknessCm", drywallThicknessInput))
drywallHeightInput.addEventListener("change", () => applyDrywallField("heightCm", drywallHeightInput))
for (const input of [drywallThicknessInput, drywallHeightInput]) {
  input.addEventListener("keydown", (e) => {
    e.stopPropagation()
    if (e.key === "Enter" || e.key === "Escape") input.blur()
  })
}

// кнопка группы «Мебель» и кнопка её инструмента «Стол» (spec furniture-plan «Панель группы «Мебель» и инструмента «Стол»»)
toolFurnitureBtn.addEventListener("click", () => applyFurnitureGroup(groupButtonClick(furnitureGroupState())))
for (const [kind, button] of furnitureKindButtons) button.addEventListener("click", () => applyFurnitureGroup(groupPick(furnitureGroupState(), kind)))
// поля панели применяются по фиксации ввода; клавиши поля не доходят до холста
furnitureWidthInput.addEventListener("change", () => applyItemField("widthCm", furnitureWidthInput))
furnitureLengthInput.addEventListener("change", () => applyItemField("lengthCm", furnitureLengthInput))
furnitureAngleInput.addEventListener("change", () => applyItemField("angleDeg", furnitureAngleInput))
for (const input of [furnitureWidthInput, furnitureLengthInput, furnitureAngleInput]) {
  input.addEventListener("keydown", (e) => {
    e.stopPropagation()
    if (e.key === "Enter" || e.key === "Escape") input.blur()
  })
}

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
toolCalloutBtn.addEventListener("click", () => setTool("callout"))

// «Примечания»: инструмент без жестов на холсте; клик по кнопке активного инструмента переключает панель
toolNotesBtn.addEventListener("click", () => {
  if (tool !== "notes") {
    setTool("notes")
    openNotesPanel()
  } else if (notesPanelOpen) closeNotesPanel()
  else openNotesPanel()
})
notesInput.addEventListener("blur", commitNotes)
// клавиши поля не доходят до холста: Delete, стрелки, Ctrl+Z правят текст, а не чертёж; Esc применяет правку
notesInput.addEventListener("keydown", (e) => {
  e.stopPropagation()
  if (e.key === "Escape") notesInput.blur()
})
window.addEventListener("pagehide", commitNotes)

toolRulerBtn.addEventListener("click", () => setTool("ruler"))
toolDemolitionBtn.addEventListener("click", () => setTool("demolition"))

// «Штукатурка» и «Стяжка»: кнопка включает инструмент и открывает панель, повторный клик по активному — переключает панель
toolPlasterBtn.addEventListener("click", () => {
  if (tool !== "plaster") {
    setTool("plaster")
    plasterPanelOpen = true
  } else plasterPanelOpen = !plasterPanelOpen
  syncRoughPanels()
})
// «Прямой угол» без параметров: кнопка только включает инструмент, панели нет
toolRightAngleBtn.addEventListener("click", () => setTool("rightAngle"))
toolScreedBtn.addEventListener("click", () => {
  if (tool !== "screed") {
    setTool("screed")
    screedPanelOpen = true
  } else screedPanelOpen = !screedPanelOpen
  syncRoughPanels()
})

// поле толщины панели: меняет выделенный объект одним шагом истории, иначе — значение для новых; недопустимое значение не
// применяется, поле возвращает прежнее
plasterThicknessInput.addEventListener("change", () => {
  const mm = parseThickness(plasterThicknessInput.value, PLASTER_THICKNESS)
  if (mm !== null) {
    if (plasterTool.selectedId() !== null) plasterTool.setSelectedThickness(mm)
    else plasterThicknessMm = mm
  }
  plasterThicknessInput.blur()
  redraw()
})
screedThicknessInput.addEventListener("change", () => {
  const mm = parseThickness(screedThicknessInput.value, SCREED_THICKNESS)
  if (mm !== null) {
    if (screedTool.selectedId() !== null) screedTool.setSelectedThickness(mm)
    else screedThicknessMm = mm
  }
  screedThicknessInput.blur()
  redraw()
})
for (const input of [plasterThicknessInput, screedThicknessInput]) {
  // клавиши поля не доходят до холста: Delete и Ctrl+Z правят текст, а не чертёж
  input.addEventListener("keydown", (e) => {
    e.stopPropagation()
    if (e.key === "Enter" || e.key === "Escape") input.blur()
  })
}

// «Натяжной потолок»: кнопка включает инструмент и открывает панель, повторный клик по активному — переключает панель
toolStretchCeilingBtn.addEventListener("click", () => {
  if (tool !== "stretchCeiling") {
    setTool("stretchCeiling")
    ceilingPanelOpen = true
  } else ceilingPanelOpen = !ceilingPanelOpen
  syncCeilingPanel()
})
// «Линия освещения»: кнопка включает инструмент и открывает панель, повторный клик по активному — переключает панель
toolLightLineBtn.addEventListener("click", () => {
  if (tool !== "lightLine") {
    setTool("lightLine")
    linePanelOpen = true
  } else linePanelOpen = !linePanelOpen
  syncLinePanel()
})
// поле «Линия»: меняет имя выделенной метки одним шагом истории, иначе — значение для новых; недопустимое не применяется
lightLineInput.addEventListener("change", () => {
  // выделенная метка вытяжки принимает «LV<n>», остальное — «L<n>»; число для новых меток общее
  const name = parseLineName(lightLineInput.value, prefixOfName(lineTool.selected()?.name ?? ""))
  if (name !== null) {
    if (lineTool.selectedId() !== null) lineTool.setSelectedName(name)
    else lineNumberCurrent = lineNumber(name)
  }
  lightLineInput.blur()
  syncLinePanel()
  redraw()
})
lightLineInput.addEventListener("keydown", (e) => {
  e.stopPropagation()
  if (e.key === "Enter" || e.key === "Escape") lightLineInput.blur()
})
// «Выключатель»: кнопка включает инструмент и открывает панель, повторный клик по активному — переключает панель
toolLightSwitchBtn.addEventListener("click", () => {
  if (tool !== "lightSwitch") {
    setTool("lightSwitch")
    switchPanelOpen = true
  } else switchPanelOpen = !switchPanelOpen
  syncSwitchPanel()
})
// поле «Клавиш»: меняет число клавиш выделенного выключателя одним шагом истории, иначе — значение для новых; недопустимое не применяется
lightSwitchInput.addEventListener("change", () => {
  const count = parseKeyCount(lightSwitchInput.value)
  if (count !== null) {
    if (switchTool.selectedId() !== null) switchTool.setSelectedKeyCount(count)
    else switchKeysCurrent = count
  }
  lightSwitchInput.blur()
  syncSwitchPanel()
  redraw()
})
lightSwitchInput.addEventListener("keydown", (e) => {
  e.stopPropagation()
  if (e.key === "Enter" || e.key === "Escape") lightSwitchInput.blur()
})
// «Вытяжка»: инструмент без панели; повторное нажатие на активную кнопку снимает инструмент
toolExhaustBtn.addEventListener("click", () => setTool(tool === "exhaust" ? "none" : "exhaust"))
// группа «Освещение»: переходы кнопки группы и панели — как у групп «Проёмы» и «Коммуникации»
toolLightBtn.addEventListener("click", () => applyLightGroup(lightGroupClick(lightGroupState())))
for (const [kind, button] of lightKindButtons) button.addEventListener("click", () => applyLightGroup(lightGroupPick(lightGroupState(), kind)))
// поле опускания: меняет выделенный потолок одним шагом истории, иначе — значение для новых; недопустимое не применяется
ceilingDropInput.addEventListener("change", () => {
  const mm = parseDropMm(ceilingDropInput.value)
  if (mm !== null) {
    if (ceilingTool.selectedId() !== null) ceilingTool.setSelectedDrop(mm)
    else ceilingDropMm = mm
  }
  ceilingDropInput.blur()
  redraw()
})
ceilingDropInput.addEventListener("keydown", (e) => {
  e.stopPropagation()
  if (e.key === "Enter" || e.key === "Escape") ceilingDropInput.blur()
})

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
  // набранный текст выноски и примечаний сохраняется на прежнем плане
  calloutTool.commitEditor()
  closeNotesPanel() // панель закрывается до смены плана: поле показывает список прежнего плана
  commitCeilingEditor() // шаг истории — на прежнем плане
  commitLineEditor()
  closeSwitchEditor()
  commitWorking()
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
  calloutTool.commitEditor()
  commitCeilingEditor()
  commitLineEditor()
  closeSwitchEditor()
  closeNotesPanel()
  commitWorking()
  store.activeId = id
  drywallPanelOpen = false
  furniturePanelOpen = false
  loadWorking()
  view = current().view
  tool = defaultToolOf(activePlanOf(current()))
  syncToolUI()
  resetDemolition()
  resetRough()
  resetCeiling()
  resetLines()
  resetSwitches()
  resetExhausts()
  itemTool.reset()
  clearChain()
  closeNumberEditor()
  selectedWalls = []
  selectedDimensions = []
  selectedDoorways = []
  selectedBatteries = []
  selectedCommunication = null
  resetElementTools()
  calloutTool.reset()
  closeOpeningsPanel()
  closeCommunicationsPanel()
  closeLightPanel()
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
  resetRough()
  resetCeiling()
  resetLines()
  resetSwitches()
  resetExhausts()
  itemTool.reset()
  clearChain()
  closeNumberEditor()
  calloutTool.reset()
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

// отмена или повтор шага плана «Черновые работы» (change add-rough-works-plan, design D7): подставляются оба списка до операции
function stepRough(step: typeof undoRough): void {
  const next = step(activeHistory(), { plaster: plasterOf(), screeds: screedsOf(), angles: anglesOf() })
  if (!next) return
  current().roughPlaster = next.plaster
  current().roughScreeds = next.screeds
  // запись, сохранённая до введения прямых углов, поля не имеет: список остаётся как есть
  if (next.angles) current().roughAngles = next.angles
  roughCache = null
  dirty = true
  resetEditing()
  redraw()
}

// отмена или повтор шага плана «Мебель» (change furniture-plan-table, design D7): подставляются столы и размеры плана до операции
function stepFurniture(step: typeof undoFurniture): void {
  const next = step(activeHistory(), { items, dimensions })
  if (!next) return
  items = next.items
  dimensions = next.dimensions
  dirty = true
  resetEditing()
  redraw()
}

// отмена или повтор шага плана «Потолки и освещение» (change add-ceiling-plan, design D6): подставляется список потолков до операции
function stepCeiling(step: typeof undoCeilingPlan): void {
  const next = step(activeHistory(), { ceilings: ceilingsOf(), lights: lightsOf() })
  if (!next) return
  current().ceiling = storedCeiling(next.ceilings, current(), next.lights)
  ceilingCache = null
  dirty = true
  resetEditing()
  redraw()
}

// отмена или повтор шага плана «Сантехника» (change add-plumbing-plan, design D6): подставляются размеры плана до операции
function stepPlumbing(step: typeof undoPlumbing): void {
  const next = step(activeHistory(), dimensions)
  if (!next) return
  dimensions = next
  dirty = true
  resetEditing()
  redraw()
}

// сцена из записи истории: на плане «Монтаж» запись хранит содержимое «Монтажа» — рабочая сцена строится заново
// (остатки берутся по текущему обмеру и демонтажу), на остальных планах запись подставляется как есть
function restoreScene(e: Scene): void {
  if (reconWorkspace) {
    // запись плана «Реконструкция» хранит стены гипсокартона и размеры; выноски и примечания в ней не хранятся (у них свои записи)
    const stored = current().reconstruction
    current().reconstruction = {
      walls: e.walls.filter(isDrywallWall),
      dimensions: e.dimensions,
      ...(stored?.callouts ? { callouts: stored.callouts } : null),
      ...(stored?.notes ? { notes: stored.notes } : null),
    }
    loadWorking()
    return
  }
  if (workspace) {
    // выноски «Монтажа» в записи истории не хранятся (у них свои записи): список остаётся как есть
    // примечания «Монтажа» — тоже (change add-plan-notes, design D3)
    const callouts = current().mounting?.callouts
    const notes = current().mounting?.notes
    current().mounting = {
      walls: e.walls,
      dimensions: e.dimensions,
      ...(e.doorways ? { doorways: e.doorways } : null),
      ...(e.batteries ? { batteries: e.batteries } : null),
      ...(callouts ? { callouts } : null),
      ...(notes ? { notes } : null),
    }
    // запись без данных помещений (история до их введения) данные не меняет
    if (e.rooms) current().rooms = e.rooms
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

// отмена или повтор шага выносок плана (change add-callout, design D3): подставляется список выносок до операции
// отмена или повтор шага меток линий плана «Группы включения» (change add-light-lines, design D7): подставляется список до операции
function stepLines(step: typeof undoSwitchingLines): void {
  const next = step(activeHistory(), linesOf())
  if (!next) return
  lineHost.setLines(next)
  dirty = true
  resetEditing()
  redraw()
}

// отмена или повтор шага выключателей плана «Группы включения» (change add-light-switch, design D7)
function stepSwitches(step: typeof undoSwitches): void {
  const next = step(activeHistory(), switchesOf())
  if (!next) return
  switchHost.setSwitches(next)
  dirty = true
  resetEditing()
  redraw()
}

// отмена или повтор шага вытяжек плана «Группы включения» (change add-exhaust-fan, design D6): вытяжки и метки — вместе
function stepExhausts(step: typeof undoExhausts): void {
  const next = step(activeHistory(), exhaustHost.state())
  if (!next) return
  exhaustHost.setState(next)
  dirty = true
  resetEditing()
  redraw()
}

function stepCallouts(step: typeof undoCallouts): void {
  const next = step(activeHistory(), calloutsOf(current(), activePlanOf(current())))
  if (!next) return
  calloutHost.setCallouts(next)
  dirty = true
  resetEditing()
  redraw()
}

// отмена или повтор шага примечаний плана (change add-plan-notes, design D3): подставляется список до правки; открытая панель
// показывает восстановленный список
function stepNotes(step: typeof undoNotes): void {
  const next = step(activeHistory(), activeNotes())
  if (!next) return
  Object.assign(current(), withNotes(current(), activePlanOf(current()), next))
  if (notesPanelOpen) showNotes()
  dirty = true
  resetEditing()
  redraw()
}

function undo(): void {
  if (groupMove || endpointDrag || panDrag || dimDrag || doorwayTool.dragging() || communicationTool.dragging() || batteryTool.dragging() || calloutTool.dragging() || demolitionTool.dragging() || plasterTool.dragging() || itemTool.dragging()) return
  // открытое поле ввода выноски и поле примечаний сохраняют текст до отмены
  calloutTool.commitEditor()
  commitNotes()
  const h = activeHistory()
  if (h.past[h.past.length - 1]?.kind === "furniture") {
    stepFurniture(undoFurniture)
    return
  }
  if (h.past[h.past.length - 1]?.kind === "plumbing") {
    stepPlumbing(undoPlumbing)
    return
  }
  if (h.past[h.past.length - 1]?.kind === "ceiling") {
    stepCeiling(undoCeilingPlan)
    return
  }
  if (h.past[h.past.length - 1]?.kind === "switching") {
    stepLines(undoSwitchingLines)
    return
  }
  if (h.past[h.past.length - 1]?.kind === "switches") {
    stepSwitches(undoSwitches)
    return
  }
  if (h.past[h.past.length - 1]?.kind === "exhausts") {
    stepExhausts(undoExhausts)
    return
  }
  if (h.past[h.past.length - 1]?.kind === "callouts") {
    stepCallouts(undoCallouts)
    return
  }
  if (h.past[h.past.length - 1]?.kind === "notes") {
    stepNotes(undoNotes)
    return
  }
  if (h.past[h.past.length - 1]?.kind === "rough") {
    stepRough(undoRough)
    return
  }
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
  if (groupMove || endpointDrag || panDrag || dimDrag || doorwayTool.dragging() || communicationTool.dragging() || batteryTool.dragging() || calloutTool.dragging() || demolitionTool.dragging() || plasterTool.dragging() || itemTool.dragging()) return
  calloutTool.commitEditor()
  commitNotes()
  const h = activeHistory()
  if (h.future[h.future.length - 1]?.kind === "furniture") {
    stepFurniture(redoFurniture)
    return
  }
  if (h.future[h.future.length - 1]?.kind === "plumbing") {
    stepPlumbing(redoPlumbing)
    return
  }
  if (h.future[h.future.length - 1]?.kind === "ceiling") {
    stepCeiling(redoCeilingPlan)
    return
  }
  if (h.future[h.future.length - 1]?.kind === "switching") {
    stepLines(redoSwitchingLines)
    return
  }
  if (h.future[h.future.length - 1]?.kind === "switches") {
    stepSwitches(redoSwitches)
    return
  }
  if (h.future[h.future.length - 1]?.kind === "exhausts") {
    stepExhausts(redoExhausts)
    return
  }
  if (h.future[h.future.length - 1]?.kind === "callouts") {
    stepCallouts(redoCallouts)
    return
  }
  if (h.future[h.future.length - 1]?.kind === "notes") {
    stepNotes(redoNotes)
    return
  }
  if (h.future[h.future.length - 1]?.kind === "rough") {
    stepRough(redoRough)
    return
  }
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
    // выделенная выноска удаляется одним шагом истории на любом плане
    if (calloutTool.selectedId() !== null) {
      if (!calloutTool.dragging()) calloutTool.deleteSelected()
      return
    }
    if (onFurniture()) {
      if (!itemTool.dragging() && !dimDrag && !panDrag) deleteFurnitureSelection()
      return
    }
    if (onRough()) {
      if (plasterTool.dragging()) return
      closeRoughEditor()
      if (!plasterTool.deleteSelected() && !rightAngleTool.deleteSelected()) screedTool.deleteSelected()
      closeRoughPanels()
      resumePlasterTool()
      return
    }
    // мебель и подложка не удаляются: Delete удаляет выделенную метку линии, выключатель, вытяжку, объект освещения или потолок
    if (onCeiling()) {
      if (lightTool.dragging() || switchTool.dragging() || exhaustTool.dragging()) return
      closeCeilingEditor()
      closeLightEditor()
      closeLineEditor()
      closeSwitchEditor()
      if (!lineTool.deleteSelected() && !switchTool.deleteSelected() && !exhaustTool.deleteSelected() && !lightTool.deleteSelected()) ceilingTool.deleteSelected()
      resetCeiling()
      resetLines()
      resetSwitches()
      resetExhausts()
      return
    }
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
  if (e.key === "Escape" && onRough()) {
    const action = escapeAction({
      tool,
      gestureActive: plasterTool.dragging(),
      dimensionDraft: false,
      calloutDraft: calloutTool.hasDraft(),
      hasSelection: plasterTool.selectedId() !== null || screedTool.selectedId() !== null || rightAngleTool.selectedId() !== null || calloutTool.selectedId() !== null,
    })
    if (action === "end-gesture") plasterTool.cancel()
    else if (action === "cancel-callout-draft") calloutTool.cancelDraft()
    else if (action === "clear-selection") {
      calloutTool.deselect()
      clearRoughSelection()
      resumePlasterTool()
    } else if (action === "deactivate-tool") setTool("none")
    return
  }
  if (e.key === "Escape" && onCeiling()) {
    const action = escapeAction({
      tool,
      gestureActive: lightTool.dragging() || switchTool.dragging() || exhaustTool.dragging(),
      dimensionDraft: false,
      calloutDraft: calloutTool.hasDraft(),
      hasSelection:
        ceilingTool.selectedId() !== null || lightTool.selectedId() !== null || lineTool.selectedId() !== null || switchTool.selectedId() !== null || exhaustTool.selectedId() !== null || calloutTool.selectedId() !== null,
    })
    if (action === "end-gesture") {
      resetCeiling()
      resetSwitches()
      resetExhausts()
    } else if (action === "cancel-callout-draft") calloutTool.cancelDraft()
    else if (action === "clear-selection") {
      calloutTool.deselect()
      resetCeiling()
      resetLines()
      resetSwitches()
      resetExhausts()
    } else if (action === "deactivate-tool") setTool("none")
    return
  }
  if (e.key === "Escape" && onDemolition()) {
    const action = escapeAction({
      tool,
      gestureActive: demolitionTool.dragging(),
      dimensionDraft: false,
      calloutDraft: calloutTool.hasDraft(),
      hasSelection: demolitionTool.selectedId() !== null || calloutTool.selectedId() !== null,
    })
    if (action === "end-gesture") demolitionTool.cancel()
    else if (action === "cancel-callout-draft") calloutTool.cancelDraft()
    else if (action === "clear-selection") {
      demolitionTool.clearSelection()
      calloutTool.deselect()
      redraw()
      resumeDemolitionTool()
    } else if (action === "deactivate-tool") setTool("none")
    return
  }
  if (e.key === "Escape") {
    const action = escapeAction({
      tool,
      gestureActive: !!chainStart,
      dimensionDraft: !!(dimDraft.a || dimDraft.b),
      calloutDraft: calloutTool.hasDraft(),
      hasSelection: selectedDimensions.length + selectedWalls.length + selectedDoorways.length + selectedBatteries.length > 0 || selectedCommunication !== null || calloutTool.selectedId() !== null || selectedRoom !== null || itemTool.hasSelection(),
    })
    if (action === "end-gesture") endChain()
    else if (action === "cancel-dimension-draft") {
      dimDraft = emptyDraft()
      redraw()
    } else if (action === "cancel-callout-draft") calloutTool.cancelDraft()
    else if (action === "clear-selection") clearSelection()
    else if (action === "deactivate-tool") setTool("none")
  }
  if (e.key !== "ArrowUp" && e.key !== "ArrowDown" && e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
  if (e.target instanceof HTMLInputElement) return
  // на плане «Мебель» стрелки сдвигают выделенные столы, без выделения ничего не меняют (материал стены не переключается)
  if (onFurniture()) {
    if (!itemTool.hasSelection() || itemTool.dragging() || calloutTool.selectedId() !== null) return
    e.preventDefault()
    const direction = e.key === "ArrowUp" ? "up" : e.key === "ArrowDown" ? "down" : e.key === "ArrowLeft" ? "left" : "right"
    if (itemTool.nudge(direction, e.shiftKey)) redraw()
    return
  }
  // на плане «Демонтаж» нет стен, материалов и элементов: стрелки ничего не двигают и не переключают
  if (onDemolition() || onRough() || onCeiling()) return
  if (groupMove || endpointDrag || panDrag || dimDrag || doorwayTool.dragging() || communicationTool.dragging() || batteryTool.dragging()) return
  // выделенная коммуникация и выноска стрелками не двигаются и материал не переключается (spec communications)
  if (selectedCommunication || calloutTool.selectedId() !== null || selectedRoom !== null) return
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
    const applied = moveWallsBounded(solid(), selectedWalls, delta, { ortho, doorways, communications: communicationsOf(), batteries })
    if (applied.x === 0 && applied.y === 0) return
    if (!nudgeBurst) pushSnapshot(before)
    nudgeBurst = true
    dirty = true
    redraw()
    return
  }
  if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return
  // у стен гипсокартона материала нет: без выделения стрелки на плане «Реконструкция» ничего не меняют; на «Сантехнике» стен нет
  if (onReconstruction() || onPlumbing()) return
  const delta = e.key === "ArrowUp" ? -1 : 1
  const idx = MATERIALS.findIndex((m) => m.id === wallMaterial)
  setWallMaterial(MATERIALS[(idx + delta + MATERIALS.length) % MATERIALS.length].id)
})

window.addEventListener("resize", redraw)
// не успевший записаться вид дописывается при закрытии и скрытии страницы
window.addEventListener("pagehide", () => viewSave.flush())
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") viewSave.flush()
})
loadWorking()
syncThicknessBox()
syncToolUI()
renderTabs()
renderPlanSwitch()
applyTheme()
