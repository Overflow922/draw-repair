import { BISECT_ITERATIONS } from "../communications/shape"
import type { Battery, Wall } from "../types"
import { batterySpan } from "./battery-geometry"
import { allowedDepth, hostOfBattery, limitedStart, obstacleShapes, runContaining, startOf, stateHolds, visibleRuns, withStart } from "./battery-motion"
import type { BatteryContext, BatteryEdit } from "./battery-place"

// Числа выделенной батареи и их правка на месте (change add-battery, design D3): расстояния до концов видимого участка
// грани, длина, толщина, отступ. Чистые функции; значение, нарушающее правила размещения, заменяется ближайшим
// допустимым, значение без изменения — «без изменений».

export interface BatteryNumbers {
  toA: number // от торца батареи, ближнего к концу a, до начала видимого участка грани
  toB: number // от торца, ближнего к концу b, до конца видимого участка грани
  lengthCm: number
  thicknessCm: number
  gapCm: number
}

// значения, различающиеся меньше этого, считаются одинаковыми (результат поиска касания не бывает точным целым)
const SAME_VALUE_CM = 1e-5

const NO_CHANGE: BatteryEdit = { kind: "rejected", reason: "no-change" }
const INVALID: BatteryEdit = { kind: "rejected", reason: "invalid" }

const applied = (battery: Battery): BatteryEdit => ({ kind: "applied", battery })

// нет опорной стены или участка грани — расстояния не определены (NaN); числа показываются только у существующей батареи
export function batteryNumbers(b: Battery, walls: readonly Wall[]): BatteryNumbers {
  const sizes = { lengthCm: b.lengthCm, thicknessCm: b.thicknessCm, gapCm: b.gapCm }
  const host = hostOfBattery(b, walls)
  if (!host) return { toA: Number.NaN, toB: Number.NaN, ...sizes }
  const [s, end] = batterySpan(b, host)
  const run = runContaining(visibleRuns(host, walls, b.face), s, b.lengthCm)
  return run ? { toA: s - run[0], toB: run[1] - end, ...sizes } : { toA: Number.NaN, toB: Number.NaN, ...sizes }
}

// ввод расстояния: батарея едет так, чтобы расстояние от конца участка toward до её ближнего торца стало равным введённому;
// сторона привязки становится toward; результат ограничивается до касания и границ участка
export function setBatteryDistance(b: Battery, walls: readonly Wall[], toward: "a" | "b", valueCm: number, ctx: BatteryContext): BatteryEdit {
  if (!Number.isFinite(valueCm) || valueCm < 0) return INVALID
  const host = hostOfBattery(b, walls)
  if (!host) return INVALID
  const from = startOf(b, host)
  const run = runContaining(visibleRuns(host, walls, b.face), from, b.lengthCm)
  if (!run) return INVALID
  const wanted = toward === "a" ? run[0] + valueCm : run[1] - valueCm - b.lengthCm
  const s = limitedStart(b, host, walls, obstacleShapes(b, host, walls, ctx), from, wanted)
  if (Math.abs(s - from) < SAME_VALUE_CM) return NO_CHANGE
  return applied(withStart({ ...b, anchor: toward }, host, s))
}

type SizeField = "lengthCm" | "thicknessCm" | "gapCm"

// ввод размера: запрошенное значение, если оно допустимо, иначе наибольшее допустимое между текущим и запрошенным
function setSize(b: Battery, walls: readonly Wall[], field: SizeField, value: number, ctx: BatteryContext): BatteryEdit {
  const current = b[field]
  const allowed = allowedDepth(b, walls, ctx)
  const fits = (v: number): boolean => stateHolds({ ...b, [field]: v }, walls, ctx, allowed)
  let result = value
  if (!fits(value)) {
    if (value <= current) return NO_CHANGE
    let lo = current
    let hi = value
    for (let i = 0; i < BISECT_ITERATIONS; i++) {
      const mid = (lo + hi) / 2
      if (fits(mid)) lo = mid
      else hi = mid
    }
    result = lo
  }
  if (Math.abs(result - current) < SAME_VALUE_CM) return NO_CHANGE
  return applied({ ...b, [field]: result })
}

// длина растёт и уменьшается от торца привязки (сторона привязки и расстояние не меняются)
export function setBatteryLength(b: Battery, walls: readonly Wall[], valueCm: number, ctx: BatteryContext): BatteryEdit {
  return Number.isFinite(valueCm) && valueCm > 0 ? setSize(b, walls, "lengthCm", valueCm, ctx) : INVALID
}

// толщина: задняя сторона остаётся, передняя двигается
export function setBatteryThickness(b: Battery, walls: readonly Wall[], valueCm: number, ctx: BatteryContext): BatteryEdit {
  return Number.isFinite(valueCm) && valueCm > 0 ? setSize(b, walls, "thicknessCm", valueCm, ctx) : INVALID
}

// отступ: батарея переезжает целиком, толщина прежняя
export function setBatteryGap(b: Battery, walls: readonly Wall[], valueCm: number, ctx: BatteryContext): BatteryEdit {
  return Number.isFinite(valueCm) && valueCm >= 0 ? setSize(b, walls, "gapCm", valueCm, ctx) : INVALID
}
