import type { Point, Wall, WallElement } from "./types"
import { angleReferenceRay, orthoDirection, typedDirection, wallAngleDeg } from "./wall-angle"
import type { StartRef } from "./wall-angle"
import { add, mul, sub } from "./wall-geometry"
import { snapOnRay, snapVertex } from "./wall-snap"
import type { VertexSnap } from "./wall-snap"
import { trackFree, trackOnRay, trackingNodes } from "./wall-tracking"
import type { TrackLine } from "./wall-tracking"

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
}

export interface ChainSegment {
  end: Point
  dir: Point | null // направление сегмента; null — нулевая длина
  snap: VertexSnap // привязка свободного конца к стене или сетке (квадрат на конце)
  angleDeg: number | null // наименьший угол к стене примыкания
  refRay: Point | null // луч, от которого отсчитан угол
  tracks: TrackLine[] // линии трекинга по узлам (change wall-axis-tracking-snap)
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

// Трекинг по узлам (design D2): только когда конец не прилип к стене и длина не введена;
// на заданном направлении — длина по пересечению луча с линией узла, иначе — координаты по осям.
function tracked(input: ChainInput, snap: VertexSnap, fixed: Point | null): { end: Point; tracks: TrackLine[] } | null {
  const { start, ref, raw, walls, radiusCm, typedLengthCm } = input
  if (snap.source === "wall" || typedLengthCm !== null) return null
  const nodes = trackingNodes(walls, start, ref?.kind === "cap" ? ref.anchor : undefined)
  if (fixed) {
    const hit = trackOnRay(raw, nodes, radiusCm, start, fixed)
    return hit && { end: hit.point, tracks: [hit.line] }
  }
  const { x, y } = trackFree(raw, nodes, radiusCm)
  if (!x && !y) return null
  // несработавшая ось — узел сетки из привязки
  const end = { x: x?.value ?? snap.point.x, y: y?.value ?? snap.point.y }
  return { end, tracks: [x, y].flatMap((hit) => (hit ? [{ from: hit.node, to: end }] : [])) }
}

export function chainSegment(input: ChainInput): ChainSegment {
  const { start, ref, raw, walls, radiusCm, gridStepCm, thicknessCm, typedLengthCm, doorways = [] } = input
  const v = unitOrNull(sub(raw, start))
  const fixed = v ? constrainedDirection(input, v) : null
  const snap = fixed
    ? snapOnRay(raw, walls, radiusCm, gridStepCm, thicknessCm, start, fixed, doorways)
    : snapVertex(raw, walls, radiusCm, gridStepCm, thicknessCm, undefined, doorways, false) // без диагонали: вторая вершина
  const track = tracked(input, snap, fixed)
  const target = track?.end ?? snap.point
  const dir = fixed ?? unitOrNull(sub(target, start))
  const end = typedLengthCm !== null && dir ? add(start, mul(dir, typedLengthCm)) : target
  return {
    end,
    dir,
    snap,
    angleDeg: ref && dir ? wallAngleDeg(ref, dir) : null,
    refRay: ref && dir ? angleReferenceRay(ref, dir) : null,
    tracks: track?.tracks ?? [],
  }
}
