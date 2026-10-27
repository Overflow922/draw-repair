import type { Drawing, FurnitureItem, LightFixture, Wall } from "../types"
import { switchingScene } from "./switching-scene"
import type { SwitchingScene } from "./switching-scene"

// Рабочий набор плана «Группы включения» (change add-switching-plan, design D3; по образцу рабочего набора «Потолков и освещения»):
// «Линейка» и «Ластик» видят стены подложки, мебель и освещение только для чтения; выноски и примечания плана пишут свои
// адаптеры (callout-store, notes-store), собственных объектов у плана пока нет. Чистая функция, вход не мутируется.

export interface SwitchingWorkspace {
  // стены подложки, стены гипсокартона, предметы мебели и объекты освещения: не выделяются и не правятся
  readOnlyIds: ReadonlySet<string>
}

export interface SwitchingWorkingScene {
  walls: Wall[]
  items: FurnitureItem[]
  lights: LightFixture[]
}

export function openSwitching(drawing: Drawing, s: SwitchingScene = switchingScene(drawing)): { scene: SwitchingWorkingScene; workspace: SwitchingWorkspace } {
  const walls = [...s.base.underlay, ...s.base.own]
  return {
    scene: { walls, items: s.items, lights: s.lights },
    workspace: { readOnlyIds: new Set([...walls, ...s.items, ...s.lights].map((x) => x.id)) },
  }
}
