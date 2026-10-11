// Ряд масштабов печати и запись «1:X» (spec drawing-scale «Ряд масштабов»). Отдельный модуль без зависимостей:
// им пользуется и подбор масштаба (fit-scale), и основная надпись (sheet-layout), а подбор зависит от pdf, который
// зависит от sheet-layout, — общий ряд здесь не даёт циклов импорта.

// от самого крупного масштаба к самому мелкому
export const SCALE_SERIES = [2, 2.5, 4, 5, 10, 15, 20, 25, 40, 50, 75, 100, 200, 400, 500, 800, 1000] as const

export type ScaleDenominator = (typeof SCALE_SERIES)[number]

// «1:X»; нецелый знаменатель — с десятичной запятой («1:2,5»)
export function formatScale(denominator: number): string {
  return `1:${String(denominator).replace(".", ",")}`
}
