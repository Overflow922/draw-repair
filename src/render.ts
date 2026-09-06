import { dimGeometry, dimPointPoint, sameTypeJoint, visibleWorld, wallShape } from "./geometry"
import type { DimGeometry } from "./geometry"
import { GRID_STEP_CM, PX_PER_CM, normalizeMaterial } from "./types"
import type { Dimension, Material, Point, Unit, View, Wall } from "./types"

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
  dimOvershootPx: number
  dimArrowPx: number
  dimTextGapPx: number
  font: string
}

export const SCREEN_METRICS: RenderMetrics = {
  mmPx: MM,
  contourPx: 2,
  hatchPx: 1,
  dashdot: [3.5 * MM, 1.2 * MM, 0.3 * MM, 1.2 * MM],
  dashdotSmall: [2.5 * MM, 1 * MM, 0.3 * MM, 1 * MM],
  labelPx: 14,
  dimOvershootPx: 4,
  dimArrowPx: 9,
  dimTextGapPx: 1.5,
  font: "sans-serif",
}

export const PDF_METRICS: RenderMetrics = {
  mmPx: 1,
  contourPx: 0.6,
  hatchPx: 0.25,
  dashdot: [3.5, 1.2, 0.3, 1.2],
  dashdotSmall: [2.5, 1, 0.3, 1],
  labelPx: 3.5,
  dimOvershootPx: 1.5,
  dimArrowPx: 2.5,
  dimTextGapPx: 0.6,
  font: "PTSans",
}

export interface RenderOptions {
  grid?: boolean
  metrics?: RenderMetrics
  hover?: Wall | null
  hoverDim?: Dimension | null
  dimensions?: Dimension[]
  dimDraft?: DimGeometry | null
  dimRubber?: [Point, Point] | null
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
  const sceneWalls = preview ? [...walls, preview] : walls
  if (selected) drawOutline(ctx, selected, sceneWalls, toScreen)
  if (opts.hover && opts.hover !== selected) drawOutline(ctx, opts.hover, sceneWalls, toScreen, HOVER_ERASE_COLOR)
  const o = toScreen({ x: 0, y: 0 })
  const anchorC = o.x + o.y
  for (const wall of walls) drawWall(ctx, wall, sceneWalls, 1, toScreen, k, anchorC, m)
  if (preview) drawWall(ctx, preview, sceneWalls, 0.4, toScreen, k, anchorC, m)
  if (selected) drawHandles(ctx, selected, toScreen)
  ctx.font = `${m.labelPx}px ${m.font}`
  ctx.textAlign = "center"
  ctx.textBaseline = "bottom"
  for (const dim of opts.dimensions ?? []) drawDimension(ctx, dim, walls, unit, INK, view, m)
  if (opts.hoverDim) drawDimension(ctx, opts.hoverDim, walls, unit, HOVER_ERASE_COLOR, view, m)
  if (opts.dimRubber) {
    const r1 = toScreen(opts.dimRubber[0])
    const r2 = toScreen(opts.dimRubber[1])
    ctx.strokeStyle = "#555"
    ctx.lineWidth = m.hatchPx
    ctx.beginPath()
    ctx.moveTo(r1.x, r1.y)
    ctx.lineTo(r2.x, r2.y)
    ctx.stroke()
  }
  if (opts.dimDraft)
    drawDimensionGeom(
      ctx,
      opts.dimDraft,
      formatLength(Math.hypot(opts.dimDraft.b.x - opts.dimDraft.a.x, opts.dimDraft.b.y - opts.dimDraft.a.y), unit),
      "#555",
      view,
      m,
    )
}

function formatLength(cm: number, unit: Unit): string {
  if (unit === "cm") return `${Math.round(cm)}`
  if (unit === "mm") return `${Math.round(cm * 10)}`
  return `${(Math.round(cm) / 100).toString().replace(".", ",")}`
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

function drawDimension(
  ctx: CanvasRenderingContext2D,
  dim: Dimension,
  walls: Wall[],
  unit: Unit,
  color: string,
  view: View,
  m: RenderMetrics,
): void {
  const from = dimPointPoint(dim.from, walls)
  const to = dimPointPoint(dim.to, walls)
  if (!from || !to) return
  const geom = dimGeometry(from, to, dim.offset)
  if (!geom) return
  drawDimensionGeom(ctx, geom, formatLength(Math.hypot(to.x - from.x, to.y - from.y), unit), color, view, m)
}

function drawDimensionGeom(
  ctx: CanvasRenderingContext2D,
  geom: DimGeometry,
  text: string,
  color: string,
  view: View,
  m: RenderMetrics,
): void {
  const k = PX_PER_CM * view.zoom
  const toScreen = (p: Point): Point => ({ x: (p.x - view.pan.x) * k, y: (p.y - view.pan.y) * k })
  const s1 = toScreen(geom.p1)
  const s2 = toScreen(geom.p2)
  let angle = Math.atan2(s2.y - s1.y, s2.x - s1.x)
  if (angle > Math.PI / 2 || angle < -Math.PI / 2) angle += Math.PI
  const cx = (s1.x + s2.x) / 2
  const cy = (s1.y + s2.y) / 2
  const cos = Math.cos(-angle)
  const sin = Math.sin(-angle)
  const local = (p: Point): Point => {
    const dx = p.x - cx
    const dy = p.y - cy
    return { x: dx * cos - dy * sin, y: dx * sin + dy * cos }
  }
  const half = Math.hypot(s2.x - s1.x, s2.y - s1.y) / 2
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(angle)
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = m.hatchPx
  ctx.beginPath()
  ctx.moveTo(-half, 0)
  ctx.lineTo(half, 0)
  ctx.stroke()
  for (const tip of [-half, half]) {
    const dir = tip < 0 ? 1 : -1
    ctx.beginPath()
    ctx.moveTo(tip, 0)
    ctx.lineTo(tip + dir * m.dimArrowPx, -m.dimArrowPx / 3)
    ctx.lineTo(tip + dir * m.dimArrowPx, m.dimArrowPx / 3)
    ctx.closePath()
    ctx.fill()
  }
  ctx.beginPath()
  for (const end of [geom.a, geom.b]) {
    const l = local(toScreen(end))
    ctx.moveTo(l.x, l.y)
    ctx.lineTo(l.x, l.y > 0 ? -m.dimOvershootPx : m.dimOvershootPx)
  }
  ctx.stroke()
  const ty = -m.dimTextGapPx
  ctx.lineWidth = (4 * m.labelPx) / 14
  ctx.strokeStyle = "#fff"
  ctx.strokeText(text, 0, ty)
  ctx.fillStyle = color
  ctx.fillText(text, 0, ty)
  ctx.restore()
}
