import type { DoorHinge, DoorSwing } from "../types"

// Параметры инструмента по виду элемента стены (change add-window, design D4; add-door, design D4): значения
// по умолчанию для новых элементов, допустимость значений полей панели и круг поворота двери. Чистые функции без DOM.

export type ElementKind = "doorway" | "window" | "door"
export type ElementField = "width" | "height" | "sill"

export interface DoorDirection {
  hinge: DoorHinge
  swing: DoorSwing
}

export interface ElementDefaults {
  widthCm: number
  heightCm: number
  sillCm?: number
  hinge?: DoorHinge
  swing?: DoorSwing
}

// проём 900 / 2100 мм (spec doorway «Инструмент «Проём»»), окно 1200 / 1500 / 850 мм (spec window),
// дверь 900 / 2100 мм, петли у a, открывание left (spec door «Инструмент «Дверь»»)
export function elementDefaults(kind: ElementKind): ElementDefaults {
  if (kind === "window") return { widthCm: 120, heightCm: 150, sillCm: 85 }
  if (kind === "door") return { widthCm: 90, heightCm: 210, hinge: "a", swing: "left" }
  return { widthCm: 90, heightCm: 210 }
}

// ширина и высота — положительные, подоконник — неотрицательный; подоконник есть только у окна
export function acceptField(kind: ElementKind, field: ElementField, cm: number): boolean {
  if (!Number.isFinite(cm)) return false
  if (field === "sill") return kind === "window" && cm >= 0
  return cm > 0
}

// круг поворота: a/left → b/left → b/right → a/right → a/left (spec door «Поворот двери»)
export function nextDirection({ hinge, swing }: DoorDirection): DoorDirection {
  if (swing === "left") return hinge === "a" ? { hinge: "b", swing: "left" } : { hinge: "b", swing: "right" }
  return hinge === "b" ? { hinge: "a", swing: "right" } : { hinge: "a", swing: "left" }
}
