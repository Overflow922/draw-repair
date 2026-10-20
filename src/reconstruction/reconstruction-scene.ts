import { mountingScene } from "../mounting/mounting-scene"
import type { MountingScene } from "../mounting/mounting-scene"
import { plasterPieces } from "../rough/plaster"
import type { PlasterPiece } from "../rough/plaster"
import type { Dimension, DimPoint, Drawing, DrywallWall, Wall } from "../types"

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
  const ids = new Set([...base.walls, ...own].map((w) => w.id))
  const doorways = new Set(base.doorways.map((e) => e.id))
  const batteries = new Set(base.batteries.map((b) => b.id))
  // точка действует, пока опорная стена есть в сцене; откос — пока виден элемент подложки, угол — пока видна батарея
  const resolvable = (p: DimPoint): boolean => {
    if (p.kind === "jamb") return doorways.has(p.elementId)
    if (p.kind === "corner") return batteries.has(p.batteryId)
    return ids.has(p.a.wallId) && ids.has(p.b.wallId)
  }
  return {
    base,
    underlay: base.walls,
    pieces: plasterPieces(drawing, base),
    own: [...own],
    dimensions: (drawing.reconstruction?.dimensions ?? []).filter((d) => resolvable(d.from) && resolvable(d.to)),
  }
}
