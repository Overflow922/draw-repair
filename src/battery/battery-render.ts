import type { Battery, Point, View, Wall } from "../types"
import { PX_PER_CM } from "../types"
import { batteryRect } from "./battery-geometry"
import { hostOfBattery } from "./battery-motion"

// Контур батареи (change add-battery, design D10; spec battery «Отображение батареи»): прямоугольник и тонкие поперечные
// линии-секции вдоль длины. Одна функция для холста и PDF; числа и размерные линии — в render.ts.

// шаг секций около 10 см, число секций целое и не меньше одной
const SECTION_STEP_CM = 10

const sectionCount = (lengthCm: number): number => Math.max(1, Math.round(lengthCm / SECTION_STEP_CM))

// обводка контуров батарей цветом и толщиной линии (экранные px); с sectionPx — и секции тонкой линией
export function strokeBatteries(
  ctx: CanvasRenderingContext2D,
  batteries: readonly Battery[],
  walls: readonly Wall[],
  view: View,
  color: string,
  widthPx: number,
  sectionPx?: number,
): void {
  const k = PX_PER_CM * view.zoom
  const toScreen = (p: Point): Point => ({ x: (p.x - view.pan.x) * k, y: (p.y - view.pan.y) * k })
  ctx.save()
  ctx.strokeStyle = color
  for (const b of batteries) {
    const host = hostOfBattery(b, walls)
    if (!host) continue
    const [a0, a1, a2, a3] = batteryRect(b, host).map(toScreen)
    ctx.lineWidth = widthPx
    ctx.beginPath()
    ctx.moveTo(a0.x, a0.y)
    for (const p of [a1, a2, a3, a0]) ctx.lineTo(p.x, p.y)
    ctx.stroke()
    if (sectionPx === undefined) continue
    ctx.lineWidth = sectionPx
    ctx.beginPath()
    const n = sectionCount(b.lengthCm)
    for (let i = 1; i < n; i++) {
      const t = i / n
      const back = { x: a0.x + (a1.x - a0.x) * t, y: a0.y + (a1.y - a0.y) * t }
      const front = { x: a3.x + (a2.x - a3.x) * t, y: a3.y + (a2.y - a3.y) * t }
      ctx.moveTo(back.x, back.y)
      ctx.lineTo(front.x, front.y)
    }
    ctx.stroke()
  }
  ctx.restore()
}
