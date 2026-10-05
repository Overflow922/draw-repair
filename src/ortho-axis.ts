import type { Point } from "./types"

// Ось орто-жеста (change ortho-axis-lock, design D1): горизонталь, если горизонтальная составляющая
// по модулю не меньше вертикальной, иначе вертикаль. Порогового угла нет.

export type Axis = "x" | "y"

export function dominantAxis(v: Point): Axis | null {
  if (v.x === 0 && v.y === 0) return null
  return Math.abs(v.x) >= Math.abs(v.y) ? "x" : "y"
}

// выбранная ось не меняется до конца жеста
export function latchAxis(current: Axis | null, dir: Point): Axis | null {
  return current ?? dominantAxis(dir)
}

export function onAxis(v: Point, axis: Axis): Point {
  return axis === "x" ? { x: v.x, y: 0 } : { x: 0, y: v.y }
}
