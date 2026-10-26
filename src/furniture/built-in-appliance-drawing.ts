import type { Point } from "../types"
import { arc, curve } from "./item-drawing"
import type { ItemDrawingFn } from "./item-drawing"
import { moduleFacade } from "./kitchen-module-drawing"
import type { ModuleHandle } from "./kitchen-module-drawing"

// Рисунки встраиваемой техники кухни (change add-furniture-appliances, references/oven-microwave.png фасадом вверх): кухонная колонна,
// духовой шкаф и микроволновка — модули 60 × 62 с фасадом кухонного шкафа. Значок прибора стоит в своей половине и в середине корпуса
// cy = (5·k + l) / 2, поэтому приборы одного места с совпадающими центрами вместе дают рисунок картинки.

const MODULE_WIDTH_CM = 60
const MODULE_LENGTH_CM = 62
const MODULE_HANDLE: ModuleHandle = { halfCm: 12.75, postOffsetCm: 8.75 }
const PANEL_CM = 5
const ICON_OFFSET_CM = 14
const ICON_RADIUS_CM = 13
// точек на период волнистой линии
const WAVE_STEPS = 24

const moduleScale = (w: number, l: number, forcedScale: number | undefined): number => Math.min(forcedScale ?? 1, w / MODULE_WIDTH_CM, l / MODULE_LENGTH_CM)
const iconY = (k: number, l: number): number => (PANEL_CM * k + l) / 2

// Кухонная колонна: знак X — половины диагоналей корпуса (от линии панели до заднего края) от углов к точке пересечения O
export const kitchenColumnDrawing: ItemDrawingFn = ({ widthCm: w, lengthCm: l }, forcedScale) => {
  const k = moduleScale(w, l, forcedScale)
  const o = { x: w / 2, y: iconY(k, l) }
  const { outline, lines } = moduleFacade(w, l, k, MODULE_HANDLE)
  const corners: Point[] = [{ x: 0, y: PANEL_CM * k }, { x: w, y: PANEL_CM * k }, { x: w, y: l }, { x: 0, y: l }]
  return { outline, lines: [...lines, ...corners.map((c) => [c, o])] }
}

// Духовой шкаф: круг справа и три волнистые черты жара сверху вниз (один период, отклонение 1, сначала влево)
export const ovenDrawing: ItemDrawingFn = ({ widthCm: w, lengthCm: l }, forcedScale) => {
  const k = moduleScale(w, l, forcedScale)
  const cx = w / 2 + ICON_OFFSET_CM * k
  const cy = iconY(k, l)
  const { outline, lines } = moduleFacade(w, l, k, MODULE_HANDLE)
  const heat = (dx: number): Point[] =>
    curve(WAVE_STEPS, (t) => ({ x: cx + dx * k - k * Math.sin(2 * Math.PI * t), y: cy - 5.5 * k + 11 * k * t }))
  return { outline, lines: [...lines, arc(cx, cy, ICON_RADIUS_CM * k, 0, 360), heat(-2.8), heat(0), heat(2.8)] }
}

// Микроволновка: круг слева и две волны (три периода, отклонение 1,5, концы внизу) на 2 выше и ниже центра
export const microwaveDrawing: ItemDrawingFn = ({ widthCm: w, lengthCm: l }, forcedScale) => {
  const k = moduleScale(w, l, forcedScale)
  const cx = w / 2 - ICON_OFFSET_CM * k
  const cy = iconY(k, l)
  const { outline, lines } = moduleFacade(w, l, k, MODULE_HANDLE)
  const wave = (dy: number): Point[] =>
    curve(3 * WAVE_STEPS, (t) => ({ x: cx - 9 * k + 18 * k * t, y: cy + dy * k + 1.5 * k * Math.cos(6 * Math.PI * t) }))
  return { outline, lines: [...lines, arc(cx, cy, ICON_RADIUS_CM * k, 0, 360), wave(-2), wave(2)] }
}
