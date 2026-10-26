import { anchorLabelAt, anchorLabelBox } from "../anchor-label"
import type { LabelBox } from "../anchor-label"
import type { Point, Screed, View } from "../types"
import { screedLabel } from "./rough-model"

// Подпись стяжки «h = 65мм» (change add-rough-works-plan, design D8): центрированный текст постоянного экранного размера в
// опорной точке; раскладка общая с подписью натяжного потолка (change add-ceiling-plan, design D5).

// рамка подписи с центром в точке center (единицы кегля fontPx)
export const screedLabelBox = (center: Point, thicknessMm: number, fontPx: number): LabelBox => anchorLabelBox(center, screedLabel(thicknessMm), fontPx)

// стяжка, подпись которой лежит под точкой чертежа (при масштабе просмотра view); из нескольких — последняя в списке
export const screedLabelAt = (p: Point, screeds: readonly Screed[], view: View, fontPx: number): Screed | null =>
  anchorLabelAt(p, screeds, (s) => screedLabel(s.thicknessMm), view, fontPx)
