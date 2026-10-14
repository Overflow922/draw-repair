import type { Segment } from "../edit-plan"
import type { Communication, Point, Wall } from "../types"
import { RECOGNITION_DEPTH_CM } from "../wall-collision"
import type { CheckMode, Verdict } from "../wall-collision"
import { communicationBox, shapeOfCommunication, wallOverlapDepth } from "./geometry"
import { BISECT_ITERATIONS, CLEAR_CM, CONTACT_DEPTH_CM, penetration, segmentShape } from "./shape"
import type { Shape } from "./shape"

// Стены не налагаются на коммуникации (change add-communications, design D6, D7; spec wall-collision «Стены не
// налагаются на коммуникации»): охранник правок существующих стен, проверка толщины и привязки, ограничение
// рисуемой стены. Нарушение после правки не должно расти сверх исходного (и допуска распознавания).

// ограничение рисуемой стены короче этого — нулевая длина
const NO_WALL_CM = 1e-4

// нарушение растёт сверх исходного
const worse = (before: number, after: number): boolean => after > Math.max(before, RECOGNITION_DEPTH_CM)

const deepest = (c: Communication, walls: readonly Wall[]): number => walls.reduce((m, w) => Math.max(m, wallOverlapDepth(c, w)), 0)

export function violatesCommunications(before: readonly Wall[], after: readonly Wall[], communications: readonly Communication[]): boolean {
  return communications.some((c) => worse(deepest(c, before), deepest(c, after)))
}

export function thicknessAllowedForCommunications(walls: readonly Wall[], wall: Wall, thicknessCm: number, communications: readonly Communication[]): boolean {
  return !violatesCommunications(walls, walls.map((w) => (w === wall ? { ...w, thicknessCm } : w)), communications)
}

export interface CommunicationGuard {
  holds(positions: ReadonlyMap<Wall, Segment>): boolean
  // вердикт с нормалью контакта: по ней правка стены скользит вдоль коммуникации (design D6)
  check(positions: ReadonlyMap<Wall, Segment>, mode: CheckMode): Verdict
}

interface Entry {
  shape: Shape
  box: [number, number, number, number]
  before: number
}

const boxOfSegment = (s: Segment, thicknessCm: number): [number, number, number, number] => [
  Math.min(s.a.x, s.b.x) - thicknessCm / 2,
  Math.min(s.a.y, s.b.y) - thicknessCm / 2,
  Math.max(s.a.x, s.b.x) + thicknessCm / 2,
  Math.max(s.a.y, s.b.y) + thicknessCm / 2,
]

const apart = (p: readonly number[], q: readonly number[]): boolean => p[0] > q[2] || q[0] > p[2] || p[1] > q[3] || q[1] > p[3]

// охранник положений правки (по образцу doorwayGuard): проверяются только изменяемые стены — остальные не хуже исходных
export function communicationGuard(walls: readonly Wall[], communications: readonly Communication[]): CommunicationGuard | null {
  if (!communications.length) return null
  const entries: Entry[] = communications.map((c) => ({ shape: shapeOfCommunication(c), box: communicationBox(c), before: deepest(c, walls) }))
  const check = (positions: ReadonlyMap<Wall, Segment>, mode: CheckMode): Verdict => {
    for (const [wall, segment] of positions) {
      const body = segmentShape(segment.a, segment.b, wall.thicknessCm)
      if (!body) continue
      const box = boxOfSegment(segment, wall.thicknessCm)
      for (const e of entries) {
        if (apart(e.box, box)) continue
        const { depth, normal } = penetration(e.shape, body)
        const allowed = mode === "recognition" ? Math.max(e.before, RECOGNITION_DEPTH_CM) : Math.max(e.before + CLEAR_CM, CONTACT_DEPTH_CM)
        if (depth > allowed) return { ok: false, normal }
      }
    }
    return { ok: true }
  }
  return { holds: (positions) => check(positions, "recognition").ok, check }
}

// квадрат установки начала стены не налагается на коммуникации (spec wall-collision «Рисование стены»)
export function squareAllowed(square: readonly Point[], communications: readonly Communication[]): boolean {
  return squareAllowedAmong(square, communications.map(shapeOfCommunication))
}

// то же для произвольных тел (батареи, change add-battery)
export function squareAllowedAmong(square: readonly Point[], shapes: readonly Shape[]): boolean {
  const body: Shape = { kind: "poly", pts: square }
  return shapes.every((s) => penetration(s, body).depth <= RECOGNITION_DEPTH_CM)
}

// конец рисуемой стены, обрезанный до касания с коммуникациями: последнее положение на отрезке от начала, при котором
// тело стены не налагается на коммуникацию; тело растёт вместе с длиной, поэтому допустимые положения — начало отрезка;
// null — стена нулевой длины
export function limitNewWall(start: Point, end: Point, thicknessCm: number, communications: readonly Communication[]): Point | null {
  return limitNewWallAmong(start, end, thicknessCm, communications.map(shapeOfCommunication))
}

// то же для произвольных тел (батареи, change add-battery)
export function limitNewWallAmong(start: Point, end: Point, thicknessCm: number, shapes: readonly Shape[]): Point | null {
  const along = (t: number): Point => ({ x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t })
  const depthAt = (t: number): number => {
    const body = segmentShape(start, along(t), thicknessCm)
    return body ? shapes.reduce((m, s) => Math.max(m, penetration(s, body).depth), 0) : 0
  }
  if (depthAt(1) <= RECOGNITION_DEPTH_CM) return end
  let ok = 0
  let bad = 1
  for (let i = 0; i < BISECT_ITERATIONS; i++) {
    const mid = (ok + bad) / 2
    if (depthAt(mid) > CONTACT_DEPTH_CM) bad = mid
    else ok = mid
  }
  const limited = along(ok)
  return Math.hypot(limited.x - start.x, limited.y - start.y) < NO_WALL_CM ? null : limited
}
