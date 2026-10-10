import type { DemolitionMark, Dimension, Doorway, Drawing, MountingContent, Wall, WallElement, WallWindow } from "../types"

// change mounting-plan: сцены и эталоны для тестов плана «Монтаж» (test-plan.md).
// Числа выведены из спецификации: идентификатор остатка — `<стена>~<начало в мм>`, а не из продакшн-модулей монтажа.

export const wall = (id: string, ax: number, ay: number, bx: number, by: number, thicknessCm = 20, type: Wall["type"] = "brick"): Wall => ({
  id,
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
  thicknessCm,
  type,
})

// W — свободная стена (0,0)-(500,0), кирпич, 20 см
export const W = (type: Wall["type"] = "brick"): Wall => wall("W", 0, 0, 500, 0, 20, type)

export const mark = (id: string, wallId: string, anchor: "a" | "b", fromCm: number, toCm: number): DemolitionMark => ({ id, wallId, anchor, fromCm, toCm })

export const opening = (id: string, wallId: string, anchor: "a" | "b", offsetCm: number, widthCm = 90): Doorway => ({
  id,
  wallId,
  anchor,
  offsetCm,
  widthCm,
  heightCm: 210,
})

export const windowAt = (id: string, wallId: string, anchor: "a" | "b", offsetCm: number, widthCm = 90): WallWindow => ({
  kind: "window",
  id,
  wallId,
  anchor,
  offsetCm,
  widthCm,
  heightCm: 120,
  sillCm: 90,
})

// размер между двумя гранями: from/to — пары (стена, грань)
export const dimension = (a: [string, number], b: [string, number], c: [string, number], d: [string, number], offset = 30): Dimension => ({
  from: { a: { wallId: a[0], edge: a[1] }, b: { wallId: b[0], edge: b[1] } },
  to: { a: { wallId: c[0], edge: c[1] }, b: { wallId: d[0], edge: d[1] } },
  offset,
})

export interface DrawingParts {
  walls?: Wall[]
  dimensions?: Dimension[]
  doorways?: WallElement[]
  demolition?: DemolitionMark[]
  mounting?: MountingContent
  activePlan?: Drawing["activePlan"]
}

export const drawing = (parts: DrawingParts = {}): Drawing => ({
  id: "d",
  name: "Чертёж 1",
  walls: parts.walls ?? [W()],
  dimensions: parts.dimensions ?? [],
  ...(parts.doorways !== undefined ? { doorways: parts.doorways } : null),
  ...(parts.demolition !== undefined ? { demolition: parts.demolition } : null),
  ...(parts.mounting !== undefined ? { mounting: parts.mounting } : null),
  ...(parts.activePlan !== undefined ? { activePlan: parts.activePlan } : null),
  view: { zoom: 1, pan: { x: 0, y: 0 } },
  scale: 100,
})

export function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const v of Object.values(value)) deepFreeze(v)
  }
  return value
}

export const idsOf = (walls: readonly Wall[]): string[] => walls.map((w) => w.id)

// «+ 0» превращает −0 в 0: toEqual различает их
const round6 = (v: number): number => Math.round(v * 1e6) / 1e6 + 0

// концы оси: [ax, ay, bx, by], с точностью до 1e-6 см
export const axisOf = (w: Wall): [number, number, number, number] => [round6(w.a.x), round6(w.a.y), round6(w.b.x), round6(w.b.y)]
