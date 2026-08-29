import { pointsEqual, visibleWorld } from "./geometry"
import { GRID_STEP_CM, PX_PER_CM, normalizeMaterial } from "./types"
import type { Material, Point, Unit, View, Wall } from "./types"

const OUTLINE_PX = 4
const HANDLE_PX = 5
const INK = "#333"
const CONTOUR_PX = 2
const MM = 96 / 25.4
const HATCH_STEP = 3 * MM
const DASHDOT = [3.5 * MM, 1.2 * MM, 0.3 * MM, 1.2 * MM]
const DASHDOT_SMALL = [2.5 * MM, 1 * MM, 0.3 * MM, 1 * MM]

export function render(
  canvas: HTMLCanvasElement,
  walls: Wall[],
  preview: Wall | null,
  unit: Unit,
  view: View,
  selected: Wall | null = null,
): void {
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
  const toScreen = (p: Point): Point => ({ x: (p.x - view.pan.x) * k, y: (p.y - view.pan.y) * k })
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
  ctx.restore()
  if (selected) drawOutline(ctx, selected, k, toScreen)
  for (const wall of walls) drawWall(ctx, wall, 1, toScreen, k)
  if (preview) drawWall(ctx, preview, 0.4, toScreen, k)
  if (selected) drawHandles(ctx, selected, toScreen)
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

function wallPolygon(wall: Wall): Point[] {
  const dx = wall.b.x - wall.a.x
  const dy = wall.b.y - wall.a.y
  const len = Math.hypot(dx, dy) || 1
  const ox = (-dy / len) * wall.thicknessCm * 0.5
  const oy = (dx / len) * wall.thicknessCm * 0.5
  return [
    { x: wall.a.x + ox, y: wall.a.y + oy },
    { x: wall.b.x + ox, y: wall.b.y + oy },
    { x: wall.b.x - ox, y: wall.b.y - oy },
    { x: wall.a.x - ox, y: wall.a.y - oy },
  ]
}

function tracePolygon(ctx: CanvasRenderingContext2D, poly: Point[]): void {
  ctx.beginPath()
  poly.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
  ctx.closePath()
}

function polyBounds(poly: Point[]): [number, number, number, number] {
  const xs = poly.map((p) => p.x)
  const ys = poly.map((p) => p.y)
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
}

function strokeHatch45(ctx: CanvasRenderingContext2D, poly: Point[], dash: number[], phase: number, stride: number): void {
  const [minX, minY, maxX, maxY] = polyBounds(poly)
  const step = HATCH_STEP * Math.SQRT2 * stride
  ctx.setLineDash(dash)
  ctx.beginPath()
  for (let c = minX + minY + phase * HATCH_STEP * Math.SQRT2; c <= maxX + maxY; c += step) {
    ctx.moveTo(minX, c - minX)
    ctx.lineTo(maxX, c - maxX)
  }
  ctx.stroke()
  ctx.setLineDash([])
}

function woodLong(ctx: CanvasRenderingContext2D, a: Point, b: Point, thicknessPx: number): void {
  const len = Math.hypot(b.x - a.x, b.y - a.y)
  if (!len) return
  const ux = (b.x - a.x) / len
  const uy = (b.y - a.y) / len
  const nx = -uy
  const ny = ux
  const amp = 0.6 * MM
  const wave = 8 * MM
  ctx.beginPath()
  for (let off = -thicknessPx / 2 + HATCH_STEP / 2; off <= thicknessPx / 2; off += HATCH_STEP) {
    for (let t = 0; t <= len; t += 2 * MM) {
      const lateral = off + amp * Math.sin((t / wave) * Math.PI * 2)
      const px = a.x + ux * t + nx * lateral
      const py = a.y + uy * t + ny * lateral
      if (t === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
  }
  ctx.stroke()
}

function drawMaterial(
  ctx: CanvasRenderingContext2D,
  mat: Material,
  poly: Point[],
  a: Point,
  b: Point,
  thicknessPx: number,
): void {
  ctx.save()
  tracePolygon(ctx, poly)
  ctx.clip()
  if (mat === "brick") strokeHatch45(ctx, poly, [], 0, 1)
  else if (mat === "concrete") strokeHatch45(ctx, poly, DASHDOT, 0, 1)
  else if (mat === "reinforced") {
    strokeHatch45(ctx, poly, [], 0, 2)
    strokeHatch45(ctx, poly, DASHDOT_SMALL, 1, 2)
  } else woodLong(ctx, a, b, thicknessPx)
  ctx.restore()
}

function drawWall(ctx: CanvasRenderingContext2D, wall: Wall, alpha: number, toScreen: (p: Point) => Point, k: number): void {
  const mat = normalizeMaterial(wall.type)
  const poly = wallPolygon(wall).map(toScreen)
  ctx.globalAlpha = alpha
  ctx.strokeStyle = INK
  ctx.lineWidth = 1
  drawMaterial(ctx, mat, poly, toScreen(wall.a), toScreen(wall.b), wall.thicknessCm * k)
  ctx.lineWidth = CONTOUR_PX
  tracePolygon(ctx, poly)
  ctx.stroke()
  ctx.globalAlpha = 1
}

export function drawPatternPreview(canvas: HTMLCanvasElement, material: Material): void {
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  const w = canvas.width
  const h = canvas.height
  ctx.clearRect(0, 0, w, h)
  ctx.strokeStyle = INK
  ctx.lineWidth = 1
  const poly: Point[] = [
    { x: 1, y: 1 },
    { x: w - 1, y: 1 },
    { x: w - 1, y: h - 1 },
    { x: 1, y: h - 1 },
  ]
  drawMaterial(ctx, material, poly, { x: 1, y: h / 2 }, { x: w - 1, y: h / 2 }, h - 2)
}

function drawOutline(ctx: CanvasRenderingContext2D, wall: Wall, k: number, toScreen: (p: Point) => Point): void {
  const a = toScreen(wall.a)
  const b = toScreen(wall.b)
  ctx.strokeStyle = "rgba(8, 145, 178, 0.5)"
  ctx.lineWidth = wall.thicknessCm * k + OUTLINE_PX * 2
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()
}

function drawHandles(ctx: CanvasRenderingContext2D, wall: Wall, toScreen: (p: Point) => Point): void {
  ctx.fillStyle = "#fff"
  ctx.strokeStyle = "#0f172a"
  ctx.lineWidth = 1.5
  for (const p of [wall.a, wall.b, { x: (wall.a.x + wall.b.x) / 2, y: (wall.a.y + wall.b.y) / 2 }]) {
    const s = toScreen(p)
    ctx.beginPath()
    ctx.arc(s.x, s.y, HANDLE_PX, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
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
