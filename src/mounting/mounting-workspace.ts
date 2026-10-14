import { effectiveMarks, lengthOf } from "../demolition/mark-model"
import type { Battery, Dimension, Drawing, MountingContent, Wall, WallElement } from "../types"
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
  // видимые батареи: батареи обмера и собственные (change add-battery, design D7)
  batteries: Battery[]
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
  // идентификаторы показанных батарей обмера (только чтение) и сохранённые собственные батареи, которые сейчас не видны
  oldBatteryIds: ReadonlySet<string>
  hiddenBatteries: readonly Battery[]
}

export function openWorkspace(drawing: Drawing): { scene: WorkingScene; workspace: Workspace } {
  const s = mountingScene(drawing)
  const stored = drawing.mounting
  const shown = new Set(s.doorways.map((e) => e.id))
  const shownBatteries = new Set(s.batteries.map((b) => b.id))
  return {
    scene: { walls: s.walls, dimensions: [...s.dimensions], doorways: [...s.doorways], batteries: [...s.batteries] },
    workspace: {
      remnantIds: new Set(s.remnants.map((w) => w.id)),
      oldElementIds: s.oldElementIds,
      hiddenDimensions: (stored?.dimensions ?? []).filter((d) => !s.dimensions.includes(d)),
      hiddenElements: (stored?.doorways ?? []).filter((e) => !shown.has(e.id)),
      oldBatteryIds: s.oldBatteryIds,
      hiddenBatteries: (stored?.batteries ?? []).filter((b) => !shownBatteries.has(b.id)),
    },
  }
}

// элемент или батарея на остатке → объект со ссылкой на стену обмера и смещением от конца привязки исходной стены
function unresolver(drawing: Drawing): <T extends { wallId: string; anchor: "a" | "b"; offsetCm: number }>(e: T) => T {
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
export function storedContent(
  scene: Omit<WorkingScene, "doorways" | "batteries"> & { doorways?: WallElement[]; batteries?: Battery[] },
  workspace: Workspace,
  drawing: Drawing,
): MountingContent {
  const unresolve = unresolver(drawing)
  const doorways = [...workspace.hiddenElements, ...(scene.doorways ?? []).filter((e) => !workspace.oldElementIds.has(e.id)).map(unresolve)]
  const batteries = [...workspace.hiddenBatteries, ...(scene.batteries ?? []).filter((b) => !workspace.oldBatteryIds.has(b.id)).map(unresolve)]
  return {
    walls: scene.walls.filter((w) => !workspace.remnantIds.has(w.id)),
    // автоматические размеры остатков не хранятся: остаток размеров не получает
    dimensions: [...workspace.hiddenDimensions, ...scene.dimensions.filter((d) => d.auto === undefined || !workspace.remnantIds.has(d.auto))],
    ...(doorways.length > 0 || drawing.mounting?.doorways !== undefined ? { doorways } : null),
    ...(batteries.length > 0 || drawing.mounting?.batteries !== undefined ? { batteries } : null),
  }
}
