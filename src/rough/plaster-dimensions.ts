import { markDimensions } from "../demolition/mark-dimensions"
import type { ChainTrim, MarkDimension } from "../demolition/mark-dimensions"
import { hostPoint } from "../doorway/doorway-faces"
import type { Unit, Wall } from "../types"
import { pointInPolygon } from "../wall-geometry"
import { plasterStrip } from "./plaster"
import { pieceFaceBounds } from "./plaster-face-bounds"
import type { PlasterPiece } from "./plaster"

// Размеры боковой полосы штукатурки (change plaster-dimensions-outside): отсчёт от внешней стороны полосы; у внутреннего угла
// внешние поверхности двух полос сходятся раньше угла стены, и размер заканчивается в точке их схождения.

// пробный отступ внутрь полосы от её конца и от внешней стороны, см
const PROBE_CM = 0.05

// Поправка цепочки грани у стыка (см вдоль оси). Внутренний угол: полоса соседней пометки перекрывает конец этой полосы —
// цепочка короче на толщину соседней. Внешний угол: за концом полосы стоит торцевая полоса, закрывающая угол, — цепочка
// длиннее на её толщину (отрицательная поправка).
function junctionTrim(piece: PlasterPiece, pieces: readonly PlasterPiece[], depthCm: number): ChainTrim {
  const lateral = piece.wall.thicknessCm / 2 + depthCm - PROBE_CM
  const others = pieces.filter((x) => x.mark.id !== piece.mark.id)
  const coverAt = (side: 1 | -1, alongCm: number, endsOnly: boolean): PlasterPiece | undefined => {
    const probe = hostPoint(piece.wall, alongCm, side * lateral)
    return others.find((x) => (!endsOnly || x.mark.face === "end") && pointInPolygon(probe, plasterStrip(x)))
  }
  return (side, atCm, end) => {
    const inward = end === "from" ? PROBE_CM : -PROBE_CM
    const inner = coverAt(side, atCm + inward, false)
    if (inner) return inner.mark.thicknessMm / 10
    const outer = coverAt(side, atCm - inward, true)
    return outer ? -outer.mark.thicknessMm / 10 : 0
  }
}

export function plasterDimensions(piece: PlasterPiece, pieces: readonly PlasterPiece[], walls: readonly Wall[], unit: Unit, k: number, labelPx: number): MarkDimension[] {
  const depthCm = piece.mark.thicknessMm / 10
  return markDimensions(piece, walls, "chain", unit, k, labelPx, depthCm, junctionTrim(piece, pieces, depthCm), pieceFaceBounds)
}
