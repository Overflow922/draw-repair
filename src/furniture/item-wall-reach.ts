import { textDirection, upOf } from "../doorway/editable-numbers"
import { CHAR_WIDTH } from "../doorway/element-label"
import { wallBody } from "../communications/geometry"
import { penetration, sweep } from "../communications/shape"
import type { Shape } from "../communications/shape"
import { formatLength } from "../format-length"
import { dimGeometry } from "../geometry"
import { plasterObstacles } from "../reconstruction/plaster-obstacles"
import type { ReconstructionScene } from "../reconstruction/reconstruction-scene"
import type { FurnitureItem, Point, Unit, Wall } from "../types"
import { add, dot, mul, sub } from "../wall-geometry"
import { itemCorners } from "./item"
import type { ItemNumber, ItemNumberField, ItemSide } from "./item-number"
import type { SizeMetrics } from "./item-size-layout"

// Расстояния сторон выделенного предмета до стен (change furniture-dimensions, design D2; spec furniture-plan «Расстояния
// выделенного предмета до стен»): полоса шириной в сторону движется вдоль наружной нормали стороны (sweep коммуникаций) до
// первого касания тела стены подложки, стены гипсокартона или полосы штукатурки. Тела — прямоугольники вдоль осей, поэтому
// проём грань стены не прерывает. Полоса стартует от противоположной стороны предмета, а тела, на которые она уже наезжает
// (позади предмета), пропускаются: так грань, за которую сторона уже зашла, даёт отрицательное расстояние, и ввод
// отсчитывается от неё. Чистые функции.

export const ITEM_SIDES: readonly ItemSide[] = ["left", "right", "top", "bottom"]

export interface WallReach {
  t: number // расстояние вдоль нормали стороны до грани; отрицательное — сторона зашла за грань
  from: Point // точка стороны, через которую идёт размерная линия (середина участка касания)
  to: Point // точка грани: from + t · нормаль
  normal: Point // наружная нормаль стороны
}

const TIE_CM = 1e-6 // равные расстояния до разных тел
const CLIP_CM = 1e-9 // допуск участка касания на грани тела
const STRIP_CM = 1e-4 // толщина движущейся полосы (позади её передней кромки)
const OVERLAP_CM = 1e-9
const ZERO_CM = 1e-6

// тела препятствий: прямоугольники вдоль осей стен (wall-collision); стена нулевой длины тела не даёт
export const reachBodies = (walls: readonly Wall[]): Shape[] =>
  walls.flatMap((w) => {
    const body = wallBody(w)
    return body ? [body] : []
  })

// грани подложки плана «Мебель»: стены обмера и «Монтажа», стены гипсокартона, действующая штукатурка
export const furnitureReachBodies = (base: ReconstructionScene): Shape[] => reachBodies([...base.underlay, ...base.own, ...plasterObstacles(base.pieces)])

interface SideFrame {
  ends: [Point, Point]
  normal: Point
  depthCm: number // размер предмета поперёк стороны
}

function sideFrame(t: FurnitureItem, side: ItemSide): SideFrame {
  const [lt, rt, rb, lb] = itemCorners(t)
  const r = (t.angleDeg * Math.PI) / 180
  const u = { x: Math.cos(r), y: Math.sin(r) }
  const v = { x: -Math.sin(r), y: Math.cos(r) }
  switch (side) {
    case "left":
      return { ends: [lb, lt], normal: mul(u, -1), depthCm: t.widthCm }
    case "right":
      return { ends: [rt, rb], normal: u, depthCm: t.widthCm }
    case "top":
      return { ends: [lt, rt], normal: mul(v, -1), depthCm: t.lengthCm }
    case "bottom":
      return { ends: [rb, lb], normal: v, depthCm: t.lengthCm }
  }
}

// участок отрезка a + s·(b − a), s ∈ [0, 1], лежащий в выпуклом многоугольнике (с допуском); null — не пересекаются
function clipToPolygon(a: Point, b: Point, pts: readonly Point[]): [number, number] | null {
  let area = 0
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length] ?? p
    area += p.x * q.y - q.x * p.y
  })
  const orient = Math.sign(area) || 1
  let lo = 0
  let hi = 1
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    const q = pts[(i + 1) % pts.length]
    if (!p || !q) continue
    const e = sub(q, p)
    const len = Math.hypot(e.x, e.y)
    if (len === 0) continue
    // расстояние со знаком внутрь многоугольника: f(s) = f0 + s · (f1 − f0) ≥ −допуск
    const f = (x: Point): number => (orient * (e.x * (x.y - p.y) - e.y * (x.x - p.x))) / len
    const f0 = f(a) + CLIP_CM
    const f1 = f(b) + CLIP_CM
    if (f0 < 0 && f1 < 0) return null
    if (f0 < 0) lo = Math.max(lo, f0 / (f0 - f1))
    else if (f1 < 0) hi = Math.min(hi, f0 / (f0 - f1))
  }
  return lo <= hi ? [lo, hi] : null
}

// середина самого длинного связного участка касания
function contactMiddle(intervals: readonly [number, number][]): number | null {
  const sorted = [...intervals].sort((p, q) => p[0] - q[0])
  let best: [number, number] | null = null
  let run: [number, number] | null = null
  for (const [lo, hi] of sorted) {
    if (run && lo <= run[1] + TIE_CM) run = [run[0], Math.max(run[1], hi)]
    else run = [lo, hi]
    if (!best || run[1] - run[0] > best[1] - best[0]) best = run
  }
  return best ? (best[0] + best[1]) / 2 : null
}

// расстояние стороны до ближайшей грани по её наружной нормали; null — граней по направлению нет
export function itemWallReach(t: FurnitureItem, side: ItemSide, bodies: readonly Shape[]): WallReach | null {
  const frame = sideFrame(t, side)
  const [s0, s1] = frame.ends
  // полоса на месте противоположной стороны: передняя кромка — на ней, толщина — назад от предмета
  const rear = mul(frame.normal, -frame.depthCm)
  const strip: Shape = { kind: "poly", pts: [add(s0, rear), add(s1, rear), add(s1, mul(frame.normal, -frame.depthCm - STRIP_CM)), add(s0, mul(frame.normal, -frame.depthCm - STRIP_CM))] }
  let best = Infinity
  let winners: { body: Shape; contact: Point }[] = []
  for (const body of bodies) {
    if (penetration(strip, body).depth > OVERLAP_CM) continue
    const hit = sweep(strip, frame.normal, body)
    if (!hit) continue
    if (hit.t < best - TIE_CM) {
      best = hit.t
      winners = [{ body, contact: hit.contact }]
    } else if (hit.t <= best + TIE_CM) winners.push({ body, contact: hit.contact })
  }
  if (!Number.isFinite(best)) return null
  const reach = best - frame.depthCm
  const shift = mul(frame.normal, reach)
  const a = add(s0, shift)
  const b = add(s1, shift)
  const intervals = winners.flatMap(({ body }) => {
    const span = body.kind === "poly" ? clipToPolygon(a, b, body.pts) : null
    return span ? [span] : []
  })
  const along = sub(s1, s0)
  const lengthSq = dot(along, along)
  // касание без участка (численный край) — проекция точки касания sweep на сторону
  const fallback = (): number => {
    const contact = winners[0]?.contact ?? s0
    return lengthSq > 0 ? Math.min(1, Math.max(0, dot(sub(sub(contact, shift), s0), along) / lengthSq)) : 0
  }
  const s = contactMiddle(intervals) ?? fallback()
  const from = add(s0, mul(along, s))
  return { t: reach, from, to: add(from, shift), normal: frame.normal }
}

// числа расстояний выделенного предмета: размерная линия от стороны до грани; ноль — только число «0» у стороны
export function itemDistanceLayout(t: FurnitureItem, bodies: readonly Shape[], unit: Unit, k: number, m: SizeMetrics): ItemNumber[] {
  return ITEM_SIDES.flatMap((side): ItemNumber[] => {
    const r = itemWallReach(t, side, bodies)
    if (!r) return []
    const shown = Math.max(0, r.t)
    const text = formatLength(shown, unit)
    const field: ItemNumberField = { kind: "distance", side }
    const base = { field, text, valueCm: shown, widthCm: (text.length * m.labelPx * CHAR_WIDTH) / k, heightCm: m.labelPx / k }
    if (shown <= ZERO_CM) {
      // число стоит снаружи у точки стороны, текст горизонтален
      return [{ ...base, geom: null, center: add(r.from, mul(r.normal, (m.labelPx / 2 + m.dimTextGapPx) / k)), dir: { x: 1, y: 0 } }]
    }
    const geom = dimGeometry(r.from, r.to, 0)
    if (!geom) return []
    const dir = textDirection(sub(r.to, r.from))
    const mid = mul(add(r.from, r.to), 0.5)
    return [{ ...base, geom, center: add(mid, mul(upOf(dir), (m.dimTextGapPx + m.labelPx / 2) / k)), dir }]
  })
}
