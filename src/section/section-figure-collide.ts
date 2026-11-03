import type { Point } from "../types"
import type { Bounds } from "./section-layout"

// Пересечение прямоугольника с выпуклым многоугольником и ход прямоугольника вдоль оси до первого препятствия
// (change move-section-figure, design D3). Касание пересечением не считается. Чистые функции.

const EPS = 1e-9

// прямоугольник и выпуклый многоугольник пересекаются по площади (теорема о разделяющей оси)
export function rectOverlapsPolygon(r: Bounds, poly: readonly Point[]): boolean {
  if (poly.length < 3) return false
  const xs = poly.map((p) => p.x)
  const ys = poly.map((p) => p.y)
  if (Math.min(...xs) >= r.maxX - EPS || Math.max(...xs) <= r.minX + EPS) return false
  if (Math.min(...ys) >= r.maxY - EPS || Math.max(...ys) <= r.minY + EPS) return false
  const corners: Point[] = [
    { x: r.minX, y: r.minY },
    { x: r.maxX, y: r.minY },
    { x: r.maxX, y: r.maxY },
    { x: r.minX, y: r.maxY },
  ]
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const nx = a.y - b.y
    const ny = b.x - a.x
    if (nx === 0 && ny === 0) continue
    const pr = poly.map((p) => p.x * nx + p.y * ny)
    const cr = corners.map((c) => c.x * nx + c.y * ny)
    if (Math.min(...pr) >= Math.max(...cr) - EPS * Math.hypot(nx, ny) || Math.max(...pr) <= Math.min(...cr) + EPS * Math.hypot(nx, ny)) return false
  }
  return true
}

const transposePoint = (p: Point): Point => ({ x: p.y, y: p.x })
const transposeRect = (r: Bounds): Bounds => ({ minX: r.minY, minY: r.minX, maxX: r.maxY, maxY: r.maxX })

// горизонтальный луч из точки c в сторону s (±1) пересекает отрезок ab: расстояние до пересечения или null
function rayHit(c: Point, s: number, a: Point, b: Point): number | null {
  if (a.y === b.y) return null
  if (c.y < Math.min(a.y, b.y) || c.y > Math.max(a.y, b.y)) return null
  const x = a.x + ((c.y - a.y) * (b.x - a.x)) / (b.y - a.y)
  const t = s * (x - c.x)
  return t >= 0 ? t : null
}

// сколько прямоугольник проходит вдоль X на расстояние d (знак — направление), не заходя в многоугольник; |результат| <= |d|
function sweepX(r: Bounds, poly: readonly Point[], d: number): number {
  const s = Math.sign(d)
  if (s === 0 || poly.length < 3) return d
  const lead = s > 0 ? r.maxX : r.minX
  const candidates: number[] = []
  for (const v of poly) if (v.y > r.minY && v.y < r.maxY) candidates.push(s * (v.x - lead))
  const corners: Point[] = [
    { x: r.minX, y: r.minY },
    { x: r.maxX, y: r.minY },
    { x: r.minX, y: r.maxY },
    { x: r.maxX, y: r.maxY },
  ]
  for (const c of corners) {
    for (let i = 0; i < poly.length; i++) {
      const t = rayHit(c, s, poly[i], poly[(i + 1) % poly.length])
      if (t !== null) candidates.push(t)
    }
  }
  const limit = Math.abs(d)
  const shifted = (t: number): Bounds => ({ ...r, minX: r.minX + s * t, maxX: r.maxX + s * t })
  const blocking = candidates.filter((t) => t >= 0 && t <= limit && rectOverlapsPolygon(shifted(t + 1e-6), poly))
  return blocking.length === 0 ? d : s * Math.min(...blocking)
}

// ход прямоугольника вдоль оси; axis "y" считается транспонированием
export function sweepAlong(r: Bounds, poly: readonly Point[], axis: "x" | "y", d: number): number {
  if (axis === "x") return sweepX(r, poly, d)
  return sweepX(transposeRect(r), poly.map(transposePoint), d)
}
