import type { ItemDrawingFn } from "./item-drawing"

// Рисунок кухонного шкафа (change add-furniture-kitchen-cabinet-fridge, design «Масштаб шкафа»): фасад — верхний (при угле 0) край,
// у него линия панели, а над фасадом стоит ручка — планка на двух стойках. Числа в сантиметрах в системе предмета 60 × 62;
// все числа умножаются на k = min(1, w / 60, l / 62), положения вдоль ширины — от середины ширины.

const DEFAULT_WIDTH_CM = 60
const DEFAULT_LENGTH_CM = 62
const FACADE_CM = 2
const PANEL_CM = 5
const HANDLE_HALF_CM = 12.75
const POST_OFFSET_CM = 8.75

export const kitchenCabinetDrawing: ItemDrawingFn = ({ widthCm: w, lengthCm: l }, forcedScale) => {
  const k = Math.min(forcedScale ?? 1, w / DEFAULT_WIDTH_CM, l / DEFAULT_LENGTH_CM)
  const mid = w / 2
  const facade = k * FACADE_CM
  const post = (dx: number) => [{ x: mid + dx * k, y: 0 }, { x: mid + dx * k, y: facade }]
  const body = [{ x: 0, y: facade }, { x: w, y: facade }, { x: w, y: l }, { x: 0, y: l }, { x: 0, y: facade }]
  const outline = [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: l }, { x: 0, y: l }]
  const lines = [
    body,
    [{ x: 0, y: k * PANEL_CM }, { x: w, y: k * PANEL_CM }],
    [{ x: mid - HANDLE_HALF_CM * k, y: 0 }, { x: mid + HANDLE_HALF_CM * k, y: 0 }],
    post(-POST_OFFSET_CM),
    post(POST_OFFSET_CM),
  ]
  return { outline, lines }
}
