import { UNIT_TO_CM } from "./format-length"
import type { Unit } from "./types"

// значение поля панели в текущей единице → сантиметры; нечисловое, нулевое и отрицательное не применяется
export function parseLengthField(text: string, unit: Unit): number | null {
  const v = parseFloat(text.replace(",", "."))
  return Number.isFinite(v) && v > 0 ? v * UNIT_TO_CM[unit] : null
}
