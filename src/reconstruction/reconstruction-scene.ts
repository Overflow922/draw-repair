import { visibleDimensions } from "../dimension-visibility"
import { mountingScene } from "../mounting/mounting-scene"
import type { MountingScene } from "../mounting/mounting-scene"
import { plasterPieces } from "../rough/plaster"
import type { PlasterPiece } from "../rough/plaster"
import { sectionObstacles } from "../section/section-obstacles"
import { sectionEntries } from "../section/section-scene"
import type { SectionEntry } from "../section/section-scene"
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
  // линии разреза с вычисленными фигурами (change add-section-view, design D2)
  sections: SectionEntry[]
  // собственные размеры плана, у которых все привязки видны в сцене
  dimensions: Dimension[]
}

export function reconstructionScene(drawing: Drawing, base: MountingScene = mountingScene(drawing)): ReconstructionScene {
  const own = drawing.reconstruction?.walls ?? []
  const pieces = plasterPieces(drawing, base)
  const sections = sectionEntries(
    drawing.reconstruction?.sections ?? [],
    own,
    [...base.walls, ...pieces.map((p) => p.wall), ...own],
    sectionObstacles([...base.walls, ...pieces.map((p) => p.wall), ...own], base.batteries, drawing.communications ?? [], base.walls),
    drawing.reconstruction?.sectionShapes ?? [],
  )
  return {
    base,
    underlay: base.walls,
    pieces,
    own: [...own],
    sections,
    dimensions: visibleDimensions(drawing.reconstruction?.dimensions ?? [], {
      walls: new Set([...base.walls, ...own].map((w) => w.id)),
      doorways: new Set(base.doorways.map((e) => e.id)),
      batteries: new Set(base.batteries.map((b) => b.id)),
      sections: new Set(sections.map((e) => e.line.id)),
    }),
  }
}
