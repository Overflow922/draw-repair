import type { Point, Wall } from "./types"
import { angleReferenceRay, orthoDirection, typedDirection, wallAngleDeg } from "./wall-angle"
import type { StartRef } from "./wall-angle"
import { add, mul, sub } from "./wall-geometry"
import { snapOnRay, snapVertex } from "./wall-snap"
import type { VertexSnap } from "./wall-snap"

// Единый расчёт сегмента построения стены (change wall-relative-angle-snap, design D5):
// превью и фиксация используют один и тот же результат.

export interface ChainInput {
  start: Point
  ref: StartRef | null // опора начала; null — начало свободно
  raw: Point // позиция курсора
  walls: Wall[]
  radiusCm: number
  gridStepCm: number
  thicknessCm: number
  ortho: boolean
  typedAngleDeg: number | null
  typedLengthCm: number | null
}

export interface ChainSegment {
  end: Point
  dir: Point | null // направление сегмента; null — нулевая длина
  snap: VertexSnap // привязка свободного конца (квадрат на конце)
  angleDeg: number | null // наименьший угол к стене примыкания
  refRay: Point | null // луч, от которого отсчитан угол
}

function unitOrNull(v: Point): Point | null {
  const l = Math.hypot(v.x, v.y)
  return l > 1e-9 ? mul(v, 1 / l) : null
}

// заданное направление: введённый угол (только при опоре) приоритетнее орто
function constrainedDirection(input: ChainInput, v: Point): Point | null {
  const { ref, typedAngleDeg, ortho } = input
  const typed = ref && typedAngleDeg !== null ? typedDirection(ref, typedAngleDeg, v) : null
  return typed ?? (ortho ? orthoDirection(ref, v) : null)
}

export function chainSegment(input: ChainInput): ChainSegment {
  const { start, ref, raw, walls, radiusCm, gridStepCm, thicknessCm, typedLengthCm } = input
  const v = unitOrNull(sub(raw, start))
  const fixed = v ? constrainedDirection(input, v) : null
  const snap = fixed
    ? snapOnRay(raw, walls, radiusCm, gridStepCm, thicknessCm, start, fixed)
    : snapVertex(raw, walls, radiusCm, gridStepCm, thicknessCm)
  const dir = fixed ?? unitOrNull(sub(snap.point, start))
  const end = typedLengthCm !== null && dir ? add(start, mul(dir, typedLengthCm)) : snap.point
  return {
    end,
    dir,
    snap,
    angleDeg: ref && dir ? wallAngleDeg(ref, dir) : null,
    refRay: ref && dir ? angleReferenceRay(ref, dir) : null,
  }
}
