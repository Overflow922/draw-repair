import type { Material, Wall, WallElement } from "../types"
import { doorwayDistances } from "./doorway-faces"
import { w } from "./doorway.test-utils"
import { win } from "./window.test-utils"

// change fix-opening-reach-body-end: сцены и эталоны для тестов положения элемента у конца опорной стены,
// где тело выступает за ось до плоскости стыка (test-plan.md «Scope»). Эталоны выводятся из спецификации
// (doorway «Проём и опорная стена», «Расстояния проёма сквозь коллинеарные стены») и геометрии сцен,
// а не из продакшн-модулей. Толщина стен 20 см, единица — см.

export const made = (wall: Wall, type: Material): Wall => ({ ...wall, type })

export interface Scene2 {
  walls: Wall[]
  W: Wall
  C: Wall
}

// F — бетонная C (510,0)-(700,0) нарисована раньше, блочная W (0,0)-(500,0) позже: вершина стыка на x = 510,
// тело W доходит до x = 510 (выступ 10 см за конец b)
export function sceneF(): Scene2 {
  const C = made(w(510, 0, 700, 0, "C"), "concrete")
  const W = made(w(0, 0, 500, 0, "W"), "blocks")
  return { walls: [C, W], W, C }
}

// G — те же стены, но W нарисована раньше C: вершина стыка — конец оси W (x = 500), выступа нет
export function sceneG(): Scene2 {
  const C = made(w(510, 0, 700, 0, "C"), "concrete")
  const W = made(w(0, 0, 500, 0, "W"), "blocks")
  return { walls: [W, C], W, C }
}

// Fa — зеркало F: бетонная C (0,0)-(190,0) раньше, блочная W (200,0)-(700,0) позже; выступ 10 см за конец a (x = 190)
export function sceneFa(): Scene2 {
  const C = made(w(0, 0, 190, 0, "C"), "concrete")
  const W = made(w(200, 0, 700, 0, "W"), "blocks")
  return { walls: [C, W], W, C }
}

// FM — на W: слева (конец a) бетонная C0 (-190,0)-(-10,0) раньше — выступ 10 см; справа (конец b) блочная W2
// (500,0)-(700,0) того же материала — продолжение, граница — конец оси W
export function sceneFM(): { walls: Wall[]; W: Wall } {
  const C0 = made(w(-190, 0, -10, 0, "C0"), "concrete")
  const W = made(w(0, 0, 500, 0, "W"), "blocks")
  const W2 = made(w(500, 0, 700, 0, "W2"), "blocks")
  return { walls: [C0, W, W2], W }
}

// окно на W шириной 120 с привязкой a, откосы x = 300…420
export const winMid = (id = "e0"): WallElement => win("W", "a", 300, 120, 150, 85, id)

export const PLUS = 1
export const MINUS = -1

// расстояния [plus.a, plus.b, minus.a, minus.b] элемента по независимому вычислению продакшн-модуля расстояний
export function distancesFor(e: WallElement, walls: Wall[], elements: WallElement[] = [e]): [number, number, number, number] {
  const d = doorwayDistances(e, walls, elements)
  if (!d) throw new Error("нет расстояний")
  return [d.plus.a, d.plus.b, d.minus.a, d.minus.b]
}
