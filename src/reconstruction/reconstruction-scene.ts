import { visibleDimensions } from "../dimension-visibility"
import { mountingScene } from "../mounting/mounting-scene"
import type { MountingScene } from "../mounting/mounting-scene"
import { plasterPieces } from "../rough/plaster"
import type { PlasterPiece } from "../rough/plaster"
import type { Dimension, Drawing, DrywallWall, Wall } from "../types"

// Сцена плана «Реконструкция» (change reconstruction-plan, design D2, D4): подложка — результат «Черновых работ» без стяжки
// (стены, проёмы, батареи «Монтажа» и действующие куски штукатурки), поверх неё стены гипсокартона и размеры плана.
// Всё вычисляется по чертежу, ничего не хранится. Чистая функция, чертёж не мутируется.

export interface ReconstructionScene {
  base: MountingScene
  // стены подложки: остатки обмера и собственные стены «Монтажа»
  underlay: Wall[]
  pieces: PlasterPiece[]
  own: DrywallWall[]
  // собственные размеры плана, у которых все привязки видны в сцене
  dimensions: Dimension[]
}

export function reconstructionScene(drawing: Drawing, base: MountingScene = mountingScene(drawing)): ReconstructionScene {
  const own = drawing.reconstruction?.walls ?? []
  return {
    base,
    underlay: base.walls,
    pieces: plasterPieces(drawing, base),
    own: [...own],
    dimensions: visibleDimensions(drawing.reconstruction?.dimensions ?? [], {
      walls: new Set([...base.walls, ...own].map((w) => w.id)),
      doorways: new Set(base.doorways.map((e) => e.id)),
      batteries: new Set(base.batteries.map((b) => b.id)),
    }),
  }
}
