import type { Point } from "../types"
import { arc, closed, curve } from "./item-drawing"
import type { ItemDrawing, ItemDrawingFn } from "./item-drawing"

// Рисунки стиральной и сушильной машин (change add-furniture-appliances, references/washer-dryer.png): общий корпус с панелью
// управления у фасада (верхний край при угле 0) — две кнопки и дисплей со скруглёнными верхними углами — и барабан в своей половине
// на середине корпуса cy = (3·k + l) / 2, поэтому сушильная машина на стиральной с совпадающими центрами даёт рисунок картинки.

const MACHINE_SIDE_CM = 60
const PANEL_CM = 3
const DRUM_OFFSET_CM = 14
const DRUM_RADIUS_CM = 11.5
// линия воды: четыре периода по 12 точек; спираль: шаг 5° по углу
const WATER_STEPS = 48
const SPIRAL_TURN_DEG = 810
const SPIRAL_STEP_DEG = 5

interface Machine {
  k: number
  cy: number
  body: ItemDrawing
}

// четыре линии корпуса: корпус от верха панели, две кнопки без нижней стороны, дисплей; контур — прямоугольник предмета
function machineBody(w: number, l: number, forcedScale: number | undefined): Machine {
  const k = Math.min(forcedScale ?? 1, w / MACHINE_SIDE_CM, l / MACHINE_SIDE_CM)
  const top = PANEL_CM * k
  const button = (x0: number, x1: number): Point[] => [{ x: x0 * k, y: top }, { x: x0 * k, y: 0 }, { x: x1 * k, y: 0 }, { x: x1 * k, y: top }]
  const display = [
    { x: 19 * k, y: top },
    ...arc(20 * k, k, k, 180, 270),
    ...arc(w - 4.5 * k, k, k, 270, 360),
    { x: w - 3.5 * k, y: top },
  ]
  const outline = [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: l }, { x: 0, y: l }]
  const lines = [closed([{ x: 0, y: top }, { x: w, y: top }, { x: w, y: l }, { x: 0, y: l }]), button(2, 7), button(9, 14), display]
  return { k, cy: (top + l) / 2, body: { outline, lines } }
}

// Стиральная машина: барабан справа и линия воды по его диаметру (гребни на высоте центра, впадины на 1,6 ниже)
export const washerDrawing: ItemDrawingFn = ({ widthCm: w, lengthCm: l }, forcedScale) => {
  const { k, cy, body } = machineBody(w, l, forcedScale)
  const cx = w / 2 + DRUM_OFFSET_CM * k
  const left = cx - DRUM_RADIUS_CM * k
  const water = curve(WATER_STEPS, (t) => ({ x: left + 2 * DRUM_RADIUS_CM * k * t, y: cy + 0.8 * k * (1 - Math.cos(8 * Math.PI * t)) }))
  return { outline: body.outline, lines: [...body.lines, arc(cx, cy, DRUM_RADIUS_CM * k, 0, 360), water] }
}

// Сушильная машина: барабан слева и спираль против часовой стрелки на экране от 2 до радиуса барабана (конец — нижняя точка барабана)
export const dryerDrawing: ItemDrawingFn = ({ widthCm: w, lengthCm: l }, forcedScale) => {
  const { k, cy, body } = machineBody(w, l, forcedScale)
  const cx = w / 2 - DRUM_OFFSET_CM * k
  const spiral = curve(SPIRAL_TURN_DEG / SPIRAL_STEP_DEG, (t) => {
    const phi = ((180 - SPIRAL_TURN_DEG * t) * Math.PI) / 180
    const r = 2 * k + (DRUM_RADIUS_CM - 2) * k * t
    return { x: cx + r * Math.cos(phi), y: cy + r * Math.sin(phi) }
  })
  return { outline: body.outline, lines: [...body.lines, arc(cx, cy, DRUM_RADIUS_CM * k, 0, 360), spiral] }
}
