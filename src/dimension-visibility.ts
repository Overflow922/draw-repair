import type { Dimension, DimPoint } from "./types"

// Видимость собственных размеров плана над подложкой (change reconstruction-plan, design D2; общий для планов «Реконструкция» и
// «Мебель», change furniture-plan-table, design D3): размер действует, пока видны все его опорные объекты. Чистая функция.

export interface DimensionTargets {
  walls: ReadonlySet<string>
  doorways: ReadonlySet<string>
  batteries: ReadonlySet<string>
}

// точка действует, пока опорная стена есть в сцене; откос — пока виден элемент подложки, угол — пока видна батарея
const resolvable = (p: DimPoint, t: DimensionTargets): boolean => {
  if (p.kind === "jamb") return t.doorways.has(p.elementId)
  if (p.kind === "corner") return t.batteries.has(p.batteryId)
  return t.walls.has(p.a.wallId) && t.walls.has(p.b.wallId)
}

export const visibleDimensions = (dimensions: readonly Dimension[], targets: DimensionTargets): Dimension[] =>
  dimensions.filter((d) => resolvable(d.from, targets) && resolvable(d.to, targets))
