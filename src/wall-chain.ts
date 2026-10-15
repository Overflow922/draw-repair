import type { Communication, Point, Wall, WallElement } from "./types"
import { angleReferenceRay, orthoDirection, typedDirection, wallAngleDeg } from "./wall-angle"
import type { StartRef } from "./wall-angle"
import { add, mul, sub } from "./wall-geometry"
import { startOverhangCm } from "./wall-length"
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
  communications?: readonly Communication[] // коммуникации: квадрат установки на них не налагается (add-communications D6)
}

export interface ChainSegment {
  start: Point // начало стены: у угла торца при параллельном направлении — середина стороны квадрата в плоскости торца
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

// Введённая длина — от кромки до кромки (change fix-collinear-edge-to-edge-length, design D2): у коллинеарного
// продолжения от торца ось короче введённого на выступ начала; значение не больше выступа не применяется
export function chainSegment(input: ChainInput): ChainSegment {
  const seg = segmentFor(input)
  const { typedLengthCm, ref } = input
  if (typedLengthCm === null || !seg.dir) return seg
  const overhang = startOverhangCm(ref, seg.start, seg.dir)
  if (overhang === 0) return seg
  if (typedLengthCm <= overhang) return segmentFor({ ...input, typedLengthCm: null })
  return { ...seg, end: add(seg.start, mul(seg.dir, typedLengthCm - overhang)) }
}

// Начало стены (change fix-corner-snap-parallel-start): у угла торца при заданном направлении вдоль оси
// существующей стены наружу торец новой стены лежит на стороне квадрата в плоскости торца
function wallStart(start: Point, ref: StartRef | null, fixed: Point | null): Point {
  const parallel = ref?.parallel
  if (!parallel || !fixed) return start
  const along = Math.abs(fixed.x - parallel.dir.x) <= 1e-9 && Math.abs(fixed.y - parallel.dir.y) <= 1e-9
  return along ? parallel.start : start
}

function segmentFor(input: ChainInput): ChainSegment {
  const { ref, raw, walls, radiusCm, gridStepCm, thicknessCm, typedLengthCm, doorways = [], communications = [] } = input
  const v = unitOrNull(sub(raw, input.start))
  const fixed = v ? constrainedDirection(input, v) : null
  const start = wallStart(input.start, ref, fixed)
  const snap = fixed
    ? snapOnRay(raw, walls, radiusCm, gridStepCm, thicknessCm, start, fixed, doorways, communications)
    : snapVertex(raw, walls, radiusCm, gridStepCm, thicknessCm, undefined, doorways, false, communications) // без диагонали: вторая вершина
  const track = tracked({ ...input, start }, snap, fixed)
  const target = track?.end ?? snap.point
  const dir = fixed ?? unitOrNull(sub(target, start))
  const end = typedLengthCm !== null && dir ? add(start, mul(dir, typedLengthCm)) : target
  return {
    start,
    end,
    dir,
    snap,
    angleDeg: ref && dir ? wallAngleDeg(ref, dir) : null,
    refRay: ref && dir ? angleReferenceRay(ref, dir) : null,
    tracks: track?.tracks ?? [],
  }
}
