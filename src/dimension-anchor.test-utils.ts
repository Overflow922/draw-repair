import { expect } from "vitest"
import { door, sceneF, sceneR, w } from "./doorway/doorway.test-utils"
import { win } from "./doorway/window.test-utils"
import type { Dimension, DimPoint, Point, Wall, WallElement } from "./types"

// change add-opening-dimension-anchors: сцены и эталоны для тестов точек замера на откосах (test-plan.md «Сцены»).
// Эталоны координат выведены вручную из спецификации и геометрии сцен, а не из продакшн-кода.
// face = знак нормали (−d.y, d.x) оси a → b: для оси вдоль +x это y = +толщина/2.

export type Jamb = "a" | "b"
export type Face = 1 | -1

// точка замера на откосе (design D1, D8); тип задан литералом, чтобы тесты не зависели от экспорта типа
export const jambPoint = (elementId: string, jamb: Jamb, face: Face): DimPoint =>
  ({ kind: "jamb", elementId, jamb, face }) as unknown as DimPoint

export const jambDimension = (from: DimPoint, to: DimPoint, offset = 30): Dimension => ({ from, to, offset })

export function expectAt(p: Point | null, x: number, y: number, digits = 3): void {
  expect(p, "точка разрешена").not.toBeNull()
  if (!p) return
  expect(p.x).toBeCloseTo(x, digits)
  expect(p.y).toBeCloseTo(y, digits)
}

export const lengthBetween = (p: Point, q: Point): number => Math.hypot(q.x - p.x, q.y - p.y)

// F2 — свободная стена W (0,0)-(500,0) t20 и два окна: e1 (t 100…220), e2 (t 300…420)
export const sceneF2 = (): { walls: Wall[]; W: Wall; e1: WallElement; e2: WallElement; elements: WallElement[] } => {
  const f = sceneF()
  const e1 = win("W", "a", 100, 120, 150, 85, "e1")
  const e2 = win("W", "a", 300, 120, 150, 85, "e2")
  return { ...f, e1, e2, elements: [e1, e2] }
}

// FB — свободная стена W, дверь привязка b, 100, ширина 90 (t 310…400)
export const sceneFB = (): { walls: Wall[]; W: Wall; d: WallElement; elements: WallElement[] } => {
  const f = sceneF()
  const d = door("W", "b", 100, 90, 210, "d1")
  return { ...f, d, elements: [d] }
}

// FD — диагональная стена (0,0)-(300,400) t20 (длина 500, d = (0.6, 0.8)), проём привязка a, 100, ширина 90
export const sceneFD = (): { walls: Wall[]; W: Wall; p: WallElement; elements: WallElement[] } => {
  const W = w(0, 0, 300, 400, "W")
  const p = door("W", "a", 100, 90, 210, "p1")
  return { walls: [W], W, p, elements: [p] }
}

// FC — две коллинеарные стены W1 (0,0)-(300,0), W2 (300,0)-(600,0); e1 на W1 (x 100…200), e2 на W2 (x 350…450)
export const sceneFC = (): { walls: Wall[]; W1: Wall; W2: Wall; e1: WallElement; e2: WallElement; elements: WallElement[] } => {
  const W1 = w(0, 0, 300, 0, "W1")
  const W2 = w(300, 0, 600, 0, "W2")
  const e1 = win("W1", "a", 100, 100, 150, 85, "e1")
  const e2 = win("W2", "a", 50, 100, 150, 85, "e2")
  return { walls: [W1, W2], W1, W2, e1, e2, elements: [e1, e2] }
}

// R2 — комната sceneR, окно e1 на W (t 100…220) и окно e3 на B (t 100…220 от конца a стены B)
export const sceneR2 = (): ReturnType<typeof sceneR> & { e1: WallElement; e3: WallElement; elements: WallElement[] } => {
  const r = sceneR()
  const e1 = win("W", "a", 100, 120, 150, 85, "e1")
  const e3 = win("B", "a", 100, 120, 150, 85, "e3")
  return { ...r, e1, e3, elements: [e1, e3] }
}

export { door, win, w, sceneR, sceneF }
