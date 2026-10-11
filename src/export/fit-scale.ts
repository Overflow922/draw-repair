import { legendWidthMm } from "./legend"
import { fitsFormat, pageBounds } from "./pdf"
import type { PageFormat, PlanPage } from "./pdf"
import { formatScale, SCALE_SERIES } from "./scale-series"
import type { ScaleDenominator } from "./scale-series"

export { formatScale, SCALE_SERIES }
export type { ScaleDenominator }

const COARSEST_SCALE: ScaleDenominator = 1000

// Самый крупный масштаб ряда, при котором чертёж каждой страницы со стенами целиком помещается в область чертежа
// формата (с учётом столбца легенды всего документа). Не поместился даже самый мелкий — он же и берётся;
// null — на страницах нет стен, подбирать нечем (spec drawing-scale «Автоподбор масштаба», «Единый масштаб документа»).
export function fitScale(pages: PlanPage[], format: PageFormat): ScaleDenominator | null {
  const filled = pages.filter((p) => p.walls.length > 0)
  if (filled.length === 0) return null
  const legendMm = legendWidthMm(pages)
  const fits = (scale: ScaleDenominator): boolean => filled.every((p) => fitsFormat(pageBounds(p, scale), scale, format, legendMm))
  return SCALE_SERIES.find(fits) ?? COARSEST_SCALE
}

// Текст подписи масштаба рядом со списком формата; пустой, если масштаб не подобран
export function scaleLabel(pages: PlanPage[], format: PageFormat): string {
  const scale = fitScale(pages, format)
  return scale === null ? "" : formatScale(scale)
}
