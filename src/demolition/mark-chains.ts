import { faceRuns } from "../doorway/doorway-faces"
import type { Side } from "../doorway/doorway-faces"
import type { Wall } from "../types"
import { EPS_CM, lengthOf } from "./mark-model"
import type { MarkSpan } from "./mark-model"

// Размеры пометки по граням стены до ближайших стыков, как у проёма (change demolition-doorway-sizes, design D1):
// у каждой грани цепочка из трёх размеров — расстояние до стыка в сторону a, ширина, расстояние до стыка в сторону b.

export type NumberTarget = "gapA" | "width" | "gapB"

// участок грани между стыками [j0, j1], к которому относится пометка, и границы пометки на нём (вдоль оси от конца a)
export interface FaceBounds {
  j0: number
  j1: number
  start: number
  end: number
}

export interface MarkChainItem {
  side: Side // +1 — грань со стороны нормали (−d.y, d.x) оси a → b, −1 — противоположная
  target: NumberTarget
  fromCm: number
  toCm: number
  lengthCm: number
}

// свободный участок грани с наибольшим перекрытием с участком пометки (при равенстве — первый, иначе ближайший)
function runOf(runs: [number, number][], from: number, to: number): [number, number] | null {
  let best: [number, number] | null = null
  let bestScore = -Infinity
  for (const r of runs) {
    const overlap = Math.min(r[1], to) - Math.max(r[0], from)
    if (overlap > bestScore) {
      best = r
      bestScore = overlap
    }
  }
  return best
}

// Граница у конца стены (в пределах EPS_CM) включает торцевую часть формы за концом оси и совпадает со стыком грани;
// границы зажаты в участок грани, конец не меньше начала — размеры не отрицательны.
export function faceBounds(r: MarkSpan, walls: readonly Wall[], side: Side): FaceBounds | null {
  const run = runOf(faceRuns(r.wall, walls, side), r.from, r.to)
  if (!run) return null
  const [j0, j1] = run
  const len = lengthOf(r.wall)
  const rawStart = r.from <= EPS_CM ? j0 : Math.max(j0, r.from)
  const rawEnd = r.to >= len - EPS_CM ? j1 : Math.min(j1, r.to)
  const start = Math.min(j1, Math.max(j0, rawStart))
  const end = Math.min(j1, Math.max(start, rawEnd))
  return { j0, j1, start, end }
}

// шесть размеров: грань +1 (gapA, width, gapB), затем грань −1; у стены без граней — пусто
export function markChains(r: MarkSpan, walls: readonly Wall[]): MarkChainItem[] {
  const out: MarkChainItem[] = []
  for (const side of [1, -1] as const) {
    const bounds = faceBounds(r, walls, side)
    if (!bounds) continue
    for (const [target, fromCm, toCm] of [
      ["gapA", bounds.j0, bounds.start],
      ["width", bounds.start, bounds.end],
      ["gapB", bounds.end, bounds.j1],
    ] as const)
      out.push({ side, target, fromCm, toCm, lengthCm: toCm - fromCm })
  }
  return out
}
