import { reconstructionScene } from "../reconstruction/reconstruction-scene"
import type { ReconstructionScene } from "../reconstruction/reconstruction-scene"
import type { Drawing, FurnitureItem, LightFixture } from "../types"

// Сцена плана «Группы включения» (change add-switching-plan, design D3): подложка — результат плана «Реконструкция» (та же, что у
// «Мебели»), все предметы «Мебели» и все объекты освещения «Потолков и освещения». Помещений и натяжных потолков в сцене нет.
// Ничего не копируется в план: данные берутся с чужих планов при каждом построении. Чистая функция, чертёж не мутируется.

export interface SwitchingScene {
  base: ReconstructionScene
  // все предметы «Мебели» в порядке «Мебели»
  items: FurnitureItem[]
  // все объекты освещения в порядке постановки
  lights: LightFixture[]
}

export function switchingScene(drawing: Drawing, base: ReconstructionScene = reconstructionScene(drawing)): SwitchingScene {
  return {
    base,
    items: (drawing.furniture?.items ?? []).map((t) => ({ ...t })),
    lights: (drawing.ceiling?.lights ?? []).map((l) => ({ ...l })),
  }
}
