import { pointsEqual, sameTypeJoint, visibleWorld, wallShape } from "./geometry"
import { GRID_STEP_CM, PX_PER_CM, normalizeMaterial } from "./types"
import type { Material, Point, Unit, View, Wall } from "./types"

const OUTLINE_PX = 4
const HANDLE_PX = 5
const HOVER_ERASE_COLOR = "rgba(220, 38, 38, 0.5)"
const INK = "#333"
const MM = 96 / 25.4

export interface RenderMetrics {
  mmPx: number
  contourPx: number
  hatchPx: number
  dashdot: number[]
  dashdotSmall: number[]
  labelPx: number
  labelGapPx: number
  font: string
}

export const SCREEN_METRICS: RenderMetrics = {
  mmPx: MM,
  contourPx: 2,
  hatchPx: 1,
  dashdot: [3.5 * MM, 1.2 * MM, 0.3 * MM, 1.2 * MM],
  dashdotSmall: [2.5 * MM, 1 * MM, 0.3 * MM, 1 * MM],
  labelPx: 14,
  labelGapPx: 4,
  font: "sans-serif",
}

export const PDF_METRICS: RenderMetrics = {
  mmPx: 1,
  contourPx: 0.6,
  hatchPx: 0.25,
  dashdot: [3.5, 1.2, 0.3, 1.2],
  dashdotSmall: [2.5, 1, 0.3, 1],
  labelPx: 3.5,
  labelGapPx: 1.5,
  font: "PTSans",
}

export interface RenderOptions {
  grid?: boolean
  metrics?: RenderMetrics
  hover?: Wall | null
}

export function render(
  canvas: HTMLCanvasElement,
  walls: Wall[],
  preview: Wall | null,
  unit: Unit,
  view: View,
  selected: Wall | null = null,
  opts: RenderOptions = {},
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
  drawScene(ctx, w, h, walls, preview, unit, view, selected, opts)
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  walls: Wall[],
  preview: Wall | null,
  unit: Unit,
  view: View,
  selected: Wall | null,
  opts: RenderOptions = {},
): void {
  const m = opts.metrics ?? SCREEN_METRICS
  const k = PX_PER_CM * view.zoom
  const toScreen = (p: Point): Point => ({ x: (p.x - view.pan.x) * k, y: (p.y - view.pan.y) * k })
  if (opts.grid ?? true) {
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
  }
  if (selected) drawOutline(ctx, selected, walls, toScreen)
  if (opts.hover && opts.hover !== selected) drawOutline(ctx, opts.hover, walls, toScreen, HOVER_ERASE_COLOR)
  const o = toScreen({ x: 0, y: 0 })
  const anchorC = o.x + o.y
  for (const wall of walls) drawWall(ctx, wall, walls, 1, toScreen, k, anchorC, m)
  if (preview) drawWall(ctx, preview, [], 0.4, toScreen, k, anchorC, m)
  if (selected) drawHandles(ctx, selected, toScreen)
  ctx.font = `${m.labelPx}px ${m.font}`
  ctx.textAlign = "center"
  ctx.textBaseline = "bottom"
  for (const wall of walls) drawLengthLabel(ctx, wall, formatLength(wall, unit), "#333", view, m)
  if (preview && !pointsEqual(preview.a, preview.b))
    drawLengthLabel(ctx, preview, formatLength(preview, unit), "#555", view, m)
}

function formatLength(wall: Wall, unit: Unit): string {
  const cm = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y)
  if (unit === "cm") return `${Math.round(cm)} см`
  if (unit === "mm") return `${Math.round(cm * 10)} мм`
  return `${(Math.round(cm) / 100).toString().replace(".", ",")} м`
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

function mod(x: number, m: number): number {
  return ((x % m) + m) % m
}

function strokeHatch45(
  ctx: CanvasRenderingContext2D,
  poly: Point[],
  dash: number[],
  phase: number,
  stride: number,
  anchorC: number,
  m: RenderMetrics,
): void {
  const [minX, minY, maxX, maxY] = polyBounds(poly)
  const step = 3 * m.mmPx * Math.SQRT2 * stride
  const minC = minX + minY
  ctx.setLineDash(dash)
  ctx.beginPath()
  for (let c = minC - mod(minC - anchorC - phase * 3 * m.mmPx * Math.SQRT2, step); c <= maxX + maxY; c += step) {
    ctx.moveTo(minX, c - minX)
    ctx.lineTo(maxX, c - maxX)
  }
  ctx.stroke()
  ctx.setLineDash([])
}

function woodLong(ctx: CanvasRenderingContext2D, a: Point, b: Point, thicknessPx: number, m: RenderMetrics): void {
  const len = Math.hypot(b.x - a.x, b.y - a.y)
  if (!len) return
  const ux = (b.x - a.x) / len
  const uy = (b.y - a.y) / len
  const nx = -uy
  const ny = ux
  const amp = 0.6 * m.mmPx
  const wave = 8 * m.mmPx
  const margin = thicknessPx * 2
  ctx.beginPath()
  for (let off = -thicknessPx / 2 + 3 * m.mmPx / 2; off <= thicknessPx / 2; off += 3 * m.mmPx) {
    let first = true
    for (let t = -margin; t <= len + margin; t += 2 * m.mmPx) {
      const lateral = off + amp * Math.sin((t / wave) * Math.PI * 2)
      const px = a.x + ux * t + nx * lateral
      const py = a.y + uy * t + ny * lateral
      if (first) {
        ctx.moveTo(px, py)
        first = false
      } else ctx.lineTo(px, py)
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
  anchorC: number,
  m: RenderMetrics,
): void {
  ctx.save()
  tracePolygon(ctx, poly)
  ctx.clip()
  ctx.lineWidth = m.hatchPx
  if (mat === "brick") strokeHatch45(ctx, poly, [], 0, 1, anchorC, m)
  else if (mat === "concrete") strokeHatch45(ctx, poly, m.dashdot, 0, 1, anchorC, m)
  else if (mat === "reinforced") {
    strokeHatch45(ctx, poly, [], 0, 2, anchorC, m)
    strokeHatch45(ctx, poly, m.dashdotSmall, 1, 2, anchorC, m)
  } else woodLong(ctx, a, b, thicknessPx, m)
  ctx.restore()
}

function strokeContour(ctx: CanvasRenderingContext2D, wall: Wall, poly: Point[], walls: Wall[]): void {
  const [aPlus, bMinus, bPlus, aMinus] = poly
  const mergeA = sameTypeJoint(wall, wall.a, walls)
  const mergeB = sameTypeJoint(wall, wall.b, walls)
  ctx.lineCap = "square"
  ctx.beginPath()
  ctx.moveTo(aPlus.x, aPlus.y)
  ctx.lineTo(bMinus.x, bMinus.y)
  if (mergeB) ctx.moveTo(bPlus.x, bPlus.y)
  else ctx.lineTo(bPlus.x, bPlus.y)
  ctx.lineTo(aMinus.x, aMinus.y)
  if (!mergeA) ctx.lineTo(aPlus.x, aPlus.y)
  ctx.stroke()
  ctx.lineCap = "butt"
}

function drawWall(
  ctx: CanvasRenderingContext2D,
  wall: Wall,
  walls: Wall[],
  alpha: number,
  toScreen: (p: Point) => Point,
  k: number,
  anchorC: number,
  m: RenderMetrics,
): void {
  const mat = normalizeMaterial(wall.type)
  const poly = wallShape(wall, walls).map(toScreen)
  ctx.globalAlpha = alpha
  ctx.strokeStyle = INK
  ctx.lineWidth = 1
  drawMaterial(ctx, mat, poly, toScreen(wall.a), toScreen(wall.b), wall.thicknessCm * k, anchorC, m)
  ctx.lineWidth = m.contourPx
  strokeContour(ctx, wall, poly, walls)
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
  drawMaterial(ctx, material, poly, { x: 1, y: h / 2 }, { x: w - 1, y: h / 2 }, h - 2, 0, SCREEN_METRICS)
}

function drawOutline(
  ctx: CanvasRenderingContext2D,
  wall: Wall,
  walls: Wall[],
  toScreen: (p: Point) => Point,
  color = "rgba(8, 145, 178, 0.5)",
): void {
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = OUTLINE_PX * 2
  tracePolygon(ctx, wallShape(wall, walls).map(toScreen))
  ctx.fill()
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

function drawLengthLabel(
  ctx: CanvasRenderingContext2D,
  wall: Wall,
  text: string,
  color: string,
  view: View,
  m: RenderMetrics,
): void {
  let angle = Math.atan2(wall.b.y - wall.a.y, wall.b.x - wall.a.x)
  if (angle > Math.PI / 2 || angle < -Math.PI / 2) angle += Math.PI
  const k = PX_PER_CM * view.zoom
  ctx.save()
  ctx.translate(((wall.a.x + wall.b.x) / 2 - view.pan.x) * k, ((wall.a.y + wall.b.y) / 2 - view.pan.y) * k)
  ctx.rotate(angle)
  const y = -(wall.thicknessCm * k) / 2 - m.labelGapPx
  ctx.lineWidth = (4 * m.labelPx) / 14
  ctx.strokeStyle = "#fff"
  ctx.strokeText(text, 0, y)
  ctx.fillStyle = color
  ctx.fillText(text, 0, y)
  ctx.restore()
}
