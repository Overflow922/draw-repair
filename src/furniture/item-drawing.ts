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

// Дуга-парабола от (x1, y) к (x0, y), вершина поднята на rise над y посередине (ось Y вниз)
function bulge(x1: number, x0: number, y: number, rise: number): Point[] {
  const steps = 12
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps
    return { x: x1 + (x0 - x1) * t, y: y - 4 * rise * t * (1 - t) }
  })
}

// Диван по эскизу (200 × 80): подлокотники шириной 18 см с верхом на 4 см ниже спинки, три подушки спинки между ними
// от верха до линии сиденья (23 см от низа), переднее ребро подушки — дуга высотой 5 см, у переднего края планка 17 см
// с отступами 14 см от боков и 6 см от низа
export const sofaDrawing: ItemDrawingFn = ({ widthCm: w, lengthCm: l }, forcedScale) => {
  const k = forcedScale ?? detailScale({ widthCm: w, lengthCm: l }, 80)
  const arm = 18 * k
  const armTop = 4 * k
  const corner = 2 * k
  const baseCorner = 3 * k
  const seatY = l - 23 * k
  const outline = [
    ...arc(corner, armTop + corner, corner, 180, 270),
    { x: arm, y: armTop },
    ...arc(arm + corner, corner, corner, 180, 270),
    ...arc(w - arm - corner, corner, corner, 270, 360),
    { x: w - arm, y: armTop },
    ...arc(w - corner, armTop + corner, corner, 270, 360),
    ...arc(w - baseCorner, l - baseCorner, baseCorner, 0, 90),
    ...arc(baseCorner, l - baseCorner, baseCorner, 90, 180),
  ]
  const cushionWidth = (w - 2 * arm) / 3
  const cushion = (n: number): Point[] => {
    const x0 = arm + cushionWidth * n
    const x1 = x0 + cushionWidth
    return [
      ...arc(x0 + corner, corner, corner, 180, 270),
      ...arc(x1 - corner, corner, corner, 270, 360),
      ...bulge(x1, x0, seatY, 5 * k),
    ]
  }
  const rail = roundedRect(14 * k, seatY, w - 28 * k, 17 * k, 1.5 * k)
  return { outline, lines: [closed(outline), closed(cushion(0)), closed(cushion(1)), closed(cushion(2)), closed(rail)] }
}

// Штрихи пунктира вдоль замкнутой ломаной: штрих dash, промежуток gap, начиная с её первой точки; штрих не прерывается на углах.
// Каждый штрих — отдельная ломаная, поэтому пунктир рисуется теми же линиями рисунка, что и сплошные
function dashed(ring: readonly Point[], dash: number, gap: number): Point[][] {
  const strokes: Point[][] = []
  let stroke: Point[] | null = null
  let drawing = true
  let left = dash
  for (let i = 1; i < ring.length; i++) {
    const a = ring[i - 1]
    const b = ring[i]
    if (!a || !b) continue
    const length = Math.hypot(b.x - a.x, b.y - a.y)
    const at = (t: number): Point => ({ x: a.x + ((b.x - a.x) * t) / length, y: a.y + ((b.y - a.y) * t) / length })
    let t = 0
    while (length - t > 1e-9) {
      const step = Math.min(left, length - t)
      if (drawing) {
        stroke ??= [at(t)]
        stroke.push(at(t + step))
      }
      t += step
      left -= step
      if (left <= 1e-9) {
        if (drawing && stroke) strokes.push(stroke)
        stroke = null
        drawing = !drawing
        left = drawing ? dash : gap
      }
    }
  }
  if (stroke) strokes.push(stroke)
  return strokes
}

// Письменный стол по эскизу (100 × 50): контур со скруглением 2 см, две пунктирные ножки 3 см шириной с отступом 3,5 см от боков и
// 4 см от верха и низа (штрих 1,5 см, промежуток 1 см) и сплошная линия между ножками на 4 см выше нижнего края (от 10 см от боков)
export const deskDrawing: ItemDrawingFn = ({ widthCm: w, lengthCm: l }, forcedScale) => {
  const k = forcedScale ?? detailScale({ widthCm: w, lengthCm: l }, 50)
  const outline = roundedRect(0, 0, w, l, 2 * k)
  const leg = (x: number): Point[][] =>
    dashed(closed([{ x, y: 4 * k }, { x: x + 3 * k, y: 4 * k }, { x: x + 3 * k, y: l - 4 * k }, { x, y: l - 4 * k }]), 1.5 * k, 1 * k)
  const front = [{ x: 10 * k, y: l - 4 * k }, { x: w - 10 * k, y: l - 4 * k }]
  return { outline, lines: [closed(outline), ...leg(3.5 * k), ...leg(w - 6.5 * k), front] }
}

// Колёсико кресла: центр и точка на подлокотнике или теле, откуда идёт спица (у верхнего колёсика спицы нет — её закрывает тело)
interface OfficeChairCaster {
  centre: Point
  spokeFrom: Point | null
}

const OFFICE_CHAIR_CASTERS: readonly OfficeChairCaster[] = [
  { centre: { x: 30, y: 3 }, spokeFrom: null },
  { centre: { x: 4, y: 23 }, spokeFrom: { x: 9, y: 24.3 } },
  { centre: { x: 56, y: 23 }, spokeFrom: { x: 51, y: 24.3 } },
  { centre: { x: 14, y: 55.5 }, spokeFrom: { x: 17, y: 50 } },
  { centre: { x: 46, y: 55.5 }, spokeFrom: { x: 43, y: 50 } },
]
const CASTER_HALF_CM = 2.2
const CASTER_WHEEL_RADIUS_CM = 1.4

// Компьютерное кресло по эскизу (60 × 60, числа в сантиметрах в системе предмета 60 × 60): тело x 11,5–48,5, y 5,5–50 (верхние углы
// радиуса 10, нижние 5) с линией, прерванной подлокотниками (x 9–14 и 46–51, y 19,5–43,5, концы радиуса 2,5), дуга сиденья от (14; 22)
// до (46; 22) с вершиной на y = 16,5, пять колёсиков (квадрат 4,4 и окружность радиуса 1,4), четыре спицы. Фигура одного размера
// у предмета любой величины и стоит в его центре; у предмета меньше 60 × 60 все детали уменьшаются
export const officeChairDrawing: ItemDrawingFn = ({ widthCm: w, lengthCm: l }, forcedScale) => {
  const k = forcedScale ?? detailScale({ widthCm: w, lengthCm: l }, 60)
  const place = (p: Point): Point => ({ x: w / 2 + (p.x - 30) * k, y: l / 2 + (p.y - 30) * k })
  const placed = (pts: readonly Point[]): Point[] => pts.map(place)
  const topCorners = [...arc(21.5, 15.5, 10, 180, 270), ...arc(38.5, 15.5, 10, 270, 360)]
  const outline = placed([...topCorners, ...arc(43.5, 45, 5, 0, 90), ...arc(16.5, 45, 5, 90, 180)])
  const bodyTop = placed([{ x: 11.5, y: 19.5 }, ...topCorners, { x: 48.5, y: 19.5 }])
  const bodyBottom = placed([{ x: 11.5, y: 43.5 }, ...arc(16.5, 45, 5, 180, 90), ...arc(43.5, 45, 5, 90, 0), { x: 48.5, y: 43.5 }])
  const arms = [roundedRect(9, 19.5, 5, 24, 2.5), roundedRect(46, 19.5, 5, 24, 2.5)].map((arm) => closed(placed(arm)))
  const seat = placed(bulge(46, 14, 22, 5.5))
  const spokes: Point[][] = []
  const squares: Point[][] = []
  const wheels: Point[][] = []
  for (const { centre: c, spokeFrom } of OFFICE_CHAIR_CASTERS) {
    const length = spokeFrom ? Math.hypot(c.x - spokeFrom.x, c.y - spokeFrom.y) : 1
    // u — вдоль спицы к колёсику (у верхнего — вверх), v — поперёк
    const u = spokeFrom ? { x: (c.x - spokeFrom.x) / length, y: (c.y - spokeFrom.y) / length } : { x: 0, y: -1 }
    const v = { x: -u.y, y: u.x }
    const corner = (a: number, b: number): Point => ({ x: c.x + CASTER_HALF_CM * (a * u.x + b * v.x), y: c.y + CASTER_HALF_CM * (a * u.y + b * v.y) })
    if (spokeFrom) spokes.push(placed([spokeFrom, corner(-1, 0)]))
    squares.push(closed(placed([corner(1, 1), corner(1, -1), corner(-1, -1), corner(-1, 1)])))
    wheels.push(placed(arc(c.x, c.y, CASTER_WHEEL_RADIUS_CM, 0, 360)))
  }
  return { outline, lines: [bodyTop, bodyBottom, ...arms, seat, ...spokes, ...squares, ...wheels] }
}

// Телевизор по эскизу (91 × 11, экран вверху): экран 3 см толщиной во всю ширину, задняя стенка — трапеция под экраном (края 5 см от боков по
// линии экрана и 9,5 см по низу, высота 3 см), шейка — четыре отрезка на ±16 и ±19,5 см от середины ширины (y 6–8,5), подставка шириной 42 см
// (y 8,5–11) по центру. Подставка шире длины предмета, поэтому детали уменьшаются по обеим сторонам: min(1, ширина / 91, длина / 11);
// силуэт для обводки — прямоугольник предмета
export const tvDrawing: ItemDrawingFn = ({ widthCm: w, lengthCm: l }, forcedScale) => {
  const k = forcedScale ?? Math.min(1, w / 91, l / 11)
  const cx = w / 2
  const outline = [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: l }, { x: 0, y: l }]
  const screen = closed([{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: 3 * k }, { x: 0, y: 3 * k }])
  const back = [{ x: 5 * k, y: 3 * k }, { x: 9.5 * k, y: 6 * k }, { x: w - 9.5 * k, y: 6 * k }, { x: w - 5 * k, y: 3 * k }]
  const post = (dx: number): Point[] => [{ x: cx + dx * k, y: 6 * k }, { x: cx + dx * k, y: 8.5 * k }]
  const base = closed([{ x: cx - 21 * k, y: 8.5 * k }, { x: cx + 21 * k, y: 8.5 * k }, { x: cx + 21 * k, y: 11 * k }, { x: cx - 21 * k, y: 11 * k }])
  return { outline, lines: [screen, back, post(-19.5), post(-16), post(16), post(19.5), base] }
}

// Подвесная тумба по эскизу (180 × 42): прямоугольник с острыми углами и два крепления 6 × 7 см у нижнего (к стене) края с отступом 13 см от боков;
// у креплений нижней стороны нет — её заменяет нижний край
export const wallCabinetDrawing: ItemDrawingFn = ({ widthCm: w, lengthCm: l }, forcedScale) => {
  const k = forcedScale ?? detailScale({ widthCm: w, lengthCm: l }, 42)
  const outline = [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: l }, { x: 0, y: l }]
  const bracket = (x: number): Point[] => [{ x, y: l }, { x, y: l - 7 * k }, { x: x + 6 * k, y: l - 7 * k }, { x: x + 6 * k, y: l }]
  return { outline, lines: [closed(outline), bracket(13 * k), bracket(w - 19 * k)] }
}
