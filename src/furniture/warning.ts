import { FURNITURE_KIND_ORDER, kindEntry } from "./furniture-kinds"
import type { FurnitureKind } from "./furniture-kinds"
import { overlapKinds } from "./overlap"
import type { ObstacleKind, Overlap } from "./overlap"

// Плашка-предупреждение о пересечениях (change furniture-plan-table, design D8; change furniture-items-catalog, design D3): текст
// по видам объектов, с которыми пересекается мебель плана. Чистая функция: DOM обновляет main.ts.

const OBSTACLE_LABEL: Record<Exclude<ObstacleKind, "furniture">, string> = {
  wall: "стена",
  drywall: "гипсокартон",
  plaster: "штукатурка",
  opening: "проём",
  door: "дверь",
  window: "окно",
  battery: "батарея",
  communication: "коммуникация",
}

const involvedKinds = (overlaps: readonly Overlap[]): Set<FurnitureKind> =>
  new Set(overlaps.flatMap((o) => (o.otherKind === undefined ? [o.itemKind] : [o.itemKind, o.otherKind])))

// «Стол пересекается: стена, штукатурка»; null — пересечений нет и плашка скрыта. Начало — название вида, если пересекающиеся
// предметы одного вида, иначе «Мебель»; предметы, пересёкшиеся друг с другом, называются словами своих видов в порядке каталога
export function warningText(overlaps: readonly Overlap[]): string | null {
  if (overlaps.length === 0) return null
  const kinds = overlapKinds(overlaps)
  const objects = kinds.flatMap((k) => (k === "furniture" ? [] : [OBSTACLE_LABEL[k]]))
  const paired = involvedKinds(overlaps.filter((o) => o.kind === "furniture"))
  const furniture = FURNITURE_KIND_ORDER.filter((k) => paired.has(k)).map((k) => kindEntry(k).plaqueWord)
  const all = involvedKinds(overlaps)
  const [only] = all
  const head = only !== undefined && all.size === 1 ? kindEntry(only).label : "Мебель"
  return `${head} пересекается: ${[...objects, ...furniture].join(", ")}`
}
