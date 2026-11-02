import type { Point } from "../types"
import { shapeWorldBox } from "./section-layout"
import type { SectionEntry } from "./section-scene"

// Попадание клика в деталь разреза (change add-section-shapes, design D3; spec section-view «Выделение, перемещение и правка
// детали разреза»): штриховка и контур детали; тонкая деталь ловится с запасом в полрадиуса привязки. Чистые функции.

export interface ShapeRef {
  lineId: string
  shapeId: string
}

const REACH_K = 0.5 // запас вокруг прямоугольника детали в долях радиуса привязки

// деталь под точкой; при нескольких — последняя из списка (рисуется поверх)
export function pickShape(entries: readonly SectionEntry[], p: Point, radiusCm: number): ShapeRef | null {
  const reach = radiusCm * REACH_K
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i]
    for (let j = e.shapes.length - 1; j >= 0; j--) {
      const box = shapeWorldBox(e.placement, e.shapes[j])
      if (p.x >= box.minX - reach && p.x <= box.maxX + reach && p.y >= box.minY - reach && p.y <= box.maxY + reach) {
        return { lineId: e.line.id, shapeId: e.shapes[j].id }
      }
    }
  }
  return null
}
