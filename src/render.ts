import { pointsEqual, visibleWorld } from "./geometry"
import { GRID_STEP_CM, PX_PER_CM, WALL_TYPES } from "./types"
import type { Unit, View, Wall } from "./types"

export function render(canvas: HTMLCanvasElement, walls: Wall[], preview: Wall | null, unit: Unit, view: View): void {
  const dpr = window.devicePixelRatio || 1
  const w = canvas.clientWidth
  const h = canvas.clientHeight
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
  }
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)
  const k = PX_PER_CM * view.zoom
  const { min, max } = visibleWorld(view, w, h, PX_PER_CM)
  ctx.save()
  ctx.scale(k, k)
  ctx.translate(-view.pan.x, -view.pan.y)
  ctx.strokeStyle = "#e0e0e0"
  ctx.lineWidth = 1 / k
  ctx.beginPath()
  for (let x = Math.ceil(min.x / GRID_STEP_CM) * GRID_STEP_CM; x <= max.x; x += GRID_STEP_CM) {
    ctx.moveTo(x, min.y)
    ctx.lineTo(x, max.y)
  }
  for (let y = Math.ceil(min.y / GRID_STEP_CM) * GRID_STEP_CM; y <= max.y; y += GRID_STEP_CM) {
    ctx.moveTo(min.x, y)
    ctx.lineTo(max.x, y)
  }
  ctx.stroke()
  ctx.lineCap = "square"
  for (const wall of walls) drawWall(ctx, wall, 1)
  if (preview) drawWall(ctx, preview, 0.4)
  ctx.restore()
  ctx.font = "14px sans-serif"
  ctx.textAlign = "center"
  ctx.textBaseline = "bottom"
  for (const wall of walls) drawLengthLabel(ctx, wall, formatLength(wall, unit), "#333", view)
  if (preview && !pointsEqual(preview.a, preview.b))
    drawLengthLabel(ctx, preview, formatLength(preview, unit), "#555", view)
}

function formatLength(wall: Wall, unit: Unit): string {
  const cm = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y)
  if (unit === "cm") return `${Math.round(cm)} см`
  if (unit === "mm") return `${Math.round(cm * 10)} мм`
  return `${(Math.round(cm) / 100).toString().replace(".", ",")} м`
}

function drawWall(ctx: CanvasRenderingContext2D, wall: Wall, alpha: number): void {
  ctx.globalAlpha = alpha
  ctx.strokeStyle = WALL_TYPES.find((t) => t.id === wall.type)?.color ?? "#333"
  ctx.lineWidth = wall.thicknessCm
  ctx.beginPath()
  ctx.moveTo(wall.a.x, wall.a.y)
  ctx.lineTo(wall.b.x, wall.b.y)
  ctx.stroke()
  ctx.globalAlpha = 1
}

function drawLengthLabel(ctx: CanvasRenderingContext2D, wall: Wall, text: string, color: string, view: View): void {
  let angle = Math.atan2(wall.b.y - wall.a.y, wall.b.x - wall.a.x)
  if (angle > Math.PI / 2 || angle < -Math.PI / 2) angle += Math.PI
  const k = PX_PER_CM * view.zoom
  ctx.save()
  ctx.translate(((wall.a.x + wall.b.x) / 2 - view.pan.x) * k, ((wall.a.y + wall.b.y) / 2 - view.pan.y) * k)
  ctx.rotate(angle)
  const y = -(wall.thicknessCm * k) / 2 - 4
  ctx.lineWidth = 4
  ctx.strokeStyle = "#fff"
  ctx.strokeText(text, 0, y)
  ctx.fillStyle = color
  ctx.fillText(text, 0, y)
  ctx.restore()
}
