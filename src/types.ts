export interface Point {
  x: number
  y: number
}

export interface Wall {
  a: Point
  b: Point
  thicknessCm: number
  type: WallType
}

export const WALL_TYPES = [
  { id: "bearing", label: "Несущая", color: "#b91c1c" },
  { id: "partition", label: "Перегородка", color: "#44403c" },
  { id: "drywall", label: "Гипрок", color: "#2563eb" },
] as const

export type WallType = (typeof WALL_TYPES)[number]["id"]

export const PX_PER_CM = 2
export const GRID_STEP_CM = 10
export const SNAP_RADIUS_PX = 12

export type Unit = "m" | "cm" | "mm"
