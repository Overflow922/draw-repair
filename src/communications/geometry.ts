import type { Communication, Point, Wall } from "../types"
import { penetration, rectShape, segmentShape, sweep } from "./shape"
import type { Shape } from "./shape"

// Расстояния до ближайших стен и глубина наложения коммуникаций (change add-communications, design D2, D3).
// Телом стены считается прямоугольник вдоль оси шириной в толщину (wall-collision); проёмы в расчёте не участвуют.

export type Direction = "left" | "right" | "up" | "down"

// «вверх» — к верху экрана, то есть к меньшему y
export const DIRECTION_VECTORS: Record<Direction, Point> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
}

export const shapeOfCommunication = (c: Communication): Shape =>
  c.kind === "riser" ? { kind: "circle", c: { x: c.x, y: c.y }, r: c.diameterCm / 2 } : rectShape(c.x, c.y, c.widthCm / 2, c.depthCm / 2)

// габаритный прямоугольник тела: [minX, minY, maxX, maxY]
export function communicationBox(c: Communication): [number, number, number, number] {
  const hx = c.kind === "riser" ? c.diameterCm / 2 : c.widthCm / 2
  const hy = c.kind === "riser" ? c.diameterCm / 2 : c.depthCm / 2
  return [c.x - hx, c.y - hy, c.x + hx, c.y + hy]
}

export const wallBody = (wall: Pick<Wall, "a" | "b" | "thicknessCm">): Shape | null => segmentShape(wall.a, wall.b, wall.thicknessCm)

// глубина наложения тела коммуникации на тело стены; 0 — касание или разделены
export function wallOverlapDepth(c: Communication, wall: Pick<Wall, "a" | "b" | "thicknessCm">): number {
  const body = wallBody(wall)
  return body ? penetration(shapeOfCommunication(c), body).depth : 0
}

export const overlapDepth = (a: Communication, b: Communication): number => penetration(shapeOfCommunication(a), shapeOfCommunication(b)).depth

// наибольшая глубина наложения коммуникации на стены и другие коммуникации (сама в others не считается)
export function communicationViolation(c: Communication, walls: readonly Wall[], others: readonly Communication[]): number {
  let worst = 0
  for (const w of walls) worst = Math.max(worst, wallOverlapDepth(c, w))
  for (const o of others) if (o.id !== c.id) worst = Math.max(worst, overlapDepth(c, o))
  return worst
}

export interface Reach {
  distanceCm: number // сдвиг до касания со стеной в этом направлении
  contact: Point // точка первого касания
}

// расстояние до ближайшей стены: на сколько можно сдвинуть коммуникацию в направлении dir до касания; null — стен нет
export function slideReach(c: Communication, dir: Direction, walls: readonly Wall[]): Reach | null {
  const shape = shapeOfCommunication(c)
  const d = DIRECTION_VECTORS[dir]
  let best: Reach | null = null
  for (const w of walls) {
    const body = wallBody(w)
    const hit = body && sweep(shape, d, body)
    if (hit && (!best || hit.t < best.distanceCm)) best = { distanceCm: hit.t, contact: hit.contact }
  }
  return best
}
