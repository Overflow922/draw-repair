import type { Point } from "../types"
import type { ItemDrawing, ItemDrawingFn, ItemSize } from "./item-drawing"

// Рисунки шкафов (change add-furniture-wardrobes, design D2–D4): фасад вверху (линии направляющих или створок, перегородки, ручки),
// ниже штанги и пары вешалок. Шкафы различаются только числами, поэтому рисунок строится одной функцией по данным шкафа.
// Все числа спецификации — в сантиметрах в системе предмета размеров по умолчанию (начало — левый верхний угол при угле 0).

type Lean = "none" | "right" | "left"

interface WardrobeHandle {
  centreCm: number
  widthCm: number
}

interface WardrobeHanger {
  centreCm: number
  lean: Lean
}

interface WardrobeSpec {
  // ширина размеров по умолчанию Ш₀: положения вдоль ширины умножаются на w / Ш₀
  baseWidthCm: number
  // y линий фасада сверху вниз; ручки стоят на первой, ряды перегородок лежат между линиями (первый ряд — от y = 0 до первой линии)
  doorLinesCm: readonly number[]
  dividerRowsCm: readonly (readonly number[])[]
  handles: readonly WardrobeHandle[]
  rodYCm: number
  rodsCm: readonly (readonly [number, number])[]
  hangers: readonly WardrobeHanger[]
}

const DEFAULT_LENGTH_CM = 60
const HANDLE_HEIGHT_CM = 2
const HANGER_HALF_LENGTH_CM = 20.5
const HANGER_HALF_SPACING_CM = 2.2
const ROD_GAP_CM = 2.2
const LEAN_DEG = 15

const V: Lean = "none"
const R: Lean = "right"
const L: Lean = "left"

const hanger = (centreCm: number, lean: Lean): WardrobeHanger => ({ centreCm, lean })

const slidingSpec: WardrobeSpec = {
  baseWidthCm: 300,
  doorLinesCm: [3.75, 7.5],
  dividerRowsCm: [[71, 150, 229], [79, 210.5, 289.5]],
  handles: [{ centreCm: 4.75, widthCm: 3.5 }, { centreCm: 284.75, widthCm: 3.5 }],
  rodYCm: 33,
  rodsCm: [[2.5, 146.5], [152, 296.5]],
  hangers: [
    hanger(9.5, V), hanger(24.5, R), hanger(43, V), hanger(56.5, V), hanger(70.5, L), hanger(84, V), hanger(93.5, V),
    hanger(109, R), hanger(125.5, V), hanger(139, V), hanger(162.5, R), hanger(181, V), hanger(194.5, V), hanger(208, L),
    hanger(222, V), hanger(231.5, V), hanger(247, R), hanger(263.5, V), hanger(278, L), hanger(290.5, V),
  ],
}

const doubleSpec: WardrobeSpec = {
  baseWidthCm: 100,
  doorLinesCm: [3],
  dividerRowsCm: [[50]],
  handles: [{ centreCm: 40.5, widthCm: 7 }, { centreCm: 59.5, widthCm: 7 }],
  rodYCm: 30.2,
  rodsCm: [[19.5, 88]],
  hangers: [hanger(19.5, V), hanger(34.5, R), hanger(53, V), hanger(66.5, V), hanger(80.5, L)],
}

const leanAngle = (lean: Lean): number => (lean === "right" ? LEAN_DEG : lean === "left" ? -LEAN_DEG : 0)

// Пара вешалок: две линии, центр пары на штанге; точка линии — (c + a·cos φ + t·sin φ; y − a·sin φ + t·cos φ). Штанга разрывает
// каждую линию: верхняя часть кончается на 2,2 см выше штанги, нижняя начинается на штанге
function hangerLines(hanger: WardrobeHanger, centreX: number, rodY: number, k: number): Point[][] {
  const phi = (leanAngle(hanger.lean) * Math.PI) / 180
  const cos = Math.cos(phi)
  const sin = Math.sin(phi)
  return [-HANGER_HALF_SPACING_CM, HANGER_HALF_SPACING_CM].flatMap((a) => {
    const at = (t: number): Point => ({ x: centreX + (a * cos + t * sin) * k, y: rodY + (-a * sin + t * cos) * k })
    const upperEnd = (-ROD_GAP_CM + a * sin) / cos
    const lowerStart = (a * sin) / cos
    return [[at(-HANGER_HALF_LENGTH_CM), at(upperEnd)], [at(lowerStart), at(HANGER_HALF_LENGTH_CM)]]
  })
}

function wardrobeDrawing(spec: WardrobeSpec, { widthCm: w, lengthCm: l }: ItemSize, forcedScale?: number): ItemDrawing {
  const s = w / spec.baseWidthCm
  // детали уменьшаются как одно целое, если предмет уже или короче размеров по умолчанию; образец легенды (масштаб 1) тоже подгоняется
  const k = Math.min(forcedScale ?? 1, s, l / DEFAULT_LENGTH_CM)
  const px = (x: number): number => x * s
  const py = (y: number): number => y * k
  const outline = [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: l }, { x: 0, y: l }]
  const doors = spec.doorLinesCm.map((y) => [{ x: 0, y: py(y) }, { x: w, y: py(y) }])
  const edges = [0, ...spec.doorLinesCm]
  const dividers = spec.dividerRowsCm.flatMap((row, i) =>
    row.map((x) => [{ x: px(x), y: py(edges[i] ?? 0) }, { x: px(x), y: py(edges[i + 1] ?? 0) }]),
  )
  const base = py(spec.doorLinesCm[0] ?? 0)
  const top = py((spec.doorLinesCm[0] ?? 0) - HANDLE_HEIGHT_CM)
  const handles = spec.handles.map(({ centreCm, widthCm }) => {
    const half = (widthCm / 2) * k
    return [{ x: px(centreCm) - half, y: base }, { x: px(centreCm) - half, y: top }, { x: px(centreCm) + half, y: top }, { x: px(centreCm) + half, y: base }]
  })
  const rods = spec.rodsCm.map(([a, b]) => [{ x: px(a), y: py(spec.rodYCm) }, { x: px(b), y: py(spec.rodYCm) }])
  const hangers = spec.hangers.flatMap((h) => hangerLines(h, px(h.centreCm), py(spec.rodYCm), k))
  return { outline, lines: [[...outline, { x: 0, y: 0 }], ...doors, ...dividers, ...handles, ...rods, ...hangers] }
}

// Шкаф-купе по эскизу (300 × 60): две линии направляющих с перегородками створок, две ручки, две штанги и двадцать пар вешалок
export const slidingWardrobeDrawing: ItemDrawingFn = (size, forcedScale) => wardrobeDrawing(slidingSpec, size, forcedScale)

// Двустворчатый шкаф по эскизу (100 × 60): линия створок с перегородкой, две ручки, штанга и пять пар вешалок
export const doubleWardrobeDrawing: ItemDrawingFn = (size, forcedScale) => wardrobeDrawing(doubleSpec, size, forcedScale)
