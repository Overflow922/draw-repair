import type { Communication, Point, Wall, WallElement } from "./types"
import { angleReferenceRay, orthoDirection, typedDirection, wallAngleDeg } from "./wall-angle"
import type { StartRef } from "./wall-angle"
import { add, mul, sub } from "./wall-geometry"
import { endInCapPlane, startInCapPlane } from "./wall-axes-meet"
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
  doorways?: readonly WallElement[] // проёмы: привязка к стене не нарушает их (change add-doorway, design D6)
  communications?: readonly Communication[] // коммуникации: квадрат установки на них не налагается (add-communications D6)
}

export interface ChainSegment {
  start: Point // начало стены: у угла торца при параллельном направлении — середина стороны квадрата в плоскости торца
  end: Point
  dir: Point | null // направление сегмента; null — нулевая длина
  snap: VertexSnap // привязка свободного конца к стене или сетке (квадрат на конце)
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

// Начало стены (change fix-corner-snap-parallel-start): у угла торца при заданном направлении вдоль оси
// существующей стены наружу торец новой стены лежит на стороне квадрата в плоскости торца
function wallStart(start: Point, ref: StartRef | null, fixed: Point | null): Point {
  const parallel = ref?.parallel
  if (!parallel || !fixed) return start
  const along = Math.abs(fixed.x - parallel.dir.x) <= 1e-9 && Math.abs(fixed.y - parallel.dir.y) <= 1e-9
  return along ? parallel.start : start
}

// Оси коллинеарного продолжения сходятся (change collinear-axes-meet, design D1–D2): начало и конец оси, идущей по
// прямой торца, лежат в плоскости торца; длина оси при этом равна длине кромка-кромка, введённая длина — по оси.
export function chainSegment(input: ChainInput): ChainSegment {
  const { ref, raw, walls, radiusCm, gridStepCm, thicknessCm, typedLengthCm, doorways = [], communications = [] } = input
  const v =unitOrNull(sub(raw, input.start))
  const fixed = v ? constrainedDirection(input, v) : null
  const placed = wallStart(input.start, ref, fixed)
  const snap = fixed
    ? snapOnRay(raw, walls, radiusCm, gridStepCm, thicknessCm, placed, fixed, doorways, communications)
    : snapVertex(raw, walls, radiusCm, gridStepCm, thicknessCm, undefined, doorways, false, communications) // без диагонали: вторая вершина
  const target = snap.point
  const dir = fixed ?? unitOrNull(sub(target, placed))
  const start = dir ? startInCapPlane(placed, dir, ref) : placed
  const end = typedLengthCm !== null && dir ? add(start, mul(dir, typedLengthCm)) : dir ? endInCapPlane(target, dir, snap) : target
  return {
    start,
    end,
    dir,
    snap,
    angleDeg: ref && dir ? wallAngleDeg(ref, dir) : null,
    refRay: ref && dir ? angleReferenceRay(ref, dir) : null,
  }
}
