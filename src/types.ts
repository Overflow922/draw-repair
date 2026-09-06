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
  id: string
  a: Point
  b: Point
  thicknessCm: number
  type: Material
}

export interface EdgeRef {
  wallId: string
  edge: number
}

export interface DimPoint {
  a: EdgeRef
  b: EdgeRef
}

export interface Dimension {
  from: DimPoint
  to: DimPoint
  offset: number
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

export const SCALE_DENOMINATORS = [50, 100, 200, 500] as const
export type ScaleDenominator = (typeof SCALE_DENOMINATORS)[number]
export const DEFAULT_SCALE: ScaleDenominator = 100

export const isScale = (value: unknown): value is ScaleDenominator =>
  typeof value === "number" && (SCALE_DENOMINATORS as readonly unknown[]).includes(value)

export interface Drawing {
  id: string
  name: string
  walls: Wall[]
  dimensions: Dimension[]
  view: View
  scale: ScaleDenominator
}

export interface DrawingStore {
  version: 3
  activeId: string
  drawings: Drawing[]
}
