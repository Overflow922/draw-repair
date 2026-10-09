import type { DemolitionMark, Material, Point, Wall, WallDoor, WallWindow } from "../types"
import { polygonArea } from "../wall-geometry"

// change demolition-plan: сцены и независимые эталоны для тестов пометок сноса (test-plan.md).
// Числа выведены из спецификации и геометрии сцен, а не из продакшн-модулей демонтажа.

export const wall = (ax: number, ay: number, bx: number, by: number, id: string, type: Material = "brick", thicknessCm = 20): Wall => ({
  id,
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
  thicknessCm,
  type,
})

// W — свободная стена (0,0)-(500,0), кирпич, 20 см
export const W = (type: Material = "brick"): Wall => wall(0, 0, 500, 0, "W", type)

export const mk = (id: string, wallId: string, anchor: "a" | "b", fromCm: number, toCm: number): DemolitionMark => ({ id, wallId, anchor, fromCm, toCm })

// детерминированные идентификаторы новых пометок: n1, n2, …
export const idGen = (): (() => string) => {
  let n = 0
  return () => `n${++n}`
}

export const window_ = (wallId: string, anchor: "a" | "b", offsetCm: number, widthCm = 90, id = "win"): WallWindow => ({
  kind: "window",
  id,
  wallId,
  anchor,
  offsetCm,
  widthCm,
  heightCm: 120,
  sillCm: 90,
})

export const door_ = (wallId: string, anchor: "a" | "b", offsetCm: number, widthCm = 90, id = "dr"): WallDoor => ({
  kind: "door",
  id,
  wallId,
  anchor,
  offsetCm,
  widthCm,
  heightCm: 210,
  hinge: "a",
  swing: "left",
})

export interface Box {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export const boxOf = (polys: readonly Point[][]): Box => {
  const pts = polys.flat()
  return {
    minX: Math.min(...pts.map((p) => p.x)),
    minY: Math.min(...pts.map((p) => p.y)),
    maxX: Math.max(...pts.map((p) => p.x)),
    maxY: Math.max(...pts.map((p) => p.y)),
  }
}

export const areaOf = (polys: readonly Point[][]): number => polys.reduce((sum, p) => sum + Math.abs(polygonArea(p)), 0)

// глубокая заморозка: любая мутация входа в тесте бросает TypeError
export function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const v of Object.values(value)) deepFreeze(v)
  }
  return value
}
