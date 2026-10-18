import type { ExplicatedRoom } from "../room-explication"
import type { Point, Screed } from "../types"
import { pointInPolygon } from "../wall-geometry"

// Стяжка помещения (change add-rough-works-plan, design D1, D2): хранится список стяжек с опорной точкой; стяжка действует,
// пока её опорная точка лежит в помещении экспликации вне островов. Привязка — вычисляемая производная, в хранилище не
// пишется. Чистые функции, входы не мутируются.

export interface ActiveScreed {
  screed: Screed
  item: ExplicatedRoom
}

const inRoom = (p: Point, item: ExplicatedRoom): boolean =>
  pointInPolygon(p, item.room.outline) && !item.room.holes.some((h) => pointInPolygon(p, h))

// помещение экспликации под точкой или null
export const roomAt = (p: Point, items: readonly ExplicatedRoom[]): ExplicatedRoom | null => items.find((i) => inRoom(p, i)) ?? null

// Действующие стяжки: у каждого помещения — самая ранняя в списке из тех, чья опорная точка в нём лежит; остальные спят.
// Порядок результата — порядок списка стяжек.
export function activeScreeds(items: readonly ExplicatedRoom[], screeds: readonly Screed[]): ActiveScreed[] {
  const owner = new Map<ExplicatedRoom, Screed>()
  const placed = screeds.flatMap((screed) => {
    const item = roomAt(screed.at, items)
    if (!item) return []
    if (!owner.has(item)) owner.set(item, screed)
    return [{ screed, item }]
  })
  return placed.filter((p) => owner.get(p.item) === p.screed)
}

// Постановка кликом: стяжка с опорной точкой в точке клика. Тот же массив, если клик вне помещений экспликации или в
// помещении уже есть действующая стяжка.
export function addScreed(
  screeds: Screed[],
  items: readonly ExplicatedRoom[],
  at: Point,
  thicknessMm: number,
  newId: () => string = () => crypto.randomUUID(),
): Screed[] {
  const item = roomAt(at, items)
  if (!item) return screeds
  if (activeScreeds(items, screeds).some((a) => a.item === item)) return screeds
  return [...screeds, { id: newId(), at: { x: at.x, y: at.y }, thicknessMm }]
}

export function removeScreed(screeds: Screed[], id: string): Screed[] {
  return screeds.some((s) => s.id === id) ? screeds.filter((s) => s.id !== id) : screeds
}

export function setScreedThickness(screeds: Screed[], id: string, thicknessMm: number): Screed[] {
  const target = screeds.find((s) => s.id === id)
  if (!target || target.thicknessMm === thicknessMm) return screeds
  return screeds.map((s) => (s.id === id ? { ...s, thicknessMm } : s))
}
