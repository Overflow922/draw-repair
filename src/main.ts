import "./style.css"
import { endpointAt, hitWall, moveEndpoint, pointsEqual, snap, zoomAt } from "./geometry"
import { render } from "./render"
import { GRID_STEP_CM, PX_PER_CM, SNAP_RADIUS_PX, WALL_TYPES } from "./types"
import type { Point, Unit, View, Wall, WallType } from "./types"

const canvas = document.querySelector<HTMLCanvasElement>("#canvas")!
const thicknessInput = document.querySelector<HTMLInputElement>("#thickness")!
const thicknessUnitLabel = document.querySelector<HTMLElement>("#thickness-unit")!
const lengthInput = document.querySelector<HTMLInputElement>("#length")!
const unitRow = document.querySelector<HTMLElement>("#unit-row")!
const wallTypesRow = document.querySelector<HTMLElement>("#wall-types")!
const orthoToggle = document.querySelector<HTMLButtonElement>("#ortho-toggle")!

const walls: Wall[] = []
let chainStart: Point | null = null
let cursor: Point | null = null
let thicknessCm = 20
let wallType: WallType = "partition"
let unit: Unit = "mm"
let lengthDirty = false
let view: View = { zoom: 1, pan: { x: 0, y: 0 } }
let selectedWall: Wall | null = null
let endpointDrag: { wall: Wall; end: "a" | "b" } | null = null
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
  if (cm) moveEndpoint(walls, selectedWall, "b", { x: a.x + ((b.x - a.x) / cm) * len, y: a.y + ((b.y - a.y) / cm) * len })
}

function updateLengthBox(): void {
  if (lengthDirty) return
  const cm = liveLengthCm()
  lengthInput.value = cm === null ? "" : formatCm(cm, unit)
  if (document.activeElement === lengthInput) lengthInput.select()
}

function redraw(): void {
  const p = previewPoint()
  render(canvas, walls, chainStart && p ? { a: chainStart, b: p, thicknessCm, type: wallType } : null, unit, view, selectedWall)
  updateLengthBox()
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
    if (!pointsEqual(chainStart, end)) walls.push({ a: chainStart, b: end, thicknessCm, type: wallType })
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
    if (!pointsEqual(next, other)) moveEndpoint(walls, wall, end, next)
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
  const end = endpointAt(toWorld(e), selectedWall, SNAP_RADIUS_PX / (PX_PER_CM * view.zoom))
  if (!end) return
  endpointDrag = { wall: selectedWall, end }
  suppressClick = true
  canvas.setPointerCapture(e.pointerId)
})

canvas.addEventListener("pointerup", (e) => {
  if (endpointDrag) {
    if (e.button === 0) endpointDrag = null
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
  if (selectedWall) {
    selectedWall.thicknessCm = thicknessCm
    redraw()
  }
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
  if (selectedWall) selectedWall.type = t
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

window.addEventListener("keydown", (e) => {
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
redraw()
