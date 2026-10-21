import { DIRECTION_VECTORS } from "../communications/geometry"
import type { Direction } from "../communications/geometry"
import type { Point, FurnitureItem } from "../types"
import { hitItem, itemCorners } from "./item"

// Правка столов (change furniture-plan-table, design D6): чистые функции над массивом столов; входы не мутируются.
// Перемещение свободное — без привязок и без ограничений препятствиями; пересечения только показываются (overlap.ts).

// шаг стрелки: шаг сетки, с Shift — 1 см (multi-selection «Сдвиг выделения стрелками»)
export const NUDGE_STEP_CM = 10
export const NUDGE_FINE_CM = 1

// сдвиг выделенных столов на вектор; null — ничего не изменилось (шага истории нет)
export function shiftItems(items: readonly FurnitureItem[], ids: ReadonlySet<string>, dx: number, dy: number): FurnitureItem[] | null {
  if (dx === 0 && dy === 0) return null
  if (!items.some((t) => ids.has(t.id))) return null
  return items.map((t) => (ids.has(t.id) ? { ...t, x: t.x + dx, y: t.y + dy } : t))
}

export function nudgeItems(items: readonly FurnitureItem[], ids: ReadonlySet<string>, direction: Direction, fine: boolean): FurnitureItem[] | null {
  const step = fine ? NUDGE_FINE_CM : NUDGE_STEP_CM
  const v = DIRECTION_VECTORS[direction]
  return shiftItems(items, ids, v.x * step, v.y * step)
}

export const removeItems = (items: readonly FurnitureItem[], ids: ReadonlySet<string>): FurnitureItem[] => items.filter((t) => !ids.has(t.id))

export const replaceItem = (items: readonly FurnitureItem[], next: FurnitureItem): FurnitureItem[] => items.map((t) => (t.id === next.id ? next : t))

// стол под точкой: при наложении столов — поставленный позже (нарисованный сверху)
export function itemAt(items: readonly FurnitureItem[], p: Point, tolCm: number): FurnitureItem | null {
  for (let i = items.length - 1; i >= 0; i--) {
    const t = items[i]
    if (t && hitItem(t, p, tolCm)) return t
  }
  return null
}

// стол пересекает прямоугольник рамки: разделяющие оси — оси рамки и оси стола
export function itemsInRect(items: readonly FurnitureItem[], min: Point, max: Point): FurnitureItem[] {
  return items.filter((t) => {
    const corners = itemCorners(t)
    const xs = corners.map((c) => c.x)
    const ys = corners.map((c) => c.y)
    if (Math.max(...xs) < min.x || Math.min(...xs) > max.x || Math.max(...ys) < min.y || Math.min(...ys) > max.y) return false
    const rect = [min, { x: max.x, y: min.y }, max, { x: min.x, y: max.y }]
    const normals = [corners[1], corners[3]].map((c) => ({ x: -(c.y - corners[0].y), y: c.x - corners[0].x }))
    return normals.every((axis) => {
      const project = (ps: readonly Point[]): [number, number] => {
        const values = ps.map((p) => p.x * axis.x + p.y * axis.y)
        return [Math.min(...values), Math.max(...values)]
      }
      const [a0, a1] = project(corners)
      const [b0, b1] = project(rect)
      return a1 >= b0 && b1 >= a0
    })
  })
}
