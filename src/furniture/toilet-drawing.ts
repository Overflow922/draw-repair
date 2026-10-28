import type { Point, ToiletSizes } from "../types"
import { arc, closed, curve, roundedRect } from "./item-drawing"
import type { ItemDrawingFn } from "./item-drawing"

// Рисунок вида «Унитаз» (change add-toilet, references/toilet.png): блок инсталляции у верхней стороны (при угле 0) с диагоналями
// и чаша по центру его ширины с носом у нижней стороны — контур, сиденье, отверстие и две дуги крышки. Детали заданы в сантиметрах
// и уменьшаются вместе с чашей, если она меньше размеров по умолчанию (38 × 52). Спеку «Унитаз» см. в furniture-plan.

const BOWL_WIDTH_CM = 38
const BOWL_LENGTH_CM = 52
const BLOCK_SHARE = 20 / 72
const SEAT_RADIUS_CM = 4
const SEAT_SIDE_CM = 6.5
const SEAT_BACK_CM = 16
const HOLE_FROM_NOSE_CM = 26
const HOLE_HALF_WIDTH_CM = 4.2
const HOLE_HALF_LENGTH_CM = 5.5
const LID_END_CM = 12
const LID_OUTER_APEX_CM = 3.7
const LID_INNER_APEX_CM = 8.6
const HOLE_STEPS = 48
const LID_STEPS = 24

// размеры без явных четырёх чисел (образец легенды, общие проверки каталога): блок во всю ширину и долю длины как у вида по умолчанию
function sizesOf(widthCm: number, lengthCm: number, toilet: ToiletSizes | undefined): ToiletSizes {
  if (toilet) return toilet
  const blockDepthCm = lengthCm * BLOCK_SHARE
  return { bowlWidthCm: Math.min(BOWL_WIDTH_CM, widthCm), bowlLengthCm: lengthCm - blockDepthCm, blockWidthCm: widthCm, blockDepthCm }
}

// дуга окружности через три точки: от a через m до b (концы точные)
function arcThrough(a: Point, m: Point, b: Point, steps: number): Point[] {
  const d = 2 * (a.x * (m.y - b.y) + m.x * (b.y - a.y) + b.x * (a.y - m.y))
  const sq = (p: Point): number => p.x * p.x + p.y * p.y
  const cx = (sq(a) * (m.y - b.y) + sq(m) * (b.y - a.y) + sq(b) * (a.y - m.y)) / d
  const cy = (sq(a) * (b.x - m.x) + sq(m) * (a.x - b.x) + sq(b) * (m.x - a.x)) / d
  const r = Math.hypot(a.x - cx, a.y - cy)
  const angle = (p: Point): number => Math.atan2(p.y - cy, p.x - cx)
  const from = angle(a)
  const mid = angle(m)
  const to = angle(b)
  // направление обхода — то, при котором m лежит между a и b
  const wrap = (v: number): number => ((v % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
  const sweep = wrap(mid - from) < wrap(to - from) ? wrap(to - from) : wrap(to - from) - 2 * Math.PI
  return curve(steps, (t) => {
    if (t === 0) return a
    if (t === 1) return b
    const th = from + sweep * t
    return { x: cx + r * Math.cos(th), y: cy + r * Math.sin(th) }
  })
}

export const toiletDrawing: ItemDrawingFn = ({ widthCm: w, lengthCm: l, toilet }, forcedScale) => {
  const { bowlWidthCm: bw, bowlLengthCm: bl, blockDepthCm: bd } = sizesOf(w, l, toilet)
  const k = Math.min(forcedScale ?? 1, bw / BOWL_WIDTH_CM, bl / BOWL_LENGTH_CM)
  const cx = w / 2
  const left = cx - bw / 2
  const right = cx + bw / 2
  const noseCenterY = l - bw / 2

  const block = closed([{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: bd }, { x: 0, y: bd }])
  const diagonals: Point[][] = [
    [{ x: 0, y: 0 }, { x: w, y: bd }],
    [{ x: w, y: 0 }, { x: 0, y: bd }],
  ]
  const bowl = [{ x: left, y: bd }, ...arc(cx, noseCenterY, bw / 2, 180, 0), { x: right, y: bd }]
  const seat = closed(roundedRect(left + SEAT_SIDE_CM * k, bd + SEAT_BACK_CM * k, bw - 2 * SEAT_SIDE_CM * k, bl - (SEAT_BACK_CM + SEAT_SIDE_CM) * k, SEAT_RADIUS_CM * k))
  const hole = curve(HOLE_STEPS, (t) => ({
    x: cx + HOLE_HALF_WIDTH_CM * k * Math.cos(2 * Math.PI * t),
    y: l - HOLE_FROM_NOSE_CM * k + HOLE_HALF_LENGTH_CM * k * Math.sin(2 * Math.PI * t),
  }))
  const lidEnd = bd + LID_END_CM * k
  const lid = (apexCm: number): Point[] => arcThrough({ x: left, y: lidEnd }, { x: cx, y: bd + apexCm * k }, { x: right, y: lidEnd }, LID_STEPS)

  // Т-образный силуэт: блок и чаша; по нему обводятся выделение и ластик
  const outline: Point[] = [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: bd }, { x: right, y: bd }, ...arc(cx, noseCenterY, bw / 2, 0, 180), { x: left, y: bd }, { x: 0, y: bd }]
  return { outline, lines: [block, ...diagonals, bowl, seat, hole, lid(LID_OUTER_APEX_CM), lid(LID_INNER_APEX_CM)] }
}
