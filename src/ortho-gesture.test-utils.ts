import { snapOthers, snapWithSource } from "./geometry"
import type { Axis } from "./ortho-axis"
import { orthoGestureStep, startOrthoGesture } from "./ortho-gesture"
import type { Point, Wall } from "./types"
import { moveEndpointBounded, moveWallsBounded } from "./wall-edit"
import type { EditMode } from "./wall-edit"
import { restore, snapshot } from "./wall-edit.test-utils"

// change ortho-axis-lock: прогон жеста правки (design D2). Правила жеста — в производственном
// orthoGestureStep; здесь только обвязка, как в main.ts: снимок начала, на каждом шаге указателя —
// восстановить снимок, шаг жеста, правка с ограничениями при наличии цели.

export const GRID = 10
export const RADIUS = 5

const sub = (p: Point, q: Point): Point => ({ x: p.x - q.x, y: p.y - q.y })
const add = (p: Point, q: Point): Point => ({ x: p.x + q.x, y: p.y + q.y })

export interface GestureResult {
  axis: Axis | null
}

// перемещение стены или группы за тело стены pressed: press — точка нажатия, pointers — шаги указателя
export function moveGesture(walls: Wall[], group: Wall[], pressed: Wall, press: Point, pointers: Point[], ortho = true): GestureResult {
  const start = snapshot(walls)
  const baseA = { ...pressed.a }
  let gesture = startOrthoGesture("move", press, baseA)
  for (const p of pointers) {
    restore(walls, start)
    if (!ortho) {
      const target = snapWithSource(add(baseA, sub(p, press)), snapOthers(walls, group), GRID, RADIUS)
      moveWallsBounded(walls, group, sub(target.point, baseA), target.axisWall ? { ortho, snappedAxis: target.axisWall } : { ortho })
      continue
    }
    const step = orthoGestureStep(gesture, p, walls, { kind: "walls", walls: group }, GRID, RADIUS)
    gesture = step.gesture
    if (!step.target) continue
    const mode: EditMode = step.target.axisWall ? { ortho, snappedAxis: step.target.axisWall } : { ortho }
    moveWallsBounded(walls, group, sub(step.target.point, baseA), mode)
  }
  return { axis: gesture.axis }
}

// перетаскивание конца end стены wall: press — точка нажатия (по умолчанию сам конец), pointers — шаги указателя
export function endpointGesture(walls: Wall[], wall: Wall, end: "a" | "b", pointers: Point[], press: Point = { ...wall[end] }): GestureResult {
  const start = snapshot(walls)
  const other = { ...wall[end === "a" ? "b" : "a"] }
  let gesture = startOrthoGesture("end", press, other)
  for (const p of pointers) {
    restore(walls, start)
    const step = orthoGestureStep(gesture, p, walls, { kind: "end", wall, end }, GRID, RADIUS)
    gesture = step.gesture
    if (!step.target) continue
    if (step.target.point.x === other.x && step.target.point.y === other.y) continue
    const mode: EditMode = step.target.axisWall ? { ortho: true, snappedAxis: step.target.axisWall } : { ortho: true }
    moveEndpointBounded(walls, wall, end, step.target.point, mode)
  }
  return { axis: gesture.axis }
}
