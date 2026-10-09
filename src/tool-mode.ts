// Правила режима «выделение только без инструмента» (change select-only-without-tool, design D1, D2, D5, D8):
// чистые функции без DOM. main.ts только вызывает их и применяет результат.

import type { GroupState, Tool } from "./doorway/openings-group"

// выделять и править существующие объекты можно только в состоянии «Без инструмента»
// (spec canvas-app «Выделение и правка только без инструмента»)
export const selectionAllowed = (tool: Tool): boolean => tool === "none"

export interface EscapeState {
  tool: Tool
  gestureActive: boolean // идёт незавершённый жест стены
  dimensionDraft: boolean // начато размещение размера
  hasSelection: boolean
}

export type EscapeAction = "end-gesture" | "cancel-dimension-draft" | "clear-selection" | "deactivate-tool" | "none"

// Esc: сначала отменяется незавершённое действие, затем снимается инструмент; без инструмента — снимается выделение
// (spec canvas-app «Esc снимает активный инструмент»)
export function escapeAction({ tool, gestureActive, dimensionDraft, hasSelection }: EscapeState): EscapeAction {
  if (gestureActive) return "end-gesture"
  if (dimensionDraft) return "cancel-dimension-draft"
  if (tool !== "none") return "deactivate-tool"
  return hasSelection ? "clear-selection" : "none"
}

// после установки «Проёма», «Двери» или «Окна» инструмент снимается и панель группы закрывается; текущий
// инструмент группы помнится (spec doorway «Установка проёма»)
export function afterPlace(tool: Tool, group: GroupState): { tool: Tool; group: GroupState } {
  if (tool !== "doorway" && tool !== "door" && tool !== "window") return { tool, group }
  return { tool: "none", group: { current: group.current, active: "other", panelOpen: false } }
}
