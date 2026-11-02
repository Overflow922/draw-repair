import { batteryRect } from "../battery/battery-geometry"
import { hostOfBattery } from "../battery/battery-motion"
import { communicationBox } from "../communications/geometry"
import type { Battery, Communication, Point, Wall } from "../types"
import type { SectionObstacle } from "./section-free"

// Что занимает место на плане «Реконструкция» и не должно лежать под концами линии разреза (change add-section-view,
// design D2): тела стен подложки, штукатурки и гипсокартона, батареи и коммуникации. Чистая функция.

function bodyQuad(w: Wall): Point[] | null {
  const dx = w.b.x - w.a.x
  const dy = w.b.y - w.a.y
  const len = Math.hypot(dx, dy)
  if (len === 0) return null
  const nx = (-dy / len) * (w.thicknessCm / 2)
  const ny = (dx / len) * (w.thicknessCm / 2)
  return [
    { x: w.a.x + nx, y: w.a.y + ny },
    { x: w.b.x + nx, y: w.b.y + ny },
    { x: w.b.x - nx, y: w.b.y - ny },
    { x: w.a.x - nx, y: w.a.y - ny },
  ]
}

export function sectionObstacles(
  walls: readonly Wall[],
  batteries: readonly Battery[],
  communications: readonly Communication[],
  batteryHosts: readonly Wall[],
): SectionObstacle[] {
  const bodies = walls.flatMap((w): SectionObstacle[] => {
    const shape = bodyQuad(w)
    return shape === null ? [] : [{ shape, wallId: w.id }]
  })
  const rects = batteries.flatMap((b): SectionObstacle[] => {
    const host = hostOfBattery(b, batteryHosts)
    return host === null ? [] : [{ shape: batteryRect(b, host), wallId: null }]
  })
  const boxes = communications.map((c): SectionObstacle => {
    const [x1, y1, x2, y2] = communicationBox(c)
    return { shape: [{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }], wallId: null }
  })
  return [...bodies, ...rects, ...boxes]
}
