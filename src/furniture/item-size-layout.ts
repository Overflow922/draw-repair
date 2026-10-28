import { textDirection, upOf } from "../doorway/editable-numbers"
import { CHAR_WIDTH } from "../doorway/element-label"
import { formatLength } from "../format-length"
import { dimGeometry } from "../geometry"
import type { FurnitureItem, Point, Unit } from "../types"
import { add, dot, mul, sub } from "../wall-geometry"
import { itemLocalToWorld } from "./item"
import type { ItemNumber, ItemSize } from "./item-number"

// Габариты предмета мебели (change furniture-dimensions, design D1; spec furniture-plan «Габариты предмета мебели»): ширина и
// длина — размерные линии внутри прямоугольника предмета у той из двух параллельных сторон, к которой обращён верх числа, на
// отступе «кегль и два зазора»; число между линией и стороной. Не поместившийся размер — у той же стороны снаружи, с выносными
// от углов. Отступ задан в px носителя (экран или лист), поэтому решение «внутри или снаружи» зависит от k. Чистые функции.

export interface SizeMetrics {
  labelPx: number // кегль числа
  dimTextGapPx: number // зазор между числом и размерной линией
}

const UNITS: readonly Unit[] = ["cm", "mm", "m"]

// отступ линии от стороны, см чертежа: k — px носителя на см
export const sizeInsetCm = (k: number, m: SizeMetrics): number => (m.labelPx + 2 * m.dimTextGapPx) / k

const textWidthCm = (text: string, k: number, m: SizeMetrics): number => (text.length * m.labelPx * CHAR_WIDTH) / k

interface SizeFrame {
  size: ItemSize
  valueCm: number
  acrossCm: number // сторона части предмета поперёк линии
  axis: Point // направление линии в системе предмета
  center: Point // центр части предмета, к которой относится размер, в системе предмета
  sides: readonly [readonly [Point, Point], readonly [Point, Point]] // две стороны вдоль линии: концы в системе предмета по оси
}

// ширина — вдоль оси x части; длина — вдоль −y (снизу вверх), так что при угле 0 её число читается снизу вверх у левой стороны
function rectFrames(x0: number, y0: number, w: number, l: number, widthSize: ItemSize, lengthSize: ItemSize): readonly SizeFrame[] {
  const center = { x: x0 + w / 2, y: y0 + l / 2 }
  return [
    {
      size: widthSize,
      valueCm: w,
      acrossCm: l,
      axis: { x: 1, y: 0 },
      center,
      sides: [
        [{ x: x0, y: y0 }, { x: x0 + w, y: y0 }],
        [{ x: x0, y: y0 + l }, { x: x0 + w, y: y0 + l }],
      ],
    },
    {
      size: lengthSize,
      valueCm: l,
      acrossCm: w,
      axis: { x: 0, y: -1 },
      center,
      sides: [
        [{ x: x0, y: y0 + l }, { x: x0, y: y0 }],
        [{ x: x0 + w, y: y0 + l }, { x: x0 + w, y: y0 }],
      ],
    },
  ]
}

// у предмета — ширина и длина; у унитаза (change add-toilet, design D4) — по два размера у блока и у чаши, каждый по правилам
// прямоугольника своей части
function frames(t: FurnitureItem): readonly SizeFrame[] {
  const s = t.toilet
  if (!s) return rectFrames(0, 0, t.widthCm, t.lengthCm, "width", "length")
  return [
    ...rectFrames((t.widthCm - s.blockWidthCm) / 2, 0, s.blockWidthCm, s.blockDepthCm, "blockWidth", "blockDepth"),
    ...rectFrames((t.widthCm - s.bowlWidthCm) / 2, s.blockDepthCm, s.bowlWidthCm, s.bowlLengthCm, "bowlWidth", "bowlLength"),
  ]
}

interface Placed {
  frame: SizeFrame
  start: Point // концы стороны в чертеже
  end: Point
  outward: Point // наружная нормаль этой стороны в чертеже
  dir: Point // направление текста
}

// сторона, к которой обращён верх числа
function placeFrame(t: FurnitureItem, frame: SizeFrame): Placed {
  const world = ([a, b]: readonly [Point, Point]): [Point, Point] => [itemLocalToWorld(t, a), itemLocalToWorld(t, b)]
  const [s0, s1] = frame.sides
  const [a0, b0] = world(s0)
  const [a1, b1] = world(s1)
  const dir = textDirection(sub(b0, a0))
  const center = itemLocalToWorld(t, frame.center)
  const mid0 = mul(add(a0, b0), 0.5)
  const towards0 = dot(sub(mid0, center), upOf(dir)) >= 0
  const [start, end] = towards0 ? [a0, b0] : [a1, b1]
  const mid = mul(add(start, end), 0.5)
  const away = sub(mid, center)
  const len = Math.hypot(away.x, away.y)
  return { frame, start, end, outward: { x: away.x / len, y: away.y / len }, dir }
}

// помещается ли размер внутрь: число короче стороны вдоль линии, сторона поперёк длиннее отступа
const fitsInside = (frame: SizeFrame, text: string, k: number, m: SizeMetrics): boolean =>
  textWidthCm(text, k, m) < frame.valueCm && frame.acrossCm > sizeInsetCm(k, m)

function layoutSize(t: FurnitureItem, frame: SizeFrame, text: string, inside: boolean, k: number, m: SizeMetrics): ItemNumber | null {
  const p = placeFrame(t, frame)
  const inset = sizeInsetCm(k, m)
  const toward = inside ? mul(p.outward, -1) : p.outward
  const along = sub(p.end, p.start)
  const normal = { x: -along.y, y: along.x }
  const geom = dimGeometry(p.start, p.end, (Math.sign(dot(normal, toward)) || 1) * inset)
  if (!geom) return null
  const mid = mul(add(geom.p1, geom.p2), 0.5)
  return {
    field: { kind: "size", size: frame.size },
    text,
    valueCm: frame.valueCm,
    geom,
    center: add(mid, mul(upOf(p.dir), (m.dimTextGapPx + m.labelPx / 2) / k)),
    dir: p.dir,
    widthCm: textWidthCm(text, k, m),
    heightCm: m.labelPx / k,
  }
}

// габариты предмета: k — px носителя на см чертежа
export function itemSizeLayout(t: FurnitureItem, unit: Unit, k: number, m: SizeMetrics): ItemNumber[] {
  return frames(t).flatMap((frame) => {
    const text = formatLength(frame.valueCm, unit)
    const n = layoutSize(t, frame, text, fitsInside(frame, text, k, m), k, m)
    return n ? [n] : []
  })
}

// точки размеров, вынесенных наружу, — для габаритов страницы PDF. Единица на странице неизвестна (это настройка экрана),
// поэтому наружу считается размер, не поместившийся хотя бы в одной единице: запас не больше отступа и только у пограничных
// предметов (design D5)
export function itemSizeOutsidePoints(t: FurnitureItem, k: number, m: SizeMetrics): Point[] {
  return frames(t).flatMap((frame) => {
    const texts = UNITS.map((u) => formatLength(frame.valueCm, u))
    if (texts.every((text) => fitsInside(frame, text, k, m))) return []
    const longest = texts.reduce((a, b) => (b.length > a.length ? b : a))
    const n = layoutSize(t, frame, longest, false, k, m)
    if (!n?.geom) return []
    const top = mul(upOf(n.dir), (m.dimTextGapPx + m.labelPx) / k)
    return [n.geom.p1, n.geom.p2, add(n.geom.p1, top), add(n.geom.p2, top)]
  })
}
