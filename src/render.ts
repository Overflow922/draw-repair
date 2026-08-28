import { pointsEqual } from "./geometry"
import { GRID_STEP_CM, PX_PER_CM, WALL_TYPES } from "./types"
import type { Unit, Wall } from "./types"

export function render(canvas: HTMLCanvasElement, walls: Wall[], preview: Wall | null, unit: Unit): void {
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
  const step = GRID_STEP_CM * PX_PER_CM
  ctx.strokeStyle = "#e0e0e0"
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let x = step; x < w; x += step) {
    ctx.moveTo(x + 0.5, 0)
    ctx.lineTo(x + 0.5, h)
  }
  for (let y = step; y < h; y += step) {
    ctx.moveTo(0, y + 0.5)
    ctx.lineTo(w, y + 0.5)
  }
  ctx.stroke()
  ctx.lineCap = "square"
  for (const wall of walls) drawWall(ctx, wall, 1)
  if (preview) drawWall(ctx, preview, 0.4)
  ctx.font = "14px sans-serif"
  ctx.textAlign = "center"
  ctx.textBaseline = "bottom"
  for (const wall of walls) drawLengthLabel(ctx, wall, formatLength(wall, unit), "#333")
  if (preview && !pointsEqual(preview.a, preview.b))
    drawLengthLabel(ctx, preview, formatLength(preview, unit), "#555")
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
  ctx.lineWidth = wall.thicknessCm * PX_PER_CM
  ctx.beginPath()
  ctx.moveTo(wall.a.x * PX_PER_CM, wall.a.y * PX_PER_CM)
  ctx.lineTo(wall.b.x * PX_PER_CM, wall.b.y * PX_PER_CM)
  ctx.stroke()
  ctx.globalAlpha = 1
}

function drawLengthLabel(ctx: CanvasRenderingContext2D, wall: Wall, text: string, color: string): void {
  let angle = Math.atan2(wall.b.y - wall.a.y, wall.b.x - wall.a.x)
  if (angle > Math.PI / 2 || angle < -Math.PI / 2) angle += Math.PI
  ctx.save()
  ctx.translate(((wall.a.x + wall.b.x) / 2) * PX_PER_CM, ((wall.a.y + wall.b.y) / 2) * PX_PER_CM)
  ctx.rotate(angle)
  const y = -(wall.thicknessCm * PX_PER_CM) / 2 - 4
  ctx.lineWidth = 4
  ctx.strokeStyle = "#fff"
  ctx.strokeText(text, 0, y)
  ctx.fillStyle = color
  ctx.fillText(text, 0, y)
  ctx.restore()
}
