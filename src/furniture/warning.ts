import { overlapKinds } from "./overlap"
import type { ObstacleKind, Overlap } from "./overlap"

// Плашка-предупреждение о пересечениях (change furniture-plan-table, design D8): текст по видам объектов, с которыми
// пересекаются столы плана. Чистая функция: DOM обновляет main.ts.

const KIND_LABEL: Record<ObstacleKind, string> = {
  wall: "стена",
  drywall: "гипсокартон",
  plaster: "штукатурка",
  opening: "проём",
  door: "дверь",
  window: "окно",
  battery: "батарея",
  communication: "коммуникация",
  table: "стол",
}

// «Стол пересекается: стена, штукатурка»; null — пересечений нет и плашка скрыта
export function warningText(overlaps: readonly Overlap[]): string | null {
  const kinds = overlapKinds(overlaps)
  return kinds.length === 0 ? null : `Стол пересекается: ${kinds.map((k) => KIND_LABEL[k]).join(", ")}`
}
