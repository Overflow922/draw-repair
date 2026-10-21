import type { FurnitureItem, Point } from "../types"
import type { FurnitureKind } from "./furniture-kinds"

// Предмет мебели плана «Мебель» (change furniture-plan-table, design D2, D5): прямоугольник вокруг центра. Ширина — вдоль оси X при
// угле 0, длина — вдоль оси Y; угол в градусах по часовой на экране (ось Y вниз). Чистые функции, входы не мутируются.

// угол → диапазон [0, 360): 360 даёт 0, −90 даёт 270, 450 даёт 90
export const normalizeAngle = (deg: number): number => {
  const a = ((deg % 360) + 360) % 360
  return a === 0 ? 0 : a
}

export const newItem = (id: string, kind: FurnitureKind, center: Point, params: { widthCm: number; lengthCm: number; angleDeg: number }): FurnitureItem => ({
  id,
  kind,
  x: center.x,
  y: center.y,
  widthCm: params.widthCm,
  lengthCm: params.lengthCm,
  angleDeg: normalizeAngle(params.angleDeg),
})

const toRadians = (deg: number): number => (deg * Math.PI) / 180

// единичные оси стола: u — вдоль ширины, v — вдоль длины (в чертёже, ось Y вниз)
function axes(t: FurnitureItem): { u: Point; v: Point } {
  const r = toRadians(t.angleDeg)
  return { u: { x: Math.cos(r), y: Math.sin(r) }, v: { x: -Math.sin(r), y: Math.cos(r) } }
}

// углы стола по обходу: левый верхний, правый верхний, правый нижний, левый нижний (при угле 0)
export function itemCorners(t: FurnitureItem): [Point, Point, Point, Point] {
  const { u, v } = axes(t)
  const hw = t.widthCm / 2
  const hl = t.lengthCm / 2
  const at = (sw: number, sl: number): Point => ({ x: t.x + sw * hw * u.x + sl * hl * v.x, y: t.y + sw * hw * u.y + sl * hl * v.y })
  return [at(-1, -1), at(1, -1), at(1, 1), at(-1, 1)]
}

// точка из системы предмета (начало — левый верхний угол при угле 0, ось X — ширина, Y — длина, в см) в чертёж
export function itemLocalToWorld(t: FurnitureItem, p: Point): Point {
  const { u, v } = axes(t)
  const dx = p.x - t.widthCm / 2
  const dy = p.y - t.lengthCm / 2
  return { x: t.x + dx * u.x + dy * v.x, y: t.y + dx * u.y + dy * v.y }
}

// точка внутри тела стола (с допуском tolCm наружу): точка переводится в систему стола обратным поворотом
export function hitItem(t: FurnitureItem, p: Point, tolCm = 0): boolean {
  const { u, v } = axes(t)
  const dx = p.x - t.x
  const dy = p.y - t.y
  const along = dx * u.x + dy * u.y
  const across = dx * v.x + dy * v.y
  return Math.abs(along) <= t.widthCm / 2 + tolCm && Math.abs(across) <= t.lengthCm / 2 + tolCm
}
