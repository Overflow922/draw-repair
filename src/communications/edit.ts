import { batteryBodies, communicationDepth } from "../battery/battery-guard"
import type { BatteryBody } from "../battery/battery-guard"
import type { Battery, Communication, Point, Wall } from "../types"
import { DIRECTION_VECTORS, slideReach } from "./geometry"
import type { Direction } from "./geometry"
import { growDuct } from "./duct-grow"
import { moveLimited } from "./placement"
import { BISECT_ITERATIONS, CLEAR_CM } from "./shape"

// Числа выделенной коммуникации и их правка (change add-communications, design D5; spec communications
// «Размеры выделенной коммуникации», «Правка чисел коммуникации»).

export type NumberField = { kind: "distance"; dir: Direction } | { kind: "diameter" } | { kind: "width" } | { kind: "depth" }

export interface CommunicationNumber {
  field: NumberField
  valueCm: number
  // положение числа в системе чертежа: диаметр — у края окружности (число стоит на полке выноски), размер воздуховода —
  // середина грани, расстояние — середина размерной линии (у нуля — точка касания)
  at: Point
  // размерная линия: расстояние — от края коммуникации до грани стены, размер воздуховода — вдоль его грани
  // (у диаметра и нулевого расстояния — нет линии)
  span: { from: Point; to: Point } | null
  // размер воздуховода рисуется размерной линией, вынесенной наружу от грани на OUTSET_PX; единичный вектор наружу
  // (у остальных чисел — null), чтобы число не стояло на контуре
  outward: Point | null
}

export const OUTSET_PX = 26

const DIRECTIONS: readonly Direction[] = ["left", "right", "up", "down"]
const SAME_CM = 1e-7
const DIAGONAL = Math.SQRT1_2

function sizeNumbers(c: Communication): CommunicationNumber[] {
  if (c.kind === "riser")
    return [
      {
        field: { kind: "diameter" },
        valueCm: c.diameterCm,
        at: { x: c.x + (c.diameterCm / 2) * DIAGONAL, y: c.y - (c.diameterCm / 2) * DIAGONAL },
        span: null,
        outward: null,
      },
    ]
  const left = c.x - c.widthCm / 2
  const right = c.x + c.widthCm / 2
  const top = c.y - c.depthCm / 2
  const bottom = c.y + c.depthCm / 2
  return [
    { field: { kind: "width" }, valueCm: c.widthCm, at: { x: c.x, y: top }, span: { from: { x: left, y: top }, to: { x: right, y: top } }, outward: { x: 0, y: -1 } },
    { field: { kind: "depth" }, valueCm: c.depthCm, at: { x: right, y: c.y }, span: { from: { x: right, y: top }, to: { x: right, y: bottom } }, outward: { x: 1, y: 0 } },
  ]
}

// размер и расстояния до стен по всем направлениям, где стены есть
export function communicationNumbers(c: Communication, walls: readonly Wall[]): CommunicationNumber[] {
  const distances = DIRECTIONS.flatMap((dir): CommunicationNumber[] => {
    const reach = slideReach(c, dir, walls)
    if (!reach) return []
    const d = DIRECTION_VECTORS[dir]
    const from = { x: reach.contact.x - d.x * reach.distanceCm, y: reach.contact.y - d.y * reach.distanceCm }
    const drawn = reach.distanceCm > 0
    const at = drawn ? { x: (from.x + reach.contact.x) / 2, y: (from.y + reach.contact.y) / 2 } : reach.contact
    return [{ field: { kind: "distance", dir }, valueCm: reach.distanceCm, at, span: drawn ? { from, to: reach.contact } : null, outward: null }]
  })
  return [...sizeNumbers(c), ...distances]
}

export interface NumberResult {
  communication: Communication
  changed: boolean
}

const unchanged = (c: Communication): NumberResult => ({ communication: c, changed: false })

const sizeOf = (c: Communication, kind: "diameter" | "width" | "depth"): number | null => {
  if (c.kind === "riser") return kind === "diameter" ? c.diameterCm : null
  return kind === "width" ? c.widthCm : kind === "depth" ? c.depthCm : null
}

const withSize = (c: Communication, kind: "diameter" | "width" | "depth", value: number): Communication => {
  if (c.kind === "riser") return { ...c, diameterCm: value }
  return kind === "width" ? { ...c, widthCm: value } : { ...c, depthCm: value }
}

const same = (a: Communication, b: Communication): boolean =>
  Math.abs(a.x - b.x) <= SAME_CM &&
  Math.abs(a.y - b.y) <= SAME_CM &&
  (a.kind === "riser" && b.kind === "riser"
    ? Math.abs(a.diameterCm - b.diameterCm) <= SAME_CM
    : a.kind === "duct" && b.kind === "duct" && Math.abs(a.widthCm - b.widthCm) <= SAME_CM && Math.abs(a.depthCm - b.depthCm) <= SAME_CM)

// наибольший допустимый размер не больше запрошенного при неизменном центре: до касания (наложение не растёт)
function limitedSize(c: Communication, kind: "diameter" | "width" | "depth", requested: number, walls: readonly Wall[], others: readonly Communication[], batteries: readonly BatteryBody[]): number {
  const current = sizeOf(c, kind) ?? requested
  const allowed = communicationDepth(c, walls, others, batteries) + CLEAR_CM
  const fits = (s: number): boolean => communicationDepth(withSize(c, kind, s), walls, others, batteries) <= allowed
  if (fits(requested)) return requested
  if (requested <= current) return current
  let lo = current
  let hi = requested
  for (let i = 0; i < BISECT_ITERATIONS; i++) {
    const mid = (lo + hi) / 2
    if (fits(mid)) lo = mid
    else hi = mid
  }
  return lo
}

// ввод числа: расстояние сдвигает коммуникацию вдоль оси до последнего допустимого положения, размер меняется вокруг
// неизменного центра; некорректное значение и ввод, не меняющий коммуникацию, — changed = false
export function applyNumber(c: Communication, field: NumberField, valueCm: number, walls: readonly Wall[], others: readonly Communication[], batteries: readonly Battery[] = []): NumberResult {
  if (!Number.isFinite(valueCm)) return unchanged(c)
  if (field.kind === "distance") {
    const reach = valueCm >= 0 ? slideReach(c, field.dir, walls) : null
    if (!reach) return unchanged(c)
    const d = DIRECTION_VECTORS[field.dir]
    const shift = reach.distanceCm - valueCm
    const p = moveLimited(c, { x: c.x + d.x * shift, y: c.y + d.y * shift }, walls, others, batteries)
    const next = { ...c, x: p.x, y: p.y }
    return same(c, next) ? unchanged(c) : { communication: next, changed: true }
  }
  const current = sizeOf(c, field.kind)
  if (!(valueCm > 0) || current === null) return unchanged(c)
  const bodies = batteryBodies(batteries, walls)
  const next =
    c.kind === "duct" && field.kind !== "diameter" && valueCm > current
      ? growDuct(c, field.kind, valueCm, walls, others, bodies)
      : withSize(c, field.kind, limitedSize(c, field.kind, valueCm, walls, others, bodies))
  return same(c, next) ? unchanged(c) : { communication: next, changed: true }
}
