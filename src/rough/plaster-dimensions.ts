import { markDimensions } from "../demolition/mark-dimensions"
import type { ChainTrim, MarkDimension } from "../demolition/mark-dimensions"
import { hostPoint } from "../doorway/doorway-faces"
import type { Unit, Wall } from "../types"
import { pointInPolygon } from "../wall-geometry"
import { plasterStrip } from "./plaster"
import type { PlasterPiece } from "./plaster"

// Размеры боковой полосы штукатурки (change plaster-dimensions-outside): отсчёт от внешней стороны полосы; у внутреннего угла
// внешние поверхности двух полос сходятся раньше угла стены, и размер заканчивается в точке их схождения.

// пробный отступ внутрь полосы от её конца и от внешней стороны, см
const PROBE_CM = 0.05

// укорочение цепочки грани у стыка: толщина полосы соседней пометки, перекрывающей внешний угол этой полосы
function junctionTrim(piece: PlasterPiece, pieces: readonly PlasterPiece[], depthCm: number): ChainTrim {
  const lateral = piece.wall.thicknessCm / 2 + depthCm - PROBE_CM
  const others = pieces.filter((x) => x.mark.id !== piece.mark.id)
  return (side, atCm, end) => {
    const probe = hostPoint(piece.wall, end === "from" ? atCm + PROBE_CM : atCm - PROBE_CM, side * lateral)
    const cover = others.find((x) => pointInPolygon(probe, plasterStrip(x)))
    return cover ? cover.mark.thicknessMm / 10 : 0
  }
}

export function plasterDimensions(piece: PlasterPiece, pieces: readonly PlasterPiece[], walls: readonly Wall[], unit: Unit, k: number, labelPx: number): MarkDimension[] {
  const depthCm = piece.mark.thicknessMm / 10
  return markDimensions(piece, walls, "chain", unit, k, labelPx, depthCm, junctionTrim(piece, pieces, depthCm))
}
