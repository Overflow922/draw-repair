import "./style.css"
import { cloneScene, drawingHistory, loadHistory, record, recordSnapshot, redoEntry, saveHistory, undoEntry } from "./history"
import type { Scene } from "./history"
import { dimGeometry, dimHitDistance, dimLevelSnap, dimensionOffsetAt, distanceToWall, handleAt, healJoints, hitWall, jointPullback, jointedWalls, moveEndpoint, moveWall, nearestEdgeIntersection, dimPointPoint, pointsEqual, snap, zoomAt } from "./geometry"
import type { DimGeometry } from "./geometry"
import { drawPatternPreview, render } from "./render"
import { availableFormats, exportDrawing, PAGE_FORMATS_MM } from "./export/pdf"
import type { PageFormat } from "./export/pdf"
import { loadStore, saveStore } from "./storage"
import { GRID_STEP_CM, MATERIALS, PX_PER_CM, SNAP_RADIUS_PX } from "./types"
import type { Dimension, DimPoint, Drawing, Material, Point, Unit, View, Wall } from "./types"

const canvas = document.querySelector<HTMLCanvasElement>("#canvas")!
const canvasWrap = document.querySelector<HTMLElement>("#canvas-wrap")!
const thicknessInput = document.querySelector<HTMLInputElement>("#thickness")!
const thicknessUnitLabel = document.querySelector<HTMLElement>("#thickness-unit")!
const lengthInput = document.querySelector<HTMLInputElement>("#length")!
const unitRow = document.querySelector<HTMLElement>("#unit-row")!
const wallTypesRow = document.querySelector<HTMLElement>("#wall-types")!
const orthoToggle = document.querySelector<HTMLButtonElement>("#ortho-toggle")!
const tabsEl = document.querySelector<HTMLElement>("#tabs")!
const tabAdd = document.querySelector<HTMLButtonElement>("#tab-add")!
const undoBtn = document.querySelector<HTMLButtonElement>("#undo-btn")!
const redoBtn = document.querySelector<HTMLButtonElement>("#redo-btn")!
const toolWallBtn = document.querySelector<HTMLButtonElement>("#tool-wall")!
const toolDimensionBtn = document.querySelector<HTMLButtonElement>("#tool-dimension")!
const toolEraserBtn = document.querySelector<HTMLButtonElement>("#tool-eraser")!
const wallPanel = document.querySelector<HTMLElement>("#wall-panel")!
const pdfScale = document.querySelector<HTMLSelectElement>("#pdf-scale")!
const pdfFormat = document.querySelector<HTMLSelectElement>("#pdf-format")!
const pdfExportBtn = document.querySelector<HTMLButtonElement>("#pdf-export")!
const dimPanel = document.querySelector<HTMLElement>("#dim-panel")!
const dimOffsetInput = document.querySelector<HTMLInputElement>("#dim-offset")!
const dimOffsetUnitLabel = document.querySelector<HTMLElement>("#dim-offset-unit")!
const dimValueInput = document.querySelector<HTMLInputElement>("#dim-value")!

const loaded = loadStore()
const readOnly = loaded.readOnly
const store = loaded.store
const loadedHistory = loadHistory()
const historyReadOnly = loadedHistory.readOnly
const historyStore = loadedHistory.history
const current = () => store.drawings.find((d) => d.id === store.activeId)!
let walls: Wall[] = current().walls
let dimensions: Dimension[] = current().dimensions
let chainStart: Point | null = null
let cursor: Point | null = null
let thicknessCm = 20
let wallMaterial: Material = "brick"
let unit: Unit = "mm"
let lengthDirty = false
let view: View = current().view
let dirty = false
for (const d of store.drawings) if (healJoints(d.walls)) dirty = true
let selectedWall: Wall | null = null
let selectedDimension: Dimension | null = null
let endpointDrag: { wall: Wall; end: "a" | "b"; base: Point; snapshot: Scene } | null = null
let wallMove: { wall: Wall; baseA: Point; baseB: Point; grab: Point; others: Wall[]; snapshot: Scene } | null = null
let dimDraft: { a: DimPoint | null; b: DimPoint | null } = { a: null, b: null }
let dimDrag: { dim: Dimension; baseOffset: number; snapshot: Scene } | null = null
let suppressClick = false
let ortho = false
let wallPanelOpen = false
type Tool = "wall" | "dimension" | "eraser" | "none"
let tool: Tool = "wall"

const emptyDraft = (): { a: DimPoint | null; b: DimPoint | null } => ({ a: null, b: null })

const endPoint = (end: DimPoint): Point | null => dimPointPoint(end, walls)

const radiusCm = (): number => SNAP_RADIUS_PX / (PX_PER_CM * view.zoom)

function setWallPanel(open: boolean): void {
  wallPanelOpen = open
  wallPanel.classList.toggle("open", open)
}

function setDimPanel(open: boolean): void {
  dimPanel.classList.toggle("open", open)
}

function selectDimension(dim: Dimension): void {
  selectedDimension = dim
  selectedWall = null
  lengthDirty = false
  setWallPanel(false)
  setDimPanel(true)
  redraw()
}

function clearDimSelection(): void {
  if (!selectedDimension) return
  selectedDimension = null
  setDimPanel(false)
  redraw()
}

function syncToolUI(): void {
  toolWallBtn.classList.toggle("active", tool === "wall")
  toolDimensionBtn.classList.toggle("active", tool === "dimension")
  toolEraserBtn.classList.toggle("active", tool === "eraser")
  canvas.classList.toggle("tool-eraser", tool === "eraser")
}

function setTool(next: Tool): void {
  if (tool === next) return
  tool = next
  chainStart = null
  dimDraft = emptyDraft()
  lengthDirty = false
  selectedWall = null
  selectedDimension = null
  suppressClick = false
  setWallPanel(false)
  setDimPanel(false)
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
  thicknessInput.value = formatCm(selectedWall?.thicknessCm ?? thicknessCm, unit)
  thicknessUnitLabel.textContent = UNIT_LABEL[unit]
}

function syncDimPanel(): void {
  dimOffsetUnitLabel.textContent = UNIT_LABEL[unit]
  if (!selectedDimension) return
  const a = endPoint(selectedDimension.from)
  const b = endPoint(selectedDimension.to)
  dimValueInput.value = a && b ? formatCm(Math.hypot(b.x - a.x, b.y - a.y), unit) : ""
  if (dimDrag || document.activeElement !== dimOffsetInput) dimOffsetInput.value = formatCm(selectedDimension.offset, unit)
}

function typedLengthCm(): number | null {
  const v = parseFloat(lengthInput.value.replace(",", "."))
  return Number.isFinite(v) && v > 0 ? v * UNIT_TO_CM[unit] : null
}

function previewLengthCm(): number | null {
  if (!chainStart || !cursor || pointsEqual(chainStart, cursor)) return null
  return Math.hypot(cursor.x - chainStart.x, cursor.y - chainStart.y)
}

function previewPoint(): Point | null {
  if (!chainStart || !cursor) return null
  const target = lengthDirty ? typedLengthCm() : null
  const cm = previewLengthCm()
  if (target === null || cm === null) return cursor
  const k = target / cm
  return { x: chainStart.x + (cursor.x - chainStart.x) * k, y: chainStart.y + (cursor.y - chainStart.y) * k }
}

function liveLengthCm(): number | null {
  if (chainStart) return previewLengthCm()
  if (!selectedWall || pointsEqual(selectedWall.a, selectedWall.b)) return null
  return Math.hypot(selectedWall.b.x - selectedWall.a.x, selectedWall.b.y - selectedWall.a.y)
}

function resizeSelected(): void {
  const len = typedLengthCm()
  if (!len || !selectedWall) return
  const { a, b } = selectedWall
  const cm = Math.hypot(b.x - a.x, b.y - a.y)
  if (!cm) return
  const end = { x: a.x + ((b.x - a.x) / cm) * len, y: a.y + ((b.y - a.y) / cm) * len }
  if (pointsEqual(end, b)) return
  record(drawingHistory(historyStore, store.activeId), { walls, dimensions })
  dirty = true
  moveEndpoint(walls, selectedWall, "b", end)
}

function updateLengthBox(): void {
  if (lengthDirty) return
  const cm = liveLengthCm()
  lengthInput.value = cm === null ? "" : formatCm(cm, unit)
  if (document.activeElement === lengthInput) lengthInput.select()
}

function syncHistoryButtons(): void {
  const h = drawingHistory(historyStore, store.activeId)
  undoBtn.disabled = h.past.length === 0
  redoBtn.disabled = h.future.length === 0
}

function redraw(): void {
  const p = previewPoint()
  const target = tool === "eraser" && cursor ? eraserTarget(cursor) : { wall: null, dim: null }
  const draft = dimDraftGeometry()
  const snapHit = tool === "dimension" && cursor && (!dimDraft.a || !dimDraft.b) ? nearestEdgeIntersection(cursor, walls, radiusCm()) : null
  let previewWall: Wall | null = null
  if (chainStart && p) {
    const dx = p.x - chainStart.x
    const dy = p.y - chainStart.y
    const len = Math.hypot(dx, dy)
    const a = len > 0 ? jointPullback(chainStart, walls, thicknessCm / 2, { x: dx / len, y: dy / len }) : chainStart
    previewWall = { id: "", a, b: p, thicknessCm, type: wallMaterial }
  }
  render(canvas, walls, previewWall, unit, view, selectedWall, {
    hover: target.wall,
    hoverDim: target.dim,
    dimensions,
    dimDraft: draft,
    dimRubber: !dimDraft.a || dimDraft.b || !cursor ? null : draftRubber(snapHit?.point ?? cursor),
    dimSnap: snapHit?.point ?? null,
    selectedDim: selectedDimension,
  })
  updateLengthBox()
  syncDimPanel()
  syncHistoryButtons()
  syncFormats()
  if (dirty) {
    dirty = false
    if (!readOnly) saveStore(store)
    if (!readOnly && !historyReadOnly) saveHistory(historyStore)
  }
}

function eraserTarget(p: Point): { wall: Wall | null; dim: Dimension | null } {
  const tol = radiusCm()
  let wall: Wall | null = hitWall(p, walls, tol)
  let wallDist = wall ? distanceToWall(p, wall) : Infinity
  let dim: Dimension | null = null
  let dimDist = Infinity
  for (const d of dimensions) {
    const dd = dimHitDistance(p, d, walls, 2)
    if (dd !== null && dd <= tol && dd < dimDist) {
      dim = d
      dimDist = dd
    }
  }
  if (dim && dimDist < wallDist) wall = null
  else dim = null
  return { wall, dim }
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
  const available = availableFormats(walls, dimensions, current().scale)
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
  return snap(toWorld(e), walls, GRID_STEP_CM, SNAP_RADIUS_PX / (PX_PER_CM * view.zoom), ortho ? (chainStart ?? undefined) : undefined)
}

function commitPoint(p: Point): void {
  cursor = p
  if (chainStart) {
    const target = lengthDirty ? typedLengthCm() : null
    const cm = previewLengthCm()
    const dir = cm !== null && !pointsEqual(chainStart, p)
      ? { x: (p.x - chainStart.x) / cm, y: (p.y - chainStart.y) / cm }
      : null
    const end = target !== null && dir ? { x: chainStart.x + dir.x * target, y: chainStart.y + dir.y * target } : p
    if (!pointsEqual(chainStart, end)) {
      const a = jointPullback(chainStart, walls, thicknessCm / 2, dir ?? { x: 1, y: 0 })
      record(drawingHistory(historyStore, store.activeId), { walls, dimensions })
      dirty = true
      walls.push({ id: crypto.randomUUID(), a, b: end, thicknessCm, type: wallMaterial })
    }
    chainStart = end
  } else {
    chainStart = p
  }
  lengthDirty = false
  lengthInput.focus()
  redraw()
}

let panDrag: { start: Point; pan: Point } | null = null

canvas.addEventListener("pointermove", (e) => {
  if (wallMove) {
    const { wall, baseA, grab, others } = wallMove
    const p = toWorld(e)
    const next = snap(
      { x: baseA.x + p.x - grab.x, y: baseA.y + p.y - grab.y },
      others,
      GRID_STEP_CM,
      radiusCm(),
      ortho ? baseA : undefined,
    )
    moveWall(walls, wall, { x: next.x - wall.a.x, y: next.y - wall.a.y })
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
    const { wall, end } = endpointDrag
    const other = end === "a" ? wall.b : wall.a
    const next = snap(
      toWorld(e),
      walls.filter((w) => w !== wall),
      GRID_STEP_CM,
      radiusCm(),
      ortho ? other : undefined,
    )
    if (!pointsEqual(next, other)) {
      dirty = true
      moveEndpoint(walls, wall, end, next)
    }
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
  cursor = toSnappedPoint(e)
  redraw()
})

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
  if (selectedWall) {
    const sel = selectedWall
    const handle = handleAt(toWorld(e), sel, radiusCm())
    if (handle) {
      suppressClick = true
      const p = toWorld(e)
      if (handle === "mid") {
        const jointed = (c: Wall) => jointedWalls(c, sel)
        wallMove = { wall: sel, baseA: sel.a, baseB: sel.b, grab: p, others: walls.filter((c) => c !== sel && !jointed(c)), snapshot: cloneScene({ walls, dimensions }) }
      } else endpointDrag = { wall: sel, end: handle, base: sel[handle], snapshot: cloneScene({ walls, dimensions }) }
      canvas.setPointerCapture(e.pointerId)
      return
    }
  }
  if (tool !== "eraser") {
    const p = toWorld(e)
    const dim = dimensions.find((d) => (dimHitDistance(p, d, walls, 2) ?? Infinity) <= radiusCm())
    if (dim) {
      dimDrag = { dim, baseOffset: dim.offset, snapshot: cloneScene({ walls, dimensions }) }
      suppressClick = true
      if (!dimDraft.a && !dimDraft.b) selectDimension(dim)
      canvas.setPointerCapture(e.pointerId)
    }
  }
})

canvas.addEventListener("pointerup", (e) => {
  if (endpointDrag) {
    if (e.button === 0) {
      if (!pointsEqual(endpointDrag.wall[endpointDrag.end], endpointDrag.base)) {
        recordSnapshot(drawingHistory(historyStore, store.activeId), endpointDrag.snapshot)
        dirty = true
      }
      endpointDrag = null
    }
    return
  }
  if (wallMove) {
    if (e.button === 0) {
      if (!pointsEqual(wallMove.wall.a, wallMove.baseA)) {
        recordSnapshot(drawingHistory(historyStore, store.activeId), wallMove.snapshot)
        dirty = true
      }
      wallMove = null
    }
    return
  }
  if (dimDrag) {
    if (e.button === 0) {
      if (dimDrag.dim.offset !== dimDrag.baseOffset) {
        recordSnapshot(drawingHistory(historyStore, store.activeId), dimDrag.snapshot)
        dirty = true
      }
      dimDrag = null
    }
    return
  }
  if (!panDrag || e.button !== 1) return
  panDrag = null
  cursor = toSnappedPoint(e)
  redraw()
})

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
  if (tool === "eraser") {
    const { wall, dim } = eraserTarget(p)
    if (wall) deleteWall(wall)
    else if (dim) deleteDimension(dim)
    return
  }
  if (tool === "dimension") {
    placeDimension(p)
    return
  }
  if (!chainStart) {
    const hit = hitWall(p, walls, radiusCm())
    if (hit) {
      clearDimSelection()
      selectedWall = hit
      lengthDirty = false
      syncThicknessBox()
      setWallMaterial(hit.type)
      setWallPanel(true)
      return
    }
    selectedWall = null
    clearDimSelection()
    if (tool !== "wall") {
      redraw()
      return
    }
  }
  commitPoint(p)
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
  record(drawingHistory(historyStore, store.activeId), { walls, dimensions })
  dimensions.push({ from: dimDraft.a, to: dimDraft.b, offset: dimLevelSnap(p, axis, dimensions, walls, radiusCm())?.offset ?? dimensionOffsetAt(p, axis) })
  dimDraft = emptyDraft()
  dirty = true
  redraw()
}

lengthInput.addEventListener("focus", () => lengthInput.select())

lengthInput.addEventListener("input", () => {
  lengthDirty = true
  if (selectedWall) resizeSelected()
  redraw()
})

lengthInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && chainStart) commitPoint(cursor ?? chainStart)
})

function endChain(): void {
  if (!chainStart) return
  chainStart = null
  lengthDirty = false
  lengthInput.blur()
  redraw()
}

function deleteWall(wall: Wall): void {
  record(drawingHistory(historyStore, store.activeId), { walls, dimensions })
  walls.splice(walls.indexOf(wall), 1)
  dimensions = dimensions.filter((d) =>
    d.from.a.wallId !== wall.id && d.from.b.wallId !== wall.id &&
    d.to.a.wallId !== wall.id && d.to.b.wallId !== wall.id)
  current().dimensions = dimensions
  if (selectedDimension && !dimensions.includes(selectedDimension)) {
    selectedDimension = null
    setDimPanel(false)
  }
  if (selectedWall === wall) {
    selectedWall = null
    lengthDirty = false
    syncThicknessBox()
  }
  dirty = true
  redraw()
}

function deleteDimension(dim: Dimension): void {
  record(drawingHistory(historyStore, store.activeId), { walls, dimensions })
  dimensions.splice(dimensions.indexOf(dim), 1)
  if (selectedDimension === dim) {
    selectedDimension = null
    setDimPanel(false)
  }
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
  if (selectedWall && selectedWall.thicknessCm !== thicknessCm) {
    record(drawingHistory(historyStore, store.activeId), { walls, dimensions })
    selectedWall.thicknessCm = thicknessCm
    dirty = true
  }
  redraw()
})

dimOffsetInput.addEventListener("input", () => {
  if (!selectedDimension) return
  const v = parseFloat(dimOffsetInput.value.replace(",", "."))
  if (!Number.isFinite(v)) return
  const next = v * UNIT_TO_CM[unit]
  if (next === selectedDimension.offset) return
  record(drawingHistory(historyStore, store.activeId), { walls, dimensions })
  selectedDimension.offset = next
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
  if (selectedWall && selectedWall.type !== m) {
    record(drawingHistory(historyStore, store.activeId), { walls, dimensions })
    selectedWall.type = m
    dirty = true
  }
  wallTypesRow.querySelectorAll(".wall-type").forEach((b) => b.classList.toggle("active", b.getAttribute("data-material") === m))
  redraw()
}

orthoToggle.addEventListener("click", () => {
  ortho = !ortho
  orthoToggle.classList.toggle("active", ortho)
  redraw()
})

toolWallBtn.addEventListener("click", () => {
  if (tool !== "wall") setTool("wall")
  else setWallPanel(!wallPanelOpen)
})

toolDimensionBtn.addEventListener("click", () => setTool("dimension"))

toolEraserBtn.addEventListener("click", () => setTool("eraser"))

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
  view = current().view
  tool = "wall"
  syncToolUI()
  chainStart = null
  selectedWall = null
  selectedDimension = null
  dimDraft = emptyDraft()
  dimDrag = null
  lengthDirty = false
  endpointDrag = null
  wallMove = null
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
  chainStart = null
  selectedWall = null
  selectedDimension = null
  setDimPanel(false)
  dimDraft = emptyDraft()
  lengthDirty = false
  suppressClick = false
  syncThicknessBox()
}

function undo(): void {
  if (wallMove || endpointDrag || panDrag || dimDrag) return
  const h = drawingHistory(historyStore, store.activeId)
  const e = undoEntry(h, { walls, dimensions })
  if (!e) return
  if (e.kind === "walls") {
    current().walls = e.walls
    current().dimensions = e.dimensions
    walls = e.walls
    dimensions = e.dimensions
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
  if (wallMove || endpointDrag || panDrag || dimDrag) return
  const h = drawingHistory(historyStore, store.activeId)
  const e = redoEntry(h, { walls, dimensions })
  if (!e) return
  if (e.kind === "walls") {
    current().walls = e.walls
    current().dimensions = e.dimensions
    walls = e.walls
    dimensions = e.dimensions
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
  exportDrawing(drawing.walls, drawing.dimensions, unit, drawing.scale, pdfFormat.value as PageFormat, drawing.name)
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
    if (wallMove || endpointDrag || panDrag || dimDrag) return
    if (selectedWall) {
      deleteWall(selectedWall)
      return
    }
    if (selectedDimension) deleteDimension(selectedDimension)
    return
  }
  if (e.key === "Escape") {
    if (chainStart) endChain()
    else if (dimDraft.a || dimDraft.b) {
      dimDraft = emptyDraft()
      redraw()
    } else if (selectedDimension) clearDimSelection()
    else if (tool === "eraser" || tool === "dimension") setTool("none")
    else {
      selectedWall = null
      lengthDirty = false
      redraw()
    }
  }
  if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return
  if ((e.target as HTMLElement) === thicknessInput) return
  const delta = e.key === "ArrowUp" ? -1 : 1
  const idx = MATERIALS.findIndex((m) => m.id === wallMaterial)
  setWallMaterial(MATERIALS[(idx + delta + MATERIALS.length) % MATERIALS.length].id)
})

window.addEventListener("resize", redraw)
syncThicknessBox()
syncToolUI()
for (const btn of wallTypesRow.querySelectorAll<HTMLButtonElement>(".wall-type"))
  drawPatternPreview(btn.querySelector("canvas")!, btn.dataset.material as Material)
renderTabs()
redraw()
