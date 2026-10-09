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

export type Tool = "wall" | "dimension" | "doorway" | "door" | "window" | "eraser" | "ruler" | "demolition" | "none"
