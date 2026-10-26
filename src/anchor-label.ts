import { CHAR_WIDTH } from "./doorway/element-label"
import type { Point, View } from "./types"
import { PX_PER_CM } from "./types"

// Подпись объекта помещения в опорной точке (change add-rough-works-plan, design D8; обобщено в change add-ceiling-plan,
// design D5): центрированный текст постоянного экранного размера; рамка подписи — область попадания и подложка. Раскладка в
// единицах холста (px) или листа (мм). Общая для подписей стяжки «h = 65мм» и натяжного потолка «-50мм».

const PAD_EM = 0.4

export interface LabelBox {
  x: number
  y: number
  w: number
  h: number
}

// рамка подписи text с центром в точке center (единицы кегля fontPx)
export function anchorLabelBox(center: Point, text: string, fontPx: number): LabelBox {
  const w = text.length * fontPx * CHAR_WIDTH + 2 * PAD_EM * fontPx
  const h = fontPx * (1 + 2 * PAD_EM)
  return { x: center.x - w / 2, y: center.y - h / 2, w, h }
}

// объект, подпись которого лежит под точкой чертежа (при масштабе просмотра view); из нескольких — последний в списке
export function anchorLabelAt<T extends { at: Point }>(p: Point, list: readonly T[], text: (t: T) => string, view: View, fontPx: number): T | null {
  const k = PX_PER_CM * view.zoom
  const screen = { x: (p.x - view.pan.x) * k, y: (p.y - view.pan.y) * k }
  for (let i = list.length - 1; i >= 0; i--) {
    const t = list[i]
    if (!t) continue
    const box = anchorLabelBox({ x: (t.at.x - view.pan.x) * k, y: (t.at.y - view.pan.y) * k }, text(t), fontPx)
    if (screen.x >= box.x && screen.x <= box.x + box.w && screen.y >= box.y && screen.y <= box.y + box.h) return t
  }
  return null
}
