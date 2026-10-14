import type { RenderMetrics } from "../render"
import type { Callout, Point, View } from "../types"
import { PX_PER_CM } from "../types"
import { calloutLayout } from "./callout-layout"
import type { CalloutLayout, Measure } from "./callout-layout"

// Попадание курсора в выноску — для выделения и ластика (change add-callout, spec callout, design D6, D9)

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t))
}

const distanceToBox = (p: Point, b: CalloutLayout["box"]): number =>
  Math.hypot(Math.max(b.x - p.x, 0, p.x - (b.x + b.w)), Math.max(b.y - p.y, 0, p.y - (b.y + b.h)))

// Ближайшая к курсору выноска, у которой текст или линия со стрелкой в радиусе привязки; при равных расстояниях — последняя
// в списке (рисуется сверху). p — мировая точка, radiusCm — радиус привязки в см (12 px / масштаб)
export function pickCallout(list: readonly Callout[], p: Point, view: View, m: RenderMetrics, measure: Measure, radiusCm: number): Callout | null {
  const k = PX_PER_CM * view.zoom
  const s = { x: (p.x - view.pan.x) * k, y: (p.y - view.pan.y) * k }
  const radius = radiusCm * k
  let best: Callout | null = null
  let bestDistance = Infinity
  for (const c of list) {
    const l = calloutLayout(c, view, m, measure)
    const d = Math.min(distanceToBox(s, l.box), distanceToSegment(s, l.lineStart, l.arrowTip))
    if (d <= radius && d <= bestDistance) {
      best = c
      bestDistance = d
    }
  }
  return best
}
