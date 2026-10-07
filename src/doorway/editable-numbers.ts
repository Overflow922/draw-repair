import { formatLength } from "../format-length"
import type { Room } from "../room-area"
import type { Point, Unit, Wall, WallElement } from "../types"
import { isWindow } from "../types"
import { add, dot, mul, sub, unit as unitVector } from "../wall-geometry"
import { chainLabels } from "./doorway-layout"
import { hostOf } from "./doorway-faces"
import type { Side } from "./doorway-faces"
import { CHAR_WIDTH, elementLabelLayout, partNumberOffsetPx } from "./element-label"

// Правимые числа выделенного элемента стены (change popups-buttons-only, design D1): числа цепочек размеров и
// числа подписи. Одна раскладка для подчёркивания и для попадания клика. Чистые функции без DOM; от render.ts
// не зависят — render берёт раскладку отсюда.

export type EditableTarget =
  | { kind: "distance"; side: Side; part: "a" | "b" }
  | { kind: "width" }
  | { kind: "height" }
  | { kind: "sill" }

export interface EditableNumber {
  target: EditableTarget
  text: string // число в текущей единице, как нарисовано
  valueCm: number // значение в см — для поля ввода и применения
  center: Point // центр текста числа, мировые координаты — туда же ставится поле ввода
  dir: Point // единичное направление текста
  widthCm: number
  heightCm: number
}

// зазор между размерной линией и числом над ней (SCREEN_METRICS.dimTextGapPx), px экрана
export const DIM_TEXT_GAP_PX = 1.5
// вынос цепочки от грани и полоса цепочки под подписью — в долях кегля (render: drawDoorways)
export const CHAIN_OFFSET_EM = 1.2
export const CHAIN_BAND_EM = 2.2

const ZERO = 1e-6

// направление текста размерной линии вдоль направления axis: слева направо (render: drawDimensionGeom)
function textDirection(axis: Point): Point {
  let angle = Math.atan2(axis.y, axis.x)
  if (angle > Math.PI / 2 || angle < -Math.PI / 2) angle += Math.PI
  return { x: Math.cos(angle), y: Math.sin(angle) }
}

// «вверх» от текста: перпендикуляр к направлению против оси y экрана
const upOf = (dir: Point): Point => ({ x: dir.y, y: -dir.x })

// числа выделенного элемента d: k — px на см чертежа, labelPx — кегль подписи
export function editableNumbers(
  d: WallElement,
  walls: readonly Wall[],
  elements: readonly WallElement[],
  rooms: readonly Room[],
  unit: Unit,
  k: number,
  labelPx: number,
): EditableNumber[] {
  const host = hostOf(d, walls)
  if (!host) return []
  const out: EditableNumber[] = []
  const numberHeight = labelPx / k
  const axis = unitVector(host.a, host.b)
  const lineDir = textDirection(axis)
  for (const l of chainLabels(d, walls, (labelPx * CHAIN_OFFSET_EM) / k, elements)) {
    const text = formatLength(l.lengthCm, unit)
    const target: EditableTarget = l.part === "width" ? { kind: "width" } : { kind: "distance", side: l.side, part: l.part }
    // нулевое расстояние — только число, текст стоит над точкой; иначе — над размерной линией с зазором
    const zero = l.lengthCm <= ZERO
    const dir = zero ? { x: 1, y: 0 } : lineDir
    const lift = zero ? labelPx / 2 / k : (DIM_TEXT_GAP_PX + labelPx / 2) / k
    out.push({ target, text, valueCm: l.lengthCm, center: add(l.at, mul(upOf(dir), lift)), dir, widthCm: (text.length * labelPx * CHAR_WIDTH) / k, heightCm: numberHeight })
  }
  const layout = elementLabelLayout(d, walls, rooms, unit, k, labelPx, labelPx * CHAIN_BAND_EM)
  if (layout) {
    layout.label.parts.forEach((part, i) => {
      const value = part.text.slice(part.text.length - part.valueLength)
      out.push({
        target: { kind: part.field },
        text: value,
        valueCm: isWindow(d) && part.field === "sill" ? d.sillCm : d.heightCm,
        center: add(layout.center, mul(layout.dir, partNumberOffsetPx(layout.label, i, labelPx) / k)),
        dir: layout.dir,
        widthCm: (value.length * labelPx * CHAR_WIDTH) / k,
        heightCm: numberHeight,
      })
    })
  }
  return out
}

// число, в прямоугольник которого (вдоль текста — ширина, поперёк — кегль) с допуском tolCm попала точка; из
// нескольких — с ближайшим центром
export function numberAt(p: Point, numbers: readonly EditableNumber[], tolCm: number): EditableNumber | null {
  let best: EditableNumber | null = null
  let bestDist = Infinity
  for (const n of numbers) {
    const rel = sub(p, n.center)
    const along = dot(rel, n.dir)
    const across = dot(rel, { x: -n.dir.y, y: n.dir.x })
    if (Math.abs(along) > n.widthCm / 2 + tolCm || Math.abs(across) > n.heightCm / 2 + tolCm) continue
    const dist = Math.hypot(rel.x, rel.y)
    if (dist < bestDist) {
      best = n
      bestDist = dist
    }
  }
  return best
}
