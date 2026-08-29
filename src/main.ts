import "./style.css"
import { cloneWalls, drawingHistory, loadHistory, record, recordSnapshot, redoEntry, saveHistory, undoEntry } from "./history"
import { handleAt, hitWall, moveEndpoint, moveWall, pointsEqual, snap, zoomAt } from "./geometry"
import { render } from "./render"
import { loadStore, saveStore } from "./storage"
import { GRID_STEP_CM, PX_PER_CM, SNAP_RADIUS_PX, WALL_TYPES } from "./types"
import type { Drawing, Point, Unit, View, Wall, WallType } from "./types"

const canvas = document.querySelector<HTMLCanvasElement>("#canvas")!
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

const loaded = loadStore()
const readOnly = loaded.readOnly
const store = loaded.store
const loadedHistory = loadHistory()
const historyReadOnly = loadedHistory.readOnly
const historyStore = loadedHistory.history
const current = () => store.drawings.find((d) => d.id === store.activeId)!
let walls: Wall[] = current().walls
let chainStart: Point | null = null
let cursor: Point | null = null
let thicknessCm = 20
let wallType: WallType = "partition"
let unit: Unit = "mm"
let lengthDirty = false
let view: View = current().view
let dirty = false
let selectedWall: Wall | null = null
let endpointDrag: { wall: Wall; end: "a" | "b"; base: Point; snapshot: Wall[] } | null = null
let wallMove: { wall: Wall; baseA: Point; baseB: Point; grab: Point; others: Wall[]; snapshot: Wall[] } | null = null
let suppressClick = false
let ortho = false

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
  record(drawingHistory(historyStore, store.activeId), walls)
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
  render(canvas, walls, chainStart && p ? { a: chainStart, b: p, thicknessCm, type: wallType } : null, unit, view, selectedWall)
  updateLengthBox()
  syncHistoryButtons()
  if (dirty) {
    dirty = false
    if (!readOnly) saveStore(store)
    if (!readOnly && !historyReadOnly) saveHistory(historyStore)
  }
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
      record(drawingHistory(historyStore, store.activeId), walls)
      dirty = true
      walls.push({ a: chainStart, b: end, thicknessCm, type: wallType })
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
      SNAP_RADIUS_PX / (PX_PER_CM * view.zoom),
      ortho ? baseA : undefined,
    )
    moveWall(walls, wall, { x: next.x - wall.a.x, y: next.y - wall.a.y })
    dirty = true
    redraw()
    return
  }
  if (endpointDrag) {
    const { wall, end } = endpointDrag
    const other = end === "a" ? wall.b : wall.a
    const next = snap(
      toWorld(e),
      walls.filter((w) => w !== wall),
      GRID_STEP_CM,
      SNAP_RADIUS_PX / (PX_PER_CM * view.zoom),
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
  if (e.button !== 0 || !selectedWall) return
  const sel = selectedWall
  const p = toWorld(e)
  const handle = handleAt(p, sel, SNAP_RADIUS_PX / (PX_PER_CM * view.zoom))
  if (!handle) return
  suppressClick = true
  if (handle === "mid") {
    const jointed = (c: Wall) => pointsEqual(c.a, sel.a) || pointsEqual(c.b, sel.a) || pointsEqual(c.a, sel.b) || pointsEqual(c.b, sel.b)
    wallMove = { wall: sel, baseA: sel.a, baseB: sel.b, grab: p, others: walls.filter((c) => c !== sel && !jointed(c)), snapshot: cloneWalls(walls) }
  } else endpointDrag = { wall: sel, end: handle, base: sel[handle], snapshot: cloneWalls(walls) }
  canvas.setPointerCapture(e.pointerId)
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
  if (!chainStart) {
    const hit = hitWall(p, walls, SNAP_RADIUS_PX / (PX_PER_CM * view.zoom))
    if (hit) {
      selectedWall = hit
      lengthDirty = false
      syncThicknessBox()
      setWallType(hit.type)
      return
    }
    selectedWall = null
  }
  commitPoint(p)
})

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

canvas.addEventListener("dblclick", endChain)

thicknessInput.addEventListener("input", () => {
  const v = parseFloat(thicknessInput.value.replace(",", "."))
  if (!Number.isFinite(v) || v <= 0) return
  thicknessCm = v * UNIT_TO_CM[unit]
  if (selectedWall && selectedWall.thicknessCm !== thicknessCm) {
    record(drawingHistory(historyStore, store.activeId), walls)
    selectedWall.thicknessCm = thicknessCm
    dirty = true
  }
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

function setWallType(t: WallType): void {
  wallType = t
  if (selectedWall && selectedWall.type !== t) {
    record(drawingHistory(historyStore, store.activeId), walls)
    selectedWall.type = t
    dirty = true
  }
  wallTypesRow.querySelectorAll(".wall-type").forEach((b) => b.classList.toggle("active", b.getAttribute("data-type") === t))
  redraw()
}

orthoToggle.addEventListener("click", () => {
  ortho = !ortho
  orthoToggle.classList.toggle("active", ortho)
  redraw()
})

wallTypesRow.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".wall-type")
  if (btn) setWallType(btn.dataset.type as WallType)
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
  const drawing: Drawing = { id: crypto.randomUUID(), name: nextName(), walls: [], view: { zoom: 1, pan: { x: 0, y: 0 } } }
  store.drawings.push(drawing)
  dirty = true
  activate(drawing.id)
}

function activate(id: string): void {
  store.activeId = id
  walls = current().walls
  view = current().view
  chainStart = null
  selectedWall = null
  lengthDirty = false
  endpointDrag = null
  wallMove = null
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
  lengthDirty = false
  suppressClick = false
  syncThicknessBox()
}

function undo(): void {
  if (wallMove || endpointDrag || panDrag) return
  const h = drawingHistory(historyStore, store.activeId)
  const e = undoEntry(h, walls)
  if (!e) return
  if (e.kind === "walls") {
    current().walls = e.walls
    walls = e.walls
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
  if (wallMove || endpointDrag || panDrag) return
  const h = drawingHistory(historyStore, store.activeId)
  const e = redoEntry(h, walls)
  if (!e) return
  if (e.kind === "walls") {
    current().walls = e.walls
    walls = e.walls
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
  if (e.key === "Escape") {
    if (chainStart) endChain()
    else {
      selectedWall = null
      lengthDirty = false
      redraw()
    }
  }
  if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return
  if ((e.target as HTMLElement) === thicknessInput) return
  const delta = e.key === "ArrowUp" ? -1 : 1
  const idx = WALL_TYPES.findIndex((t) => t.id === wallType)
  setWallType(WALL_TYPES[(idx + delta + WALL_TYPES.length) % WALL_TYPES.length].id)
})

window.addEventListener("resize", redraw)
syncThicknessBox()
renderTabs()
redraw()
