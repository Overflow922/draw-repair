import { cutContour, cutPieces, dimensionChains, doorLeaf, doorZones, openingLines, windowLines } from "./doorway/doorway-layout"
import type { DoorDirection } from "./doorway/doorway-layout"
import { CHAIN_BAND_EM, CHAIN_OFFSET_EM, DIM_TEXT_GAP_PX, editableNumbers } from "./doorway/editable-numbers"
import { CHAR_WIDTH, LABEL_GAP, elementLabelLayout } from "./doorway/element-label"
import type { ElementLabel } from "./doorway/element-label"
import { formatLength } from "./format-length"
import { dimGeometry, dimPointPoint, visibleWorld } from "./geometry"
import type { DimGeometry } from "./geometry"
import { findRooms, formatArea } from "./room-area"
import type { Room } from "./room-area"
import type { RoomAngle, RulerReading } from "./ruler"
import { LIGHT_PALETTE } from "./theme"
import type { Palette } from "./theme"
import { contourSegments, cross, displayPolygons, dot, outlineSegments, sub } from "./wall-geometry"
import type { Seg } from "./wall-geometry"
import { GRID_STEP_CM, PX_PER_CM, isDoor, isWindow, normalizeMaterial } from "./types"
import type { Dimension, Material, Point, Unit, View, Wall, WallDoor, WallElement } from "./types"
import type { TrackLine } from "./wall-tracking"

const OUTLINE_PX = 4
const HANDLE_PX = 5
// правимые числа выделенного элемента (change popups-buttons-only, design D2) и альтернативные направления двери
const UNDERLINE_DASH = [3, 2]
const UNDERLINE_GAP_PX = 2 // зазор между нижним краем текста и штрихом
const ALTERNATIVE_DASH = [4, 3]
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
  dimTextGapPx: DIM_TEXT_GAP_PX,
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
  dimSnap?: Point | null
  selectedDims?: Dimension[]
  marquee?: { x1: number; y1: number; x2: number; y2: number } | null
  marqueeHits?: { walls: Wall[]; dims: Dimension[]; doorways?: WallElement[] } | null
  // проёмы (change add-doorway): вырез и подписи всех, размеры — у одиночного выделения и призрака
  doorways?: WallElement[]
  selectedDoorways?: WallElement[]
  doorwayGhost?: WallElement | null
  hoverDoorway?: WallElement | null // подсветка ластика
  hoverDoorDirection?: DoorDirection | null // направление выделенной двери под курсором — рисуется сплошным
  square?: Point[] | null // вершины квадрата установки в мировых координатах
  // угол к стене примыкания у начала превью: дуга от луча отсчёта from к направлению to
  angle?: { at: Point; from: Point; to: Point; deg: number } | null
  tracks?: TrackLine[] | null // линии трекинга по узлам в мировых координатах
  ruler?: RulerReading | null // замеры инструмента «Линейка» под курсором
  underlay?: boolean // подложка плана «Демонтаж»: без подписей помещений, размеров и слоя элементов стен (вырезы остаются)
  palette?: Palette // цвета схемы; по умолчанию светлая (PDF — всегда светлая)
}

const ANGLE_ARC_PX = 56
const ANGLE_RAY_PX = ANGLE_ARC_PX + 10 // отрезок луча отсчёта чуть длиннее радиуса дуги
const ANGLE_LABEL_GAP_PX = 18
const ANGLE_LINE_PX = 2
const TRACK_LINE_PX = 1.5
const TRACK_DASH_PX = [6, 4]

// холст под текущий размер и плотность пикселей, очищенный; размер в CSS-пикселях
export function prepareCanvas(canvas: HTMLCanvasElement): { ctx: CanvasRenderingContext2D; w: number; h: number } | null {
  const dpr = window.devicePixelRatio || 1
  const w = canvas.clientWidth
  const h = canvas.clientHeight
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
  }
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)
  return { ctx, w, h }
}

export function render(
  canvas: HTMLCanvasElement,
  walls: Wall[],
  preview: Wall | null,
  unit: Unit,
  view: View,
  selectedWalls: Wall[] = [],
  opts: RenderOptions = {},
): void {
  const target = prepareCanvas(canvas)
  if (target) drawScene(target.ctx, target.w, target.h, walls, preview, unit, view, selectedWalls, opts)
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  walls: Wall[],
  preview: Wall | null,
  unit: Unit,
  view: View,
  selectedWalls: Wall[],
  opts: RenderOptions = {},
): void {
  const m = opts.metrics ?? SCREEN_METRICS
  const p = opts.palette ?? LIGHT_PALETTE
  const k = PX_PER_CM * view.zoom
  const toScreen = (p: Point): Point => ({ x: (p.x - view.pan.x) * k, y: (p.y - view.pan.y) * k })
  // помещения — только по зафиксированным стенам, превью не участвует
  const rooms = findRooms(walls)
  if (opts.grid ?? true) {
    const { min, max } = visibleWorld(view, w, h, PX_PER_CM)
    ctx.save()
    ctx.scale(k, k)
    ctx.translate(-view.pan.x, -view.pan.y)
    ctx.strokeStyle = p.grid
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
    // заливка скрывает сетку внутри помещений; без сетки (PDF) она не наблюдаема
    fillRooms(ctx, rooms, toScreen, p.paper)
  }
  const sceneWalls = preview ? [...walls, preview] : walls
  const selectedDims = opts.selectedDims ?? []
  const singleWalls = selectedWalls.length === 1 && !selectedDims.length
  const singleDim = selectedDims.length === 1 && !selectedWalls.length
  for (const wall of selectedWalls) drawOutline(ctx, wall, sceneWalls, toScreen, p.selection)
  for (const wall of opts.marqueeHits?.walls ?? [])
    if (!selectedWalls.includes(wall)) drawOutline(ctx, wall, sceneWalls, toScreen, p.marqueeWall)
  if (opts.hover && !selectedWalls.includes(opts.hover)) drawOutline(ctx, opts.hover, sceneWalls, toScreen, p.erase)
  const o = toScreen({ x: 0, y: 0 })
  const anchorC = o.x + o.y
  const doorways = opts.doorways ?? []
  for (const wall of walls) drawWall(ctx, wall, sceneWalls, 1, toScreen, k, anchorC, m, p.ink, doorways)
  if (preview) drawWall(ctx, preview, sceneWalls, 0.4, toScreen, k, anchorC, m, p.ink, [])
  if (singleWalls) drawHandles(ctx, selectedWalls[0], toScreen, p)
  if (opts.square) {
    const corners = opts.square.map(toScreen)
    ctx.save()
    ctx.strokeStyle = p.square
    ctx.lineWidth = 1
    ctx.setLineDash([4, 3])
    tracePolygon(ctx, corners)
    ctx.stroke()
    ctx.restore()
  }
  if (opts.tracks?.length) drawTracks(ctx, opts.tracks, toScreen, p.track)
  if (opts.angle) drawAngle(ctx, opts.angle, toScreen, m, p)
  if (!opts.underlay) drawRoomLabels(ctx, rooms, toScreen, m, p.ink)
  ctx.font = `${m.labelPx}px ${m.font}`
  ctx.textAlign = "center"
  ctx.textBaseline = "bottom"
  if (!opts.underlay) drawDoorways(ctx, walls, rooms, unit, view, m, p, opts, selectedWalls.length > 0 || selectedDims.length > 0)
  for (const dim of opts.dimensions ?? []) drawDimension(ctx, dim, walls, unit, p.ink, view, m, p)
  for (const dim of opts.marqueeHits?.dims ?? [])
    if (!selectedDims.includes(dim)) drawDimension(ctx, dim, walls, unit, p.marqueeDim, view, m, p)
  for (const dim of selectedDims) drawDimension(ctx, dim, walls, unit, p.selectedDim, view, m, p, singleDim)
  if (opts.hoverDim) drawDimension(ctx, opts.hoverDim, walls, unit, p.erase, view, m, p)
  if (opts.ruler) drawRuler(ctx, opts.ruler, unit, view, toScreen, m, p)
  if (opts.marquee) {
    const { x1, y1, x2, y2 } = opts.marquee
    ctx.save()
    ctx.strokeStyle = p.ink
    ctx.lineWidth = m.hatchPx
    ctx.setLineDash([4, 3])
    ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1))
    ctx.restore()
  }
  if (opts.dimRubber) {
    const r1 = toScreen(opts.dimRubber[0])
    const r2 = toScreen(opts.dimRubber[1])
    ctx.strokeStyle = p.muted
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
      p.muted,
      view,
      m,
      p,
    )
  if (opts.dimSnap) {
    const s = toScreen(opts.dimSnap)
    ctx.beginPath()
    ctx.arc(s.x, s.y, 3.5, 0, Math.PI * 2)
    ctx.fillStyle = p.snap
    ctx.fill()
    ctx.lineWidth = 1.5
    ctx.strokeStyle = p.paper
    ctx.stroke()
  }
}

// подпись в системе текста: начало — центр подписи, ось x — направление текста вдоль стены (design D6)
function drawElementLabel(
  ctx: CanvasRenderingContext2D,
  label: ElementLabel,
  center: Point,
  angle: number,
  width: number,
  pad: number,
  m: RenderMetrics,
  p: Palette,
): void {
  ctx.translate(center.x, center.y)
  ctx.rotate(angle)
  const [only] = label.parts
  if (label.parts.length === 1) {
    // подпись проёма — одна строка по центру рамки, как в add-doorway
    ctx.textAlign = "center"
    ctx.fillStyle = only.color === "sill" ? p.sill : p.ink
    ctx.fillText(only.text, 0, 0)
  } else {
    // части подписи окна разного цвета — отдельными вызовами по направлению текста
    let x = -width / 2
    ctx.textAlign = "left"
    for (const part of label.parts) {
      ctx.fillStyle = part.color === "sill" ? p.sill : p.ink
      ctx.fillText(part.text, x, 0)
      x += (part.text + LABEL_GAP).length * m.labelPx * CHAR_WIDTH
    }
  }
  ctx.strokeStyle = p.ink
  ctx.lineWidth = m.hatchPx
  ctx.beginPath()
  ctx.rect(-width / 2 - pad, -m.labelPx / 2 - pad, width + 2 * pad, m.labelPx + 2 * pad)
  ctx.stroke()
}

// слой элементов стен (change add-doorway, design D2, D7, D10; add-window D5, D6): откосы, грани, окна, подсветка,
// подписи высоты; цепочки размеров — у одиночного выделенного проёма и у призрака установки
function drawDoorways(
  ctx: CanvasRenderingContext2D,
  walls: Wall[],
  rooms: Room[],
  unit: Unit,
  view: View,
  m: RenderMetrics,
  p: Palette,
  opts: RenderOptions,
  othersSelected: boolean,
): void {
  const k = PX_PER_CM * view.zoom
  const toScreen = (q: Point): Point => ({ x: (q.x - view.pan.x) * k, y: (q.y - view.pan.y) * k })
  const strokeSegs = (segs: Seg[], color: string, width: number): void => {
    if (!segs.length) return
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.beginPath()
    for (const { p1, p2 } of segs) {
      const s1 = toScreen(p1)
      const s2 = toScreen(p2)
      ctx.moveTo(s1.x, s1.y)
      ctx.lineTo(s2.x, s2.y)
    }
    ctx.stroke()
  }
  const elements = opts.doorways ?? []
  const outline = (d: WallElement, color: string): void => {
    const poly = openingLines(d, walls, elements)?.outline
    if (!poly) return
    ctx.save()
    ctx.strokeStyle = color
    ctx.lineWidth = OUTLINE_PX
    // явное замыкание: обводятся все четыре стороны участка, включая оба откоса
    tracePolygon(ctx, [...poly, poly[0]].map(toScreen))
    ctx.stroke()
    ctx.restore()
  }
  const selected = opts.selectedDoorways ?? []
  const marqueeHits = opts.marqueeHits?.doorways ?? []
  for (const d of marqueeHits) if (!selected.includes(d)) outline(d, p.marqueeWall)
  for (const d of selected) outline(d, p.selection)
  if (opts.hoverDoorway) outline(opts.hoverDoorway, p.erase)
  // полотно двери линиями контура и тонкая дуга открывания с центром в петле (change add-door, design D3)
  const drawLeaf = (d: WallDoor, color: string, dash: number[] = []): void => {
    const l = doorLeaf(d, walls)
    if (!l) return
    ctx.save()
    if (dash.length) ctx.setLineDash(dash)
    ctx.strokeStyle = color
    ctx.lineWidth = m.contourPx
    tracePolygon(ctx, [...l.leaf, l.leaf[0]].map(toScreen))
    ctx.stroke()
    const from = sub(l.arcFrom, l.hinge)
    const to = sub(l.arcTo, l.hinge)
    const start = Math.atan2(from.y, from.x)
    const span = Math.atan2(cross(from, to), dot(from, to))
    const c = toScreen(l.hinge)
    ctx.lineWidth = m.hatchPx
    ctx.beginPath()
    ctx.arc(c.x, c.y, l.radius * k, start, start + span, span < 0)
    ctx.stroke()
    ctx.restore()
  }
  const ghost = opts.doorwayGhost ?? null
  // правится только одиночно выделенный элемент на экране; при призраке установки числа его цепочки — призрака
  const editable = selected.length === 1 && !othersSelected && !ghost && m !== PDF_METRICS ? selected[0] : null
  const hovered = opts.hoverDoorDirection ?? null
  const labelNumbers = editable
    ? editableNumbers(editable, walls, elements, rooms, unit, k, m.labelPx).filter((n) => n.target.kind === "height" || n.target.kind === "sill")
    : []
  for (const d of elements) {
    if (isWindow(d)) {
      const lines = windowLines(d, walls, elements)
      if (!lines) continue
      strokeSegs([...lines.faces, ...lines.jambs, ...lines.squares], p.ink, m.contourPx)
      strokeSegs(lines.glass, p.ink, m.hatchPx)
    } else {
      const lines = openingLines(d, walls, elements)
      if (!lines) continue
      strokeSegs(lines.faces, p.muted, m.hatchPx)
      strokeSegs(lines.jambs, p.ink, m.contourPx)
      if (isDoor(d)) drawLeaf(d, p.ink)
    }
    // на экране — за полосой цепочки размеров; в PDF цепочек нет, подпись у грани
    const band = m === PDF_METRICS ? m.labelPx * 0.5 : m.labelPx * CHAIN_BAND_EM
    const layout = elementLabelLayout(d, walls, rooms, unit, k, m.labelPx, band)
    if (!layout) continue
    ctx.save()
    ctx.font = `${m.labelPx}px ${m.font}`
    ctx.textBaseline = "middle"
    // текст параллелен стене: вдоль нормали грани подпись занимает только свою полувысоту (с полем рамки)
    drawElementLabel(ctx, layout.label, toScreen(layout.center), Math.atan2(layout.dir.y, layout.dir.x), layout.widthPx, layout.padPx, m, p)
    ctx.restore()
    if (d === editable)
      for (const n of labelNumbers) {
        const down = { x: -n.dir.y, y: n.dir.x }
        const at = toScreen(n.center)
        const off = m.labelPx / 2 + UNDERLINE_GAP_PX
        drawUnderline(ctx, { x: at.x + down.x * off, y: at.y + down.y * off }, n.dir, n.widthCm * k, n.target.kind === "sill" ? p.sill : p.ink, m)
      }
  }
  if (ghost) outline(ghost, p.muted)
  if (ghost && isDoor(ghost)) drawLeaf(ghost, p.muted)
  // выделенная дверь: полотно и дуга трёх других направлений штрихом (spec door «Направление выделенной двери»)
  if (editable && isDoor(editable))
    for (const z of doorZones(editable, walls))
      if (z.hinge !== editable.hinge || z.swing !== editable.swing)
        drawLeaf({ ...editable, hinge: z.hinge, swing: z.swing }, p.muted, z.hinge === hovered?.hinge && z.swing === hovered.swing ? [] : ALTERNATIVE_DASH)
  const chained = ghost ?? (selected.length === 1 && !othersSelected ? selected[0] : null)
  if (!chained) return
  const underlineChain = editable !== null && chained === editable
  const offsetCm = (m.labelPx * CHAIN_OFFSET_EM) / k
  for (const item of dimensionChains(chained, walls, elements)) {
    if (item.lengthCm > 1e-6) {
      const geom = dimGeometry(item.a, item.b, offsetCm * Math.sign(item.normal.x * -(item.b.y - item.a.y) + item.normal.y * (item.b.x - item.a.x)))
      if (geom) drawDimensionGeom(ctx, geom, formatLength(item.lengthCm, unit), p.ink, view, m, p, false, underlineChain)
      continue
    }
    // нулевое расстояние — только число у откоса
    const s = toScreen({ x: item.a.x + item.normal.x * offsetCm, y: item.a.y + item.normal.y * offsetCm })
    ctx.fillStyle = p.ink
    ctx.fillText("0", s.x, s.y)
    if (underlineChain) drawUnderline(ctx, { x: s.x, y: s.y + UNDERLINE_GAP_PX }, { x: 1, y: 0 }, m.labelPx * CHAR_WIDTH, p.ink, m)
  }
}

// штриховое подчёркивание правимого числа: отрезок шириной widthPx, центр — center, вдоль dir (экранные px)
function drawUnderline(ctx: CanvasRenderingContext2D, center: Point, dir: Point, widthPx: number, color: string, m: RenderMetrics): void {
  ctx.save()
  ctx.setLineDash(UNDERLINE_DASH)
  ctx.strokeStyle = color
  ctx.lineWidth = m.hatchPx
  ctx.beginPath()
  ctx.moveTo(center.x - (dir.x * widthPx) / 2, center.y - (dir.y * widthPx) / 2)
  ctx.lineTo(center.x + (dir.x * widthPx) / 2, center.y + (dir.y * widthPx) / 2)
  ctx.stroke()
  ctx.restore()
}

function fillRooms(ctx: CanvasRenderingContext2D, rooms: Room[], toScreen: (p: Point) => Point, color: string): void {
  ctx.fillStyle = color
  for (const room of rooms) {
    tracePolygons(ctx, [room.outline, ...room.holes].map((poly) => poly.map(toScreen)))
    ctx.fill("evenodd")
  }
}

function drawRoomLabels(
  ctx: CanvasRenderingContext2D,
  rooms: Room[],
  toScreen: (p: Point) => Point,
  m: RenderMetrics,
  color: string,
): void {
  ctx.fillStyle = color
  ctx.font = `${m.labelPx}px ${m.font}`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  for (const room of rooms) {
    const s = toScreen(room.labelAt)
    ctx.fillText(formatArea(room.areaCm2), s.x, s.y)
  }
}

// линии трекинга от узла до конца превью: пунктир постоянной экранной толщины
function drawTracks(ctx: CanvasRenderingContext2D, tracks: TrackLine[], toScreen: (p: Point) => Point, color: string): void {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = TRACK_LINE_PX
  ctx.setLineDash(TRACK_DASH_PX)
  ctx.beginPath()
  for (const t of tracks) {
    const a = toScreen(t.from)
    const b = toScreen(t.to)
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
  }
  ctx.stroke()
  ctx.restore()
}

// дуга кратчайшего сектора между лучами и подпись угла в целых градусах (экранные px)
function drawAngle(
  ctx: CanvasRenderingContext2D,
  angle: NonNullable<RenderOptions["angle"]>,
  toScreen: (p: Point) => Point,
  m: RenderMetrics,
  palette: Palette,
): void {
  const c = toScreen(angle.at)
  const a1 = Math.atan2(angle.from.y, angle.from.x)
  let sweep = Math.atan2(angle.to.y, angle.to.x) - a1
  if (sweep > Math.PI) sweep -= 2 * Math.PI
  if (sweep <= -Math.PI) sweep += 2 * Math.PI
  drawAngleArc(ctx, c, a1, sweep, angle.deg, m, palette, true)
}

// угол помещения у линейки: знаковый сектор со стороны помещения, без луча отсчёта
function drawRoomAngle(
  ctx: CanvasRenderingContext2D,
  angle: RoomAngle,
  toScreen: (p: Point) => Point,
  m: RenderMetrics,
  palette: Palette,
): void {
  const a1 = Math.atan2(angle.startDir.y, angle.startDir.x)
  drawAngleArc(ctx, toScreen(angle.at), a1, (angle.sweepDeg * Math.PI) / 180, angle.deg, m, palette, false)
}

// дуга сектора от a1 на sweep (рад, экранные координаты) и подпись на биссектрисе
function drawAngleArc(
  ctx: CanvasRenderingContext2D,
  c: Point,
  a1: number,
  sweep: number,
  deg: number,
  m: RenderMetrics,
  palette: Palette,
  ray: boolean,
): void {
  const mid = a1 + sweep / 2
  const labelR = ANGLE_ARC_PX + ANGLE_LABEL_GAP_PX
  ctx.save()
  ctx.strokeStyle = palette.angle
  ctx.lineWidth = ANGLE_LINE_PX
  ctx.beginPath()
  if (ray) {
    ctx.moveTo(c.x, c.y)
    ctx.lineTo(c.x + Math.cos(a1) * ANGLE_RAY_PX, c.y + Math.sin(a1) * ANGLE_RAY_PX)
  }
  ctx.moveTo(c.x + Math.cos(a1) * ANGLE_ARC_PX, c.y + Math.sin(a1) * ANGLE_ARC_PX)
  ctx.arc(c.x, c.y, ANGLE_ARC_PX, a1, a1 + sweep, sweep < 0)
  ctx.stroke()
  // подпись на подложке цвета фона — не сливается со штриховкой стен
  const text = `${Math.round(deg)}°`
  const lx = c.x + Math.cos(mid) * labelR
  const ly = c.y + Math.sin(mid) * labelR
  ctx.font = `bold ${m.labelPx}px ${m.font}`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  const pad = 3
  const w = ctx.measureText(text).width + 2 * pad
  const h = m.labelPx + 2 * pad
  ctx.fillStyle = palette.labelBg
  ctx.fillRect(lx - w / 2, ly - h / 2, w, h)
  ctx.strokeRect(lx - w / 2, ly - h / 2, w, h)
  ctx.fillStyle = palette.angle
  ctx.fillText(text, lx, ly)
  ctx.restore()
}

// замеры линейки: длина оси стены или пролёты грань-грань — как размерная линия цветом
// подсказок построения (цвет угла); углы помещения — дугами
function drawRuler(
  ctx: CanvasRenderingContext2D,
  ruler: RulerReading,
  unit: Unit,
  view: View,
  toScreen: (p: Point) => Point,
  m: RenderMetrics,
  palette: Palette,
): void {
  const measures = ruler.kind === "wall" ? [ruler] : [ruler.horizontal, ruler.vertical].filter((s) => s !== null)
  ctx.save()
  ctx.font = `${m.labelPx}px ${m.font}`
  ctx.textAlign = "center"
  ctx.textBaseline = "bottom"
  for (const { from, to, lengthCm } of measures) {
    const geom = dimGeometry(from, to, 0)
    if (geom) drawDimensionGeom(ctx, geom, formatLength(lengthCm, unit), palette.angle, view, m, palette)
  }
  ctx.restore()
  if (ruler.kind === "space") for (const angle of ruler.angles) drawRoomAngle(ctx, angle, toScreen, m, palette)
}

function tracePolygon(ctx: CanvasRenderingContext2D, poly: Point[]): void {
  tracePolygons(ctx, [poly])
}

export function tracePolygons(ctx: CanvasRenderingContext2D, polys: Point[][]): void {
  ctx.beginPath()
  for (const poly of polys) {
    poly.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
    ctx.closePath()
  }
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

// штриховка сноса: линии под 135° к осям (направление экрана (1, 1), перпендикулярно штриховке «Кирпича»)
// с шагом и фазой strokeHatch45 (change demolition-plan, design D8)
export function strokeHatch135(ctx: CanvasRenderingContext2D, poly: Point[], anchorC: number, m: RenderMetrics): void {
  const [minX, minY, maxX, maxY] = polyBounds(poly)
  const step = 3 * m.mmPx * Math.SQRT2
  const minC = minY - maxX
  ctx.setLineDash([])
  ctx.beginPath()
  for (let c = minC - mod(minC - anchorC, step); c <= maxY - minX; c += step) {
    ctx.moveTo(minX, minX + c)
    ctx.lineTo(maxX, maxX + c)
  }
  ctx.stroke()
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
  polys: Point[][],
  a: Point,
  b: Point,
  thicknessPx: number,
  anchorC: number,
  m: RenderMetrics,
): void {
  ctx.save()
  tracePolygons(ctx, polys)
  ctx.clip()
  ctx.lineWidth = m.hatchPx
  const bounds = polys.flat()
  if (mat === "brick") strokeHatch45(ctx, bounds, [], 0, 1, anchorC, m)
  else if (mat === "concrete") strokeHatch45(ctx, bounds, m.dashdot, 0, 1, anchorC, m)
  else if (mat === "reinforced") {
    strokeHatch45(ctx, bounds, [], 0, 2, anchorC, m)
    strokeHatch45(ctx, bounds, m.dashdotSmall, 1, 2, anchorC, m)
  } else woodLong(ctx, a, b, thicknessPx, m)
  ctx.restore()
}

function strokeContour(ctx: CanvasRenderingContext2D, segs: Seg[], toScreen: (p: Point) => Point): void {
  ctx.lineCap = "square"
  ctx.beginPath()
  for (const { p1, p2 } of segs) {
    const s1 = toScreen(p1)
    const s2 = toScreen(p2)
    ctx.moveTo(s1.x, s1.y)
    ctx.lineTo(s2.x, s2.y)
  }
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
  ink: string,
  doorways: readonly WallElement[],
): void {
  const mat = normalizeMaterial(wall.type)
  const polys = cutPieces(wall, displayPolygons(wall, walls), walls, doorways).map((poly) => poly.map(toScreen))
  ctx.globalAlpha = alpha
  ctx.strokeStyle = ink
  ctx.lineWidth = 1
  drawMaterial(ctx, mat, polys, toScreen(wall.a), toScreen(wall.b), wall.thicknessCm * k, anchorC, m)
  ctx.lineWidth = m.contourPx
  strokeContour(ctx, cutContour(wall, contourSegments(wall, walls), walls, doorways), toScreen)
  ctx.globalAlpha = 1
}

export function drawPatternPreview(canvas: HTMLCanvasElement, material: Material, palette: Palette = LIGHT_PALETTE): void {
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  const w = canvas.width
  const h = canvas.height
  ctx.clearRect(0, 0, w, h)
  ctx.strokeStyle = palette.ink
  ctx.lineWidth = 1
  const poly: Point[] = [
    { x: 1, y: 1 },
    { x: w - 1, y: 1 },
    { x: w - 1, y: h - 1 },
    { x: 1, y: h - 1 },
  ]
  drawMaterial(ctx, material, [poly], { x: 1, y: h / 2 }, { x: w - 1, y: h / 2 }, h - 2, 0, SCREEN_METRICS)
}

function drawOutline(
  ctx: CanvasRenderingContext2D,
  wall: Wall,
  walls: Wall[],
  toScreen: (p: Point) => Point,
  color: string,
): void {
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = OUTLINE_PX * 2
  tracePolygons(ctx, displayPolygons(wall, walls).map((poly) => poly.map(toScreen)))
  ctx.fill()
  // обводится только внешняя граница формы: без полос на границах между телом и заливками
  // стены; скруглённые стыки — без шипов на острых углах заливок
  ctx.lineJoin = "round"
  ctx.lineCap = "round"
  ctx.beginPath()
  for (const { p1, p2 } of outlineSegments(wall, walls)) {
    const s1 = toScreen(p1)
    const s2 = toScreen(p2)
    ctx.moveTo(s1.x, s1.y)
    ctx.lineTo(s2.x, s2.y)
  }
  ctx.stroke()
  ctx.lineJoin = "miter"
  ctx.lineCap = "butt"
}

function drawHandles(ctx: CanvasRenderingContext2D, wall: Wall, toScreen: (p: Point) => Point, palette: Palette): void {
  ctx.fillStyle = palette.paper
  ctx.strokeStyle = palette.handleStroke
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
  palette: Palette,
  handles = false,
): void {
  const from = dimPointPoint(dim.from, walls)
  const to = dimPointPoint(dim.to, walls)
  if (!from || !to) return
  const geom = dimGeometry(from, to, dim.offset)
  if (!geom) return
  drawDimensionGeom(ctx, geom, formatLength(Math.hypot(to.x - from.x, to.y - from.y), unit), color, view, m, palette, handles)
}

// underline: число правимое — размерная линия под ним штриховая, вне числа сплошная (design D2)
function drawDimensionGeom(
  ctx: CanvasRenderingContext2D,
  geom: DimGeometry,
  text: string,
  color: string,
  view: View,
  m: RenderMetrics,
  palette: Palette,
  handles = false,
  underline = false,
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
  const under = underline ? Math.min(text.length * m.labelPx * CHAR_WIDTH, 2 * half) / 2 : 0
  ctx.beginPath()
  if (under > 0) {
    ctx.moveTo(-half, 0)
    ctx.lineTo(-under, 0)
    ctx.moveTo(under, 0)
    ctx.lineTo(half, 0)
  } else {
    ctx.moveTo(-half, 0)
    ctx.lineTo(half, 0)
  }
  ctx.stroke()
  if (under > 0) {
    ctx.setLineDash(UNDERLINE_DASH)
    ctx.beginPath()
    ctx.moveTo(-under, 0)
    ctx.lineTo(under, 0)
    ctx.stroke()
    ctx.setLineDash([])
  }
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
  ctx.strokeStyle = palette.paper
  ctx.strokeText(text, 0, ty)
  ctx.fillStyle = color
  ctx.fillText(text, 0, ty)
  ctx.restore()
  if (handles) {
    ctx.fillStyle = palette.paper
    ctx.strokeStyle = palette.handleStroke
    ctx.lineWidth = 1.5
    for (const s of [s1, s2]) {
      ctx.beginPath()
      ctx.arc(s.x, s.y, HANDLE_PX, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
  }
}
