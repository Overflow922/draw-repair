// Параметры инструмента по виду элемента стены (change add-window, design D4): значения по умолчанию
// для новых элементов и допустимость значений полей панели. Чистые функции без DOM.

export type ElementKind = "doorway" | "window"
export type ElementField = "width" | "height" | "sill"

export interface ElementDefaults {
  widthCm: number
  heightCm: number
  sillCm?: number
}

// проём 900 / 2100 мм (spec doorway «Инструмент «Проём»»), окно 1200 / 1500 / 850 мм (spec window)
export function elementDefaults(kind: ElementKind): ElementDefaults {
  return kind === "window" ? { widthCm: 120, heightCm: 150, sillCm: 85 } : { widthCm: 90, heightCm: 210 }
}

// ширина и высота — положительные, подоконник — неотрицательный; у проёма подоконника нет
export function acceptField(kind: ElementKind, field: ElementField, cm: number): boolean {
  if (!Number.isFinite(cm)) return false
  if (field === "sill") return kind === "window" && cm >= 0
  return cm > 0
}
