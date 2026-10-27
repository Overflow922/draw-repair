import { LIGHT_SYMBOL_PX_PER_MM } from "../ceiling/light-symbol"
import type { Palette } from "../theme"
import type { Point } from "../types"

// Знак вытяжки (change add-exhaust-fan, design D4; первое приближение по описанию пользователя, картинки в references/ нет):
// красный квадрат без заливки со стороной 3,5 мм бумаги (14 px на холсте), внутри три отрезка от центра — к левому верхнему углу,
// к правому верхнему и к середине нижней стороны. Размер постоянный и не зависит от масштаба; знак не поворачивается.
// Одна функция для холста и PDF: u — единиц носителя на мм бумаги.

export const EXHAUST_SIDE_MM = 3.5
const LINE_MM = 0.35
const MIN_HIT_PX = 8

// зона клика: круг вокруг центра не меньше 8 px
export const exhaustHitRadiusPx = (): number => Math.max(MIN_HIT_PX, (EXHAUST_SIDE_MM / 2) * LIGHT_SYMBOL_PX_PER_MM)

// концы знака относительно центра в единицах носителя: вершины квадрата и концы трёх отрезков
export function exhaustSegments(at: Point, u: number): { square: Point[]; spokes: [Point, Point][] } {
  const h = (EXHAUST_SIDE_MM / 2) * u
  const c = at
  const tl = { x: c.x - h, y: c.y - h }
  const tr = { x: c.x + h, y: c.y - h }
  const br = { x: c.x + h, y: c.y + h }
  const bl = { x: c.x - h, y: c.y + h }
  return { square: [tl, tr, br, bl], spokes: [[c, tl], [c, tr], [c, { x: c.x, y: c.y + h }]] }
}

// color — цвет выделения или ластика вместо красного (только на холсте)
export function drawExhaust(ctx: CanvasRenderingContext2D, at: Point, u: number, palette: Palette, color?: string): void {
  const { square, spokes } = exhaustSegments(at, u)
  ctx.save()
  ctx.lineWidth = LINE_MM * u
  ctx.strokeStyle = color ?? palette.lightingRed
  ctx.beginPath()
  square.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
  ctx.closePath()
  for (const [a, b] of spokes) {
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
  }
  ctx.stroke()
  ctx.restore()
}
