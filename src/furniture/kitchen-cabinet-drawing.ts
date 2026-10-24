import type { ItemDrawingFn } from "./item-drawing"
import { moduleFacade } from "./kitchen-module-drawing"

// Рисунок кухонного шкафа (change add-furniture-kitchen-cabinet-fridge, design «Масштаб шкафа»): фасад — верхний (при угле 0) край,
// у него линия панели, а над фасадом стоит ручка — планка на двух стойках. Числа в сантиметрах в системе предмета 60 × 62;
// все числа умножаются на k = min(1, w / 60, l / 62), положения вдоль ширины — от середины ширины. Фасад общий с встроенными
// объектами кухни (change add-furniture-kitchen-objects).

const DEFAULT_WIDTH_CM = 60
const DEFAULT_LENGTH_CM = 62

export const kitchenCabinetDrawing: ItemDrawingFn = ({ widthCm: w, lengthCm: l }, forcedScale) => {
  const k = Math.min(forcedScale ?? 1, w / DEFAULT_WIDTH_CM, l / DEFAULT_LENGTH_CM)
  return moduleFacade(w, l, k, { halfCm: 12.75, postOffsetCm: 8.75 })
}
