import { plasterStrip } from "../rough/plaster"
import type { PlasterPiece } from "../rough/plaster"
import type { Point, Wall } from "../types"

// Полосы штукатурки как виртуальные стены-препятствия (change reconstruction-plan, design D3): полоса — всегда прямоугольник,
// ось виртуальной стены идёт по средней линии вдоль его длинной стороны, толщина — короткая сторона. Привязка и правка
// стен ГКЛ видят их как тела стен, поэтому ГКЛ встаёт на наружную поверхность штукатурки. Нигде не хранятся и не рисуются.

const mid = (p: Point, q: Point): Point => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 })
const len = (p: Point, q: Point): number => Math.hypot(q.x - p.x, q.y - p.y)

export const PLASTER_OBSTACLE_PREFIX = "plaster:"

// Откос проёма (change plaster-opening-reveals, design D7) поверхностью привязки не является и препятствия не даёт.
export function plasterObstacles(pieces: readonly PlasterPiece[]): Wall[] {
  return pieces.filter((piece) => piece.mark.face !== "reveal").map((piece): Wall => {
    const [p0, p1, p2, p3] = plasterStrip(piece)
    if (!p0 || !p1 || !p2 || !p3) throw new Error("полоса штукатурки не прямоугольник")
    const alongFirst = len(p0, p1) >= len(p1, p2)
    return {
      id: `${PLASTER_OBSTACLE_PREFIX}${piece.mark.id}:${piece.wall.id}:${piece.from}`,
      a: alongFirst ? mid(p0, p3) : mid(p0, p1),
      b: alongFirst ? mid(p1, p2) : mid(p3, p2),
      thicknessCm: alongFirst ? len(p1, p2) : len(p0, p1),
      type: "brick",
    }
  })
}
