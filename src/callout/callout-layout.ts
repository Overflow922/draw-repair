import type { RenderMetrics } from "../render"
import type { Callout, Point, View } from "../types"
import { PX_PER_CM } from "../types"

// Раскладка текста выноски в экранных пикселях (change add-callout, spec callout «Отображение выноски», design D6).
// Чистая функция: ширину строки даёт переданный измеритель, поэтому раскладка одна для экрана и PDF.

export type Measure = (line: string) => number

export interface CalloutLayout {
  align: "left" | "right"
  // x — левый край строки, y — её нижняя кромка; строки в порядке ввода, первая выше остальных
  lines: { text: string; x: number; y: number }[]
  // подложка текста с полем: охватывает все строки
  box: { x: number; y: number; w: number; h: number }
  lineStart: Point
  arrowTip: Point
}

// межстрочный интервал и поле подложки — в долях размера шрифта, одни на все выноски
export const LINE_STEP_EM = 1.25
export const BOX_PAD_EM = 0.25

export function calloutLayout(c: Callout, view: View, m: RenderMetrics, measure: Measure): CalloutLayout {
  const k = PX_PER_CM * view.zoom
  const toScreen = (p: Point): Point => ({ x: (p.x - view.pan.x) * k, y: (p.y - view.pan.y) * k })
  const at = toScreen(c.at)
  // стрелка правее текста — выравнивание по правому краю у точки текста, иначе по левому
  const align = c.target.x > c.at.x ? "right" : "left"
  const step = m.labelPx * LINE_STEP_EM
  const lines = c.text.split("\n").map((text, i) => ({
    text,
    x: align === "right" ? at.x - measure(text) : at.x,
    y: at.y + i * step,
  }))
  const pad = m.labelPx * BOX_PAD_EM
  const minX = Math.min(...lines.map((l) => l.x)) - pad
  const maxX = Math.max(...lines.map((l) => l.x + measure(l.text))) + pad
  const top = lines[0].y - m.labelPx - pad
  const bottom = lines[lines.length - 1].y + pad
  const box = { x: minX, y: top, w: maxX - minX, h: bottom - top }
  // линия выходит из подложки у её ближнего к стрелке края на уровне нижней кромки первой строки
  const lineStart = { x: align === "right" ? maxX : minX, y: lines[0].y }
  return { align, lines, box, lineStart, arrowTip: toScreen(c.target) }
}
