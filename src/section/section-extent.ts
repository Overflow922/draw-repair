import type { Point } from "../types"
import { figureToWorld } from "./section-layout"
import { endMarks } from "./section-marks"
import type { SectionEntry } from "./section-scene"

// Габариты линии и фигуры разреза для страницы PDF (change add-section-view, design D8): рамка фигуры с названием над ней и
// обозначения на концах линии. kMm — мм листа на см чертежа, labelPx — кегль подписи в мм листа. Чистая функция.

const TITLE_HEIGHT_K = 1.4 // название стоит над верхом фигуры: отступ 0,4 кегля и сама строка

export function sectionExtent(entry: SectionEntry, kMm: number, labelPx: number): Point[] {
  const { placement } = entry
  const bottomRight = figureToWorld(placement, placement.width, 0)
  const topLeft = figureToWorld(placement, 0, placement.height + (labelPx * TITLE_HEIGHT_K) / kMm)
  const labels = endMarks(entry.shown).flatMap((m) => [m.end, m.tail, m.labelAt])
  return [topLeft, bottomRight, ...labels]
}
