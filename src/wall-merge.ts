import { jointTol, wallEndOccupied } from "./geometry"
import { jambsT } from "./doorway/doorway-faces"
import { violatesDoorways } from "./doorway/doorway-guard"
import type { Scene } from "./history"
import type { Point, Wall, WallElement } from "./types"

// Слияние продолжения со стеной (change merge-collinear-walls, design D1–D4): новая стена, которая
// продолжает свободный конец стены того же материала и толщины по одной прямой, удлиняет её
export type MergeResult = { kind: "none" } | { kind: "blocked" } | { kind: "merged"; scene: Scene }

// допуск прямой: обе вершины новой стены не дальше от оси продолжаемой стены (spec wall-drawing)
const LINE_TOL_CM = 0.5

interface Continuation {
  wall: Wall
  end: "a" | "b"
  tip: Point // конец оси продолжаемой стены
  dir: Point // единичный вектор от тела стены наружу, за этот конец
  lengthCm: number
  gapCm: number // расстояние от конца оси до начала новой стены вдоль оси
}

const along = (p: Point, from: Point, dir: Point): number => (p.x - from.x) * dir.x + (p.y - from.y) * dir.y
const offLine = (p: Point, from: Point, dir: Point): number => Math.abs((p.x - from.x) * dir.y - (p.y - from.y) * dir.x)

// продолжаемая стена: свободный конец, начало новой стены у торца, обе вершины на прямой, ход от тела (design D2)
function findContinuation(scene: Scene, wall: Wall): Continuation | null {
  let best: Continuation | null = null
  for (const e of scene.walls) {
    if (e.type !== wall.type || e.thicknessCm !== wall.thicknessCm) continue
    const lengthCm = Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y)
    if (lengthCm === 0) continue
    for (const end of ["a", "b"] as const) {
      if (wallEndOccupied(e, end, scene.walls)) continue
      const tip = e[end]
      const back = end === "b" ? e.a : e.b
      const dir = { x: (tip.x - back.x) / lengthCm, y: (tip.y - back.y) / lengthCm }
      const gapCm = along(wall.a, tip, dir)
      if (gapCm < 0 || gapCm > jointTol(e, wall)) continue
      if (offLine(wall.a, tip, dir) > LINE_TOL_CM || offLine(wall.b, tip, dir) > LINE_TOL_CM) continue
      if (along(wall.b, wall.a, dir) <= 0) continue
      if (!best || gapCm < best.gapCm) best = { wall: e, end, tip, dir, lengthCm, gapCm }
    }
  }
  return best
}

// элемент остаётся на месте в плане: у удлинённого конца привязка переходит на противоположный (design D4)
function reattach(el: WallElement, host: Wall, end: "a" | "b", addedCm: number, newLengthCm: number): WallElement {
  const [t1, t2] = jambsT(el, host)
  if (end === "b") return el.anchor === "a" ? el : { ...el, anchor: "a", offsetCm: t1 }
  return el.anchor === "b" ? el : { ...el, anchor: "b", offsetCm: newLengthCm - (t2 + addedCm) }
}

export function mergeContinuation(scene: Scene, wall: Wall): MergeResult {
  const found = findContinuation(scene, wall)
  if (!found) return { kind: "none" }
  const { wall: e, end, tip, dir, lengthCm } = found
  const addedCm = along(wall.b, tip, dir)
  const extended: Wall = { ...e, [end]: { x: tip.x + dir.x * addedCm, y: tip.y + dir.y * addedCm } }
  const walls = scene.walls.map((w) => (w === e ? extended : w))
  const doorways = (scene.doorways ?? []).map((d) => (d.wallId === e.id ? reattach(d, e, end, addedCm, lengthCm + addedCm) : d))
  if (violatesDoorways(scene.walls, walls, doorways)) return { kind: "blocked" }
  return { kind: "merged", scene: { ...scene, walls, ...(scene.doorways ? { doorways } : null) } }
}
