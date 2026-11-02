import type { DimGeometry } from "./geometry"
import { UNDERLINE_GAP_PX, drawDimensionGeom, drawUnderline } from "./render"
import type { RenderMetrics } from "./render"
import type { Palette } from "./theme"
import { PX_PER_CM } from "./types"
import type { Point, View } from "./types"

// Числа выделенного объекта на холсте: размерная линия в стиле размеров плана или одно число у точки (нулевое расстояние);
// у правимых числа подчёркнуты. Общая отрисовка для предмета «Мебели» (change furniture-dimensions) и детали разреза
// (change add-section-shapes), чтобы раскладки разных планов выглядели одинаково.

export interface DrawnNumber {
  text: string
  geom: DimGeometry | null // размерная линия; null — только число
  center: Point // центр текста числа, чертёж
  widthCm: number
}

export function drawNumbers(c: CanvasRenderingContext2D, numbers: readonly DrawnNumber[], underline: boolean, view: View, m: RenderMetrics, palette: Palette): void {
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
