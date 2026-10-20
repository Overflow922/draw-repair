import type { Unit } from "./types"

// сантиметров в единице измерения
export const UNIT_TO_CM: Record<Unit, number> = { m: 100, cm: 1, mm: 0.1 }

// число длины в текущей единице без суффикса; в метрах — с десятичной запятой
export function formatLength(cm: number, unit: Unit): string {
  if (unit === "cm") return `${Math.round(cm)}`
  if (unit === "mm") return `${Math.round(cm * 10)}`
  return `${(Math.round(cm) / 100).toString().replace(".", ",")}`
}
