import type { Dimension, DimPoint } from "./types"

// Видимость собственных размеров плана над подложкой (change reconstruction-plan, design D2; общий для планов «Реконструкция» и
// «Мебель», change furniture-plan-table, design D3; и «Сантехника», change add-plumbing-plan, design D3): размер действует, пока
// видны все его опорные объекты. Чистая функция.

export interface DimensionTargets {
  walls: ReadonlySet<string>
  doorways: ReadonlySet<string>
  batteries: ReadonlySet<string>
  // приборы плана «Сантехника»; на других планах точек приборов нет
  items?: ReadonlySet<string>
}

// точка действует, пока опорная стена есть в сцене; откос — пока виден элемент подложки, угол — пока видна батарея, точка
// прибора — пока прибор есть на плане «Мебель»
const resolvable = (p: DimPoint, t: DimensionTargets): boolean => {
  if (p.kind === "jamb") return t.doorways.has(p.elementId)
  if (p.kind === "corner") return t.batteries.has(p.batteryId)
  if (p.kind === "item") return t.items?.has(p.itemId) ?? false
  return t.walls.has(p.a.wallId) && t.walls.has(p.b.wallId)
}

export const visibleDimensions = (dimensions: readonly Dimension[], targets: DimensionTargets): Dimension[] =>
  dimensions.filter((d) => resolvable(d.from, targets) && resolvable(d.to, targets))
