import type { RenderMetrics } from "../render"
import type { Palette } from "../theme"
import { PX_PER_CM } from "../types"
import type { Point, SectionLine, SectionShape, View } from "../types"
import { SCREED_HATCH, strokeHatchSeries } from "../wall-hatch"
import { figureToWorld } from "./section-layout"
import { SECTION_BAR_WIDTH_K, SECTION_DASH_CM, dashedPath, endMarks } from "./section-marks"
import type { SectionEntry } from "./section-scene"
import { clipOutside, drawShape, drawShapes, pieceCorners, shapeCorners } from "./section-shape-draw"
import type { ShapeMarks } from "./section-shape-draw"

// Отрисовка линий и фигур разреза (change add-section-view, design D2; spec section-view «Обозначение линии разреза на плане»,
// «Фигура разреза — содержание и штриховка»). Одна функция для холста и PDF; размеры в единицах чертежа, толщины и шрифт — из
// RenderMetrics. Внешний вид — references/sections.png: контур сечения, штриховка 45°, название «A–A» над фигурой.

export interface SectionMarks extends ShapeMarks {
  selected?: string | null // выделенная линия: подсветка линии вместе с фигурой
  erasing?: string | null // линия под курсором ластика
}

export interface SectionPreview {
  points: readonly Point[] // набранные вершины
  cursor: Point | null // куда встанет следующая вершина
  line: SectionLine | null // линия с выбранным взглядом (шаг направления)
  shape?: { entry: SectionEntry; shape: SectionShape } | null // деталь до курсора (инструмент «Деталь разреза»)
}

const HALO_K = 3

const title = (label: string): string => `${label}–${label}`

function strokePath(ctx: CanvasRenderingContext2D, pts: readonly Point[]): void {
  ctx.beginPath()
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
  ctx.stroke()
}

function arrowHead(ctx: CanvasRenderingContext2D, tip: Point, from: Point, m: RenderMetrics): void {
  const len = Math.hypot(tip.x - from.x, tip.y - from.y) || 1
  const dir = { x: (from.x - tip.x) / len, y: (from.y - tip.y) / len }
  const base = { x: tip.x + dir.x * m.dimArrowPx, y: tip.y + dir.y * m.dimArrowPx }
  ctx.beginPath()
  ctx.moveTo(tip.x, tip.y)
  ctx.lineTo(base.x - dir.y * (m.dimArrowPx / 3), base.y + dir.x * (m.dimArrowPx / 3))
  ctx.lineTo(base.x + dir.y * (m.dimArrowPx / 3), base.y - dir.x * (m.dimArrowPx / 3))
  ctx.closePath()
  ctx.fill()
}

function drawLine(ctx: CanvasRenderingContext2D, line: SectionLine, toScreen: (p: Point) => Point, k: number, color: string, m: RenderMetrics, halo: string | null): void {
  const pts = line.points.map(toScreen)
  const marks = endMarks(line).map((mark) => ({ end: toScreen(mark.end), strokeFrom: toScreen(mark.strokeFrom), strokeTo: toScreen(mark.strokeTo), tail: toScreen(mark.tail), labelAt: toScreen(mark.labelAt) }))
  if (halo !== null) {
    ctx.strokeStyle = halo
    ctx.lineWidth = m.contourPx * HALO_K
    strokePath(ctx, pts)
    for (const mark of marks) strokePath(ctx, [mark.tail, mark.end])
  }
  ctx.strokeStyle = color
  ctx.fillStyle = color
  // как на references/sections.png: штриховая линия тоньше концевых штрихов в SECTION_BAR_WIDTH_K раз, начинается с зазором за штрихом
  ctx.lineWidth = m.contourPx
  const dashed = dashedPath(line)
  if (dashed !== null) {
    ctx.setLineDash(SECTION_DASH_CM.map((d) => d * k))
    strokePath(ctx, dashed.map(toScreen))
    ctx.setLineDash([])
  }
  for (const mark of marks) {
    ctx.lineWidth = m.contourPx * SECTION_BAR_WIDTH_K
    strokePath(ctx, [mark.strokeFrom, mark.strokeTo])
    ctx.lineWidth = m.hatchPx
    strokePath(ctx, [mark.tail, mark.end])
    arrowHead(ctx, mark.end, mark.tail, m)
  }
  ctx.font = `${m.labelPx}px ${m.font}`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  for (const mark of marks) ctx.fillText(line.label, mark.labelAt.x, mark.labelAt.y)
}

function drawFigure(ctx: CanvasRenderingContext2D, entry: SectionEntry, toScreen: (p: Point) => Point, color: string, m: RenderMetrics, origin: Point, halo: string | null): void {
  const { placement, figure } = entry
  const rects = figure.pieces.map((p) => pieceCorners(entry, p, toScreen))
  // углубления — детали на сечениях: штриховка сечения в них не рисуется (change add-section-shapes)
  const recesses = entry.shapes.map((s) => shapeCorners(entry, s, toScreen))
  if (halo !== null) {
    ctx.strokeStyle = halo
    ctx.lineWidth = m.contourPx * HALO_K
    for (const r of rects) strokePath(ctx, [...r, r[0]])
  }
  ctx.strokeStyle = color
  ctx.lineWidth = m.contourPx
  for (const r of rects) {
    ctx.save()
    ctx.beginPath()
    r.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
    ctx.closePath()
    ctx.clip()
    clipOutside(ctx, recesses)
    ctx.strokeStyle = color
    strokeHatchSeries(ctx, r, SCREED_HATCH, origin, m)
    ctx.restore()
    ctx.strokeStyle = color
    ctx.lineWidth = m.contourPx
    strokePath(ctx, [...r, r[0]])
  }
  const top = toScreen(figureToWorld(placement, figure.width / 2, figure.height))
  ctx.fillStyle = color
  ctx.font = `${m.labelPx}px ${m.font}`
  ctx.textAlign = "center"
  ctx.textBaseline = "bottom"
  ctx.fillText(title(figure.label), top.x, top.y - m.labelPx * 0.4)
}

export function drawSections(
  ctx: CanvasRenderingContext2D,
  entries: readonly SectionEntry[],
  view: View,
  m: RenderMetrics,
  palette: Palette,
  color: string, // цвет линии и фигуры: контур гипсокартона схемы
  marks: SectionMarks = {},
  preview: SectionPreview | null = null,
): void {
  const k = PX_PER_CM * view.zoom
  const toScreen = (p: Point): Point => ({ x: (p.x - view.pan.x) * k, y: (p.y - view.pan.y) * k })
  const origin = toScreen({ x: 0, y: 0 })
  ctx.save()
  for (const e of entries) {
    const halo = marks.erasing === e.line.id ? palette.erase : marks.selected === e.line.id ? palette.selection : null
    drawLine(ctx, e.shown, toScreen, k, color, m, halo)
    drawFigure(ctx, e, toScreen, color, m, origin, halo)
    drawShapes(ctx, e, toScreen, color, m, origin, palette, marks)
  }
  if (preview !== null) drawPreview(ctx, preview, toScreen, k, color, m, origin)
  ctx.restore()
}

// превью размещения: набранные отрезки, резинка до курсора и, на шаге направления, стрелки взгляда
function drawPreview(ctx: CanvasRenderingContext2D, preview: SectionPreview, toScreen: (p: Point) => Point, k: number, color: string, m: RenderMetrics, origin: Point): void {
  ctx.globalAlpha = 0.6
  if (preview.shape) {
    drawShape(ctx, shapeCorners(preview.shape.entry, preview.shape.shape, toScreen), color, m, origin, null)
  } else if (preview.line !== null) {
    drawLine(ctx, preview.line, toScreen, k, color, m, null)
  } else {
    const pts = [...preview.points, ...(preview.cursor ? [preview.cursor] : [])].map(toScreen)
    ctx.strokeStyle = color
    ctx.lineWidth = m.hatchPx
    if (pts.length >= 2) strokePath(ctx, pts)
  }
  ctx.globalAlpha = 1
}
