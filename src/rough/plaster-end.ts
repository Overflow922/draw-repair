import { EPS_CM, MIN_WIDTH_CM } from "../demolition/mark-model"
import { faceRunsReaching, hostPoint } from "../doorway/doorway-faces"
import { CHAIN_OFFSET_EM } from "../doorway/editable-numbers"
import { formatLength } from "../format-length"
import { dimGeometry } from "../geometry"
import type { DimGeometry } from "../geometry"
import type { Point, Unit, Wall } from "../types"
import { add, degenerate, dist, mul, perp, unit as unitVector } from "../wall-geometry"

// Торец стены как грань штукатурки (change plaster-wall-end-face, design D2–D3): открытые части торца, полоса и размер.
// Геометрия торца — поперечные смещения от оси стены вдоль нормали (−d.y, d.x); чистые функции.

export type WallEnd = "a" | "b"

// глубина пробной линии внутрь стены от торца; линии пробы стоят на ±PROBE от торца, как у граней (`doorway-faces`)
const PROBE_DEPTH_CM = 0.1

// Открытые части торца: поперечные смещения [от, до] в пределах тела стены, где за концом оси нет тела другой стены.
// Правило грани (внутренняя пробная линия покрыта телом, внешняя — нет), повёрнутое поперёк оси: пробный отрезок идёт вдоль
// торца, а «грань» этого отрезка — сам торец.
export function openEndRuns(wall: Wall, walls: readonly Wall[], end: WallEnd): [number, number][] {
  if (degenerate(wall)) return []
  const axis = unitVector(wall.a, wall.b)
  const lateral = perp(axis)
  const half = wall.thicknessCm / 2
  const inward = end === "a" ? axis : mul(axis, -1)
  const start = add(add(end === "a" ? wall.a : wall.b, mul(inward, PROBE_DEPTH_CM)), mul(lateral, -half))
  const probe: Wall = { ...wall, id: `${wall.id}~end`, a: start, b: add(start, mul(lateral, 2 * half)), thicknessCm: 2 * PROBE_DEPTH_CM }
  // нормаль пробного отрезка (−lateral.y, lateral.x) = −axis: наружу у конца a — сторона +1, у конца b — −1
  return faceRunsReaching(probe, walls, end === "a" ? 1 : -1, 0, 0)
    .map(([t0, t1]): [number, number] => [Math.max(0, t0) - half, Math.min(2 * half, t1) - half])
    .filter(([from, to]) => to - from >= MIN_WIDTH_CM)
}

// полоса торца: от конца оси наружу на толщину штукатурки, поперёк — на открытой части [from, to]; у края, дошедшего до
// боковой грани, шире на толщину штукатурки — закрывает внешний угол
export function endStrip(wall: Wall, end: WallEnd, from: number, to: number, thicknessMm: number): Point[] {
  const len = dist(wall.a, wall.b)
  const half = wall.thicknessCm / 2
  const depth = thicknessMm / 10
  const t0 = end === "a" ? 0 : len
  const t1 = end === "a" ? -depth : len + depth
  const lo = from <= -half + EPS_CM ? from - depth : from
  const hi = to >= half - EPS_CM ? to + depth : to
  return [hostPoint(wall, t0, lo), hostPoint(wall, t0, hi), hostPoint(wall, t1, hi), hostPoint(wall, t1, lo)]
}

export interface EndDimension {
  geom: DimGeometry
  text: string
}

// размер торца — длина открытой части (design D7): линия размера за торцом на CHAIN_OFFSET_EM · кегль
export function endDimension(wall: Wall, end: WallEnd, from: number, to: number, unit: Unit, k: number, labelPx: number): EndDimension | null {
  const len = dist(wall.a, wall.b)
  const t0 = end === "a" ? 0 : len
  const offsetCm = (CHAIN_OFFSET_EM * labelPx) / k
  const geom = dimGeometry(hostPoint(wall, t0, from), hostPoint(wall, t0, to), end === "a" ? offsetCm : -offsetCm)
  return geom ? { geom, text: formatLength(to - from, unit) } : null
}
