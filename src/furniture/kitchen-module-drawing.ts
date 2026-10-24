import type { Point } from "../types"
import { arc, bulge, closed } from "./item-drawing"
import type { ItemDrawing, ItemDrawingFn } from "./item-drawing"

// Рисунки встроенных объектов кухни (change add-furniture-kitchen-objects, design «Фасад модуля — общая часть с кухонным шкафом»):
// модуль с фасадом как у кухонного шкафа — фасад вверху (при угле 0), ручка-планка на двух стойках над ним, — и значок внутри.
// Числа в сантиметрах в системе предмета; детали умножаются на k, положения вдоль ширины — от середины m = w / 2.

const FACADE_CM = 2
const PANEL_CM = 5

export interface ModuleHandle {
  // половина длины планки и отступ стоек от середины ширины
  halfCm: number
  postOffsetCm: number
}

// пять линий фасада модуля: корпус, линия панели, планка ручки, левая и правая стойки; контур — прямоугольник предмета
export function moduleFacade(w: number, l: number, k: number, handle: ModuleHandle): ItemDrawing {
  const mid = w / 2
  const facade = k * FACADE_CM
  const post = (dx: number): Point[] => [{ x: mid + dx * k, y: 0 }, { x: mid + dx * k, y: facade }]
  const outline = [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: l }, { x: 0, y: l }]
  const lines = [
    closed([{ x: 0, y: facade }, { x: w, y: facade }, { x: w, y: l }, { x: 0, y: l }]),
    [{ x: 0, y: k * PANEL_CM }, { x: w, y: k * PANEL_CM }],
    [{ x: mid - handle.halfCm * k, y: 0 }, { x: mid + handle.halfCm * k, y: 0 }],
    post(-handle.postOffsetCm),
    post(handle.postOffsetCm),
  ]
  return { outline, lines }
}

// Винный шкаф 30 × 62: бутылка горлышком к фасаду — венчик, бутылка (горлышко, плечи, тело со скруглённым дном), края этикетки
const WINE_WIDTH_CM = 30
const WINE_LENGTH_CM = 62
const WINE_HANDLE: ModuleHandle = { halfCm: 7, postOffsetCm: 4.5 }

export const wineCabinetDrawing: ItemDrawingFn = ({ widthCm: w, lengthCm: l }, forcedScale) => {
  const k = Math.min(forcedScale ?? 1, w / WINE_WIDTH_CM, l / WINE_LENGTH_CM)
  const m = w / 2
  const at = (dx: number, y: number): Point => ({ x: m + dx * k, y: y * k })
  const { outline, lines } = moduleFacade(w, l, k, WINE_HANDLE)
  const lip = closed([at(-2, 12), at(2, 12), at(2, 14), at(-2, 14)])
  const bottle = [
    at(-1.4, 14),
    at(-1.4, 21),
    at(-4.2, 27),
    ...arc(m - 1.2 * k, 52 * k, 3 * k, 180, 90),
    ...arc(m + 1.2 * k, 52 * k, 3 * k, 90, 0),
    at(4.2, 27),
    at(1.4, 21),
    at(1.4, 14),
  ]
  const label = (y: number): Point[] => [at(-4.2, y), at(4.2, y)]
  return { outline, lines: [...lines, lip, bottle, label(34), label(46)] }
}

// Посудомойка 60 × 62: фасад кухонного шкафа, бокал (чаша, ножка, подставка) и вилка (контур и два средних зубца)
const DISHWASHER_WIDTH_CM = 60
const DISHWASHER_LENGTH_CM = 62
const DISHWASHER_HANDLE: ModuleHandle = { halfCm: 12.75, postOffsetCm: 8.75 }

// нижняя половина эллипса с центром (cx, cy) от правого конца к левому
const lowerHalfEllipse = (cx: number, cy: number, rx: number, ry: number): Point[] => arc(0, 0, 1, 0, 180).map((p) => ({ x: cx + rx * p.x, y: cy + ry * p.y }))

export const dishwasherDrawing: ItemDrawingFn = ({ widthCm: w, lengthCm: l }, forcedScale) => {
  const k = Math.min(forcedScale ?? 1, w / DISHWASHER_WIDTH_CM, l / DISHWASHER_LENGTH_CM)
  const g = w / 2 - 7 * k
  const f = w / 2 + 9 * k
  const { outline, lines } = moduleFacade(w, l, k, DISHWASHER_HANDLE)
  const cup = [{ x: g - 6.5 * k, y: 14 * k }, ...lowerHalfEllipse(g, 14 * k, 6.5 * k, 16 * k)]
  const stem = [{ x: g, y: 30 * k }, { x: g, y: 44 * k }]
  const foot = [{ x: g - 5.5 * k, y: 46 * k }, ...bulge(g + 5.5 * k, g - 5.5 * k, 46 * k, 1.5 * k)]
  const fx = (dx: number, y: number): Point => ({ x: f + dx * k, y: y * k })
  const fork = [fx(-3.5, 14), fx(-3.5, 22), fx(-0.9, 27.5), ...arc(f, 45 * k, 0.9 * k, 180, 0), fx(0.9, 27.5), fx(3.5, 22), fx(3.5, 14)]
  const tine = (dx: number): Point[] => [fx(dx, 14), fx(dx, 22)]
  return { outline, lines: [...lines, cup, stem, foot, fork, tine(-1.2), tine(1.2)] }
}
