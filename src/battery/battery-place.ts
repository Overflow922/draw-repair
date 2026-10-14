import type { Battery, Communication, Point, Wall, WallElement } from "../types"
import { degenerate, dist, unit } from "../wall-geometry"
import { chooseFace } from "./battery-face"
import { freeStarts, hostOfBattery, limitedStart, nearestIn, obstacleShapes, snapCenter, startOf, withStart } from "./battery-motion"

// Установка и перемещение батареи вдоль опорной стены (change add-battery, design D3): призрак, перетаскивание, стрелки,
// центровка по окну. Чистые функции; результат правки — BatteryEdit, исходная батарея не меняется.

export interface BatteryParams {
  lengthCm: number
  thicknessCm: number
  gapCm: number
}

// длина 70 см, толщина 10 см, отступ 3 см (spec battery «Инструмент «Батарея» и параметры новых батарей»)
export const DEFAULT_BATTERY_PARAMS: BatteryParams = { lengthCm: 70, thicknessCm: 10, gapCm: 3 }

// правка батареи делает её размеры параметрами новых батарей
export const inheritBatteryParams = (_params: BatteryParams, b: Battery): BatteryParams => ({
  lengthCm: b.lengthCm,
  thicknessCm: b.thicknessCm,
  gapCm: b.gapCm,
})

// snapCm — радиус центровки по окну в сантиметрах чертежа (с учётом зума); elements — окна для центровки
export interface BatteryContext {
  batteries: readonly Battery[]
  communications: readonly Communication[]
  elements: readonly WallElement[]
  snapCm: number
}

export type BatteryEdit = { kind: "applied"; battery: Battery } | { kind: "rejected"; reason: "invalid" | "no-change" }

const NO_CHANGE: BatteryEdit = { kind: "rejected", reason: "no-change" }
const INVALID: BatteryEdit = { kind: "rejected", reason: "invalid" }
const SAME_CM = 1e-9
// допуск прямого угла между стрелкой и осью стены: 0,5° (spec multi-selection «Сдвиг выделения стрелками»)
const RIGHT_ANGLE_SIN = Math.sin((0.5 * Math.PI) / 180)

const axisOf = (host: Wall): Point => unit(host.a, host.b)

// целевое начало участка: с прилипанием центра к центру окна (точно) или с округлением расстояния привязки до сантиметра
function targetStart(b: Battery, host: Wall, rawStart: number, ctx: BatteryContext): number {
  const snapped = snapCenter(rawStart + b.lengthCm / 2, host, ctx.elements, ctx.snapCm)
  if (snapped !== null) return snapped - b.lengthCm / 2
  const len = dist(host.a, host.b)
  const offset = b.anchor === "a" ? rawStart : len - rawStart - b.lengthCm
  const rounded = Math.round(offset)
  return b.anchor === "a" ? rounded : len - rounded - b.lengthCm
}

const moved = (b: Battery, host: Wall, s: number): BatteryEdit =>
  Math.abs(s - startOf(b, host)) < SAME_CM ? NO_CHANGE : { kind: "applied", battery: withStart(b, host, s) }

// призрак установки: центр — проекция курсора на ось (с центровкой по окну), расстояние округляется до сантиметра;
// положение сдвигается к ближайшему допустимому; null — на грани нет места
export function placeBattery(host: Wall, walls: readonly Wall[], cursor: Point, params: BatteryParams, id: string, ctx: BatteryContext): Battery | null {
  if (degenerate(host)) return null
  const proto: Battery = { id, wallId: host.id, face: chooseFace(host, cursor, walls), anchor: "a", offsetCm: 0, ...params }
  const u = axisOf(host)
  const along = (cursor.x - host.a.x) * u.x + (cursor.y - host.a.y) * u.y
  const wanted = targetStart(proto, host, along - params.lengthCm / 2, ctx)
  const free = freeStarts(proto, host, walls, obstacleShapes(proto, host, walls, ctx))
  const s = nearestIn(free, wanted)
  return s === null ? null : withStart(proto, host, s)
}

// перетаскивание: смещение указателя проецируется на ось; положение от исходного до цели ограничивается до касания
export function slideBattery(b: Battery, walls: readonly Wall[], deltaWorld: Point, ctx: BatteryContext): BatteryEdit {
  const host = hostOfBattery(b, walls)
  if (!host) return INVALID
  const u = axisOf(host)
  const from = startOf(b, host)
  const wanted = targetStart(b, host, from + deltaWorld.x * u.x + deltaWorld.y * u.y, ctx)
  const s = limitedStart(b, host, walls, obstacleShapes(b, host, walls, ctx), from, wanted)
  return moved(b, host, s)
}

// стрелка: шаг stepCm вдоль оси в сторону конца стены, направление на который образует со стрелкой острый угол;
// без прилипания к окну и без округления
export function arrowSlideBattery(b: Battery, walls: readonly Wall[], arrow: Point, stepCm: number, ctx: BatteryContext): BatteryEdit {
  const host = hostOfBattery(b, walls)
  if (!host) return INVALID
  const norm = Math.hypot(arrow.x, arrow.y)
  if (norm === 0) return NO_CHANGE
  const u = axisOf(host)
  const cos = (arrow.x * u.x + arrow.y * u.y) / norm
  if (Math.abs(cos) <= RIGHT_ANGLE_SIN) return NO_CHANGE
  const from = startOf(b, host)
  const s = limitedStart(b, host, walls, obstacleShapes(b, host, walls, ctx), from, from + Math.sign(cos) * stepCm)
  return moved(b, host, s)
}
