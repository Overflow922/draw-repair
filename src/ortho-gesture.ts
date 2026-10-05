import { snapAlongAxis } from "./geometry"
import type { SnapResult } from "./geometry"
import { latchAxis } from "./ortho-axis"
import type { Axis } from "./ortho-axis"
import { planOrthoStretch } from "./ortho-stretch"
import type { StretchSeed } from "./ortho-stretch"
import type { Point, Wall } from "./types"
import { add, degenerate, sub } from "./wall-geometry"

// Шаг орто-жеста (change ortho-axis-lock, design D2, D4): ось защёлкивается при первом ненулевом
// смещении указателя от точки нажатия и не меняется до конца жеста; точка привязывается вдоль оси
// через опорную точку среди стен, не увлекаемых правкой.

// move — перемещение стены или группы (ref — опорный конец), end — перетаскивание конца
// (ref — противоположный конец)
export interface OrthoGesture {
  readonly kind: "move" | "end"
  readonly press: Point
  readonly ref: Point
  readonly axis: Axis | null
}

export interface OrthoGestureStep {
  gesture: OrthoGesture
  target: SnapResult | null
}

export function startOrthoGesture(kind: OrthoGesture["kind"], press: Point, ref: Point): OrthoGesture {
  return { kind, press, ref, axis: null }
}

const AXIS_DIR: Record<Axis, Point> = { x: { x: 1, y: 0 }, y: { x: 0, y: 1 } }

// стены, концы которых правка смещает (целиком или растягивая), в привязке не участвуют (design D4)
function snapCandidates(walls: Wall[], seed: StretchSeed, axis: Axis): Wall[] {
  const dragged = planOrthoStretch(walls, seed, AXIS_DIR[axis]).moved
  return walls.filter((w) => !dragged.has(w) && !degenerate(w))
}

export function orthoGestureStep(
  g: OrthoGesture,
  pointer: Point,
  walls: Wall[],
  seed: StretchSeed,
  gridStepCm: number,
  radiusCm: number,
): OrthoGestureStep {
  const shift = sub(pointer, g.press)
  const moved = shift.x !== 0 || shift.y !== 0
  // направляющий вектор конца — от противоположного конца: стена не разворачивается поперёк себя
  const axis = moved ? latchAxis(g.axis, g.kind === "move" ? shift : sub(pointer, g.ref)) : g.axis
  const gesture = axis === g.axis ? g : { ...g, axis }
  if (!axis) return { gesture, target: null }
  const cursor = g.kind === "move" ? add(g.ref, shift) : pointer
  return { gesture, target: snapAlongAxis(cursor, snapCandidates(walls, seed, axis), gridStepCm, radiusCm, g.ref, axis) }
}
