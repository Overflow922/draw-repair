import { reconstructionScene } from "../reconstruction/reconstruction-scene"
import type { ReconstructionScene } from "../reconstruction/reconstruction-scene"
import { copyLightSwitch } from "../storage"
import type { Drawing, FurnitureItem, LightSwitch } from "../types"

// Сцена плана «Электрооборудование» (change add-electrical-plan, design D2): подложка — результат плана «Реконструкция» (та же, что
// у «Мебели»), все предметы «Мебели» и все выключатели «Потолков и освещения». Потолков, освещения, вытяжек и меток линий в сцене
// нет. Ничего не копируется в план: данные берутся с чужих планов при каждом построении. Чистая функция, чертёж не мутируется.

export interface ElectricalScene {
  base: ReconstructionScene
  // все предметы «Мебели» в порядке «Мебели»
  items: FurnitureItem[]
  // все выключатели в порядке постановки
  switches: LightSwitch[]
}

export function electricalScene(drawing: Drawing, base: ReconstructionScene = reconstructionScene(drawing)): ElectricalScene {
  return {
    base,
    items: (drawing.furniture?.items ?? []).map((t) => ({ ...t })),
    switches: (drawing.switching?.switches ?? []).map(copyLightSwitch),
  }
}
