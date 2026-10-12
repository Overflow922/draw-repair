import type { Communication, Point, View } from "../types"
import { PX_PER_CM } from "../types"

// Контуры коммуникаций (change add-communications, design D10): стояк — окружность, воздуховод — прямоугольник с
// диагональю от левого верхнего угла к правому нижнему. Одна функция для холста и PDF; числа и размерные линии —
// в render.ts (по образцу цепочек проёма).

function trace(ctx: CanvasRenderingContext2D, c: Communication, view: View): void {
  const k = PX_PER_CM * view.zoom
  const toScreen = (p: Point): Point => ({ x: (p.x - view.pan.x) * k, y: (p.y - view.pan.y) * k })
  if (c.kind === "riser") {
    const s = toScreen(c)
    ctx.arc(s.x, s.y, (c.diameterCm / 2) * k, 0, Math.PI * 2)
    return
  }
  const tl = toScreen({ x: c.x - c.widthCm / 2, y: c.y - c.depthCm / 2 })
  const br = toScreen({ x: c.x + c.widthCm / 2, y: c.y + c.depthCm / 2 })
  ctx.moveTo(tl.x, tl.y)
  ctx.lineTo(br.x, tl.y)
  ctx.lineTo(br.x, br.y)
  ctx.lineTo(tl.x, br.y)
  ctx.lineTo(tl.x, tl.y)
  ctx.moveTo(tl.x, tl.y)
  ctx.lineTo(br.x, br.y)
}

// нижняя левая половина воздуховода под диагональю (левый верхний — левый нижний — правый нижний углы)
function traceHalf(ctx: CanvasRenderingContext2D, c: Communication, view: View): void {
  if (c.kind !== "duct") return
  const k = PX_PER_CM * view.zoom
  const x = (v: number): number => (v - view.pan.x) * k
  const y = (v: number): number => (v - view.pan.y) * k
  ctx.moveTo(x(c.x - c.widthCm / 2), y(c.y - c.depthCm / 2))
  ctx.lineTo(x(c.x - c.widthCm / 2), y(c.y + c.depthCm / 2))
  ctx.lineTo(x(c.x + c.widthCm / 2), y(c.y + c.depthCm / 2))
  ctx.closePath()
}

// обводка контуров коммуникаций цветом и толщиной линии (экранные px); halfFill — цвет заливки половины воздуховода
export function strokeCommunications(
  ctx: CanvasRenderingContext2D,
  communications: readonly Communication[],
  view: View,
  color: string,
  widthPx: number,
  halfFill?: string,
): void {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = widthPx
  for (const c of communications) {
    if (halfFill && c.kind === "duct") {
      ctx.fillStyle = halfFill
      ctx.beginPath()
      traceHalf(ctx, c, view)
      ctx.fill()
    }
    ctx.beginPath()
    trace(ctx, c, view)
    ctx.stroke()
  }
  ctx.restore()
}
