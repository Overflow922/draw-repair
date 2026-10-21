import type { jsPDF } from "jspdf"
import { strokeBatteries } from "../battery/battery-render"
import { strokeCommunications } from "../communications/communications-render"
import { demolitionColor } from "../demolition/demolition-render"
import { PDF_METRICS, SAMPLE_LENGTH_MM, SAMPLE_THICKNESS_MM, drawLegendSample, tracePolygons } from "../render"
import { LIGHT_PALETTE } from "../theme"
import type { Palette } from "../theme"
import { PX_PER_CM } from "../types"
import type { Battery, Communication, Point, View, Wall } from "../types"
import { traceLines } from "../furniture/furniture-render"
import { kindEntry } from "../furniture/furniture-kinds"
import type { FurnitureKind } from "../furniture/furniture-kinds"
import { drywallColors } from "../reconstruction/reconstruction-render"
import { plasterColors } from "../rough/rough-render"
import { DEMOLITION_HATCH, SCREED_HATCH, strokeHatchSeries } from "../wall-hatch"
import {
  LEGEND_BATTERY_THICKNESS_MM,
  LEGEND_DUCT_DEPTH_MM,
  LEGEND_DUCT_WIDTH_MM,
  LEGEND_FONT_MM,
  LEGEND_GAP_MM,
  LEGEND_ITEM_MM_PER_CM,
  LEGEND_LINE_PITCH_MM,
  LEGEND_PAD_LEFT_MM,
  LEGEND_RISER_DIAMETER_MM,
  LEGEND_ROW_PITCH_MM,
  legendEntries,
  wrapLabel,
} from "./legend"
import type { LegendEntry } from "./legend"
import type { PlanPage } from "./pdf"
import type { Rect } from "./sheet-layout"

// Отрисовка легенды страницы PDF (change pdf-legend, design D4, D5, D7): образцы рисуются теми же рендерами, что и
// чертёж, подписи — текстом PTSans в одну или несколько строк. Всё в абсолютных миллиметрах листа.

// образец «Демонтируемая стена»: закраска бумагой, красный контур и красная штриховка 135° (как в drawDemolitionScene)
function drawDemolitionSample(ctx: CanvasRenderingContext2D, origin: Point): void {
  const m = PDF_METRICS
  const color = demolitionColor("light")
  const h = SAMPLE_THICKNESS_MM / 2
  const poly: Point[] = [
    { x: origin.x, y: origin.y - h },
    { x: origin.x + SAMPLE_LENGTH_MM, y: origin.y - h },
    { x: origin.x + SAMPLE_LENGTH_MM, y: origin.y + h },
    { x: origin.x, y: origin.y + h },
  ]
  ctx.save()
  ctx.fillStyle = LIGHT_PALETTE.paper
  tracePolygons(ctx, [poly])
  ctx.fill()
  ctx.clip()
  ctx.strokeStyle = color
  strokeHatchSeries(ctx, poly, DEMOLITION_HATCH, { x: 0, y: 0 }, m)
  ctx.restore()
  ctx.strokeStyle = color
  ctx.lineWidth = m.contourPx
  tracePolygons(ctx, [poly])
  ctx.stroke()
}

// прямоугольник образца: длина и толщина образца материала
function sampleRect(origin: Point): Point[] {
  const h = SAMPLE_THICKNESS_MM / 2
  return [
    { x: origin.x, y: origin.y - h },
    { x: origin.x + SAMPLE_LENGTH_MM, y: origin.y - h },
    { x: origin.x + SAMPLE_LENGTH_MM, y: origin.y + h },
    { x: origin.x, y: origin.y + h },
  ]
}

// образец «Гипсокартон»: зелёная заливка и тёмный контур, как на чертеже плана «Реконструкция»
function drawDrywallSample(ctx: CanvasRenderingContext2D, origin: Point): void {
  const colors = drywallColors("light")
  const poly = sampleRect(origin)
  ctx.fillStyle = colors.fill
  tracePolygons(ctx, [poly])
  ctx.fill()
  ctx.strokeStyle = colors.stroke
  ctx.lineWidth = PDF_METRICS.contourPx
  ctx.stroke()
}

// образец вида мебели (change furniture-line-drawings, design D4): рисунок вида в постоянном масштабе легенды, детали вместе с
// габаритами не уменьшаются; под образец подгоняются только габариты — размеры по умолчанию, уменьшенные в одном отношении
// настолько, чтобы рисунок поместился; вытянутый предмет повёрнут на 90° по часовой, чтобы длинная сторона шла вдоль образца;
// стоит по центру образца; линии цвета контуров светлой схемы, без заливки
function drawItemSample(ctx: CanvasRenderingContext2D, origin: Point, kind: FurnitureKind): void {
  const { defaults, drawing } = kindEntry(kind)
  const turned = defaults.lengthCm > defaults.widthCm
  const longCm = turned ? defaults.lengthCm : defaults.widthCm
  const shortCm = turned ? defaults.widthCm : defaults.lengthCm
  const fit = Math.min(1, SAMPLE_LENGTH_MM / (LEGEND_ITEM_MM_PER_CM * longCm), SAMPLE_THICKNESS_MM / (LEGEND_ITEM_MM_PER_CM * shortCm))
  const size = { widthCm: defaults.widthCm * fit, lengthCm: defaults.lengthCm * fit }
  const wMm = (turned ? size.lengthCm : size.widthCm) * LEGEND_ITEM_MM_PER_CM
  const hMm = (turned ? size.widthCm : size.lengthCm) * LEGEND_ITEM_MM_PER_CM
  const left = origin.x + (SAMPLE_LENGTH_MM - wMm) / 2
  const top = origin.y - hMm / 2
  const toSheet = (p: Point): Point => {
    const q = turned ? { x: size.lengthCm - p.y, y: p.x } : p
    return { x: left + q.x * LEGEND_ITEM_MM_PER_CM, y: top + q.y * LEGEND_ITEM_MM_PER_CM }
  }
  ctx.strokeStyle = LIGHT_PALETTE.ink
  ctx.lineWidth = PDF_METRICS.contourPx
  traceLines(ctx, drawing(size, 1).lines.map((line) => line.map(toSheet)))
  ctx.stroke()
}

// образец «Штукатурка»: фиолетовая заливка и тёмный контур, как на чертеже; на плане «Реконструкция» штукатурка серая
function drawPlasterSample(ctx: CanvasRenderingContext2D, origin: Point, grey: boolean): void {
  const m = PDF_METRICS
  const colors = grey ? { fill: LIGHT_PALETTE.muted, stroke: LIGHT_PALETTE.muted } : plasterColors("light")
  const poly = sampleRect(origin)
  ctx.fillStyle = colors.fill
  tracePolygons(ctx, [poly])
  ctx.fill()
  ctx.strokeStyle = colors.stroke
  ctx.lineWidth = m.contourPx
  ctx.stroke()
}

// образец «Стяжка до N мм»: тонкий контур и косая штриховка «/», как на чертеже
function drawScreedSample(ctx: CanvasRenderingContext2D, origin: Point): void {
  const m = PDF_METRICS
  const poly = sampleRect(origin)
  ctx.save()
  tracePolygons(ctx, [poly])
  ctx.clip()
  ctx.strokeStyle = LIGHT_PALETTE.ink
  strokeHatchSeries(ctx, poly, SCREED_HATCH, { x: 0, y: 0 }, m)
  ctx.restore()
  ctx.strokeStyle = LIGHT_PALETTE.ink
  ctx.lineWidth = m.hatchPx
  tracePolygons(ctx, [poly])
  ctx.stroke()
}

// вид, в котором одна единица чертежа равна одному миллиметру листа, а начало координат — в origin
const mmView = (origin: Point): View => ({ zoom: 1 / PX_PER_CM, pan: { x: -origin.x, y: -origin.y } })

// образец «Батарея»: батарея длиной 70 см на невидимой опорной стене, нарисованная рендером чертежа; единица вида — сантиметр,
// 70 см укладываются в длину образца, поэтому секции (шаг 10 см) читаются как на чертеже
function drawBatterySample(ctx: CanvasRenderingContext2D, origin: Point, palette: Palette): void {
  const lengthCm = 70
  const mmPerCm = SAMPLE_LENGTH_MM / lengthCm
  const thicknessCm = LEGEND_BATTERY_THICKNESS_MM / mmPerCm
  const hostY = -thicknessCm / 2
  const host: Wall = { id: "legend-host", a: { x: 0, y: hostY }, b: { x: lengthCm, y: hostY }, thicknessCm: 0, type: "brick" }
  const battery: Battery = { id: "legend-battery", wallId: host.id, face: 1, anchor: "a", offsetCm: 0, lengthCm, thicknessCm, gapCm: 0 }
  const view: View = { zoom: mmPerCm / PX_PER_CM, pan: { x: -origin.x / mmPerCm, y: -origin.y / mmPerCm } }
  strokeBatteries(ctx, [battery], [host], view, palette.ink, PDF_METRICS.contourPx, PDF_METRICS.hatchPx)
}

// образцы «Стояк» и «Воздуховод»: коммуникации тем же рендером и тем же цветом на любой странице
function drawCommunicationSample(ctx: CanvasRenderingContext2D, entry: LegendEntry, origin: Point): void {
  const center = { x: SAMPLE_LENGTH_MM / 2, y: 0 }
  const sample: Communication =
    entry.kind === "riser"
      ? { kind: "riser", id: "legend-riser", ...center, diameterCm: LEGEND_RISER_DIAMETER_MM }
      : { kind: "duct", id: "legend-duct", ...center, widthCm: LEGEND_DUCT_WIDTH_MM, depthCm: LEGEND_DUCT_DEPTH_MM }
  strokeCommunications(ctx, [sample], mmView(origin), LIGHT_PALETTE.ink, PDF_METRICS.contourPx, LIGHT_PALETTE.concreteFill)
}

function drawSample(ctx: CanvasRenderingContext2D, entry: LegendEntry, origin: Point, palette: Palette, greyPlaster: boolean): void {
  switch (entry.kind) {
    case "material":
      return drawLegendSample(ctx, entry.material, origin, PDF_METRICS, palette)
    case "battery":
      return drawBatterySample(ctx, origin, palette)
    case "riser":
    case "duct":
      return drawCommunicationSample(ctx, entry, origin)
    case "demolition":
      return drawDemolitionSample(ctx, origin)
    case "plaster":
      return drawPlasterSample(ctx, origin, greyPlaster)
    case "screed":
      return drawScreedSample(ctx, origin)
    case "drywall":
      return drawDrywallSample(ctx, origin)
    case "furniture":
      return drawItemSample(ctx, origin, entry.item)
  }
}

// столбец легенды страницы: записи сверху вниз с верхнего края столбца; на странице «Демонтаж» образцы материалов серые,
// как подложка. Образец стоит по центру блока строк подписи.
export function drawLegend(doc: jsPDF, ctx: CanvasRenderingContext2D, page: PlanPage, column: Rect): void {
  const underlay = page.demolition !== undefined || page.rough !== undefined || page.reconstruction !== undefined
  const palette: Palette = underlay ? { ...LIGHT_PALETTE, ink: LIGHT_PALETTE.muted } : LIGHT_PALETTE
  legendEntries(page).forEach((entry, i) => {
    const centerY = column.y + LEGEND_ROW_PITCH_MM * (i + 0.5)
    const origin: Point = { x: column.x + LEGEND_PAD_LEFT_MM, y: centerY }
    drawSample(ctx, entry, origin, palette, page.reconstruction !== undefined)
    // рендер образца меняет состояние шрифта документа, поэтому шрифт задаётся после образца
    doc.setFont(PDF_METRICS.font, "normal")
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(LEGEND_FONT_MM * doc.internal.scaleFactor)
    const lines = wrapLabel(entry.label)
    // базовая линия первой строки: центр блока минус половина его высоты плюс половина высоты прописных букв
    const first = centerY - (LEGEND_LINE_PITCH_MM * (lines.length - 1)) / 2 + 0.35 * LEGEND_FONT_MM
    lines.forEach((line, j) => doc.text(line, origin.x + SAMPLE_LENGTH_MM + LEGEND_GAP_MM, first + LEGEND_LINE_PITCH_MM * j))
  })
}
