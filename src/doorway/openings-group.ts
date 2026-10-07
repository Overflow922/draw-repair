// Группа «Проёмы» на панели инструментов (change add-door, design D6): переходы состояния кнопки группы
// и её панели без DOM. main.ts применяет переходы и отражает результат в разметке. Выделение элемента группу
// не трогает (change popups-buttons-only, spec canvas-app «Панель группы «Проёмы»»).

export type GroupTool = "doorway" | "door"

export interface GroupState {
  current: GroupTool // последний выбранный инструмент группы — его активирует кнопка группы
  active: GroupTool | "other" // "other" — активен инструмент вне группы
  panelOpen: boolean
}

// клик по кнопке группы — как по кнопке инструмента: другой инструмент → текущий инструмент группы и панель
// с первого нажатия; уже активный → переключение панели (spec canvas-app «Группа «Проёмы»»)
export function groupButtonClick(s: GroupState): GroupState {
  if (s.active !== s.current) return { ...s, active: s.current, panelOpen: true }
  return { ...s, panelOpen: !s.panelOpen }
}

// кнопка инструмента в панели группы: инструмент становится текущим и активным, панель остаётся открытой
export function groupPick(s: GroupState, t: GroupTool): GroupState {
  return { ...s, current: t, active: t, panelOpen: true }
}

export const groupButtonActive = (s: GroupState): boolean => s.active !== "other"

export type Tool = "wall" | "dimension" | "doorway" | "door" | "window" | "eraser" | "ruler" | "none"

export interface ElementPress {
  tool: Tool
  group: GroupState
  selected: boolean // нажатие выделило существующий элемент стены
}

// нажатие на элемент при активном инструменте установки («Проём», «Дверь», «Окно») выводит из установки:
// инструмента нет, панель группы закрыта, текущий инструмент группы помнится (spec doorway «Выделение проёма
// кликом»); при других инструментах и без выделения ничего не меняется
export function afterElementPress({ tool, group, selected }: ElementPress): { tool: Tool; group: GroupState } {
  if (!selected || (tool !== "doorway" && tool !== "door" && tool !== "window")) return { tool, group }
  return { tool: "none", group: { current: group.current, active: "other", panelOpen: false } }
}
