import type { Dimension, Drawing, DrywallWall, ReconstructionContent, Wall } from "../types"
import { plasterObstacles } from "./plaster-obstacles"
import { reconstructionScene } from "./reconstruction-scene"

// Рабочий набор плана «Реконструкция» (change reconstruction-plan, design D2, D4): инструменты правят смешанный список стен —
// подложка, виртуальные стены штукатурки (препятствия) и стены ГКЛ, — а в чертёж и историю пишется хранимое представление:
// только стены ГКЛ и размеры. Чистые функции, входы не мутируются.

export interface WorkingScene {
  walls: Wall[]
  dimensions: Dimension[]
}

export interface Workspace {
  // подложка и виртуальные стены штукатурки: только для чтения, не выделяются и после правки возвращаются на место
  readOnlyIds: ReadonlySet<string>
  // сохранённые размеры, которые сейчас не видны: не теряются при записи
  hiddenDimensions: readonly Dimension[]
}

const isDrywall = (w: Wall): w is DrywallWall => w.type === "gkl" && "heightCm" in w && typeof w.heightCm === "number"

const copyWall = (w: DrywallWall): DrywallWall => ({ ...w, a: { ...w.a }, b: { ...w.b } })

export function openReconstruction(drawing: Drawing): { scene: WorkingScene; workspace: Workspace } {
  const s = reconstructionScene(drawing)
  const obstacles = plasterObstacles(s.pieces)
  const own = s.own.map(copyWall)
  const shown = new Set(s.dimensions)
  return {
    scene: { walls: [...s.underlay, ...obstacles, ...own], dimensions: [...s.dimensions] },
    workspace: {
      readOnlyIds: new Set([...s.underlay, ...obstacles].map((w) => w.id)),
      hiddenDimensions: (drawing.reconstruction?.dimensions ?? []).filter((d) => !shown.has(d)),
    },
  }
}

// хранимое содержимое «Реконструкции» по рабочей сцене: без подложки и препятствий, с невидимыми размерами
export function storedReconstruction(scene: WorkingScene, workspace: Workspace, drawing: Drawing): ReconstructionContent {
  const stored = drawing.reconstruction
  return {
    walls: scene.walls.filter((w) => !workspace.readOnlyIds.has(w.id)).filter(isDrywall).map(copyWall),
    dimensions: [...workspace.hiddenDimensions, ...scene.dimensions],
    // выноски и примечания плана не зависят от сцены: хранятся как есть (change add-callout, add-plan-notes)
    ...(stored?.callouts !== undefined ? { callouts: stored.callouts } : null),
    ...(stored?.notes !== undefined ? { notes: stored.notes } : null),
  }
}
