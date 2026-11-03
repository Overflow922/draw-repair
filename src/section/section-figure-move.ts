import type { Point } from "../types"
import { rectOverlapsPolygon, sweepAlong } from "./section-figure-collide"
import type { Bounds } from "./section-layout"

// Перемещение фигуры разреза с упором в препятствия (change move-section-figure, design D3). Позиция — левая точка пола фигуры,
// rectAt даёт занятое место фигуры (с названием) для позиции. Чистая функция.

export interface FigureMoveContext {
  rectAt: (position: Point) => Bounds
  obstacles: readonly (readonly Point[])[]
}

// целое число сантиметров не больше пройденного по модулю: фигура не заходит на препятствие
const inwardCm = (d: number): number => Math.sign(d) * Math.floor(Math.abs(d) + 1e-6)

export function moveFigure(start: Point, delta: Point, ctx: FigureMoveContext): Point {
  const startRect = ctx.rectAt(start)
  // препятствия, на которых фигура уже стоит (после правки плана), в этом жесте не действуют: с них можно уйти
  const active = ctx.obstacles.filter((o) => !rectOverlapsPolygon(startRect, o))
  const along = (position: Point, axis: "x" | "y", want: number): number => {
    let d = Math.round(want)
    for (const o of active) d = sweepAlong(ctx.rectAt(position), o, axis, d)
    return inwardCm(d)
  }
  const x = start.x + along(start, "x", delta.x)
  const y = start.y + along({ x, y: start.y }, "y", delta.y)
  return { x, y }
}
