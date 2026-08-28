import "./style.css"
import { pointsEqual, snap } from "./geometry"
import { render } from "./render"
import { GRID_STEP_CM, PX_PER_CM, SNAP_RADIUS_PX, WALL_TYPES } from "./types"
import type { Point, Unit, Wall, WallType } from "./types"

const canvas = document.querySelector<HTMLCanvasElement>("#canvas")!
const thicknessInput = document.querySelector<HTMLInputElement>("#thickness")!
const thicknessUnitLabel = document.querySelector<HTMLElement>("#thickness-unit")!
const lengthInput = document.querySelector<HTMLInputElement>("#length")!
const unitRow = document.querySelector<HTMLElement>("#unit-row")!
const wallTypesRow = document.querySelector<HTMLElement>("#wall-types")!

const walls: Wall[] = []
let chainStart: Point | null = null
let cursor: Point | null = null
let thicknessCm = 20
let wallType: WallType = "partition"
let unit: Unit = "mm"
let lengthDirty = false

const UNIT_TO_CM: Record<Unit, number> = { m: 100, cm: 1, mm: 0.1 }
const UNIT_LABEL: Record<Unit, string> = { m: "м", cm: "см", mm: "мм" }

function formatCm(cm: number, u: Unit): string {
  if (u === "m") return (Math.round(cm) / 100).toString()
  if (u === "cm") return String(Math.round(cm))
  return String(Math.round(cm / UNIT_TO_CM[u]))
}

function syncThicknessBox(): void {
  thicknessInput.value = formatCm(thicknessCm, unit)
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

function updateLengthBox(): void {
  if (lengthDirty) return
  const cm = previewLengthCm()
  lengthInput.value = cm === null ? "" : formatCm(cm, unit)
  if (document.activeElement === lengthInput) lengthInput.select()
}

function redraw(): void {
  const p = previewPoint()
  render(canvas, walls, chainStart && p ? { a: chainStart, b: p, thicknessCm, type: wallType } : null, unit)
  updateLengthBox()
}

function toSnappedPoint(e: MouseEvent): Point {
  const r = canvas.getBoundingClientRect()
  return snap(
    { x: (e.clientX - r.left) / PX_PER_CM, y: (e.clientY - r.top) / PX_PER_CM },
    walls,
    GRID_STEP_CM,
    SNAP_RADIUS_PX / PX_PER_CM,
    chainStart ?? undefined,
  )
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

canvas.addEventListener("pointermove", (e) => {
  cursor = toSnappedPoint(e)
  redraw()
})

canvas.addEventListener("click", (e) => commitPoint(toSnappedPoint(e)))

lengthInput.addEventListener("focus", () => lengthInput.select())

lengthInput.addEventListener("input", () => {
  lengthDirty = true
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
  if (Number.isFinite(v) && v > 0) thicknessCm = v * UNIT_TO_CM[unit]
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
  wallTypesRow.querySelectorAll(".wall-type").forEach((b) => b.classList.toggle("active", b.getAttribute("data-type") === t))
  redraw()
}

wallTypesRow.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".wall-type")
  if (btn) setWallType(btn.dataset.type as WallType)
})

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") endChain()
  if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return
  if ((e.target as HTMLElement) === thicknessInput) return
  const delta = e.key === "ArrowUp" ? -1 : 1
  const idx = WALL_TYPES.findIndex((t) => t.id === wallType)
  setWallType(WALL_TYPES[(idx + delta + WALL_TYPES.length) % WALL_TYPES.length].id)
})

window.addEventListener("resize", redraw)
syncThicknessBox()
redraw()
