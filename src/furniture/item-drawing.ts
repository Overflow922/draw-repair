import type { Point } from "../types"

// Рисунки видов мебели (change furniture-line-drawings, design D1, D2): схематичный вид сверху — силуэт и линии в сантиметрах
// в системе координат предмета при угле 0 (начало — левый верхний угол прямоугольника, X — вдоль ширины, Y — вдоль длины).
// Чистая геометрия: ни canvas, ни каталога не знает; замкнутая линия повторяет первую точку в конце.

export interface ItemDrawing {
  // замкнутый силуэт без повторной первой точки: по нему обводятся выделение и ластик
  outline: Point[]
  // все линии рисунка, силуэт входит
  lines: Point[][]
}

export interface ItemSize {
  widthCm: number
  lengthCm: number
}

// detailScale — коэффициент деталей вместо вычисляемого по размеру предмета: образец легенды рисует габариты, подогнанные под образец,
// с деталями в полном размере (design D4)
export type ItemDrawingFn = (size: ItemSize, detailScale?: number) => ItemDrawing

const ARC_STEP_DEG = 5

const closed = (poly: Point[]): Point[] => (poly[0] ? [...poly, poly[0]] : poly)

// дуга окружности с центром (cx, cy), углы в градусах (ось Y вниз, 0° — вправо, 90° — вниз), шаг не больше ARC_STEP_DEG
function arc(cx: number, cy: number, r: number, fromDeg: number, toDeg: number): Point[] {
  const steps = Math.max(1, Math.ceil(Math.abs(toDeg - fromDeg) / ARC_STEP_DEG))
  return Array.from({ length: steps + 1 }, (_, i) => {
    const a = ((fromDeg + ((toDeg - fromDeg) * i) / steps) * Math.PI) / 180
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
  })
}

// прямоугольник со скруглёнными углами по часовой, начиная с левого верхнего скругления; радиус ограничен половиной стороны
function roundedRect(x: number, y: number, w: number, h: number, radius: number): Point[] {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2))
  if (r === 0) return [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }]
  return [
    ...arc(x + r, y + r, r, 180, 270),
    ...arc(x + w - r, y + r, r, 270, 360),
    ...arc(x + w - r, y + h - r, r, 0, 90),
    ...arc(x + r, y + h - r, r, 90, 180),
  ]
}

// Все детали уменьшаются в отношении меньшей стороны предмета к меньшей стороне размеров по умолчанию, если предмет меньше
const detailScale = (size: ItemSize, defaultMinSideCm: number): number => Math.min(1, Math.min(size.widthCm, size.lengthCm) / defaultMinSideCm)

// Стол: контур со скруглением 10 см и внутренняя линия кромки с отступом 6 см (скругление 5 см)
export const tableDrawing: ItemDrawingFn = ({ widthCm: w, lengthCm: l }, forcedScale) => {
  const k = forcedScale ?? detailScale({ widthCm: w, lengthCm: l }, 80)
  const edge = 6 * k
  const outline = roundedRect(0, 0, w, l, 10 * k)
  const inner = roundedRect(edge, edge, w - 2 * edge, l - 2 * edge, 5 * k)
  return { outline, lines: [closed(outline), closed(inner)] }
}

// Стул: силуэт с дугой радиуса 18 см у верхних углов, внутренняя линия спинки и подлокотников (отступ 7 см от боков и верха) и
// сиденье со скруглением 6 см с отступами 11 см от боков, 13 см от верха и 4 см от низа
export const chairDrawing: ItemDrawingFn = ({ widthCm: w, lengthCm: l }, forcedScale) => {
  const k = forcedScale ?? detailScale({ widthCm: w, lengthCm: l }, 45)
  const corner = 18 * k
  const arm = 7 * k
  const outline = [
    { x: 0, y: l },
    ...arc(corner, corner, corner, 180, 270),
    ...arc(w - corner, corner, corner, 270, 360),
    { x: w, y: l },
  ]
  const back = [
    { x: arm, y: l },
    ...arc(corner, corner, corner - arm, 180, 270),
    ...arc(w - corner, corner, corner - arm, 270, 360),
    { x: w - arm, y: l },
  ]
  const seat = roundedRect(11 * k, 13 * k, w - 22 * k, l - 17 * k, 6 * k)
  return { outline, lines: [closed(outline), back, closed(seat)] }
}

// Диван: контур со скруглением 10 см и сиденье со скруглением 6 см с отступами 16 см от боков (подлокотники), 22 см от верха (спинка)
// и 8 см от низа
export const sofaDrawing: ItemDrawingFn = ({ widthCm: w, lengthCm: l }, forcedScale) => {
  const k = forcedScale ?? detailScale({ widthCm: w, lengthCm: l }, 90)
  const side = 16 * k
  const top = 22 * k
  const bottom = 8 * k
  const outline = roundedRect(0, 0, w, l, 10 * k)
  const seat = roundedRect(side, top, w - 2 * side, l - top - bottom, 6 * k)
  return { outline, lines: [closed(outline), closed(seat)] }
}
