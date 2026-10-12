import type { Communication, Point } from "../types"

// Выбор коммуникации под курсором для выделения и ластика (change add-communications; spec communications
// «Выделение, перемещение и удаление коммуникации»): расстояние от точки до тела не больше допуска.

function distanceToBody(p: Point, c: Communication): number {
  if (c.kind === "riser") return Math.max(0, Math.hypot(p.x - c.x, p.y - c.y) - c.diameterCm / 2)
  return Math.hypot(Math.max(0, Math.abs(p.x - c.x) - c.widthCm / 2), Math.max(0, Math.abs(p.y - c.y) - c.depthCm / 2))
}

// ближайшая к точке коммуникация в пределах допуска tolCm; при равенстве — первая в списке
export function hitCommunication(p: Point, communications: readonly Communication[], tolCm: number): Communication | null {
  let best: Communication | null = null
  let bestDistance = Infinity
  for (const c of communications) {
    const d = distanceToBody(p, c)
    if (d <= tolCm && d < bestDistance) {
      best = c
      bestDistance = d
    }
  }
  return best
}
