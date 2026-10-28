import type { Point } from "../types"
import { arc, closed, roundedRect } from "./item-drawing"
import type { ItemDrawingFn } from "./item-drawing"

// Рисунок вида «Тропический душ» (change add-furniture-tropical-shower, набросок пользователя — вариант A «Сетка форсунок»): корпус лейки,
// панель с отступом и сетка форсунок 6 × 4 по центру предмета. Детали заданы в сантиметрах; сетка не растягивается вместе с предметом,
// а у предмета меньше размеров по умолчанию (40 × 30) все детали уменьшаются в одном отношении. Спеку см. в furniture-plan.

const WIDTH_CM = 40
const LENGTH_CM = 30
const BODY_RADIUS_CM = 3
const PANEL_INSET_CM = 3
const PANEL_RADIUS_CM = 1.8
const NOZZLE_RADIUS_CM = 0.9
const NOZZLE_COLUMNS = 6
const NOZZLE_ROWS = 4
const NOZZLE_STEP_X_CM = 4.8
const NOZZLE_STEP_Y_CM = 4

export const tropicalShowerDrawing: ItemDrawingFn = ({ widthCm: w, lengthCm: l }, forcedScale) => {
  const k = forcedScale ?? Math.min(1, w / WIDTH_CM, l / LENGTH_CM)
  const outline = roundedRect(0, 0, w, l, BODY_RADIUS_CM * k)
  const inset = PANEL_INSET_CM * k
  const panel = roundedRect(inset, inset, w - 2 * inset, l - 2 * inset, PANEL_RADIUS_CM * k)
  const nozzles: Point[][] = []
  for (let j = 0; j < NOZZLE_ROWS; j++) {
    for (let i = 0; i < NOZZLE_COLUMNS; i++) {
      const cx = w / 2 + (i - (NOZZLE_COLUMNS - 1) / 2) * NOZZLE_STEP_X_CM * k
      const cy = l / 2 + (j - (NOZZLE_ROWS - 1) / 2) * NOZZLE_STEP_Y_CM * k
      nozzles.push(arc(cx, cy, NOZZLE_RADIUS_CM * k, 0, 360))
    }
  }
  return { outline, lines: [closed(outline), closed(panel), ...nozzles] }
}
