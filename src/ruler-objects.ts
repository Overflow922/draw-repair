import { batteryRect } from "./battery/battery-geometry"
import { itemCorners } from "./furniture/item"
import type { RulerObject } from "./ruler"
import type { Battery, Communication, FurnitureItem, Point, Wall } from "./types"
import { degenerate, dist } from "./wall-geometry"

// Объекты плана для линейки (change ruler-objects-span, design D2): батарея, воздуховод, стояк и предмет мебели
// приводятся к RulerObject. Чистые функции без DOM; входы не мутируются.

export interface RulerObjectSource {
  // стены плана: хозяева батарей
  walls: readonly Wall[]
  batteries: readonly Battery[]
  communications: readonly Communication[]
  items: readonly FurnitureItem[]
}

export function furnitureRulerObject(item: FurnitureItem): RulerObject {
  const [c0, c1] = itemCorners(item)
  const width = dist(c0, c1)
  return { kind: "rect", center: { x: item.x, y: item.y }, u: { x: (c1.x - c0.x) / width, y: (c1.y - c0.y) / width }, widthCm: item.widthCm, depthCm: item.lengthCm }
}

// ширина — длина батареи вдоль стены, глубина — толщина поперёк; без стены-хозяина объекта нет
export function batteryRulerObject(battery: Battery, walls: readonly Wall[]): RulerObject | null {
  const host = walls.find((w) => w.id === battery.wallId)
  if (!host || degenerate(host)) return null
  const [c0, c1, c2] = batteryRect(battery, host)
  const width = dist(c0, c1)
  const center: Point = { x: (c0.x + c2.x) / 2, y: (c0.y + c2.y) / 2 }
  return { kind: "rect", center, u: { x: (c1.x - c0.x) / width, y: (c1.y - c0.y) / width }, widthCm: width, depthCm: dist(c1, c2) }
}

export function communicationRulerObject(c: Communication): RulerObject {
  const center: Point = { x: c.x, y: c.y }
  return c.kind === "riser" ? { kind: "circle", center, diameterCm: c.diameterCm } : { kind: "rect", center, u: { x: 1, y: 0 }, widthCm: c.widthCm, depthCm: c.depthCm }
}

// порядок: батареи, коммуникации, мебель — он решает равенство расстояний до центров под курсором
export function rulerObjectsOf(source: RulerObjectSource): RulerObject[] {
  const batteries = source.batteries.flatMap((b) => batteryRulerObject(b, source.walls) ?? [])
  return [...batteries, ...source.communications.map(communicationRulerObject), ...source.items.map(furnitureRulerObject)]
}
