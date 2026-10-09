import { dimPointPoint, nearestEdgeIntersection, pointsEqual, wallEndOccupied } from "./geometry"
import { violatesDoorways } from "./doorway/doorway-guard"
import { faceRuns, hostPoint } from "./doorway/doorway-faces"
import type { Side } from "./doorway/doorway-faces"
import type { Scene } from "./history"
import type { DimPoint, Dimension, Point, Wall } from "./types"

// Автоматические размеры стены (change auto-wall-dimensions, design D1–D6): размер на каждый видимый
// кусок длинных граней и на каждый свободный торец; создаются при фиксации стены и пересчитываются
// для затронутых стен, у которых уже есть автоматические размеры (метка Dimension.auto).

// смещение размерной линии от грани или торца, см
const OFFSET_CM = 20
// радиус поиска вершины контура для привязки конца куска: faceRuns определяет концы с точностью пробной линии
const ANCHOR_RADIUS_CM = 1
// куски грани, разделённые зазором меньше этого, склеиваются: дробный шум faceRuns на повёрнутых чертежах
const RUN_JOIN_CM = 1e-4
const MIN_LENGTH_CM = 1e-6
const KEY_SCALE = 1e6

const anchorAt = (p: Point, walls: Wall[]): DimPoint | null => {
  const hit = nearestEdgeIntersection(p, walls, ANCHOR_RADIUS_CM)
  return hit ? { a: hit.a, b: hit.b } : null
}

function joinedRuns(runs: [number, number][]): [number, number][] {
  const out: [number, number][] = []
  for (const run of runs) {
    const last = out[out.length - 1]
    if (last && run[0] - last[1] < RUN_JOIN_CM) last[1] = Math.max(last[1], run[1])
    else out.push([run[0], run[1]])
  }
  return out
}

// длина по каждому видимому куску грани: положительное смещение — со стороны грани «плюс», отрицательное — «минус»
function lengthDimensions(wall: Wall, walls: Wall[], side: Side): Dimension[] {
  const half = wall.thicknessCm / 2
  const out: Dimension[] = []
  for (const [t0, t1] of joinedRuns(faceRuns(wall, walls, side))) {
    const from = anchorAt(hostPoint(wall, t0, side * half), walls)
    const to = anchorAt(hostPoint(wall, t1, side * half), walls)
    if (!from || !to) continue
    const a = dimPointPoint(from, walls)
    const b = dimPointPoint(to, walls)
    if (!a || !b || Math.hypot(b.x - a.x, b.y - a.y) < MIN_LENGTH_CM) continue
    out.push({ from, to, offset: side * OFFSET_CM, auto: wall.id })
  }
  return out
}

// толщина на свободном торце: линия лежит за торцом
function thicknessDimension(wall: Wall, walls: Wall[], end: "a" | "b"): Dimension[] {
  if (wallEndOccupied(wall, end, walls)) return []
  const edge = end === "a" ? 2 : 3
  return [
    {
      from: { a: { wallId: wall.id, edge: 0 }, b: { wallId: wall.id, edge } },
      to: { a: { wallId: wall.id, edge: 1 }, b: { wallId: wall.id, edge } },
      offset: end === "b" ? OFFSET_CM : -OFFSET_CM,
      auto: wall.id,
    },
  ]
}

// набор размеров стены для текущего чертежа; walls — все стены чертежа, включая wall
export function autoWallDimensions(wall: Wall, walls: readonly Wall[]): Dimension[] {
  if (pointsEqual(wall.a, wall.b)) return []
  const all = [...walls]
  return [...lengthDimensions(wall, all, 1), ...lengthDimensions(wall, all, -1), ...thicknessDimension(wall, all, "a"), ...thicknessDimension(wall, all, "b")]
}

const round = (v: number): number => Math.round(v * KEY_SCALE) / KEY_SCALE + 0

// ключ размера по разрешённой геометрии; null — точка замера не разрешилась
function geometryKey(d: Dimension, walls: Wall[]): string | null {
  const a = dimPointPoint(d.from, walls)
  const b = dimPointPoint(d.to, walls)
  return a && b ? [a.x, a.y, b.x, b.y, d.offset].map(round).join(",") : null
}

function sameSet(current: Dimension[], desired: Dimension[], walls: Wall[]): boolean {
  if (current.length !== desired.length) return false
  const keys = current.map((d) => geometryKey(d, walls))
  if (keys.includes(null)) return false
  const pool = new Map<string, number>()
  for (const k of keys) pool.set(k ?? "", (pool.get(k ?? "") ?? 0) + 1)
  for (const d of desired) {
    const k = geometryKey(d, walls)
    const left = k === null ? 0 : (pool.get(k) ?? 0)
    if (left === 0) return false
    pool.set(k ?? "", left - 1)
  }
  return true
}

// пересчёт: новая стена (если задана) и каждая стена с автоматическими размерами получают набор для текущего
// чертежа; набор, отличающийся от текущего, заменяет его целиком, прочие размеры не меняются (design D1, D4)
export function syncAutoDimensions(scene: Scene, newWallId?: string): Scene {
  const owners = new Set<string>(newWallId ? [newWallId] : [])
  for (const d of scene.dimensions) if (d.auto !== undefined) owners.add(d.auto)
  const walls = scene.walls
  let dimensions = scene.dimensions
  for (const id of owners) {
    const wall = walls.find((w) => w.id === id)
    if (!wall) continue
    const current = dimensions.filter((d) => d.auto === id)
    const desired = autoWallDimensions(wall, walls)
    if (sameSet(current, desired, walls)) continue
    dimensions = [...dimensions.filter((d) => d.auto !== id), ...desired]
  }
  return dimensions === scene.dimensions ? scene : { ...scene, dimensions }
}

// сцена с новой стеной (в конце списка), её размерами и пересчитанными размерами соседей;
// null — стена нарушает проём и не фиксируется
export function placeWall(scene: Scene, wall: Wall): Scene | null {
  const walls = [...scene.walls, wall]
  if (violatesDoorways(scene.walls, walls, scene.doorways ?? [])) return null
  return syncAutoDimensions({ ...scene, walls }, wall.id)
}
