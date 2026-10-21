import { plasterObstacles } from "../reconstruction/plaster-obstacles"
import type { Dimension, Drawing, FurnitureContent, FurnitureItem, Wall } from "../types"
import { furnitureScene } from "./furniture-scene"
import type { FurnitureScene } from "./furniture-scene"

// Рабочий набор плана «Мебель» (change furniture-plan-table, design D3): инструменты «Размер», «Линейка» и «Ластик» видят
// список стен «подложка + штукатурка-препятствия + стены гипсокартона», целиком только для чтения, а в чертёж и историю
// пишется хранимое представление: столы и размеры. Чистые функции, входы не мутируются.

export interface Workspace {
  // вся подложка (стены обмера и «Монтажа», стены гипсокартона, виртуальные стены штукатурки): не выделяется и не правится
  readOnlyIds: ReadonlySet<string>
  // сохранённые размеры, которые сейчас не видны: не теряются при записи
  hiddenDimensions: readonly Dimension[]
}

export interface WorkingScene {
  walls: Wall[]
  dimensions: Dimension[]
  items: FurnitureItem[]
}

export function openFurniture(drawing: Drawing, s: FurnitureScene = furnitureScene(drawing)): { scene: WorkingScene; workspace: Workspace; obstacles: Wall[] } {
  const obstacles = plasterObstacles(s.base.pieces)
  const walls = [...s.base.underlay, ...s.base.own]
  const shown = new Set(s.dimensions)
  return {
    scene: { walls, dimensions: [...s.dimensions], items: s.items },
    workspace: {
      readOnlyIds: new Set([...walls, ...obstacles].map((w) => w.id)),
      hiddenDimensions: (drawing.furniture?.dimensions ?? []).filter((d) => !shown.has(d)),
    },
    obstacles,
  }
}

// хранимое содержимое «Мебели» по рабочей сцене: столы, размеры (с невидимыми), выноски и примечания как есть
export function storedFurniture(items: readonly FurnitureItem[], dimensions: readonly Dimension[], workspace: Workspace, drawing: Drawing): FurnitureContent {
  const stored = drawing.furniture
  return {
    items: items.map((t) => ({ ...t })),
    dimensions: [...workspace.hiddenDimensions, ...dimensions],
    // выноски и примечания плана не зависят от сцены: хранятся как есть (change add-callout, add-plan-notes)
    ...(stored?.callouts !== undefined ? { callouts: stored.callouts } : null),
    ...(stored?.notes !== undefined ? { notes: stored.notes } : null),
  }
}
