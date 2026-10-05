import type { Wall } from "./types"
import { w } from "./wall-edit.test-utils"

// change ortho-axis-lock: сцены тестов фиксации оси орто (test-plan.md)

// --- сцены (test-plan.md) ---

// R: комната 400 × 300
export const sceneR = (): { walls: Wall[]; top: Wall; right: Wall; bottom: Wall; left: Wall } => {
  const top = w(0, 0, 400, 0, "top", 20)
  const right = w(400, 0, 400, 300, "right", 20)
  const bottom = w(400, 300, 0, 300, "bottom", 20)
  const left = w(0, 300, 0, 0, "left", 20)
  return { walls: [top, right, bottom, left], top, right, bottom, left }
}

// R2: две комнаты с общей перегородкой P, верх разбит на T1 и T2
export const sceneR2 = (): { walls: Wall[]; T1: Wall; T2: Wall; R: Wall; B: Wall; L: Wall; P: Wall } => {
  const T1 = w(0, 0, 400, 0, "T1", 20)
  const T2 = w(400, 0, 800, 0, "T2", 20)
  const R = w(800, 0, 800, 300, "R", 20)
  const B = w(800, 300, 0, 300, "B", 20)
  const L = w(0, 300, 0, 0, "L", 20)
  const P = w(400, 0, 400, 300, "P", 20)
  return { walls: [T1, T2, R, B, L, P], T1, T2, R, B, L, P }
}

// U: раскладка снимка пользователя (img.png). S — перемещаемая стена: левый конец в стыке с L,
// правый — угловым стыком на грани у концов M1/M2; к нижней грани S примкнута V нижней комнаты
export const sceneU = (): { walls: Wall[]; S: Wall; L: Wall; M1: Wall; M2: Wall; V: Wall } => {
  const Top = w(0, 0, 250, 0, "Top", 20)
  const L = w(0, 0, 0, 170, "L", 20)
  const M1 = w(250, 0, 250, 170, "M1", 20)
  const M2 = w(250, 170, 250, 300, "M2", 20)
  const D1 = w(10, 80, 240, 80, "D1", 20)
  const S = w(0, 170, 240, 170, "S", 20)
  const V = w(100, 180, 100, 310, "V", 20)
  const TR = w(260, 60, 480, 60, "TR", 20)
  const R = w(480, 60, 480, 310, "R", 20)
  const B = w(480, 310, 100, 310, "B", 20)
  return { walls: [Top, L, M1, M2, D1, S, V, TR, R, B], S, L, M1, M2, V }
}

// одиночная свободная горизонтальная стена
export const sceneFree = (): { walls: Wall[]; A: Wall } => {
  const A = w(0, 0, 200, 0, "A", 20)
  return { walls: [A], A }
}

// F: две несоединённые стены
export const sceneF = (): { walls: Wall[]; A: Wall; B: Wall } => {
  const A = w(0, 0, 200, 0, "A", 20)
  const B = w(0, 100, 200, 100, "B", 20)
  return { walls: [A, B], A, B }
}
