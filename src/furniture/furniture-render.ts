import { drawReconstructionScene } from "../reconstruction/reconstruction-render"
import type { ReconstructionOptions, ReconstructionView } from "../reconstruction/reconstruction-render"
import { SCREEN_METRICS, prepareCanvas, tracePolygons } from "../render"
import { LIGHT_PALETTE } from "../theme"
import type { Theme } from "../theme"
import type { Point, FurnitureItem, Unit, View } from "../types"
import type { Overlap } from "./overlap"
import { kindEntry } from "./furniture-kinds"
import type { FurnitureKind, ItemColors } from "./furniture-kinds"
import { itemCorners } from "./item"

// Отрисовка плана «Мебель» (change furniture-plan-table, design D8): подложка — результат «Реконструкции» (рисует её функция
// плана «Реконструкция»), поверх неё столы в реальном масштабе, затем подсветка пересечений, затем размеры. Одна функция для
// холста и PDF: в PDF подсветка и призрак не передаются.

// цвет предмета задаёт каталог видов; PDF — всегда светлая схема (spec furniture-plan «Отображение плана «Мебель» и цвет стола»,
// «Каталог видов мебели»)
export const itemColors = (kind: FurnitureKind, theme: Theme): ItemColors => kindEntry(kind).colors[theme]

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
  const theme = opts.theme ?? "light"

  const outline = (t: FurnitureItem, toScreen: (p: Point) => Point): Point[] => itemCorners(t).map(toScreen)

  const above = (c: CanvasRenderingContext2D, toScreen: (p: Point) => Point): void => {
    // обводка выделения и ластика — под телом стола
    for (const t of scene.items) {
      const color = scene.erasingItemId === t.id ? palette.erase : scene.selectedItemIds?.has(t.id) ? palette.selection : null
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
    const paint = (t: FurnitureItem): void => {
      const colors = itemColors(t.kind, theme)
      c.fillStyle = colors.fill
      c.strokeStyle = colors.stroke
      c.lineWidth = m.contourPx
      tracePolygons(c, [outline(t, toScreen)])
      c.fill()
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
    scene.above?.(c, toScreen)
  }

  drawReconstructionScene(ctx, w, h, { ...scene, above }, unit, view, opts)
}

// то же на холсте страницы (размер и плотность пикселей как у render)
export function renderFurniture(canvas: HTMLCanvasElement, scene: FurnitureView, unit: Unit, view: View, opts: ReconstructionOptions = {}): void {
  const target = prepareCanvas(canvas)
  if (target) drawFurnitureScene(target.ctx, target.w, target.h, scene, unit, view, opts)
}
