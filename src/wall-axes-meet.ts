import type { Point } from "./types"
import type { StartRef } from "./wall-angle"
import { RIGHT_COS, add, dot, mul, sub } from "./wall-geometry"
import type { VertexSnap } from "./wall-snap"

// Оси коллинеарного продолжения сходятся (change collinear-axes-meet, design D1–D3): у стены, продолжающей свободный
// торец по той же прямой, конец оси лежит в плоскости торца, а не в центре квадрата установки за ней. Сдвиг идёт вдоль
// направления сегмента, поперечное смещение (квадрат заподлицо с гранью) сохраняется. Чистые функции.

const EPS = 1e-9

const unitOf = (v: Point): Point | null => {
  const len = Math.hypot(v.x, v.y)
  return len < EPS ? null : mul(v, 1 / len)
}

// Начало оси: опора — торец с концом оси ранней стены, сегмент идёт по наружной нормали торца в допуске прямого угла.
export function startInCapPlane(start: Point, dir: Point, ref: StartRef | null): Point {
  if (!ref || ref.kind !== "cap" || !ref.anchor) return start
  const u = unitOf(dir)
  if (!u || dot(u, ref.normal) < RIGHT_COS) return start
  const beyond = dot(sub(start, ref.anchor), u)
  return beyond > 0 ? sub(start, mul(u, beyond)) : start
}

// Свободный конец: прилип к торцу (конец совпадает с точкой прилипания), сегмент идёт навстречу наружной нормали торца.
export function endInCapPlane(end: Point, dir: Point, snap: VertexSnap): Point {
  if (snap.source !== "wall" || snap.target !== "cap" || !snap.normal || !snap.base) return end
  if (Math.abs(snap.point.x - end.x) > EPS || Math.abs(snap.point.y - end.y) > EPS) return end
  const u = unitOf(dir)
  if (!u || dot(u, snap.normal) > -RIGHT_COS) return end
  const short = dot(sub(snap.base, end), u)
  return short > 0 ? add(end, mul(u, short)) : end
}
