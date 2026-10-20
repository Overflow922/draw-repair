import type { DemolitionMark, Drawing, MountingContent, PlasterMark, Point, Screed, Wall, WallElement } from "../types"
import { polygonArea } from "../wall-geometry"

// change add-rough-works-plan: сцены и независимые эталоны для тестов плана «Черновые работы».
// Числа выведены из спецификации и геометрии сцен, а не из продакшн-модулей плана.

export const wall = (id: string, ax: number, ay: number, bx: number, by: number, thicknessCm = 20, type: Wall["type"] = "brick"): Wall => ({
  id,
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
  thicknessCm,
  type,
})

// W — свободная стена (0,0)-(500,0), кирпич, 20 см
export const W = (): Wall => wall("W", 0, 0, 500, 0)

export const plaster = (
  id: string,
  wallId: string,
  face: 1 | -1,
  anchor: "a" | "b",
  fromCm: number,
  toCm: number,
  thicknessMm = 20,
): PlasterMark => ({ id, wallId, face, anchor, fromCm, toCm, thicknessMm })

// откос элемента стены (change plaster-opening-reveals)
export const reveal = (id: string, elementId: string, jamb: "a" | "b", thicknessMm = 20): PlasterMark => ({ id, face: "reveal", elementId, jamb, thicknessMm })

// окно на стене wallId: откосы offsetCm и offsetCm + widthCm от конца anchor
export const windowOn = (id: string, wallId: string, offsetCm: number, widthCm: number, anchor: "a" | "b" = "a"): WallElement => ({
  kind: "window",
  id,
  wallId,
  anchor,
  offsetCm,
  widthCm,
  heightCm: 150,
  sillCm: 85,
})

// проём без вида и дверь на стене wallId
export const openingOn = (id: string, wallId: string, offsetCm: number, widthCm: number, anchor: "a" | "b" = "a"): WallElement => ({
  id,
  wallId,
  anchor,
  offsetCm,
  widthCm,
  heightCm: 210,
})

export const doorOn = (id: string, wallId: string, offsetCm: number, widthCm: number, anchor: "a" | "b" = "a"): WallElement => ({
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

export const screed = (id: string, x: number, y: number, thicknessMm = 50): Screed => ({ id, at: { x, y }, thicknessMm })

export const demolitionMark = (id: string, wallId: string, anchor: "a" | "b", fromCm: number, toCm: number): DemolitionMark => ({ id, wallId, anchor, fromCm, toCm })

export interface RoughParts {
  walls?: Wall[]
  demolition?: DemolitionMark[]
  mounting?: MountingContent
  roughPlaster?: PlasterMark[]
  roughScreeds?: Screed[]
  rooms?: Drawing["rooms"]
  doorways?: WallElement[]
}

export const drawing = (parts: RoughParts = {}): Drawing => ({
  id: "d",
  name: "Чертёж 1",
  walls: parts.walls ?? [W()],
  dimensions: [],
  ...(parts.demolition !== undefined ? { demolition: parts.demolition } : null),
  ...(parts.mounting !== undefined ? { mounting: parts.mounting } : null),
  ...(parts.roughPlaster !== undefined ? { roughPlaster: parts.roughPlaster } : null),
  ...(parts.roughScreeds !== undefined ? { roughScreeds: parts.roughScreeds } : null),
  ...(parts.rooms !== undefined ? { rooms: parts.rooms } : null),
  ...(parts.doorways !== undefined ? { doorways: parts.doorways } : null),
  view: { zoom: 1, pan: { x: 0, y: 0 } },
})

// прямоугольник из четырёх стен с совпадающими концами осей (внутренняя область — на толщину/2 внутрь от осей)
export const rectWalls = (prefix: string, x0: number, y0: number, x1: number, y1: number, t = 20): Wall[] => [
  wall(`${prefix}1`, x0, y0, x1, y0, t),
  wall(`${prefix}2`, x1, y0, x1, y1, t),
  wall(`${prefix}3`, x1, y1, x0, y1, t),
  wall(`${prefix}4`, x0, y1, x0, y0, t),
]

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

export const idGen = (): (() => string) => {
  let n = 0
  return () => `n${++n}`
}

export function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const v of Object.values(value)) deepFreeze(v)
  }
  return value
}

// «+ 0» превращает −0 в 0: toEqual различает их
const round6 = (v: number): number => Math.round(v * 1e6) / 1e6 + 0
export const r6 = round6
