import { effectiveMarks, lengthOf } from "../demolition/mark-model"
import type { Dimension, Drawing, MountingContent, Wall, WallElement } from "../types"
import { remnantId, remnantSpans } from "./remnants"
import { mountingScene } from "./mounting-scene"

// Рабочий набор плана «Монтаж» (change mounting-plan, design D2, D5, D6): инструменты правят сцену (остатки +
// собственные объекты, элементы разрешены на остатки), а в чертёж и историю пишется хранимое представление — только
// собственные объекты, элементы с ссылкой на стену обмера. Чистые функции, входы не мутируются.

// сцена, с которой работают инструменты холста
export interface WorkingScene {
  walls: Wall[]
  dimensions: Dimension[]
  doorways: WallElement[]
}

// что отличает рабочий набор от хранимого содержимого
export interface Workspace {
  // идентификаторы остатков (стены только для чтения)
  remnantIds: ReadonlySet<string>
  // идентификаторы старых элементов обмера (только чтение)
  oldElementIds: ReadonlySet<string>
  // сохранённые собственные размеры и элементы, которые сейчас не видны: не теряются при записи
  hiddenDimensions: readonly Dimension[]
  hiddenElements: readonly WallElement[]
}

export function openWorkspace(drawing: Drawing): { scene: WorkingScene; workspace: Workspace } {
  const s = mountingScene(drawing)
  const stored = drawing.mounting
  const shown = new Set(s.doorways.map((e) => e.id))
  return {
    scene: { walls: s.walls, dimensions: [...s.dimensions], doorways: [...s.doorways] },
    workspace: {
      remnantIds: new Set(s.remnants.map((w) => w.id)),
      oldElementIds: s.oldElementIds,
      hiddenDimensions: (stored?.dimensions ?? []).filter((d) => !s.dimensions.includes(d)),
      hiddenElements: (stored?.doorways ?? []).filter((e) => !shown.has(e.id)),
    },
  }
}

// элемент на остатке → элемент со ссылкой на стену обмера и смещением от конца привязки исходной стены
function unresolver(drawing: Drawing): (e: WallElement) => WallElement {
  const marks = effectiveMarks(drawing.demolition ?? [], drawing.walls, drawing.doorways ?? [])
  const origins = new Map<string, { wall: Wall; start: number; end: number }>()
  for (const wall of drawing.walls) {
    for (const [start, end] of remnantSpans(wall, marks)) origins.set(remnantId(wall.id, start), { wall, start, end })
  }
  return (e) => {
    const o = origins.get(e.wallId)
    if (!o) return e
    const len = lengthOf(o.wall)
    return { ...e, wallId: o.wall.id, offsetCm: e.anchor === "a" ? e.offsetCm + o.start : e.offsetCm + (len - o.end) }
  }
}

// хранимое содержимое «Монтажа» по рабочей сцене: без остатков, без старых элементов, с невидимыми объектами
export function storedContent(scene: Omit<WorkingScene, "doorways"> & { doorways?: WallElement[] }, workspace: Workspace, drawing: Drawing): MountingContent {
  const unresolve = unresolver(drawing)
  const doorways = [...workspace.hiddenElements, ...(scene.doorways ?? []).filter((e) => !workspace.oldElementIds.has(e.id)).map(unresolve)]
  return {
    walls: scene.walls.filter((w) => !workspace.remnantIds.has(w.id)),
    // автоматические размеры остатков не хранятся: остаток размеров не получает
    dimensions: [...workspace.hiddenDimensions, ...scene.dimensions.filter((d) => d.auto === undefined || !workspace.remnantIds.has(d.auto))],
    ...(doorways.length > 0 || drawing.mounting?.doorways !== undefined ? { doorways } : null),
  }
}
