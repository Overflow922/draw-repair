import type { Point } from "./types"

// Векторный тайл узора «Дерево» (change new-wall-materials, design D4): волнистые линии по направлению волокон и «линзы»
// (удлинённые заострённые петли) — по образцу заказчика. Всё в мм листа. Тайл бесшовный: линия, вышедшая за край периода,
// продолжается началом той же линии в соседнем тайле (сдвиг на период по x и y), поэтому повтор тайла сеткой даёт
// непрерывный узор без швов и пропусков.

export interface TilePattern {
  widthMm: number // период по x
  heightMm: number // период по y
  lines: readonly (readonly Point[])[] // ломаные узора; могут выходить за прямоугольник периода по высоте
}

const WIDTH_MM = 12
const HEIGHT_MM = 8
// направление волокон: за период по x линия уходит на два периода по y, то есть под углом ≈ 53° к оси x
const FLOW = { x: WIDTH_MM, y: 2 * HEIGHT_MM }
const FLOW_LEN = Math.hypot(FLOW.x, FLOW.y)
const DIR = { x: FLOW.x / FLOW_LEN, y: FLOW.y / FLOW_LEN }
const NORMAL = { x: -DIR.y, y: DIR.x }

const WAVE_AMPLITUDE_MM = 0.5
const WAVE_STEPS = 40
const LENS_HALF_LENGTH_MM = 1.2
const LENS_HALF_WIDTH_MM = 0.4
const LENS_STEPS = 8

// волнистая линия волокон: от (0, y0) за период по x; боковое смещение возвращается к началу, поэтому концы стыкуются
function flowLine(y0: number, phase: number): Point[] {
  const out: Point[] = []
  for (let i = 0; i <= WAVE_STEPS; i++) {
    const t = i / WAVE_STEPS
    const lateral = WAVE_AMPLITUDE_MM * Math.sin(2 * Math.PI * t + phase)
    out.push({ x: t * FLOW.x + NORMAL.x * lateral, y: y0 + t * FLOW.y + NORMAL.y * lateral })
  }
  return out
}

// «линза» с центром в (cx, cy): замкнутая петля вдоль направления волокон с заострёнными концами
function lens(cx: number, cy: number): Point[] {
  const at = (along: number, lateral: number): Point => ({
    x: cx + DIR.x * along + NORMAL.x * lateral,
    y: cy + DIR.y * along + NORMAL.y * lateral,
  })
  const profile = (s: number): number => LENS_HALF_WIDTH_MM * (1 - s * s)
  const out: Point[] = []
  for (let i = -LENS_STEPS; i <= LENS_STEPS; i++) {
    const s = i / LENS_STEPS
    out.push(at(LENS_HALF_LENGTH_MM * s, profile(s)))
  }
  for (let i = LENS_STEPS - 1; i >= -LENS_STEPS; i--) {
    const s = i / LENS_STEPS
    out.push(at(LENS_HALF_LENGTH_MM * s, -profile(s)))
  }
  return out
}

export const WOOD_TILE: TilePattern = {
  widthMm: WIDTH_MM,
  heightMm: HEIGHT_MM,
  lines: [flowLine(0, 0), flowLine(HEIGHT_MM / 2, 2.2), lens(3, 6), lens(9, 2)],
}

export interface TileExtent {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export function tileExtent(tile: TilePattern): TileExtent {
  const pts = tile.lines.flat()
  return {
    minX: Math.min(...pts.map((p) => p.x)),
    minY: Math.min(...pts.map((p) => p.y)),
    maxX: Math.max(...pts.map((p) => p.x)),
    maxY: Math.max(...pts.map((p) => p.y)),
  }
}
