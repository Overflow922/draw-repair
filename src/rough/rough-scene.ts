import { mountingScene } from "../mounting/mounting-scene"
import type { MountingScene } from "../mounting/mounting-scene"
import { findRooms } from "../room-area"
import { reconcileRooms } from "../room-explication"
import type { ExplicatedRoom } from "../room-explication"
import type { Drawing, Point } from "../types"
import { netItems } from "./net-area"
import { plasterPieces, plasterStrip } from "./plaster"
import type { PlasterPiece } from "./plaster"
import { activeScreeds } from "./screed"
import type { ActiveScreed } from "./screed"

// Сцена плана «Черновые работы» (change add-rough-works-plan, design D1, D4–D6): подложка — результат «Монтажа», поверх неё
// действующие куски штукатурки, полосы, действующие стяжки и помещения экспликации с площадями после штукатурки.
// Всё вычисляется по чертежу, ничего не хранится.

export interface RoughScene {
  base: MountingScene
  pieces: PlasterPiece[]
  strips: Point[][]
  // помещения экспликации «Монтажа» (площадь до штукатурки) и они же с площадью после штукатурки
  items: ExplicatedRoom[]
  netItems: ExplicatedRoom[]
  screeds: ActiveScreed[]
}

export function roughScene(drawing: Drawing, base: MountingScene = mountingScene(drawing)): RoughScene {
  const pieces = plasterPieces(drawing, base)
  const strips = pieces.map(plasterStrip)
  const items = reconcileRooms(findRooms(base.walls), drawing.rooms ?? [])
  return { base, pieces, strips, items, netItems: netItems(items, strips), screeds: activeScreeds(items, drawing.roughScreeds ?? []) }
}
