import type { jsPDF } from "jspdf"
import { demolitionColor } from "../demolition/demolition-render"
import { PDF_METRICS, SAMPLE_LENGTH_MM, SAMPLE_THICKNESS_MM, drawLegendSample, strokeHatch135, tracePolygons } from "../render"
import { LIGHT_PALETTE } from "../theme"
import type { Palette } from "../theme"
import type { Point } from "../types"
import { LEGEND_FONT_MM, LEGEND_GAP_MM, LEGEND_LINE_PITCH_MM, LEGEND_PAD_LEFT_MM, LEGEND_ROW_PITCH_MM, legendEntries, wrapLabel } from "./legend"
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
  ctx.lineWidth = m.hatchPx
  strokeHatch135(ctx, poly, 0, m)
  ctx.restore()
  ctx.strokeStyle = color
  ctx.lineWidth = m.contourPx
  tracePolygons(ctx, [poly])
  ctx.stroke()
}

function drawSample(ctx: CanvasRenderingContext2D, entry: LegendEntry, origin: Point, palette: Palette): void {
  if (entry.kind === "material") drawLegendSample(ctx, entry.material, origin, PDF_METRICS, palette)
  else drawDemolitionSample(ctx, origin)
}

// столбец легенды страницы: записи сверху вниз с верхнего края столбца; на странице «Демонтаж» образцы материалов серые,
// как подложка. Образец стоит по центру блока строк подписи.
export function drawLegend(doc: jsPDF, ctx: CanvasRenderingContext2D, page: PlanPage, column: Rect): void {
  const palette: Palette = page.demolition === undefined ? LIGHT_PALETTE : { ...LIGHT_PALETTE, ink: LIGHT_PALETTE.muted }
  legendEntries(page).forEach((entry, i) => {
    const centerY = column.y + LEGEND_ROW_PITCH_MM * (i + 0.5)
    const origin: Point = { x: column.x + LEGEND_PAD_LEFT_MM, y: centerY }
    drawSample(ctx, entry, origin, palette)
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
