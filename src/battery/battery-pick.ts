import { segmentIntersectsRect } from "../geometry"
import type { Battery, Point, Wall } from "../types"
import { dist, pointInPolygon } from "../wall-geometry"
import { batteryRect } from "./battery-geometry"
import { hostOfBattery } from "./battery-motion"

// Попадание и рамка для батарей (change add-battery, design D6; spec battery «Удаление батареи»). Чистые функции.

// расстояние от точки до повёрнутого прямоугольника батареи в его осях (0 — внутри)
function distanceTo(p: Point, rect: readonly Point[]): number {
  const [o, a, , d] = rect
  const length = dist(o, a)
  const width = dist(o, d)
  const rel = { x: p.x - o.x, y: p.y - o.y }
  const t = (rel.x * (a.x - o.x) + rel.y * (a.y - o.y)) / length
  const l = (rel.x * (d.x - o.x) + rel.y * (d.y - o.y)) / width
  return Math.hypot(Math.max(0, -t, t - length), Math.max(0, -l, l - width))
}

// батарея, в прямоугольнике которой (с радиусом привязки tolCm) находится точка; из нескольких — ближайшая
export function hitBattery(p: Point, walls: readonly Wall[], batteries: readonly Battery[], tolCm: number): Battery | null {
  let best: Battery | null = null
  let bestDistance = tolCm
  for (const b of batteries) {
    const host = hostOfBattery(b, walls)
    if (!host) continue
    const d = distanceTo(p, batteryRect(b, host))
    if (d <= bestDistance) {
      best = b
      bestDistance = d
    }
  }
  return best
}

// батареи рамки: прямоугольник батареи пересекает рамку (в том числе частично) или лежит в ней целиком
export function batteriesInRect(min: Point, max: Point, walls: readonly Wall[], batteries: readonly Battery[]): Battery[] {
  return batteries.filter((b) => {
    const host = hostOfBattery(b, walls)
    if (!host) return false
    const rect = batteryRect(b, host)
    const crosses = rect.some((p, i) => segmentIntersectsRect(p, rect[(i + 1) % rect.length], min, max))
    return crosses || pointInPolygon(min, rect)
  })
}
