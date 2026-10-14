import { expect } from "vitest"
import type { Battery, Communication, Point, Wall, WallElement, WallWindow } from "../types"
import type { BatteryContext, BatteryEdit } from "./battery-place"

// change add-battery: сцены, фабрики и независимые эталоны для тестов батарей (test-plan.md «Scope»).
// Эталоны выводятся из спецификации и геометрии сцен (ось стены, нормаль (−d.y, d.x)), а не из продакшн-модулей батарей.

export { duct, riser } from "../communications/communications.test-utils"
export { door, sceneF, sceneR, sceneRP, sceneRT, w } from "../doorway/doorway.test-utils"

// батарея по умолчанию: грань +1 (нормаль (−d.y, d.x) оси), длина 70, толщина 10, отступ 3
export const bat = (
  wallId: string,
  anchor: "a" | "b",
  offsetCm: number,
  over: Partial<Pick<Battery, "id" | "face" | "lengthCm" | "thicknessCm" | "gapCm">> = {},
): Battery => ({
  id: over.id ?? "b0",
  wallId,
  face: over.face ?? 1,
  anchor,
  offsetCm,
  lengthCm: over.lengthCm ?? 70,
  thicknessCm: over.thicknessCm ?? 10,
  gapCm: over.gapCm ?? 3,
})

// окно на стене: активный сосед для центровки и точек замера; high-level поля не важны
export const windowAt = (wallId: string, anchor: "a" | "b", offsetCm: number, widthCm = 120, id = "w0"): WallWindow => ({
  kind: "window",
  id,
  wallId,
  anchor,
  offsetCm,
  widthCm,
  heightCm: 150,
  sillCm: 85,
})

// контекст операций; snapCm — радиус прилипания в сантиметрах (SNAP_RADIUS_PX / зум)
export const ctxOf = (over: Partial<BatteryContext> = {}): BatteryContext => ({
  batteries: [],
  communications: [],
  elements: [],
  snapCm: 6,
  ...over,
})

export const applied = (r: BatteryEdit): Battery => {
  expect(r.kind).toBe("applied")
  if (r.kind !== "applied") throw new Error(`rejected: ${r.reason}`)
  return r.battery
}

// мировая точка на стене: t — вдоль оси от конца a, lat — вдоль нормали (−d.y, d.x)
export function at(wall: Wall, t: number, lat: number): Point {
  const len = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y)
  const dx = (wall.b.x - wall.a.x) / len
  const dy = (wall.b.y - wall.a.y) / len
  return { x: wall.a.x + dx * t - dy * lat, y: wall.a.y + dy * t + dx * lat }
}

export function expectPoint(p: Point, x: number, y: number, digits = 3): void {
  expect(p.x).toBeCloseTo(x, digits)
  expect(p.y).toBeCloseTo(y, digits)
}

export interface Box {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export const boxOf = (points: readonly Point[]): Box => ({
  minX: Math.min(...points.map((p) => p.x)),
  minY: Math.min(...points.map((p) => p.y)),
  maxX: Math.max(...points.map((p) => p.x)),
  maxY: Math.max(...points.map((p) => p.y)),
})

export function expectBox(points: readonly Point[], minX: number, minY: number, maxX: number, maxY: number, digits = 3): void {
  const b = boxOf(points)
  expect(b.minX).toBeCloseTo(minX, digits)
  expect(b.minY).toBeCloseTo(minY, digits)
  expect(b.maxX).toBeCloseTo(maxX, digits)
  expect(b.maxY).toBeCloseTo(maxY, digits)
}

// глубина наложения двух прямоугольников по осям: независимый эталон для осевых сцен
export function axisOverlap(p: Box, q: Box): number {
  const dx = Math.min(p.maxX, q.maxX) - Math.max(p.minX, q.minX)
  const dy = Math.min(p.maxY, q.maxY) - Math.max(p.minY, q.minY)
  return dx > 0 && dy > 0 ? Math.min(dx, dy) : 0
}

export type { Battery, Communication, WallElement }
