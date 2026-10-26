import type { ExplicatedRoom } from "./room-explication"
import type { Point } from "./types"
import { pointInPolygon } from "./wall-geometry"

// Привязка объекта к помещению экспликации опорной точкой (change add-ceiling-plan, design D3): общие правила стяжки и
// натяжного потолка. Объект действует, пока его опорная точка лежит в помещении вне островов; в помещении действует первый
// в списке из таких объектов, остальные спят. Привязка — вычисляемая производная, в хранилище не пишется. Чистые функции.

export interface Anchored {
  id: string
  at: Point
}

export interface ActiveAnchored<T extends Anchored> {
  object: T
  item: ExplicatedRoom
}

const inRoom = (p: Point, item: ExplicatedRoom): boolean =>
  pointInPolygon(p, item.room.outline) && !item.room.holes.some((h) => pointInPolygon(p, h))

// помещение экспликации под точкой или null
export const roomAt = (p: Point, items: readonly ExplicatedRoom[]): ExplicatedRoom | null => items.find((i) => inRoom(p, i)) ?? null

// Действующие объекты в порядке списка: у каждого помещения — самый ранний из тех, чья опорная точка в нём лежит.
export function activeAnchored<T extends Anchored>(items: readonly ExplicatedRoom[], list: readonly T[]): ActiveAnchored<T>[] {
  const owner = new Map<ExplicatedRoom, T>()
  const placed = list.flatMap((object) => {
    const item = roomAt(object.at, items)
    if (!item) return []
    if (!owner.has(item)) owner.set(item, object)
    return [{ object, item }]
  })
  return placed.filter((p) => owner.get(p.item) === p.object)
}

// Помещение под точкой, в которое можно поставить новый объект (в нём нет действующего), или null.
export function canAnchor<T extends Anchored>(items: readonly ExplicatedRoom[], list: readonly T[], p: Point): ExplicatedRoom | null {
  const item = roomAt(p, items)
  if (!item) return null
  return activeAnchored(items, list).some((a) => a.item === item) ? null : item
}
