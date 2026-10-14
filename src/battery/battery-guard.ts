import { communicationViolation, shapeOfCommunication } from "../communications/geometry"
import { limitNewWallAmong, squareAllowedAmong } from "../communications/guard"
import { CLEAR_CM, CONTACT_DEPTH_CM, penetration, segmentShape } from "../communications/shape"
import type { Shape } from "../communications/shape"
import type { Segment } from "../edit-plan"
import type { Battery, Communication, Point, Wall } from "../types"
import { RECOGNITION_DEPTH_CM } from "../wall-collision"
import type { CheckMode, Verdict } from "../wall-collision"
import { degenerate } from "../wall-geometry"
import { batteryDepth, batteryRect, batteryShape, batterySpan } from "./battery-geometry"
import { hostOfBattery, runContaining, visibleRuns } from "./battery-motion"

// Двустороннее ограничение (change add-battery, design D4; spec wall-collision «Стены не налагаются на батареи», communications
// «Коммуникации не налагаются на батареи»): стены и коммуникации не налагаются на батареи. Батареи опорной стены едут с ней
// и проверяются против всех объектов; наложение не должно расти сверх исходного (и допуска распознавания).

// нарушение растёт сверх исходного
const worse = (before: number, after: number): boolean => after > Math.max(before, RECOGNITION_DEPTH_CM)

const depthsOf = (batteries: readonly Battery[], walls: readonly Wall[], communications: readonly Communication[]): number[] =>
  batteries.map((b) => batteryDepth(b, { walls, batteries, communications }))

// стены после правки (батареи следуют за опорной стеной сами: прямоугольник вычисляется от её оси)
export function violatesBatteries(before: readonly Wall[], after: readonly Wall[], batteries: readonly Battery[], communications: readonly Communication[] = []): boolean {
  const was = depthsOf(batteries, before, communications)
  const now = depthsOf(batteries, after, communications)
  return now.some((depth, i) => worse(was[i], depth))
}

export function thicknessAllowedForBatteries(walls: readonly Wall[], wall: Wall, thicknessCm: number, batteries: readonly Battery[], communications: readonly Communication[] = []): boolean {
  return !violatesBatteries(walls, walls.map((w) => (w === wall ? { ...w, thicknessCm } : w)), batteries, communications)
}

// тело батареи и его габарит [minX, minY, maxX, maxY]; minSideCm — меньшая сторона (шаг пути не больше неё)
export interface BatteryBody {
  shape: Shape
  box: readonly [number, number, number, number]
  minSideCm: number
}

// тела батарей, опорная стена которых есть среди walls
export function batteryBodies(batteries: readonly Battery[], walls: readonly Wall[]): BatteryBody[] {
  return batteries.flatMap((b): BatteryBody[] => {
    const host = hostOfBattery(b, walls)
    if (!host) return []
    const rect = batteryRect(b, host)
    const xs = rect.map((p) => p.x)
    const ys = rect.map((p) => p.y)
    return [{ shape: batteryShape(b, host), box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], minSideCm: Math.min(b.lengthCm, b.thicknessCm) }]
  })
}

// наибольшая глубина наложения тела на тела батарей
export const bodiesDepth = (shape: Shape, bodies: readonly BatteryBody[]): number => bodies.reduce((m, b) => Math.max(m, penetration(shape, b.shape).depth), 0)

// наибольшая глубина наложения коммуникации на стены, другие коммуникации и батареи
export const communicationDepth = (c: Communication, walls: readonly Wall[], others: readonly Communication[], bodies: readonly BatteryBody[]): number =>
  Math.max(communicationViolation(c, walls, others), bodiesDepth(shapeOfCommunication(c), bodies))

// квадрат установки начала стены не налагается на батареи (spec wall-collision «Рисование стены»)
export function squareAllowedForBatteries(square: readonly Point[], walls: readonly Wall[], batteries: readonly Battery[]): boolean {
  return squareAllowedAmong(square, batteryBodies(batteries, walls).map((b) => b.shape))
}

// конец рисуемой стены, обрезанный до касания с батареями; null — стена нулевой длины
export function limitNewWallByBatteries(start: Point, end: Point, thicknessCm: number, walls: readonly Wall[], batteries: readonly Battery[]): Point | null {
  return limitNewWallAmong(start, end, thicknessCm, batteryBodies(batteries, walls).map((b) => b.shape))
}

export interface BatteryGuard {
  holds(positions: ReadonlyMap<Wall, Segment>): boolean
  // вердикт с нормалью контакта: по ней правка стены скользит вдоль батареи (null — без скольжения)
  check(positions: ReadonlyMap<Wall, Segment>, mode: CheckMode): Verdict
}

const wallsAfter = (walls: readonly Wall[], positions: ReadonlyMap<Wall, Segment>): Wall[] =>
  walls.map((w) => {
    const s = positions.get(w)
    return s ? { ...w, a: s.a, b: s.b } : w
  })

// охранник положений правки (по образцу communicationGuard): батарея неподвижной опорной стены проверяется против изменяемых
// стен; батарея изменяемой опорной стены — против всех объектов, и её видимый участок грани остаётся вмещающим
export function batteryGuard(walls: readonly Wall[], batteries: readonly Battery[], communications: readonly Communication[]): BatteryGuard | null {
  const placed = batteries.filter((b) => hostOfBattery(b, walls))
  if (!placed.length) return null
  const before = new Map(placed.map((b) => [b, batteryDepth(b, { walls, batteries, communications })]))
  const visibleBefore = new Map(
    placed.map((b) => {
      const host = hostOfBattery(b, walls)
      return [b, host ? runContaining(visibleRuns(host, walls, b.face), batterySpan(b, host)[0], b.lengthCm) !== null : false]
    }),
  )
  const allowedFor = (b: Battery, mode: CheckMode): number => {
    const was = before.get(b) ?? 0
    return mode === "recognition" ? Math.max(was, RECOGNITION_DEPTH_CM) : Math.max(was + CLEAR_CM, CONTACT_DEPTH_CM)
  }
  const check = (positions: ReadonlyMap<Wall, Segment>, mode: CheckMode): Verdict => {
    const after = wallsAfter(walls, positions)
    for (const b of placed) {
      const original = walls.find((w) => w.id === b.wallId)
      const moved = original !== undefined && positions.has(original)
      const allowed = allowedFor(b, mode)
      if (moved) {
        const host = hostOfBattery(b, after)
        if (!host) return { ok: false, normal: null }
        if (visibleBefore.get(b) && !runContaining(visibleRuns(host, after, b.face), batterySpan(b, host)[0], b.lengthCm)) return { ok: false, normal: null }
        const mine = batteryShape(b, host)
        const obstacles: Shape[] = []
        for (const w of after) {
          if (w.id === host.id || degenerate(w)) continue
          const body = segmentShape(w.a, w.b, w.thicknessCm)
          if (body) obstacles.push(body)
        }
        for (const o of batteries) {
          const oh = o.id === b.id ? null : hostOfBattery(o, after)
          if (oh) obstacles.push(batteryShape(o, oh))
        }
        for (const c of communications) obstacles.push(shapeOfCommunication(c))
        for (const o of obstacles) {
          const hit = penetration(o, mine)
          if (hit.depth > allowed) return { ok: false, normal: hit.normal }
        }
      } else {
        const host = hostOfBattery(b, walls)
        if (!host) continue
        const mine = batteryShape(b, host)
        for (const [wall, segment] of positions) {
          const body = segmentShape(segment.a, segment.b, wall.thicknessCm)
          if (!body) continue
          const hit = penetration(mine, body)
          if (hit.depth > allowed) return { ok: false, normal: hit.normal }
        }
      }
    }
    return { ok: true }
  }
  return { holds: (positions) => check(positions, "recognition").ok, check }
}
