import { faceBounds } from "../demolition/mark-chains"
import type { FaceBoundsOf } from "../demolition/mark-chains"
import { lengthOf } from "../demolition/mark-model"

// Границы цепочки размеров куска штукатурки (change plaster-dimension-collinear-joint, design D1): ширина и отступы считаются по
// самому куску. Участок грани «от стыка до стыка» (faceBounds) идёт сквозь коллинеарного соседа до границы окна поиска, поэтому
// он ограничивается пределами стены вместе с куском: выступ куска за ось (внешний угол, щель у T-примыкания) остаётся в размере,
// продолжение грани за конец оси — нет.
export const pieceFaceBounds: FaceBoundsOf = (r, walls, side) => {
  const run = faceBounds(r, walls, side)
  if (!run) return null
  const j0 = Math.max(run.j0, Math.min(0, r.from))
  const j1 = Math.min(run.j1, Math.max(lengthOf(r.wall), r.to))
  const start = Math.min(j1, Math.max(j0, r.from))
  const end = Math.min(j1, Math.max(start, r.to))
  return { j0, j1, start, end }
}
