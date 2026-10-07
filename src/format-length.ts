import type { Unit } from "./types"

// число длины в текущей единице без суффикса; в метрах — с десятичной запятой
export function formatLength(cm: number, unit: Unit): string {
  if (unit === "cm") return `${Math.round(cm)}`
  if (unit === "mm") return `${Math.round(cm * 10)}`
  return `${(Math.round(cm) / 100).toString().replace(".", ",")}`
}
