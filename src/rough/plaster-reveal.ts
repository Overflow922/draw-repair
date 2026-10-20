import { hostPoint } from "../doorway/doorway-faces"
import { CHAIN_OFFSET_EM } from "../doorway/editable-numbers"
import { formatLength } from "../format-length"
import { dimGeometry } from "../geometry"
import type { Unit } from "../types"
import type { PlasterPiece } from "./plaster"
import type { EndDimension } from "./plaster-end"

// Размер откоса (change plaster-opening-reveals, design D5): один размер — толщина опорной стены от грани до грани; выносные
// линии начинаются на внутренней стороне полосы, линия размера лежит дальше от откоса, в проёме. Число не правится.
export function revealDimension(piece: PlasterPiece, unit: Unit, k: number, labelPx: number): EndDimension | null {
  const { mark, wall } = piece
  if (mark.face !== "reveal") return null
  const half = wall.thicknessCm / 2
  const inner = mark.jamb === "a" ? piece.to : piece.from
  const offsetCm = (CHAIN_OFFSET_EM * labelPx) / k
  // положительный сдвиг ведёт к концу a оси; от откоса a линия уходит к концу b
  const geom = dimGeometry(hostPoint(wall, inner, -half), hostPoint(wall, inner, half), mark.jamb === "a" ? -offsetCm : offsetCm)
  return geom ? { geom, text: formatLength(wall.thicknessCm, unit) } : null
}
