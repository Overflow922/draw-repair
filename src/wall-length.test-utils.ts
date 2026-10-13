import { expect } from "vitest"
import type { Material, Point, Wall } from "./types"
import { displayPolygons } from "./wall-geometry"
import type { StartRef } from "./wall-angle"

// change fix-collinear-edge-to-edge-length: сцены и независимая проверка видимого тела для тестов длины
// стены от кромки до кромки (specs length-input, ruler-tool). Эталоны выведены из спецификации и геометрии
// сцен, а не из модуля длины.

export const wall = (id: string, ax: number, ay: number, bx: number, by: number, thicknessCm = 20, type: Material = "brick"): Wall => ({
  id,
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
  thicknessCm,
  type,
})

// сцена S1: ранняя стена E и коллинеарное продолжение N, вершина a которого — в центре квадрата установки
// за плоскостью торца E (x = 500), на полтолщины от неё; тело N занимает x ∈ [500, 900]
export const E = (): Wall => wall("E", 0, 0, 500, 0)
export const N = (): Wall => wall("N", 510, 0, 900, 0, 20, "blocks")

// опора начала у свободного торца E: наружная нормаль плоскости торца и конец оси E (design D2)
export const CAP_REF: StartRef = { kind: "cap", normal: { x: 1, y: 0 }, anchor: { x: 500, y: 0 } }
export const FACE_REF: StartRef = { kind: "face", normal: { x: 0, y: 1 } }

export function expectPoint(p: Point, x: number, y: number, digits = 6): void {
  expect(p.x).toBeCloseTo(x, digits)
  expect(p.y).toBeCloseTo(y, digits)
}

// протяжённость отображаемого тела стены вдоль её оси (по контурам), независимо от модуля длины;
// годится для сцен без угловых и T-стыков
export function bodyExtentAlongAxis(w: Wall, walls: Wall[]): number {
  const len = Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y)
  const u = { x: (w.b.x - w.a.x) / len, y: (w.b.y - w.a.y) / len }
  const ts = displayPolygons(w, walls).flatMap((poly) => poly.map((p) => (p.x - w.a.x) * u.x + (p.y - w.a.y) * u.y))
  return Math.max(...ts) - Math.min(...ts)
}
