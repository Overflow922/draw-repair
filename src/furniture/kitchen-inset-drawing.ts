import type { Point } from "../types"
import { arc, closed, roundedRect } from "./item-drawing"
import type { ItemDrawingFn } from "./item-drawing"

// Рисунки врезных объектов кухни (change add-furniture-kitchen-objects): как на картинке, длинной стороной вдоль фасада, фасад —
// верхний (при угле 0) край. Числа в сантиметрах в системе предмета; детали умножаются на k.

const circle = (cx: number, cy: number, r: number): Point[] => arc(cx, cy, r, 0, 360)

// Варочная панель 52 × 30: контур со скруглением, большая конфорка у левого края, малая за ней, две ручки у правого края;
// всё на середине длины
const HOB_WIDTH_CM = 52
const HOB_LENGTH_CM = 30

export const hobDrawing: ItemDrawingFn = ({ widthCm: w, lengthCm: l }, forcedScale) => {
  const k = Math.min(forcedScale ?? 1, w / HOB_WIDTH_CM, l / HOB_LENGTH_CM)
  const c = l / 2
  const outline = roundedRect(0, 0, w, l, 1.5 * k)
  const knobX = w - 4.5 * k
  const lines = [
    closed(outline),
    circle(14 * k, c, 8.3 * k),
    circle(14 * k, c, 6 * k),
    circle(35 * k, c, 5.6 * k),
    circle(35 * k, c, 3.8 * k),
    circle(knobX, c - 3 * k, 1.2 * k),
    circle(knobX, c + 3 * k, 1.2 * k),
  ]
  return { outline, lines }
}

// Раковина 45 × 40: бортик, чаша у фасада, у задней стороны (нижний край) — рифление крыла и смеситель: шайба и рычаг к чаше.
// Нижняя сторона чаши прервана под рычагом (design «Рычаг раковины над чашей»), концы рычага лежат на внешней окружности шайбы.
const SINK_WIDTH_CM = 45
const SINK_LENGTH_CM = 40
const LEVER_HALF_CM = 1.5
const WASHER_R_CM = 3

export const sinkDrawing: ItemDrawingFn = ({ widthCm: w, lengthCm: l }, forcedScale) => {
  const k = Math.min(forcedScale ?? 1, w / SINK_WIDTH_CM, l / SINK_LENGTH_CM)
  const m = w / 2
  const outline = roundedRect(0, 0, w, l, 3 * k)

  const left = 3.8 * k
  const right = w - 3.8 * k
  const top = 4.7 * k
  const bottom = l - 10 * k
  const r = 2.5 * k
  const lever = LEVER_HALF_CM * k
  const bowl = [
    { x: m - lever, y: bottom },
    ...arc(left + r, bottom - r, r, 90, 180),
    ...arc(left + r, top + r, r, 180, 270),
    ...arc(right - r, top + r, r, 270, 360),
    ...arc(right - r, bottom - r, r, 0, 90),
    { x: m + lever, y: bottom },
  ]

  const grooveYs = [7.9, 5.6, 3.4].map((d) => l - d * k)
  const groove = (x0: number, x1: number) => (y: number): Point[] => [{ x: x0, y }, { x: x1, y }]
  const grooves = [...grooveYs.map(groove(5.4 * k, 13.9 * k)), ...grooveYs.map(groove(w - 13.9 * k, w - 5.4 * k))]

  const washerY = l - 5.6 * k
  const leverEndY = washerY - Math.sqrt(WASHER_R_CM ** 2 - LEVER_HALF_CM ** 2) * k
  const leverTipY = l - 21.2 * k
  const leverLine = [{ x: m - lever, y: leverEndY }, ...arc(m, leverTipY, lever, 180, 360), { x: m + lever, y: leverEndY }]

  const lines = [closed(outline), bowl, ...grooves, circle(m, washerY, WASHER_R_CM * k), circle(m, washerY, k), leverLine]
  return { outline, lines }
}
