import { teeEndAttached } from "./geometry"
import type { Point, Wall } from "./types"
import { RIGHT_SIN, cross, dist, faceCornerTol, unit } from "./wall-geometry"

// Орто-растяжение связанных стен (change ortho-stretch-move, design D2): правка при включённом
// орто сохраняет направление связанных стен — параллельные вектору растягиваются, остальные
// смещаются целиком и передают правило дальше. План строится по исходной геометрии и не
// мутирует стены; сдвиг применяет applyStretch.

export type WallEnd = "a" | "b"

export type StretchSeed =
  | { kind: "walls"; walls: readonly Wall[] } // перемещение, группа, стрелки
  | { kind: "end"; wall: Wall; end: WallEnd } // перетаскивание конца, ввод длины

export interface StretchPlan {
  moved: ReadonlyMap<Wall, { a: boolean; b: boolean }>
}

const ENDS: readonly WallEnd[] = ["a", "b"]

export function planOrthoStretch(walls: readonly Wall[], seed: StretchSeed, v: Point): StretchPlan {
  const moved = new Map<Wall, { a: boolean; b: boolean }>()
  const whole = new Set<Wall>()
  const queue: Wall[] = []
  const vLen = Math.hypot(v.x, v.y)
  const vDir = vLen > 0 ? { x: v.x / vLen, y: v.y / vLen } : null

  const markWhole = (w: Wall): void => {
    moved.set(w, { a: true, b: true })
    if (whole.has(w)) return
    whole.add(w)
    queue.push(w)
  }
  const markEnd = (w: Wall, end: WallEnd): void => {
    const m = moved.get(w) ?? { a: false, b: false }
    const next = { ...m, [end]: true }
    if (next.a && next.b) markWhole(w)
    else moved.set(w, next)
  }
  // связанная стена: параллельная v растягивается своим концом, остальные — целиком
  const link = (w: Wall, end: WallEnd): void => {
    if (whole.has(w)) return
    const parallel = vDir !== null && Math.abs(cross(unit(w.a, w.b), vDir)) <= RIGHT_SIN
    if (parallel) markEnd(w, end)
    else markWhole(w)
  }
  // концы других стен в допуске стыка со смещаемой точкой p стены source
  const jointedAt = (p: Point, source: Wall): { wall: Wall; end: WallEnd }[] =>
    walls.flatMap((w) =>
      w === source || dist(w.a, w.b) === 0 ? [] : ENDS.filter((e) => dist(w[e], p) <= faceCornerTol(source, w)).map((end) => ({ wall: w, end })),
    )

  if (seed.kind === "walls") seed.walls.forEach(markWhole)
  else {
    markEnd(seed.wall, seed.end)
    if (vDir) for (const { wall, end } of jointedAt(seed.wall[seed.end], seed.wall)) link(wall, end)
  }
  if (!vDir) return { moved }

  for (let i = 0; i < queue.length; i++) {
    const s = queue[i]
    const jointed = ENDS.flatMap((e) => jointedAt(s[e], s))
    for (const { wall, end } of jointed) link(wall, end)
    // T-примыкания — только от стены, сдвигаемой целиком, и только концы без стыка с ней
    for (const w of walls) {
      if (w === s || dist(w.a, w.b) === 0) continue
      for (const e of ENDS)
        if (!jointed.some((j) => j.wall === w && j.end === e) && teeEndAttached(w[e], w, s)) link(w, e)
    }
  }
  return { moved }
}

export function applyStretch(plan: StretchPlan, v: Point): void {
  for (const [w, m] of plan.moved) {
    if (m.a) w.a = { x: w.a.x + v.x, y: w.a.y + v.y }
    if (m.b) w.b = { x: w.b.x + v.x, y: w.b.y + v.y }
  }
}
