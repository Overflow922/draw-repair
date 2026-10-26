import { plasterObstacles } from "../reconstruction/plaster-obstacles"
import type { Dimension, Drawing, FurnitureItem, PlumbingContent, Wall } from "../types"
import { plumbingScene } from "./plumbing-scene"
import type { PlumbingScene } from "./plumbing-scene"

// Рабочий набор плана «Сантехника» (change add-plumbing-plan, design D3; по образцу рабочего набора «Мебели»): инструменты
// «Размер», «Линейка» и «Ластик» видят стены подложки и приборы целиком только для чтения, а в чертёж и историю пишутся только
// размеры плана. Чистые функции, входы не мутируются.

export interface PlumbingWorkspace {
  // стены подложки, виртуальные стены штукатурки и приборы: не выделяются и не правятся
  readOnlyIds: ReadonlySet<string>
  // сохранённые размеры, которые сейчас не видны: не теряются при записи
  hiddenDimensions: readonly Dimension[]
}

export interface PlumbingWorkingScene {
  walls: Wall[]
  dimensions: Dimension[]
  items: FurnitureItem[]
}

export function openPlumbing(drawing: Drawing, s: PlumbingScene = plumbingScene(drawing)): { scene: PlumbingWorkingScene; workspace: PlumbingWorkspace; obstacles: Wall[] } {
  const obstacles = plasterObstacles(s.base.pieces)
  const walls = [...s.base.underlay, ...s.base.own]
  const shown = new Set(s.dimensions)
  return {
    scene: { walls, dimensions: [...s.dimensions], items: s.items },
    workspace: {
      readOnlyIds: new Set([...walls, ...obstacles, ...s.items].map((x) => x.id)),
      hiddenDimensions: (drawing.plumbing?.dimensions ?? []).filter((d) => !shown.has(d)),
    },
    obstacles,
  }
}

// хранимое содержимое «Сантехники» по рабочей сцене: размеры (с невидимыми), выноски и примечания как есть
export function storedPlumbing(dimensions: readonly Dimension[], workspace: PlumbingWorkspace, drawing: Drawing): PlumbingContent {
  const stored = drawing.plumbing
  return {
    dimensions: [...workspace.hiddenDimensions, ...dimensions],
    ...(stored?.callouts !== undefined ? { callouts: stored.callouts } : null),
    ...(stored?.notes !== undefined ? { notes: stored.notes } : null),
  }
}
