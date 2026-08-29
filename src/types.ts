export interface Point {
  x: number
  y: number
}

export const MATERIALS = [
  { id: "brick", label: "Кирпич" },
  { id: "concrete", label: "Бетон" },
  { id: "reinforced", label: "Железобетон" },
  { id: "wood-long", label: "Дерево (вдоль)" },
] as const

export type Material = (typeof MATERIALS)[number]["id"]

export function normalizeMaterial(type: string): Material {
  return (MATERIALS.some((m) => m.id === type) ? type : "brick") as Material
}

export interface Wall {
  a: Point
  b: Point
  thicknessCm: number
  type: Material
}

export interface View {
  zoom: number
  pan: Point
}

export const PX_PER_CM = 2
export const GRID_STEP_CM = 10
export const SNAP_RADIUS_PX = 12
export const ZOOM_MIN = 0.1
export const ZOOM_MAX = 10

export type Unit = "m" | "cm" | "mm"

export interface Drawing {
  id: string
  name: string
  walls: Wall[]
  view: View
}

export interface DrawingStore {
  version: 1
  activeId: string
  drawings: Drawing[]
}
