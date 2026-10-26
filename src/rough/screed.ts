import type { ExplicatedRoom } from "../room-explication"
import { activeAnchored, canAnchor } from "../room-anchor"
import type { Point, Screed } from "../types"

// Стяжка помещения (change add-rough-works-plan, design D1, D2): хранится список стяжек с опорной точкой; стяжка действует,
// пока её опорная точка лежит в помещении экспликации вне островов. Привязка — общая с натяжным потолком
// (change add-ceiling-plan, design D3). Чистые функции, входы не мутируются.

export interface ActiveScreed {
  screed: Screed
  item: ExplicatedRoom
}

// Действующие стяжки: у каждого помещения — самая ранняя в списке из тех, чья опорная точка в нём лежит; остальные спят.
// Порядок результата — порядок списка стяжек.
export const activeScreeds = (items: readonly ExplicatedRoom[], screeds: readonly Screed[]): ActiveScreed[] =>
  activeAnchored(items, screeds).map((a) => ({ screed: a.object, item: a.item }))

// Постановка кликом: стяжка с опорной точкой в точке клика. Тот же массив, если клик вне помещений экспликации или в
// помещении уже есть действующая стяжка.
export function addScreed(
  screeds: Screed[],
  items: readonly ExplicatedRoom[],
  at: Point,
  thicknessMm: number,
  newId: () => string = () => crypto.randomUUID(),
): Screed[] {
  if (!canAnchor(items, screeds, at)) return screeds
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
