import type { Point } from "../types"
import type { ItemDrawingFn } from "./item-drawing"

// Рисунок штор (change add-furniture-curtains, design «Число складок», «Масштаб», «Порядок линий»): гардина с n складками, карниз —
// нижний (при угле 0) край предмета. Числа в сантиметрах в системе предмета 300 × 13; все числа по y умножаются на k = min(1, l / 13),
// по x растёт только число складок n = max(1, round(3·w / (100·k))), шаг складки p = w / n.

const DEFAULT_LENGTH_CM = 13
const FOLD_PITCH_CM = 100 / 3
const WAVE_MID_CM = 3.25
const RAIL_UPPER_CM = 10
const RAIL_LOWER_CM = 11.5
const ARCH_RISE_CM = 7.5
const DIP_DEPTH_CM = 2.5
// доля шага складки, которую занимает половина провала по x
const DIP_HALF = 0.1
const WAVE_STEPS = 16
const ARCH_STEPS = 16
const DIP_STEPS = 8

const range = (count: number): number[] => Array.from({ length: count }, (_, i) => i)

export const curtainsDrawing: ItemDrawingFn = ({ widthCm: w, lengthCm: l }, forcedScale) => {
  const k = Math.min(forcedScale ?? 1, l / DEFAULT_LENGTH_CM)
  const folds = Math.max(1, Math.round(w / (FOLD_PITCH_CM * k)))
  const p = w / folds
  const gap = DIP_HALF * p

  // лицевая волна: гребень посередине складки, впадина на границе
  const wave: Point[] = range(folds * WAVE_STEPS + 1).map((i) => {
    const x = (i / WAVE_STEPS) * p
    return { x, y: k * WAVE_MID_CM * (1 + Math.cos((2 * Math.PI * x) / p)) }
  })

  // волна складок: арка каждой складки и полуэллипс провала между соседними арками
  const fold: Point[] = range(folds).flatMap((i) => {
    const x0 = i * p + gap
    const x1 = (i + 1) * p - gap
    const arch = range(ARCH_STEPS + 1).map((j) => {
      const t = j / ARCH_STEPS
      return { x: x0 + (x1 - x0) * t, y: k * (RAIL_UPPER_CM - ARCH_RISE_CM * Math.sin(Math.PI * t)) }
    })
    if (i === folds - 1) return arch
    const dip = range(DIP_STEPS - 1).map((j) => {
      const a = (Math.PI * (j + 1)) / DIP_STEPS
      return { x: x1 + gap - gap * Math.cos(a), y: k * (RAIL_UPPER_CM + DIP_DEPTH_CM * Math.sin(a)) }
    })
    return [...arch, ...dip]
  })

  // карниз: по n отрезков на каждой прямой, прерываются провалами
  const rail = (yCm: number): Point[][] =>
    range(folds).map((i) => {
      const from = i === 0 ? 0 : i * p + gap
      const to = i === folds - 1 ? w : (i + 1) * p - gap
      return [{ x: from, y: k * yCm }, { x: to, y: k * yCm }]
    })

  const outline = [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: l }, { x: 0, y: l }]
  return { outline, lines: [wave, fold, ...rail(RAIL_UPPER_CM), ...rail(RAIL_LOWER_CM)] }
}
