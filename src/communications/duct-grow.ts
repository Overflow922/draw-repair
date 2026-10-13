import type { Communication, Duct, Wall } from "../types"
import { communicationViolation } from "./geometry"
import { BISECT_ITERATIONS, CLEAR_CM } from "./shape"

// Рост воздуховода на свободное место вдоль оси (change fix-duct-resize-against-wall, design D1–D2; spec communications
// «Правка чисел коммуникации», «Ввод размера»).

export type DuctAxis = "width" | "depth"
type Side = "low" | "high"

// грань останавливается чуть раньше границы допуска: остаток в 1e-9 делает касание «налеганием» для измерения расстояния до стены
const CONTACT_MARGIN = 1e-7

const sizeAlong = (d: Duct, axis: DuctAxis): number => (axis === "width" ? d.widthCm : d.depthCm)

// воздуховод с гранями, сдвинутыми наружу на low (к меньшим координатам) и high (к большим): центр уходит на (high − low) / 2
function withGrowth(d: Duct, axis: DuctAxis, low: number, high: number): Duct {
  const shift = (high - low) / 2
  return axis === "width" ? { ...d, x: d.x + shift, widthCm: d.widthCm + low + high } : { ...d, y: d.y + shift, depthCm: d.depthCm + low + high }
}

// на сколько можно сдвинуть одну грань наружу (другая неподвижна), не больше cap, пока наложение не растёт
function sideReach(d: Duct, axis: DuctAxis, side: Side, cap: number, walls: readonly Wall[], others: readonly Communication[]): number {
  const grown = (g: number): Duct => (side === "low" ? withGrowth(d, axis, g, 0) : withGrowth(d, axis, 0, g))
  const allowed = communicationViolation(d, walls, others) + CLEAR_CM
  const fits = (g: number): boolean => communicationViolation(grown(g), walls, others) <= allowed
  if (fits(cap)) return cap
  let lo = 0
  let hi = cap
  for (let i = 0; i < BISECT_ITERATIONS; i++) {
    const mid = (lo + hi) / 2
    if (fits(mid)) lo = mid
    else hi = mid
  }
  return Math.max(0, lo - CONTACT_MARGIN)
}

// увеличение ширины или глубины воздуховода до requested: прирост поровну на обе стороны, пока обе свободны; доля упёршейся
// стороны уходит в свободную, не выше её предела; если места не хватает, рост идёт до касания с обеих сторон
export function growDuct(d: Duct, axis: DuctAxis, requested: number, walls: readonly Wall[], others: readonly Communication[]): Duct {
  const increase = requested - sizeAlong(d, axis)
  const half = increase / 2
  const lowMax = sideReach(d, axis, "low", increase, walls, others)
  const highMax = sideReach(d, axis, "high", increase, walls, others)
  if (half <= lowMax && half <= highMax) return withGrowth(d, axis, half, half)
  if (half > lowMax) return withGrowth(d, axis, lowMax, Math.min(increase - lowMax, highMax))
  return withGrowth(d, axis, Math.min(increase - highMax, lowMax), highMax)
}
