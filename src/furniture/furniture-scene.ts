import { visibleDimensions } from "../dimension-visibility"
import { reconstructionScene } from "../reconstruction/reconstruction-scene"
import type { ReconstructionScene } from "../reconstruction/reconstruction-scene"
import type { Dimension, Drawing, Table } from "../types"

// Сцена плана «Мебель» (change furniture-plan-table, design D3): подложка — результат плана «Реконструкция» целиком (подложка
// «Черновых работ», штукатурка, стены гипсокартона), поверх неё собственные столы и размеры плана. Всё вычисляется по чертежу,
// ничего не хранится. Чистая функция, чертёж не мутируется.

export interface FurnitureScene {
  // результат «Реконструкции»: underlay, pieces, own (стены гипсокартона), base
  base: ReconstructionScene
  tables: Table[]
  // собственные размеры плана, у которых все привязки видны в сцене
  dimensions: Dimension[]
}

export function furnitureScene(drawing: Drawing, base: ReconstructionScene = reconstructionScene(drawing)): FurnitureScene {
  const content = drawing.furniture
  return {
    base,
    tables: (content?.tables ?? []).map((t) => ({ ...t })),
    dimensions: visibleDimensions(content?.dimensions ?? [], {
      walls: new Set([...base.underlay, ...base.own].map((w) => w.id)),
      doorways: new Set(base.base.doorways.map((e) => e.id)),
      batteries: new Set(base.base.batteries.map((b) => b.id)),
    }),
  }
}
