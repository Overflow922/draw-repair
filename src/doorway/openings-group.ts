// Группа «Проёмы» на панели инструментов (change add-door, design D6): переходы состояния кнопки группы
// и её панели без DOM. main.ts применяет переходы и отражает результат в разметке. Выделение элемента группу
// не трогает (change popups-buttons-only, spec canvas-app «Панель группы «Проёмы»»).

export type GroupTool = "doorway" | "door"

// состояние группы инструментов; по умолчанию — группа «Проёмы», группа «Коммуникации» берёт те же переходы
// (change add-communications, design D9)
export interface GroupState<T extends string = GroupTool> {
  current: T // последний выбранный инструмент группы — его активирует кнопка группы
  active: T | "other" // "other" — активен инструмент вне группы
  panelOpen: boolean
}

// клик по кнопке группы — как по кнопке инструмента: другой инструмент → текущий инструмент группы и панель
// с первого нажатия; уже активный → переключение панели (spec canvas-app «Группа «Проёмы»»)
export function groupButtonClick<T extends string>(s: GroupState<T>): GroupState<T> {
  if (s.active !== s.current) return { ...s, active: s.current, panelOpen: true }
  return { ...s, panelOpen: !s.panelOpen }
}

// кнопка инструмента в панели группы: инструмент становится текущим и активным, панель остаётся открытой
export function groupPick<T extends string>(s: GroupState<T>, t: T): GroupState<T> {
  return { ...s, current: t, active: t, panelOpen: true }
}

export const groupButtonActive = <T extends string>(s: GroupState<T>): boolean => s.active !== "other"

export type Tool = "wall" | "dimension" | "doorway" | "door" | "window" | "battery" | "riser" | "duct" | "eraser" | "ruler" | "demolition" | "plaster" | "rightAngle" | "screed" | "drywall" | "furniture" | "callout" | "notes" | "none"
