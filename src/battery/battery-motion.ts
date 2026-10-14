import { shapeOfCommunication } from "../communications/geometry"
import { CONTACT_DEPTH_CM, segmentShape, sweep } from "../communications/shape"
import type { Shape } from "../communications/shape"
import { faceRuns, jambsT } from "../doorway/doorway-faces"
import type { Battery, Communication, Wall, WallElement } from "../types"
import { isWindow } from "../types"
import { degenerate, dist, unit } from "../wall-geometry"
import { batterySpan, batteryShape, batteryDepth } from "./battery-geometry"

// Допустимые положения батареи вдоль оси опорной стены (change add-battery, design D3): видимый участок грани и
// препятствия — другие батареи, тела других стен, коммуникации. Положение описывается началом участка s — координатой t
// ближнего к концу a торца; к полям батареи оно переводится независимо от стороны привязки.

export interface BatteryObstacles {
  batteries: readonly Battery[]
  communications: readonly Communication[]
}

// шум вычисления границ участков грани меньше этого значения не значим (границы округляются, чтобы упор был точным)
const RUN_ROUND = 1e6
const RUN_TOL_CM = 1e-6
const NO_MOVE_CM = 1e-9

export const hostOfBattery = (b: Battery, walls: readonly Wall[]): Wall | null => {
  const host = walls.find((w) => w.id === b.wallId)
  return host && !degenerate(host) ? host : null
}

// батарея того же размера с началом участка s и той же стороной привязки
export function withStart(b: Battery, host: Wall, s: number): Battery {
  return b.anchor === "a" ? { ...b, offsetCm: s } : { ...b, offsetCm: dist(host.a, host.b) - s - b.lengthCm }
}

export const startOf = (b: Battery, host: Wall): number => batterySpan(b, host)[0]

const snap = (v: number): number => Math.round(v * RUN_ROUND) / RUN_ROUND

// видимые участки грани батареи; шум границ убран округлением
export function visibleRuns(host: Wall, walls: readonly Wall[], face: 1 | -1): [number, number][] {
  return faceRuns(host, [...walls], face).map(([t0, t1]): [number, number] => [snap(t0), snap(t1)])
}

// участок, на котором целиком лежит отрезок [s, s + length]
export function runContaining(runs: readonly [number, number][], s: number, length: number): [number, number] | null {
  return runs.find(([t0, t1]) => s >= t0 - RUN_TOL_CM && s + length <= t1 + RUN_TOL_CM) ?? null
}

// тела препятствий: другие стены, другие батареи (любых стен) и коммуникации; опорная стена, сама батарея и элементы
// стены препятствиями не являются
export function obstacleShapes(b: Battery, host: Wall, walls: readonly Wall[], others: BatteryObstacles): Shape[] {
  const shapes: Shape[] = []
  for (const w of walls) {
    if (w.id === host.id || degenerate(w)) continue
    const body = segmentShape(w.a, w.b, w.thicknessCm)
    if (body) shapes.push(body)
  }
  for (const o of others.batteries) {
    if (o.id === b.id) continue
    const oh = hostOfBattery(o, walls)
    if (oh) shapes.push(batteryShape(o, oh))
  }
  for (const c of others.communications) shapes.push(shapeOfCommunication(c))
  return shapes
}

// положение батареи после сдвига вдоль оси от начала участка from к to: до касания с первым препятствием и до границы
// видимого участка грани; препятствие, с которым батарея уже налагается, останавливает только движение вглубь
export function limitedStart(b: Battery, host: Wall, walls: readonly Wall[], obstacles: readonly Shape[], from: number, to: number): number {
  const distance = Math.abs(to - from)
  if (distance < NO_MOVE_CM) return from
  const sign = to > from ? 1 : -1
  const u = unit(host.a, host.b)
  const d = { x: u.x * sign, y: u.y * sign }
  const shape = batteryShape(withStart(b, host, from), host)
  let travel = distance
  for (const o of obstacles) {
    const hit = sweep(shape, d, o)
    if (hit) travel = Math.min(travel, Math.max(0, hit.t))
  }
  const run = runContaining(visibleRuns(host, walls, b.face), from, b.lengthCm)
  const reach = run ? (sign > 0 ? run[1] - (from + b.lengthCm) : from - run[0]) : 0
  travel = Math.min(travel, Math.max(0, reach))
  return travel >= distance ? to : from + sign * travel
}

// свободные начала участка: внутри видимых участков грани и вне интервалов, где батарея налагается на препятствия
export function freeStarts(b: Battery, host: Wall, walls: readonly Wall[], obstacles: readonly Shape[]): [number, number][] {
  const len = dist(host.a, host.b)
  const far = 2 * len + 4 * b.lengthCm + 1000
  const u = unit(host.a, host.b)
  const at = (s: number): Shape => batteryShape(withStart({ ...b, anchor: "a" }, host, s), host)
  const forbidden: [number, number][] = []
  for (const o of obstacles) {
    const enter = sweep(at(-far), u, o)
    const leave = sweep(at(far), { x: -u.x, y: -u.y }, o)
    if (!enter || !leave) continue
    const from = -far + enter.t
    const to = far - leave.t
    if (from < to - NO_MOVE_CM) forbidden.push([from, to])
  }
  forbidden.sort((p, q) => p[0] - q[0])
  const out: [number, number][] = []
  for (const [t0, t1] of visibleRuns(host, walls, b.face)) {
    let pieces: [number, number][] = [[t0, t1 - b.lengthCm]]
    for (const [f0, f1] of forbidden) {
      const next: [number, number][] = []
      for (const [p0, p1] of pieces) {
        if (f1 <= p0 || f0 >= p1) next.push([p0, p1])
        else {
          if (f0 > p0) next.push([p0, f0])
          if (f1 < p1) next.push([f1, p1])
        }
      }
      pieces = next
    }
    out.push(...pieces.filter(([p0, p1]) => p1 - p0 >= -NO_MOVE_CM))
  }
  return out
}

// ближайшее к s значение из интервалов; null, если интервалов нет
export function nearestIn(intervals: readonly [number, number][], s: number): number | null {
  let best: number | null = null
  for (const [p0, p1] of intervals) {
    const v = Math.min(p1, Math.max(p0, s))
    if (best === null || Math.abs(v - s) < Math.abs(best - s)) best = v
  }
  return best
}

// центр окна опорной стены, ближайший к центру батареи в пределах радиуса прилипания; двери и проёмы не цели
export function snapCenter(center: number, host: Wall, elements: readonly WallElement[], snapCm: number): number | null {
  let best: number | null = null
  for (const e of elements) {
    if (!isWindow(e) || e.wallId !== host.id) continue
    const [j1, j2] = jambsT(e, host)
    const c = (j1 + j2) / 2
    if (Math.abs(c - center) <= snapCm && (best === null || Math.abs(c - center) < Math.abs(best - center))) best = c
  }
  return best
}

// допустимая глубина наложения при правке чисел: уже существующее наложение не углубляется; касание — наложение не глубже
// общего допуска касания (communications/shape), чтобы значение останавливалось у препятствия, а не за ним
export function allowedDepth(b: Battery, walls: readonly Wall[], others: BatteryObstacles): number {
  return Math.max(batteryDepth(b, { walls, batteries: others.batteries, communications: others.communications }), CONTACT_DEPTH_CM)
}

// допустимо ли состояние батареи: целиком на видимом участке грани и без более глубокого наложения, чем allowed
export function stateHolds(b: Battery, walls: readonly Wall[], others: BatteryObstacles, allowed: number): boolean {
  const host = hostOfBattery(b, walls)
  if (!host) return false
  const [s] = batterySpan(b, host)
  if (!runContaining(visibleRuns(host, walls, b.face), s, b.lengthCm)) return false
  return batteryDepth(b, { walls, batteries: others.batteries, communications: others.communications }) <= allowed
}
