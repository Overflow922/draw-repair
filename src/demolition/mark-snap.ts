import { jambsT } from "../doorway/doorway-faces"
import type { Wall, WallElement } from "../types"
import { clipHalfPlane, displayPolygons, dot, sub, unit } from "../wall-geometry"
import { EPS_CM, lengthOf } from "./mark-model"

// Узлы стены и привязка границ участка при протяжке (change demolition-plan, design D4). Координаты —
// расстояния вдоль оси от конца a.

// Узлы: концы стены; откосы её элементов; границы вдоль оси, в которых форма другой стены входит в полосу этой стены
// (включая грани) и выходит из неё. Одной оси недостаточно: стена, примыкающая торцом к грани, ось не пересекает.
export function alongNodes(wall: Wall, walls: readonly Wall[], elements: readonly WallElement[]): number[] {
  const len = lengthOf(wall)
  const u = unit(wall.a, wall.b)
  const normal = { x: -u.y, y: u.x }
  const half = wall.thicknessCm / 2
  const raw: number[] = [0, len]
  for (const el of elements) if (el.wallId === wall.id) raw.push(...jambsT(el, wall))
  const scene = [...walls]
  for (const other of walls) {
    if (other.id === wall.id) continue
    for (const piece of displayPolygons(other, scene)) {
      const inStrip = clipHalfPlane(clipHalfPlane(piece, wall.a, normal, -half), wall.a, { x: -normal.x, y: -normal.y }, -half)
      if (inStrip.length === 0) continue
      const along = inStrip.map((q) => dot(sub(q, wall.a), u))
      for (const t of [Math.min(...along), Math.max(...along)]) if (t >= 0 && t <= len) raw.push(t)
    }
  }
  raw.sort((x, y) => x - y)
  const nodes: number[] = []
  for (const t of raw) {
    const last = nodes[nodes.length - 1]
    if (last === undefined || t - last > EPS_CM) nodes.push(t)
  }
  return nodes
}

// Ближайший узел, если он не дальше радиуса (включительно); иначе целый сантиметр. Результат в [0, lenCm].
export function snapAlong(t: number, nodes: readonly number[], radiusCm: number, lenCm: number): number {
  let best: number | null = null
  let bestDistance = Infinity
  for (const node of nodes) {
    const d = Math.abs(node - t)
    if (d <= radiusCm && d < bestDistance) {
      best = node
      bestDistance = d
    }
  }
  return Math.min(lenCm, Math.max(0, best ?? Math.round(t)))
}
