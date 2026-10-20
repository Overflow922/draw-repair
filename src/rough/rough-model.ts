// Толщины слоёв плана «Черновые работы» (change add-rough-works-plan, spec rough-works-plan «Параметры инструментов»):
// целые миллиметры в диапазоне; значения для новых объектов в чертёж не входят.

import type { PlasterMark, SidePlasterMark } from "../types"

export interface ThicknessRange {
  min: number
  max: number
  default: number
}

export const PLASTER_THICKNESS: ThicknessRange = { min: 5, max: 100, default: 20 }
export const SCREED_THICKNESS: ThicknessRange = { min: 10, max: 200, default: 50 }

// пометка продольной грани (не торец и не откос)
export const isSideMark = (m: PlasterMark): m is SidePlasterMark => m.face === 1 || m.face === -1

export const isThickness = (value: unknown, range: ThicknessRange): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= range.min && value <= range.max

// толщина из поля ввода: целое число миллиметров в диапазоне, иначе null (ввод не применяется)
export function parseThickness(text: string, range: ThicknessRange): number | null {
  const t = text.trim()
  if (!/^\d+$/.test(t)) return null
  const n = Number(t)
  return isThickness(n, range) ? n : null
}

// подпись стяжки на холсте и в PDF
export const screedLabel = (thicknessMm: number): string => `h = ${thicknessMm}мм`
