import { CHAR_WIDTH } from "../doorway/element-label"
import { SMOKE_FONT_MM } from "../ceiling/light-symbol"
import type { LabelBox } from "../anchor-label"
import type { Palette } from "../theme"
import type { Point, View } from "../types"
import { PX_PER_CM } from "../types"

// Метка линии освещения на плане (change add-light-lines, design D5; вид — references/lines.png): текст имени кегля подписи
// «ДПС», левый нижний угол — центр светильника плюс (2 мм, −2 мм) бумаги, то есть правее и выше знака; текст горизонтален.
// Раскладка в единицах носителя: u — единиц носителя на мм бумаги (на холсте LIGHT_SYMBOL_PX_PER_MM, в PDF 1).

const OFFSET_MM = 2
export const LINE_LABEL_HIT_PAD_PX = 4 // поле рамки клика вокруг текста

// левый нижний угол текста метки; center — центр светильника в единицах носителя
export const lineLabelCorner = (center: Point, u: number): Point => ({ x: center.x + OFFSET_MM * u, y: center.y - OFFSET_MM * u })

// рамка текста метки: высота — кегль, ширина — по числу символов
export function lineLabelBox(center: Point, text: string, u: number): LabelBox {
  const corner = lineLabelCorner(center, u)
  const fontPx = SMOKE_FONT_MM * u
  return { x: corner.x, y: corner.y - fontPx, w: text.length * fontPx * CHAR_WIDTH, h: fontPx }
}

export interface LineLabelHighlight {
  color: string
  lineWidth: number
}

// u — единиц носителя на мм бумаги; font — гарнитура носителя; highlight — рамка выделения или ластика (только на холсте)
export function drawLineLabel(ctx: CanvasRenderingContext2D, text: string, center: Point, u: number, palette: Palette, font: string, highlight?: LineLabelHighlight): void {
  const corner = lineLabelCorner(center, u)
  ctx.save()
  ctx.font = `${SMOKE_FONT_MM * u}px ${font}`
  ctx.textAlign = "left"
  ctx.textBaseline = "bottom"
  ctx.fillStyle = palette.lightingRed
  ctx.fillText(text, corner.x, corner.y)
  if (highlight) {
    const box = lineLabelBox(center, text, u)
    const pad = LINE_LABEL_HIT_PAD_PX / 2
    ctx.strokeStyle = highlight.color
    ctx.lineWidth = highlight.lineWidth
    ctx.beginPath()
    ctx.rect(box.x - pad, box.y - pad, box.w + 2 * pad, box.h + 2 * pad)
    ctx.stroke()
  }
  ctx.restore()
}

// метка, чей текст лежит под точкой чертежа (при масштабе просмотра view); из нескольких — последняя в списке
export function lineLabelAt<T extends { at: Point; name: string }>(p: Point, list: readonly T[], view: View, u: number): T | null {
  const k = PX_PER_CM * view.zoom
  const screen = { x: (p.x - view.pan.x) * k, y: (p.y - view.pan.y) * k }
  for (let i = list.length - 1; i >= 0; i--) {
    const t = list[i]
    if (!t) continue
    const box = lineLabelBox({ x: (t.at.x - view.pan.x) * k, y: (t.at.y - view.pan.y) * k }, t.name, u)
    const pad = LINE_LABEL_HIT_PAD_PX
    if (screen.x >= box.x - pad && screen.x <= box.x + box.w + pad && screen.y >= box.y - pad && screen.y <= box.y + box.h + pad) return t
  }
  return null
}
