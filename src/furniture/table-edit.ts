import { DIRECTION_VECTORS } from "../communications/geometry"
import type { Direction } from "../communications/geometry"
import type { Point, Table } from "../types"
import { hitTable, tableCorners } from "./table"

// Правка столов (change furniture-plan-table, design D6): чистые функции над массивом столов; входы не мутируются.
// Перемещение свободное — без привязок и без ограничений препятствиями; пересечения только показываются (overlap.ts).

// шаг стрелки: шаг сетки, с Shift — 1 см (multi-selection «Сдвиг выделения стрелками»)
export const NUDGE_STEP_CM = 10
export const NUDGE_FINE_CM = 1

// сдвиг выделенных столов на вектор; null — ничего не изменилось (шага истории нет)
export function shiftTables(tables: readonly Table[], ids: ReadonlySet<string>, dx: number, dy: number): Table[] | null {
  if (dx === 0 && dy === 0) return null
  if (!tables.some((t) => ids.has(t.id))) return null
  return tables.map((t) => (ids.has(t.id) ? { ...t, x: t.x + dx, y: t.y + dy } : t))
}

export function nudgeTables(tables: readonly Table[], ids: ReadonlySet<string>, direction: Direction, fine: boolean): Table[] | null {
  const step = fine ? NUDGE_FINE_CM : NUDGE_STEP_CM
  const v = DIRECTION_VECTORS[direction]
  return shiftTables(tables, ids, v.x * step, v.y * step)
}

export const removeTables = (tables: readonly Table[], ids: ReadonlySet<string>): Table[] => tables.filter((t) => !ids.has(t.id))

export const replaceTable = (tables: readonly Table[], next: Table): Table[] => tables.map((t) => (t.id === next.id ? next : t))

// стол под точкой: при наложении столов — поставленный позже (нарисованный сверху)
export function tableAt(tables: readonly Table[], p: Point, tolCm: number): Table | null {
  for (let i = tables.length - 1; i >= 0; i--) {
    const t = tables[i]
    if (t && hitTable(t, p, tolCm)) return t
  }
  return null
}

// стол пересекает прямоугольник рамки: разделяющие оси — оси рамки и оси стола
export function tablesInRect(tables: readonly Table[], min: Point, max: Point): Table[] {
  return tables.filter((t) => {
    const corners = tableCorners(t)
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
