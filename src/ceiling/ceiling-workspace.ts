import type { CeilingContent, Drawing, FurnitureItem, StretchCeiling, Wall } from "../types"
import { ceilingScene } from "./ceiling-scene"
import type { CeilingScene } from "./ceiling-scene"

// Рабочий набор плана «Потолки и освещение» (change add-ceiling-plan, design D4; по образцу рабочего набора «Сантехники»):
// «Линейка» и выделение видят стены подложки и мебель только для чтения, а в чертёж и историю пишутся только натяжные потолки.
// Чистые функции, входы не мутируются.

export interface CeilingWorkspace {
  // стены подложки, стены гипсокартона и предметы мебели: не выделяются и не правятся
  readOnlyIds: ReadonlySet<string>
}

export interface CeilingWorkingScene {
  walls: Wall[]
  items: FurnitureItem[]
}

export function openCeiling(drawing: Drawing, s: CeilingScene = ceilingScene(drawing)): { scene: CeilingWorkingScene; workspace: CeilingWorkspace } {
  const walls = [...s.base.underlay, ...s.base.own]
  return {
    scene: { walls, items: s.items },
    workspace: { readOnlyIds: new Set([...walls, ...s.items].map((x) => x.id)) },
  }
}

// хранимое содержимое плана: потолки, выноски и примечания плана как есть
export function storedCeiling(ceilings: readonly StretchCeiling[], drawing: Drawing): CeilingContent {
  const stored = drawing.ceiling
  return {
    ceilings: [...ceilings],
    ...(stored?.callouts !== undefined ? { callouts: stored.callouts } : null),
    ...(stored?.notes !== undefined ? { notes: stored.notes } : null),
  }
}
