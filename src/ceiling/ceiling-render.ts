import { anchorLabelBox } from "../anchor-label"
import { itemDrawingInPlan, traceLines } from "../furniture/furniture-render"
import { drawReconstructionScene } from "../reconstruction/reconstruction-render"
import type { ReconstructionOptions, ReconstructionView } from "../reconstruction/reconstruction-render"
import type { Shape } from "../communications/shape"
import { drawDimensionGeom, drawUnderline, SCREEN_METRICS, tracePolygons, UNDERLINE_GAP_PX } from "../render"
import type { RenderMetrics } from "../render"
import type { Room } from "../room-area"
import { LIGHT_PALETTE } from "../theme"
import type { Palette } from "../theme"
import type { FurnitureItem, LightFixture, Point, StretchCeiling, Unit, View } from "../types"
import { PX_PER_CM } from "../types"
import { ceilingLabel } from "./ceiling"
import { lightNumberLayout } from "./light-numbers"
import type { LightNumber } from "./light-numbers"
import { drawLightSymbol, lightHitRadiusPx } from "./light-symbol"

// Отрисовка плана «Потолки и освещение» (change add-ceiling-plan, design D7): снизу вверх — подложка «Реконструкции» (та же, что у
// «Мебели»), предметы «Мебели» серыми линиями без габаритов и подсветок, полупрозрачная жёлтая заливка помещений с натяжным
// потолком (потолок висит над помещением), подписи потолков, выноски. Одна функция для холста и PDF.

export interface CeilingView extends Omit<ReconstructionView, "preview" | "outlines" | "handles" | "above"> {
  items: readonly FurnitureItem[]
  ceilings: readonly { ceiling: StretchCeiling; room: Room }[]
  selectedCeilingId?: string | null
  erasingCeilingId?: string | null
  // объекты освещения (change add-ceiling-lighting, design D6): знаки и расстояния до чистовых граней lightBodies у всех объектов;
  // призрак, выделение (числа подчёркнуты — правятся) и подсветка ластика — только на холсте
  lights?: readonly LightFixture[]
  lightBodies?: readonly Shape[]
  // расстояния объектов освещения показаны, пока не сказано обратное; страница PDF «Потолки и освещение» их не рисует (change split-ceiling-pdf-pages, design D3)
  lightDistances?: boolean
  lightGhost?: LightFixture | null
  selectedLightId?: string | null
  // объекты освещения той же линии, что у выделенного объекта (change line-edit-and-highlight): подсвечены цветом выделения, только на холсте
  linkedLightIds?: ReadonlySet<string>
  erasingLightId?: string | null
  // слой поверх знаков освещения и до выносок (план «Группы включения», change add-light-lines: метки линий)
  aboveLights?: (c: CanvasRenderingContext2D, toScreen: (p: Point) => Point) => void
}

const GHOST_ALPHA = 0.4

// числа объекта: размерные линии в стиле размеров плана; ноль — одно число у центра
function drawLightNumbers(c: CanvasRenderingContext2D, numbers: readonly LightNumber[], underline: boolean, view: View, m: RenderMetrics, palette: Palette): void {
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

// подсветка выделения или ластика: окружность вокруг знака
function ringAround(c: CanvasRenderingContext2D, at: Point, l: LightFixture, color: string, m: RenderMetrics): void {
  c.save()
  c.strokeStyle = color
  c.lineWidth = m.contourPx * 2
  c.beginPath()
  c.arc(at.x, at.y, lightHitRadiusPx(l.kind) + m.contourPx * 2, 0, Math.PI * 2)
  c.stroke()
  c.restore()
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
    drawLights(c, toScreen)
  }

  // объекты освещения поверх подписей потолков: сначала все размерные линии и числа, затем знаки — линия знак не перечёркивает
  const drawLights = (c: CanvasRenderingContext2D, toScreen: (p: Point) => Point): void => {
    const bodies = scene.lightBodies ?? []
    const lights = scene.lights ?? []
    const ghost = scene.lightGhost ?? null
    const k = PX_PER_CM * view.zoom
    const numbersOf = (l: LightFixture): LightNumber[] => lightNumberLayout(l, bodies, unit, k, m)
    if (scene.lightDistances !== false) {
      c.save()
      c.font = `${m.labelPx}px ${m.font}`
      c.textAlign = "center"
      c.textBaseline = "bottom"
      for (const l of lights) drawLightNumbers(c, numbersOf(l), l.id === scene.selectedLightId, view, m, palette)
      if (ghost) translucent(GHOST_ALPHA, () => drawLightNumbers(c, numbersOf(ghost), false, view, m, palette))
      c.restore()
    }
    for (const l of lights) {
      const at = toScreen({ x: l.x, y: l.y })
      if (l.id === scene.erasingLightId) ringAround(c, at, l, palette.erase, m)
      else if (l.id === scene.selectedLightId || scene.linkedLightIds?.has(l.id)) ringAround(c, at, l, palette.selection, m)
      drawLightSymbol(c, l, at, m.symbolMmPx, palette, m.font)
    }
    if (ghost) translucent(GHOST_ALPHA, () => drawLightSymbol(c, ghost, toScreen({ x: ghost.x, y: ghost.y }), m.symbolMmPx, palette, m.font))
    scene.aboveLights?.(c, toScreen)
  }

  drawReconstructionScene(ctx, w, h, { ...scene, above }, unit, view, opts)
}
