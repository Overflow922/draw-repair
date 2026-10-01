import type { Point } from "./types"
import type { VertexSnap } from "./wall-snap"
import { cross, dot, mul, perp } from "./wall-geometry"

// Угол новой стены к стене примыкания и опорные направления построения
// (change wall-relative-angle-snap, design D1). Все функции чистые.

// опора начала цепочки: вид примыкания и наружная нормаль грани или торца
export interface StartRef {
  kind: "face" | "cap"
  normal: Point
}

const ORTHO_TAN = Math.tan((15 * Math.PI) / 180)
const RAD_TO_DEG = 180 / Math.PI

const neg = (a: Point): Point => ({ x: -a.x, y: -a.y })

// угол между векторами в градусах, 0..180; atan2 устойчив у 0 и 180
const angleBetween = (a: Point, b: Point): number => Math.atan2(Math.abs(cross(a, b)), dot(a, b)) * RAD_TO_DEG

// поворот на deg градусов (математический угол в мировых координатах)
function rotate(v: Point, deg: number): Point {
  const r = deg / RAD_TO_DEG
  const c = Math.cos(r)
  const s = Math.sin(r)
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c }
}

function normalized(v: Point): Point {
  const l = Math.hypot(v.x, v.y)
  return l > 0 ? mul(v, 1 / l) : v
}

export function startRefOf(snap: VertexSnap): StartRef | null {
  if (snap.source !== "wall" || !snap.normal || !snap.target) return null
  return { kind: snap.target, normal: { x: snap.normal.x, y: snap.normal.y } }
}

// наименьший угол к стене примыкания: у торца — к лучу внутрь стены (0..180),
// у грани — меньший из углов к двум лучам грани (0..90)
export function wallAngleDeg(ref: StartRef, dir: Point): number {
  if (ref.kind === "cap") return angleBetween(dir, neg(ref.normal))
  const t = perp(ref.normal)
  return Math.min(angleBetween(dir, t), angleBetween(dir, neg(t)))
}

// луч от начала, от которого отсчитан наименьший угол (сторона дуги)
export function angleReferenceRay(ref: StartRef, dir: Point): Point {
  if (ref.kind === "cap") return neg(ref.normal)
  const t = perp(ref.normal)
  return angleBetween(dir, t) <= angleBetween(dir, neg(t)) ? t : neg(t)
}

// Опорные направления орто: торец — продолжение и перпендикуляры к оси, грань —
// перпендикуляр наружу, без опоры — оси экрана. Допуск 15° включительно.
export function orthoDirection(ref: StartRef | null, v: Point): Point | null {
  const candidates: Point[] =
    ref === null
      ? [
          { x: 1, y: 0 },
          { x: -1, y: 0 },
          { x: 0, y: 1 },
          { x: 0, y: -1 },
        ]
      : ref.kind === "cap"
        ? [ref.normal, perp(ref.normal), neg(perp(ref.normal))]
        : [ref.normal]
  for (const d of candidates) {
    const along = dot(v, d)
    if (along > 0 && Math.abs(cross(v, d)) <= ORTHO_TAN * along) return { x: d.x, y: d.y }
  }
  return null
}

// Направление по введённому наименьшему углу; сторона — по курсору v. На разделяющей
// линии — поворот против часовой на экране (y вниз) от луча отсчёта через свободную
// сторону: у торца это −deg от луча внутрь стены, у грани — +(90 − deg) от нормали.
export function typedDirection(ref: StartRef, deg: number, v: Point): Point | null {
  const max = ref.kind === "cap" ? 180 : 90
  if (!Number.isFinite(deg) || deg <= 0 || deg > max) return null
  const base = ref.kind === "cap" ? neg(ref.normal) : ref.normal
  const theta = ref.kind === "cap" ? deg : 90 - deg
  const c = cross(base, v)
  const side = c > 0 ? 1 : c < 0 ? -1 : ref.kind === "cap" ? -1 : 1
  return normalized(rotate(base, side * theta))
}

export function parseAngleDeg(text: string): number | null {
  if (text.trim() === "") return null
  const v = parseFloat(text.replace(",", "."))
  return Number.isFinite(v) ? v : null
}
