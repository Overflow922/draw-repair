import { closed, roundedRect } from "./item-drawing"
import type { ItemDrawingFn } from "./item-drawing"

// Рисунок вида «Трап в стену» (change add-wall-shower-drain, набросок пользователя — вариант А «Щель в лицевой стороне»): контур лотка,
// тело лотка и щель шириной 1 см у лицевой стороны (y = l, нижняя при угле 0). Детали заданы в сантиметрах; щель держится у лицевой
// стороны и не растягивается, у предмета меньше размеров по умолчанию (70 × 8) все детали уменьшаются в одном отношении.
// Спеку см. в furniture-plan.

const WIDTH_CM = 70
const LENGTH_CM = 8
const OUTLINE_RADIUS_CM = 0.6
const INNER_RADIUS_CM = 0.3
const BODY_INSET_CM = 1.5
const BODY_FROM_FACE_CM = 3
const SLOT_INSET_CM = 3
const SLOT_FROM_FACE_CM = 2
const SLOT_WIDTH_CM = 1

export const wallShowerDrainDrawing: ItemDrawingFn = ({ widthCm: w, lengthCm: l }, forcedScale) => {
  const k = forcedScale ?? Math.min(1, w / WIDTH_CM, l / LENGTH_CM)
  const outline = roundedRect(0, 0, w, l, OUTLINE_RADIUS_CM * k)
  const bodyInset = BODY_INSET_CM * k
  const body = roundedRect(bodyInset, bodyInset, w - 2 * bodyInset, l - bodyInset - BODY_FROM_FACE_CM * k, INNER_RADIUS_CM * k)
  const slotInset = SLOT_INSET_CM * k
  const slot = roundedRect(slotInset, l - SLOT_FROM_FACE_CM * k, w - 2 * slotInset, SLOT_WIDTH_CM * k, INNER_RADIUS_CM * k)
  return { outline, lines: [closed(outline), closed(body), closed(slot)] }
}
