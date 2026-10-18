import { CHAR_WIDTH } from "../doorway/element-label"
import type { Point, Screed, View } from "../types"
import { PX_PER_CM } from "../types"
import { screedLabel } from "./rough-model"

// Подпись стяжки «h = 65мм» (change add-rough-works-plan, design D8): центрированный текст постоянного экранного размера в
// опорной точке; рамка подписи — область попадания и подложка. Раскладка в единицах холста (px) или листа (мм).

const PAD_EM = 0.4

export interface LabelBox {
  x: number
  y: number
  w: number
  h: number
}

// рамка подписи с центром в точке center (единицы кегля fontPx)
export function screedLabelBox(center: Point, thicknessMm: number, fontPx: number): LabelBox {
  const w = screedLabel(thicknessMm).length * fontPx * CHAR_WIDTH + 2 * PAD_EM * fontPx
  const h = fontPx * (1 + 2 * PAD_EM)
  return { x: center.x - w / 2, y: center.y - h / 2, w, h }
}

// стяжка, подпись которой лежит под точкой чертежа (при масштабе просмотра view); из нескольких — последняя в списке
export function screedLabelAt(p: Point, screeds: readonly Screed[], view: View, fontPx: number): Screed | null {
  const k = PX_PER_CM * view.zoom
  const screen = { x: (p.x - view.pan.x) * k, y: (p.y - view.pan.y) * k }
  for (let i = screeds.length - 1; i >= 0; i--) {
    const s = screeds[i]
    if (!s) continue
    const box = screedLabelBox({ x: (s.at.x - view.pan.x) * k, y: (s.at.y - view.pan.y) * k }, s.thicknessMm, fontPx)
    if (screen.x >= box.x && screen.x <= box.x + box.w && screen.y >= box.y && screen.y <= box.y + box.h) return s
  }
  return null
}
