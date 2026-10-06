import { dimHitDistance, distanceToWall, hitWall, segmentIntersectsRect } from "../geometry"
import type { Scene } from "../history"
import type { Dimension, Doorway, Point, Wall } from "../types"
import { cross, degenerate, dot, sub, unit } from "../wall-geometry"
import { hostOf, hostPoint, jambsT } from "./doorway-faces"

// Решения выбора и удаления с проёмами (change add-doorway, design D2, D8): попадание, рамка,
// приоритет ластика, каскад удаления. Чистые функции; main.ts только маршрутизирует события.

export type ErasePick = { kind: "dimension"; dimension: Dimension } | { kind: "doorway"; doorway: Doorway } | { kind: "wall"; wall: Wall }

export interface Selection {
  walls: Wall[]
  dimensions: Dimension[]
  doorways: Doorway[]
}

// участок проёма — прямоугольник откосов через всю толщину; tolCm — радиус привязки
export function hitDoorway(p: Point, walls: readonly Wall[], doorways: readonly Doorway[], tolCm: number): Doorway | null {
  for (let i = doorways.length - 1; i >= 0; i--) {
    const d = doorways[i]
    const host = hostOf(d, walls)
    if (!host) continue
    const u = unit(host.a, host.b)
    const rel = sub(p, host.a)
    const t = dot(rel, u)
    const lat = cross(u, rel)
    const [j1, j2] = jambsT(d, host)
    if (t >= j1 - tolCm && t <= j2 + tolCm && Math.abs(lat) <= host.thicknessCm / 2 + tolCm) return d
  }
  return null
}

// стена, в радиусе привязки от тела которой находится точка (spec doorway «Установка проёма»):
// попадание в форму стены, иначе ближайшая по расстоянию до тела (ось − полутолщина)
export function wallNearBody(p: Point, walls: readonly Wall[], tolCm: number): Wall | null {
  const inside = hitWall(p, walls as Wall[], 0)
  if (inside) return inside
  let best: Wall | null = null
  let bestD = tolCm
  for (const w of walls) {
    if (degenerate(w)) continue
    const d = distanceToWall(p, w) - w.thicknessCm / 2
    if (d <= bestD) {
      best = w
      bestD = d
    }
  }
  return best
}

const axisSegment = (d: Doorway, host: Wall): [Point, Point] => {
  const [j1, j2] = jambsT(d, host)
  return [hostPoint(host, j1, 0), hostPoint(host, j2, 0)]
}

export function doorwaysInRect(min: Point, max: Point, walls: readonly Wall[], doorways: readonly Doorway[]): Doorway[] {
  return doorways.filter((d) => {
    const host = hostOf(d, walls)
    if (!host) return false
    const [p1, p2] = axisSegment(d, host)
    return segmentIntersectsRect(p1, p2, min, max)
  })
}

// участки оси стены вне её проёмов (по t от конца a)
function axisOutsideDoorways(wall: Wall, walls: readonly Wall[], doorways: readonly Doorway[]): [number, number][] {
  const len = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y)
  const cuts = doorways
    .filter((d) => d.wallId === wall.id && hostOf(d, walls))
    .map((d) => jambsT(d, wall))
    .sort((x, y) => x[0] - y[0])
  const out: [number, number][] = []
  let cursor = 0
  for (const [j1, j2] of cuts) {
    if (j1 > cursor) out.push([cursor, Math.min(j1, len)])
    cursor = Math.max(cursor, j2)
  }
  if (cursor < len) out.push([cursor, len])
  return out.filter(([t0, t1]) => t1 > t0)
}

const inside = (p: Point, min: Point, max: Point): boolean => p.x >= min.x && p.x <= max.x && p.y >= min.y && p.y <= max.y

// стены рамки: ось вне участков проёмов пересекает рамку или стена целиком внутри (multi-selection)
export function wallsInRect(min: Point, max: Point, walls: readonly Wall[], doorways: readonly Doorway[]): Wall[] {
  return walls.filter((w) => {
    if (inside(w.a, min, max) && inside(w.b, min, max)) return true
    return axisOutsideDoorways(w, walls, doorways).some(([t0, t1]) =>
      segmentIntersectsRect(hostPoint(w, t0, 0), hostPoint(w, t1, 0), min, max),
    )
  })
}

// ластик: размер → проём → стена (wall-deletion «Инструмент «Ластик»»)
export function erasePick(p: Point, scene: Selection, tolCm: number, textFactor: number): ErasePick | null {
  let dimension: Dimension | null = null
  let best = Infinity
  for (const d of scene.dimensions) {
    const dd = dimHitDistance(p, d, scene.walls, textFactor)
    if (dd !== null && dd <= tolCm && dd < best) {
      dimension = d
      best = dd
    }
  }
  if (dimension) return { kind: "dimension", dimension }
  const doorway = hitDoorway(p, scene.walls, scene.doorways, tolCm)
  if (doorway) return { kind: "doorway", doorway }
  const wall = hitWall(p, scene.walls, tolCm)
  return wall ? { kind: "wall", wall } : null
}

const refsWall = (d: Dimension, ids: ReadonlySet<string>): boolean =>
  ids.has(d.from.a.wallId) || ids.has(d.from.b.wallId) || ids.has(d.to.a.wallId) || ids.has(d.to.b.wallId)

// удаление выделенного с каскадом размеров и проёмов удаляемых стен (wall-deletion)
export function deleteObjects(scene: Scene, picked: Selection): Scene {
  const ids = new Set(picked.walls.map((w) => w.id))
  return {
    walls: scene.walls.filter((w) => !picked.walls.includes(w)),
    dimensions: scene.dimensions.filter((d) => !picked.dimensions.includes(d) && !refsWall(d, ids)),
    doorways: (scene.doorways ?? []).filter((d) => !picked.doorways.includes(d) && !ids.has(d.wallId)),
  }
}
