import { reconstructionScene } from "../reconstruction/reconstruction-scene"
import type { ReconstructionScene } from "../reconstruction/reconstruction-scene"
import { activeAnchored } from "../room-anchor"
import type { ActiveAnchored } from "../room-anchor"
import { findRooms } from "../room-area"
import { reconcileRooms } from "../room-explication"
import type { ExplicatedRoom } from "../room-explication"
import type { Drawing, FurnitureItem, StretchCeiling } from "../types"

// Сцена плана «Потолки и освещение» (change add-ceiling-plan, design D4): подложка — результат плана «Реконструкция» (та же, что
// у «Мебели»), все предметы «Мебели» и действующие натяжные потолки. Помещения — помещения экспликации по стенам «Монтажа», как у
// стяжки. Мебель не копируется в план: берётся из «Мебели» при каждом построении. Чистая функция, чертёж не мутируется.

export interface CeilingScene {
  base: ReconstructionScene
  // все предметы «Мебели» в порядке «Мебели»
  items: FurnitureItem[]
  rooms: ExplicatedRoom[]
  ceilings: ActiveAnchored<StretchCeiling>[]
}

export function ceilingScene(drawing: Drawing, base: ReconstructionScene = reconstructionScene(drawing)): CeilingScene {
  const rooms = reconcileRooms(findRooms(base.base.walls), drawing.rooms ?? [])
  return {
    base,
    items: (drawing.furniture?.items ?? []).map((t) => ({ ...t })),
    rooms,
    ceilings: activeAnchored(rooms, drawing.ceiling?.ceilings ?? []),
  }
}
