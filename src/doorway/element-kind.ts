import type { DoorHinge, DoorSwing, WallElement } from "../types"
import { isDoor, isWindow } from "../types"

// Параметры инструмента по виду элемента стены (change add-window, design D4; add-door, design D4;
// popups-buttons-only, design D4): параметры новых элементов, их наследование от правки и допустимость
// вводимых значений. Чистые функции без DOM.

export type ElementKind = "doorway" | "window" | "door"
export type ElementField = "width" | "height" | "sill"

export interface DoorwayParams {
  widthCm: number
  heightCm: number
}

// сторона открывания в параметры новых дверей не входит: её задаёт курсор (spec door)
export interface DoorParams extends DoorwayParams {
  hinge: DoorHinge
}

export interface WindowParams extends DoorwayParams {
  sillCm: number
}

export interface NewElementParams {
  doorway: DoorwayParams
  door: DoorParams
  window: WindowParams
}

// проём 900 / 2100 мм, дверь 900 / 2100 мм с петлями у a, окно 1200 / 1500 / 850 мм
export function initialParams(): NewElementParams {
  return {
    doorway: { widthCm: 90, heightCm: 210 },
    door: { widthCm: 90, heightCm: 210, hinge: "a" },
    window: { widthCm: 120, heightCm: 150, sillCm: 85 },
  }
}

// параметры вида правленого элемента заменяются его значениями; остальные виды не меняются
export function inheritFrom(params: NewElementParams, e: WallElement): NewElementParams {
  if (isWindow(e)) return { ...params, window: { widthCm: e.widthCm, heightCm: e.heightCm, sillCm: e.sillCm } }
  if (isDoor(e)) return { ...params, door: { widthCm: e.widthCm, heightCm: e.heightCm, hinge: e.hinge } }
  return { ...params, doorway: { widthCm: e.widthCm, heightCm: e.heightCm } }
}

export interface ElementDefaults {
  widthCm: number
  heightCm: number
  sillCm?: number
  hinge?: DoorHinge
  swing?: DoorSwing
}

// значения по умолчанию вида; у двери — вместе со стороной открывания призрака до первого показа (left)
export function elementDefaults(kind: ElementKind): ElementDefaults {
  const p = initialParams()
  if (kind === "window") return p.window
  if (kind === "door") return { ...p.door, swing: "left" }
  return p.doorway
}

// ширина и высота — положительные, подоконник — неотрицательный; подоконник есть только у окна
export function acceptField(kind: ElementKind, field: ElementField, cm: number): boolean {
  if (!Number.isFinite(cm)) return false
  if (field === "sill") return kind === "window" && cm >= 0
  return cm > 0
}
