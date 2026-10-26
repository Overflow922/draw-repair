import { anchorLabelBox } from "../anchor-label"
import { itemDrawingInPlan, traceLines } from "../furniture/furniture-render"
import { drawReconstructionScene } from "../reconstruction/reconstruction-render"
import type { ReconstructionOptions, ReconstructionView } from "../reconstruction/reconstruction-render"
import { prepareCanvas, SCREEN_METRICS, tracePolygons } from "../render"
import type { Room } from "../room-area"
import { LIGHT_PALETTE } from "../theme"
import type { FurnitureItem, Point, StretchCeiling, Unit, View } from "../types"
import { ceilingLabel } from "./ceiling"

// Отрисовка плана «Потолки и освещение» (change add-ceiling-plan, design D7): снизу вверх — подложка «Реконструкции» (та же, что у
// «Мебели»), предметы «Мебели» серыми линиями без габаритов и подсветок, полупрозрачная жёлтая заливка помещений с натяжным
// потолком (потолок висит над помещением), подписи потолков, выноски. Одна функция для холста и PDF.

export interface CeilingView extends Omit<ReconstructionView, "preview" | "outlines" | "handles" | "above"> {
  items: readonly FurnitureItem[]
  ceilings: readonly { ceiling: StretchCeiling; room: Room }[]
  selectedCeilingId?: string | null
  erasingCeilingId?: string | null
}

// прозрачность заливки натяжного потолка: одна на обеих схемах и в PDF; линии подложки и мебели видны сквозь заливку
export const CEILING_ALPHA = 0.35

// рисование с прозрачностью: на холсте — globalAlpha; контекст jsPDF его не выводит, поэтому PDF передаёт свою реализацию
export type Translucent = (alpha: number, paint: () => void) => void

export const canvasTranslucent =
  (ctx: CanvasRenderingContext2D): Translucent =>
  (alpha, paint) => {
    ctx.save()
    ctx.globalAlpha = alpha
    paint()
    ctx.restore()
  }

export interface CeilingOptions extends ReconstructionOptions {
  translucent?: Translucent
}

export function drawCeilingScene(ctx: CanvasRenderingContext2D, w: number, h: number, scene: CeilingView, unit: Unit, view: View, opts: CeilingOptions = {}): void {
  const m = opts.metrics ?? SCREEN_METRICS
  const palette = opts.palette ?? LIGHT_PALETTE
  const translucent = opts.translucent ?? canvasTranslucent(ctx)

  const above = (c: CanvasRenderingContext2D, toScreen: (p: Point) => Point): void => {
    // предметы — линиями цвета подложки: только для чтения, без габаритов, пересечений и выделения
    c.strokeStyle = palette.muted
    c.lineWidth = m.contourPx
    for (const t of scene.items) {
      traceLines(c, itemDrawingInPlan(t).lines.map((line) => line.map(toScreen)))
      c.stroke()
    }
    // заливка поверх подложки и мебели, полупрозрачная: линии видны сквозь неё; по контуру помещения, острова не заливаются (even-odd)
    for (const { room } of scene.ceilings) {
      translucent(CEILING_ALPHA, () => {
        c.fillStyle = palette.ceiling
        tracePolygons(c, [room.outline.map(toScreen), ...room.holes.map((hole) => hole.map(toScreen))])
        c.fill("evenodd")
      })
    }
    for (const { ceiling, room } of scene.ceilings) {
      if (scene.erasingCeilingId !== ceiling.id) continue
      c.strokeStyle = palette.erase
      c.lineWidth = m.contourPx * 2
      tracePolygons(c, [room.outline.map(toScreen)])
      c.stroke()
    }
    // подписи: подложка цвета бумаги и текст постоянного размера в опорной точке
    c.save()
    c.font = `${m.labelPx}px ${m.font}`
    c.textAlign = "center"
    c.textBaseline = "middle"
    for (const { ceiling } of scene.ceilings) {
      const at = toScreen(ceiling.at)
      const text = ceilingLabel(ceiling.dropMm)
      const box = anchorLabelBox(at, text, m.labelPx)
      c.fillStyle = palette.paper
      c.fillRect(box.x, box.y, box.w, box.h)
      c.fillStyle = palette.ink
      c.fillText(text, at.x, at.y)
      if (scene.selectedCeilingId === ceiling.id) {
        c.strokeStyle = palette.selection
        c.lineWidth = m.contourPx * 2
        c.strokeRect(box.x, box.y, box.w, box.h)
      }
    }
    c.restore()
  }

  drawReconstructionScene(ctx, w, h, { ...scene, above }, unit, view, opts)
}

// то же на холсте страницы (размер и плотность пикселей как у render)
export function renderCeiling(canvas: HTMLCanvasElement, scene: CeilingView, unit: Unit, view: View, opts: CeilingOptions = {}): void {
  const target = prepareCanvas(canvas)
  if (target) drawCeilingScene(target.ctx, target.w, target.h, scene, unit, view, opts)
}
