import { visibleDimensions } from "../dimension-visibility"
import { reconstructionScene } from "../reconstruction/reconstruction-scene"
import type { ReconstructionScene } from "../reconstruction/reconstruction-scene"
import type { Dimension, Drawing, FurnitureItem } from "../types"
import { waterItems } from "./water-items"

// Сцена плана «Сантехника» (change add-plumbing-plan, design D3): подложка — результат плана «Реконструкция» (та же, что у плана
// «Мебель»), поверх неё приборы плана «Мебель» и собственные размеры плана. Приборы не копируются в план: они берутся из
// «Мебели» при каждом построении сцены. Всё вычисляется по чертежу, ничего не хранится. Чистая функция, чертёж не мутируется.

export interface PlumbingScene {
  // результат «Реконструкции»: underlay, pieces, own (стены гипсокартона), base
  base: ReconstructionScene
  // приборы «Мебели» в порядке «Мебели»
  items: FurnitureItem[]
  // собственные размеры плана, у которых все привязки видны в сцене
  dimensions: Dimension[]
}

export function plumbingScene(drawing: Drawing, base: ReconstructionScene = reconstructionScene(drawing)): PlumbingScene {
  const items = waterItems(drawing.furniture?.items ?? []).map((t) => ({ ...t }))
  return {
    base,
    items,
    dimensions: visibleDimensions(drawing.plumbing?.dimensions ?? [], {
      walls: new Set([...base.underlay, ...base.own].map((w) => w.id)),
      doorways: new Set(base.base.doorways.map((e) => e.id)),
      batteries: new Set(base.base.batteries.map((b) => b.id)),
      items: new Set(items.map((t) => t.id)),
    }),
  }
}
