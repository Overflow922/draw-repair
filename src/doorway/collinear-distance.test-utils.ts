import type { Material, Wall, WallElement } from "../types"
import { doorwayDistances } from "./doorway-faces"
import type { DoorwayDistances } from "./doorway-faces"
import { door, w } from "./doorway.test-utils"
import { dr } from "./door.test-utils"
import { win } from "./window.test-utils"

// change fix-opening-distance-collinear: сцены и эталоны для тестов расстояний проёма сквозь коллинеарные стены
// (test-plan.md «Сцены»). Эталоны выводятся из спецификации (doorway «Расстояния проёма сквозь коллинеарные
// стены») и геометрии сцен, а не из продакшн-модулей. Толщина всех стен 20 см, единица — см.

export const made = (wall: Wall, type: Material): Wall => ({ ...wall, type })

export interface Ends {
  W0: Wall
  W: Wall
  L: Wall
  walls: Wall[]
}

// CK — кирпичные L (0,400)-(0,0), W0 (0,0)-(250,0), W (250,0)-(700,0); угол L/W0 замкнут, помещение y > 0
export function sceneCK(): Ends {
  const L = w(0, 400, 0, 0, "L")
  const W0 = w(0, 0, 250, 0, "W0")
  const W = w(250, 0, 700, 0, "W")
  return { L, W0, W, walls: [W0, W, L] }
}

// CB — как CK, но W бетонная
export function sceneCB(): Ends {
  const k = sceneCK()
  const W = made(k.W, "concrete")
  return { ...k, W, walls: [k.W0, W, k.L] }
}

// CF — свободные W0 (0,0)-(250,0) и W (250,0)-(700,0): оба внешних конца свободны
export function sceneCF(): Ends {
  const W0 = w(0, 0, 250, 0, "W0")
  const W = w(250, 0, 700, 0, "W")
  return { L: w(0, 400, 0, 0, "L"), W0, W, walls: [W0, W] }
}

// окно на W: привязка a, 150 см, ширина 120 (участок x 400…520); подпись окна не важна
export const WN = (id = "e0"): WallElement => win("W", "a", 150, 120, 150, 85, id)

// элемент вида kind на W на том же участке x 400…520
export function elementOf(kind: "doorway" | "door" | "window"): WallElement {
  if (kind === "window") return WN("e0")
  if (kind === "door") return dr("W", "a", 150, "a", "left", 120, 210, "e0")
  return door("W", "a", 150, 120, 210, "e0")
}

// независимый эталон: расстояния [plus.a, plus.b, minus.a, minus.b]
export function distancesOf(d: DoorwayDistances | null): [number, number, number, number] {
  if (!d) throw new Error("нет расстояний")
  return [d.plus.a, d.plus.b, d.minus.a, d.minus.b]
}

export const distancesFor = (e: WallElement, walls: Wall[], elements: WallElement[] = [e]): [number, number, number, number] =>
  distancesOf(doorwayDistances(e, walls, elements))

// CR — замкнутая комната 700×400, верхняя стена из двух кирпичных: W0 (0,0)-(250,0) и W (250,0)-(700,0);
// порядки массива стен — три перестановки
export function sceneCR(order: "natural" | "reversed" | "walls-first-last"): { walls: Wall[]; W: Wall } {
  const W0 = w(0, 0, 250, 0, "W0")
  const W = w(250, 0, 700, 0, "W")
  const R = w(700, 0, 700, 400, "R")
  const B = w(700, 400, 0, 400, "B")
  const L = w(0, 400, 0, 0, "L")
  const natural = [W0, W, R, B, L]
  if (order === "natural") return { walls: natural, W }
  if (order === "reversed") return { walls: [...natural].reverse(), W }
  return { walls: [L, W, B, R, W0], W }
}

// CM — цепочка: кирпичные W1 (0,0)-(150,0), W2 (150,0)-(300,0), бетонная W3 (300,0)-(700,0)
export function sceneCM(): { walls: Wall[]; W2: Wall } {
  const W1 = w(0, 0, 150, 0, "W1")
  const W2 = w(150, 0, 300, 0, "W2")
  const W3 = made(w(300, 0, 700, 0, "W3"), "concrete")
  return { walls: [W1, W2, W3], W2 }
}

// CT — W0 толщиной 10 и W толщиной 20, оба кирпичные, одна ось
export function sceneCT(): { walls: Wall[]; W: Wall } {
  const W0 = w(0, 0, 250, 0, "W0", 10)
  const W = w(250, 0, 700, 0, "W")
  return { walls: [W0, W], W }
}

// CKb — зеркало CK: W (0,0)-(450,0) — опорная, W0 (450,0)-(700,0), R (700,0)-(700,400); угол W0/R замкнут
export function sceneCKb(): { walls: Wall[]; W: Wall; W0: Wall } {
  const W = w(0, 0, 450, 0, "W")
  const W0 = w(450, 0, 700, 0, "W0")
  const R = w(700, 0, 700, 400, "R")
  return { walls: [W, W0, R], W, W0 }
}
