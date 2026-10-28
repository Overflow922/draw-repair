import { arc, closed, roundedRect } from "./item-drawing"
import type { ItemDrawingFn } from "./item-drawing"

// Рисунок вида «Умывальник» (change add-washbasin, набросок пользователя — вариант B «Врезная прямоугольная»): рамка, скруглённая
// чаша со сливом, у задней стороны (y = 0, верхняя при угле 0) смеситель и два вентиля. Детали заданы в сантиметрах; смеситель, вентили
// и слив не растягиваются вместе с предметом, у предмета меньше размеров по умолчанию (60 × 48) все детали уменьшаются в одном отношении.
// Спеку см. в furniture-plan.

const WIDTH_CM = 60
const LENGTH_CM = 48
const FRAME_RADIUS_CM = 2
const BOWL_SIDE_CM = 6
const BOWL_FROM_BACK_CM = 14
const BOWL_FROM_FRONT_CM = 5
const BOWL_RADIUS_CM = 8
const DRAIN_RADIUS_CM = 1.6
const MIXER_RADIUS_CM = 2.2
const VALVE_RADIUS_CM = 1.5
const TAP_FROM_BACK_CM = 7
const VALVE_OFFSET_CM = 10

export const washbasinDrawing: ItemDrawingFn = ({ widthCm: w, lengthCm: l }, forcedScale) => {
  const k = forcedScale ?? Math.min(1, w / WIDTH_CM, l / LENGTH_CM)
  const cx = w / 2
  const frame = roundedRect(0, 0, w, l, FRAME_RADIUS_CM * k)
  const bowlTop = BOWL_FROM_BACK_CM * k
  const bowlBottom = l - BOWL_FROM_FRONT_CM * k
  const bowl = roundedRect(BOWL_SIDE_CM * k, bowlTop, w - 2 * BOWL_SIDE_CM * k, bowlBottom - bowlTop, BOWL_RADIUS_CM * k)
  const tapY = TAP_FROM_BACK_CM * k
  return {
    outline: frame,
    lines: [
      closed(frame),
      closed(bowl),
      arc(cx, (bowlTop + bowlBottom) / 2, DRAIN_RADIUS_CM * k, 0, 360),
      arc(cx, tapY, MIXER_RADIUS_CM * k, 0, 360),
      arc(cx - VALVE_OFFSET_CM * k, tapY, VALVE_RADIUS_CM * k, 0, 360),
      arc(cx + VALVE_OFFSET_CM * k, tapY, VALVE_RADIUS_CM * k, 0, 360),
    ],
  }
}
