import { drawReconstructionScene } from "../reconstruction/reconstruction-render"
import type { ReconstructionOptions, ReconstructionView } from "../reconstruction/reconstruction-render"
import { SCREEN_METRICS, prepareCanvas, tracePolygons } from "../render"
import { LIGHT_PALETTE } from "../theme"
import type { Theme } from "../theme"
import type { Point, Table, Unit, View } from "../types"
import type { Overlap } from "./overlap"
import { tableCorners } from "./table"

// Отрисовка плана «Мебель» (change furniture-plan-table, design D8): подложка — результат «Реконструкции» (рисует её функция
// плана «Реконструкция»), поверх неё столы в реальном масштабе, затем подсветка пересечений, затем размеры. Одна функция для
// холста и PDF: в PDF подсветка и призрак не передаются.

export interface TableColors {
  fill: string
  stroke: string
}

// стол — тёплая заливка с тёмным контуром, отличная от серой подложки, зелёного гипсокартона и красной подсветки;
// PDF — всегда светлая схема (spec furniture-plan «Отображение плана «Мебель» и цвет стола»)
export const tableColors = (theme: Theme): TableColors =>
  theme === "dark" ? { fill: "#b8863f", stroke: "#f3dcae" } : { fill: "#e0b46c", stroke: "#6b4510" }

// область пересечения стола с другими объектами — красная, полупрозрачная; цвет задаётся схемой
export const conflictColor = (theme: Theme): string => (theme === "dark" ? "rgba(248, 113, 113, 0.6)" : "rgba(220, 38, 38, 0.55)")

export interface FurnitureView extends ReconstructionView {
  tables: readonly Table[]
  selectedTableIds?: ReadonlySet<string>
  erasingTableId?: string | null
  // призрак под указателем у инструмента «Стол»
  tableGhost?: Table | null
  // области пересечений; только на холсте
  overlaps?: readonly Overlap[]
}

const GHOST_ALPHA = 0.4

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
  const colors = tableColors(opts.theme ?? "light")

  const outline = (t: Table, toScreen: (p: Point) => Point): Point[] => tableCorners(t).map(toScreen)

  const above = (c: CanvasRenderingContext2D, toScreen: (p: Point) => Point): void => {
    // обводка выделения и ластика — под телом стола
    for (const t of scene.tables) {
      const color = scene.erasingTableId === t.id ? palette.erase : scene.selectedTableIds?.has(t.id) ? palette.selection : null
      if (!color) continue
      c.strokeStyle = color
      c.fillStyle = color
      c.lineWidth = m.contourPx * 4
      c.lineJoin = "round"
      const poly = outline(t, toScreen)
      tracePolygons(c, [poly])
      c.fill()
      tracePolygons(c, [poly])
      c.stroke()
      c.lineJoin = "miter"
    }
    const paint = (t: Table): void => {
      c.fillStyle = colors.fill
      c.strokeStyle = colors.stroke
      c.lineWidth = m.contourPx
      tracePolygons(c, [outline(t, toScreen)])
      c.fill()
      c.stroke()
    }
    for (const t of scene.tables) paint(t)
    if (scene.tableGhost) {
      c.globalAlpha = GHOST_ALPHA
      paint(scene.tableGhost)
      c.globalAlpha = 1
    }
    c.fillStyle = conflictColor(opts.theme ?? "light")
    for (const o of scene.overlaps ?? []) {
      tracePolygons(c, [o.region.map(toScreen)])
      c.fill()
    }
    scene.above?.(c, toScreen)
  }

  drawReconstructionScene(ctx, w, h, { ...scene, above }, unit, view, opts)
}

// то же на холсте страницы (размер и плотность пикселей как у render)
export function renderFurniture(canvas: HTMLCanvasElement, scene: FurnitureView, unit: Unit, view: View, opts: ReconstructionOptions = {}): void {
  const target = prepareCanvas(canvas)
  if (target) drawFurnitureScene(target.ctx, target.w, target.h, scene, unit, view, opts)
}
