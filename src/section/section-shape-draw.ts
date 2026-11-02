import type { RenderMetrics } from "../render"
import type { Palette } from "../theme"
import type { Point, SectionShape } from "../types"
import { SCREED_HATCH, strokeHatchSeries } from "../wall-hatch"
import { figureToWorld } from "./section-layout"
import type { SectionEntry } from "./section-scene"

// Отрисовка деталей разреза (change add-section-shapes, design D2; spec section-view «Деталь разреза»): заштрихованный
// прямоугольник тем же рисунком и фазой штриховки, что сечения стен фигуры (references/section-shelves.png), контур — цвет
// гипсокартона. Штриховка детали и сечения взаимно исключаются: участок детали на сечении — углубление, без штриховки
// (spec section-view «Деталь разреза»). Одна функция для холста и PDF; выделение и ластик — подсветка, числа рисует отдельный слой холста.

export interface ShapeMarks {
  selectedShape?: string | null
  erasingShape?: string | null
}

const HALO_K = 3

// углы детали на экране: левый верхний, правый верхний, правый нижний, левый нижний
export function shapeCorners(entry: SectionEntry, shape: SectionShape, toScreen: (p: Point) => Point): Point[] {
  const lo = toScreen(figureToWorld(entry.placement, shape.s0, shape.z1))
  const hi = toScreen(figureToWorld(entry.placement, shape.s1, shape.z0))
  return [lo, { x: hi.x, y: lo.y }, hi, { x: lo.x, y: hi.y }]
}

// углы сечения фигуры на экране в том же порядке, что у детали
export function pieceCorners(entry: SectionEntry, piece: SectionEntry["figure"]["pieces"][number], toScreen: (p: Point) => Point): Point[] {
  const lo = toScreen(figureToWorld(entry.placement, piece.s0, piece.heightCm))
  const hi = toScreen(figureToWorld(entry.placement, piece.s1, 0))
  return [lo, { x: hi.x, y: lo.y }, hi, { x: lo.x, y: hi.y }]
}

const FAR = 1e7

// отсечение: всё, кроме перечисленных прямоугольников (правило evenodd); применять внутри уже заданной области
export function clipOutside(ctx: CanvasRenderingContext2D, rects: readonly (readonly Point[])[]): void {
  ctx.beginPath()
  ctx.rect(-FAR, -FAR, 2 * FAR, 2 * FAR)
  for (const r of rects) r.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
  ctx.clip("evenodd")
}

function outline(ctx: CanvasRenderingContext2D, r: readonly Point[]): void {
  ctx.beginPath()
  r.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
  ctx.closePath()
}

export function drawShape(ctx: CanvasRenderingContext2D, r: readonly Point[], color: string, m: RenderMetrics, origin: Point, halo: string | null, pieces: readonly (readonly Point[])[] = []): void {
  if (halo !== null) {
    ctx.strokeStyle = halo
    ctx.lineWidth = m.contourPx * HALO_K
    outline(ctx, r)
    ctx.stroke()
  }
  ctx.save()
  outline(ctx, r)
  ctx.clip()
  clipOutside(ctx, pieces)
  ctx.strokeStyle = color
  strokeHatchSeries(ctx, [...r], SCREED_HATCH, origin, m)
  ctx.restore()
  ctx.strokeStyle = color
  ctx.lineWidth = m.contourPx
  outline(ctx, r)
  ctx.stroke()
}

export function drawShapes(ctx: CanvasRenderingContext2D, entry: SectionEntry, toScreen: (p: Point) => Point, color: string, m: RenderMetrics, origin: Point, palette: Palette, marks: ShapeMarks): void {
  const pieces = entry.figure.pieces.map((p) => pieceCorners(entry, p, toScreen))
  for (const shape of entry.shapes) {
    const halo = marks.erasingShape === shape.id ? palette.erase : marks.selectedShape === shape.id ? palette.selection : null
    drawShape(ctx, shapeCorners(entry, shape, toScreen), color, m, origin, halo, pieces)
  }
}
