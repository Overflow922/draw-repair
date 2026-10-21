import { lengthOf } from "../demolition/mark-model"
import { hostPoint } from "../doorway/doorway-faces"
import type { Point } from "../types"
import { dot, perp, pointInPolygon, sub, unit as unitVector } from "../wall-geometry"
import { plasterStrip } from "./plaster"
import type { PlasterPiece } from "./plaster"
import { isSideMark } from "./rough-model"

// Границы размера торца (change plaster-single-contour, design D2): поперечные смещения от оси стены, между которыми отсчитывается
// размер. Начинаются от краёв куска (с расширением у внешнего угла); у края, который перекрывает полоса соседней стены
// (внутренний угол), граница — внешняя поверхность этой полосы, а не грань стены, чтобы точка размера не заходила в полосу.

// глубина пробной точки внутрь полосы торца от её края, см
const PROBE_CM = 0.05

export function endDimensionBounds(piece: PlasterPiece, pieces: readonly PlasterPiece[]): [number, number] {
  const mark = piece.mark
  if (mark.face !== "end") return [piece.from, piece.to]
  const wall = piece.wall
  const lateral = perp(unitVector(wall.a, wall.b))
  const depth = mark.thicknessMm / 10
  // середина глубины полосы торца вдоль оси: за концом оси наружу
  const along = mark.anchor === "a" ? -depth / 2 : lengthOf(wall) + depth / 2
  const lateralOf = (p: Point): number => dot(sub(p, wall.a), lateral)
  const cover = (at: number): PlasterPiece | undefined => {
    const probe = hostPoint(wall, along, at)
    return pieces.find((x) => x.mark.id !== piece.mark.id && x.wall.id !== wall.id && isSideMark(x.mark) && pointInPolygon(probe, plasterStrip(x)))
  }
  const low = cover(piece.from + PROBE_CM)
  const high = cover(piece.to - PROBE_CM)
  const from = low ? Math.max(piece.from, ...plasterStrip(low).map(lateralOf)) : piece.from
  const to = high ? Math.min(piece.to, ...plasterStrip(high).map(lateralOf)) : piece.to
  return from < to ? [from, to] : [piece.from, piece.to]
}
