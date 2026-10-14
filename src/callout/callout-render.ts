import type { RenderMetrics } from "../render"
import type { Palette } from "../theme"
import type { Callout, View } from "../types"
import { PX_PER_CM } from "../types"
import { calloutLayout } from "./callout-layout"

// Отрисовка выносок (change add-callout, spec callout «Отображение выноски», design D7): размеры шрифта, стрелки и линии — из
// RenderMetrics, поэтому не зависят от зума и совпадают с размерами на экране и в PDF

const HANDLE_PX = 5
const HANDLE_LINE_PX = 1.5

export interface CalloutMarks {
  selected?: string | null // выделенная выноска: маркеры у точки стрелки и у точки текста
  erasing?: string | null // выноска под курсором ластика: подсветка цветом ластика
}

export function drawCallouts(ctx: CanvasRenderingContext2D, list: readonly Callout[], view: View, m: RenderMetrics, p: Palette, marks: CalloutMarks = {}): void {
  const k = PX_PER_CM * view.zoom
  ctx.save()
  ctx.font = `${m.labelPx}px ${m.font}`
  const measure = (line: string): number => ctx.measureText(line).width
  for (const c of list) {
    const l = calloutLayout(c, view, m, measure)
    // стрелка — тот же треугольник, что у размерных линий, остриё в точке стрелки, основание в сторону текста
    const dx = l.lineStart.x - l.arrowTip.x
    const dy = l.lineStart.y - l.arrowTip.y
    const len = Math.hypot(dx, dy) || 1
    const dir = { x: dx / len, y: dy / len }
    // подложка цвета фона — раньше текста, чтобы линии чертежа под ним не мешали
    ctx.fillStyle = p.paper
    ctx.beginPath()
    ctx.rect(l.box.x, l.box.y, l.box.w, l.box.h)
    ctx.fill()
    ctx.strokeStyle = p.ink
    ctx.lineWidth = m.hatchPx
    ctx.beginPath()
    ctx.moveTo(l.lineStart.x, l.lineStart.y)
    ctx.lineTo(l.arrowTip.x, l.arrowTip.y)
    ctx.stroke()
    ctx.fillStyle = p.ink
    ctx.beginPath()
    ctx.moveTo(l.arrowTip.x, l.arrowTip.y)
    const baseX = l.arrowTip.x + dir.x * m.dimArrowPx
    const baseY = l.arrowTip.y + dir.y * m.dimArrowPx
    ctx.lineTo(baseX - dir.y * (m.dimArrowPx / 3), baseY + dir.x * (m.dimArrowPx / 3))
    ctx.lineTo(baseX + dir.y * (m.dimArrowPx / 3), baseY - dir.x * (m.dimArrowPx / 3))
    ctx.closePath()
    ctx.fill()
    ctx.textAlign = "left"
    ctx.textBaseline = "bottom"
    for (const line of l.lines) if (line.text !== "") ctx.fillText(line.text, line.x, line.y)
    if (marks.erasing === c.id) {
      ctx.strokeStyle = p.erase
      ctx.lineWidth = m.contourPx
      ctx.beginPath()
      ctx.moveTo(l.lineStart.x, l.lineStart.y)
      ctx.lineTo(l.arrowTip.x, l.arrowTip.y)
      ctx.stroke()
      ctx.beginPath()
      ctx.rect(l.box.x, l.box.y, l.box.w, l.box.h)
      ctx.stroke()
    }
    if (marks.selected === c.id) {
      ctx.fillStyle = p.paper
      ctx.strokeStyle = p.handleStroke
      ctx.lineWidth = HANDLE_LINE_PX
      const textPoint = { x: (c.at.x - view.pan.x) * k, y: (c.at.y - view.pan.y) * k }
      for (const s of [l.arrowTip, textPoint]) {
        ctx.beginPath()
        ctx.arc(s.x, s.y, HANDLE_PX, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      }
    }
  }
  ctx.restore()
}
