import { drawReconstructionScene } from "../reconstruction/reconstruction-render"
import type { ReconstructionOptions, ReconstructionView } from "../reconstruction/reconstruction-render"
import { SCREEN_METRICS, UNDERLINE_GAP_PX, drawDimensionGeom, drawUnderline, prepareCanvas, tracePolygons } from "../render"
import type { RenderMetrics } from "../render"
import { LIGHT_PALETTE } from "../theme"
import type { Palette, Theme } from "../theme"
import { PX_PER_CM } from "../types"
import type { Point, FurnitureItem, Unit, View } from "../types"
import type { Overlap } from "./overlap"
import { kindEntry } from "./furniture-kinds"
import type { ItemDrawing } from "./item-drawing"
import { itemLocalToWorld } from "./item"
import type { ItemNumber } from "./item-number"
import { itemSizeLayout } from "./item-size-layout"

// Отрисовка плана «Мебель» (change furniture-plan-table, design D8): подложка — результат «Реконструкции» (рисует её функция
// плана «Реконструкция»), поверх неё предметы в реальном масштабе, затем подсветка пересечений, затем размеры. Одна функция для
// холста и PDF: в PDF подсветка и призрак не передаются. Предмет — линии рисунка своего вида без заливки (change
// furniture-line-drawings, design D1, D3; spec furniture-plan «Отображение плана «Мебель» и цвет стола», «Каталог видов мебели»).

// рисунок вида предмета в чертеже: точки поворачиваются и смещаются вместе с предметом
export function itemDrawingInPlan(t: FurnitureItem): ItemDrawing {
  const drawing = kindEntry(t.kind).drawing({ widthCm: t.widthCm, lengthCm: t.lengthCm, ...(t.toilet ? { toilet: t.toilet } : null) })
  const place = (p: Point): Point => itemLocalToWorld(t, p)
  return { outline: drawing.outline.map(place), lines: drawing.lines.map((line) => line.map(place)) }
}

// ломаные без заливки; линия, вернувшаяся в первую точку, замыкается
export function traceLines(c: CanvasRenderingContext2D, lines: readonly (readonly Point[])[]): void {
  c.beginPath()
  for (const line of lines) {
    line.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)))
    const first = line[0]
    const last = line[line.length - 1]
    if (line.length > 2 && first && last && first.x === last.x && first.y === last.y) c.closePath()
  }
}

// область пересечения стола с другими объектами — красная, полупрозрачная; цвет задаётся схемой
export const conflictColor = (theme: Theme): string => (theme === "dark" ? "rgba(248, 113, 113, 0.6)" : "rgba(220, 38, 38, 0.55)")

export interface FurnitureView extends ReconstructionView {
  items: readonly FurnitureItem[]
  selectedItemIds?: ReadonlySet<string>
  erasingItemId?: string | null
  // призрак под указателем у инструмента «Стол»
  itemGhost?: FurnitureItem | null
  // области пересечений; только на холсте
  overlaps?: readonly Overlap[]
  // числа ровно одного выделенного предмета — габариты и расстояния до стен, правимые (подчёркнуты); только на холсте
  editable?: { itemId: string; numbers: readonly ItemNumber[] } | null
}

const GHOST_ALPHA = 0.4

// числа предмета: размерные линии в стиле размеров плана; нулевое расстояние — одно число у стороны
function drawItemNumbers(c: CanvasRenderingContext2D, numbers: readonly ItemNumber[], underline: boolean, view: View, m: RenderMetrics, palette: Palette): void {
  const k = PX_PER_CM * view.zoom
  for (const n of numbers) {
    if (n.geom) {
      drawDimensionGeom(c, n.geom, n.text, palette.ink, view, m, palette, false, underline)
      continue
    }
    const at = { x: (n.center.x - view.pan.x) * k, y: (n.center.y - view.pan.y) * k }
    c.save()
    c.textBaseline = "middle"
    c.fillStyle = palette.ink
    c.fillText(n.text, at.x, at.y)
    c.restore()
    if (underline) drawUnderline(c, { x: at.x, y: at.y + m.labelPx / 2 + UNDERLINE_GAP_PX }, { x: 1, y: 0 }, n.widthCm * k, palette.ink, m)
  }
}

export function drawFurnitureScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  scene: FurnitureView,
  unit: Unit,
  view: View,
  opts: ReconstructionOptions = {},
): void {
  const m = opts.metrics ?? SCREEN_METRICS
  const palette = opts.palette ?? LIGHT_PALETTE
  const theme = opts.theme ?? "light"

  const above = (c: CanvasRenderingContext2D, toScreen: (p: Point) => Point): void => {
    // обводка выделения и ластика по силуэту рисунка — под линиями, внутри силуэта без заливки
    for (const t of scene.items) {
      const color = scene.erasingItemId === t.id ? palette.erase : scene.selectedItemIds?.has(t.id) ? palette.selection : null
      if (!color) continue
      c.strokeStyle = color
      c.lineWidth = m.contourPx * 4
      c.lineJoin = "round"
      tracePolygons(c, [itemDrawingInPlan(t).outline.map(toScreen)])
      c.stroke()
      c.lineJoin = "miter"
    }
    const paint = (t: FurnitureItem): void => {
      c.strokeStyle = palette.ink
      c.lineWidth = m.contourPx
      traceLines(c, itemDrawingInPlan(t).lines.map((line) => line.map(toScreen)))
      c.stroke()
    }
    for (const t of scene.items) paint(t)
    if (scene.itemGhost) {
      c.globalAlpha = GHOST_ALPHA
      paint(scene.itemGhost)
      c.globalAlpha = 1
    }
    c.fillStyle = conflictColor(theme)
    for (const o of scene.overlaps ?? []) {
      tracePolygons(c, [o.region.map(toScreen)])
      c.fill()
    }
    // габариты всех предметов и призрака поверх подсветки; у выделенного — его правимые числа (change furniture-dimensions, design D5)
    const k = PX_PER_CM * view.zoom
    const editable = scene.editable ?? null
    c.save()
    c.font = `${m.labelPx}px ${m.font}`
    c.textAlign = "center"
    c.textBaseline = "bottom"
    for (const t of scene.items) if (t.id !== editable?.itemId) drawItemNumbers(c, itemSizeLayout(t, unit, k, m), false, view, m, palette)
    if (scene.itemGhost) {
      c.globalAlpha = GHOST_ALPHA
      drawItemNumbers(c, itemSizeLayout(scene.itemGhost, unit, k, m), false, view, m, palette)
      c.globalAlpha = 1
    }
    if (editable) drawItemNumbers(c, editable.numbers, true, view, m, palette)
    c.restore()
    scene.above?.(c, toScreen)
  }

  drawReconstructionScene(ctx, w, h, { ...scene, above }, unit, view, opts)
}

// то же на холсте страницы (размер и плотность пикселей как у render)
export function renderFurniture(canvas: HTMLCanvasElement, scene: FurnitureView, unit: Unit, view: View, opts: ReconstructionOptions = {}): void {
  const target = prepareCanvas(canvas)
  if (target) drawFurnitureScene(target.ctx, target.w, target.h, scene, unit, view, opts)
}
