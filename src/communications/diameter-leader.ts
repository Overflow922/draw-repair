import type { Point } from "../types"

// Выноска диаметра стояка по ГОСТ (change add-communications): размерная линия под 45° через центр, стрелки упираются
// в окружность с двух сторон, у правого верхнего конца — выносная линия с полкой, над полкой «Ø…». Всё в экранных px.

export const LEADER_PX = 18 // длина выносной линии от окружности до полки
export const TAIL_PX = 14 // выступ размерной линии за окружность с противоположной стороны
const SHELF_PAD_PX = 6 // запас полки за текстом
const TEXT_GAP_PX = 3 // зазор между полкой и низом текста

const DIAGONAL = Math.SQRT1_2

export interface DiameterLeader {
  tail: Point // внешний конец размерной линии (левый нижний)
  nearTip: Point // остриё стрелки у левого нижнего края окружности
  farTip: Point // остриё стрелки у правого верхнего края окружности
  elbow: Point // начало полки
  shelfEnd: Point
  textCenter: Point
  dir: Point // единичный вектор вдоль размерной линии вправо вверх
}

// center — центр окружности на экране, radiusPx — её радиус, textWidthPx и labelPx — размер текста
export function diameterLeader(center: Point, radiusPx: number, textWidthPx: number, labelPx: number): DiameterLeader {
  const dir = { x: DIAGONAL, y: -DIAGONAL }
  const farTip = { x: center.x + dir.x * radiusPx, y: center.y + dir.y * radiusPx }
  const nearTip = { x: center.x - dir.x * radiusPx, y: center.y - dir.y * radiusPx }
  const tail = { x: nearTip.x - dir.x * TAIL_PX, y: nearTip.y - dir.y * TAIL_PX }
  const elbow = { x: farTip.x + dir.x * LEADER_PX, y: farTip.y + dir.y * LEADER_PX }
  const shelfLength = textWidthPx + SHELF_PAD_PX
  return {
    tail,
    nearTip,
    farTip,
    elbow,
    shelfEnd: { x: elbow.x + shelfLength, y: elbow.y },
    textCenter: { x: elbow.x + shelfLength / 2, y: elbow.y - TEXT_GAP_PX - labelPx / 2 },
    dir,
  }
}
