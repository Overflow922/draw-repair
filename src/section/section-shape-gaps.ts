import type { SectionShape } from "../types"
import type { SectionFigure } from "./section-figure"
import { figureFrame, insideFrame } from "./section-shape"
import type { FigureFrame } from "./section-shape"

// Расстояния выделенной детали до ближайших граней (change add-section-shapes, design D5; spec section-view «Выделение,
// перемещение и правка детали разреза»): от каждой из четырёх сторон вдоль её наружной нормали до первой грани сечения стены,
// другой детали, пола или края прямоугольника фигуры. Сторона, лежащая строго внутри сечения (углубление), меряется до внешней
// грани этого сечения. Тот же алгоритм, что у расстояний предмета
// «Мебели» до стен (furniture-plan «Расстояния выделенного предмета до стен»), но в осях фигуры. Чистые функции.

const EPS = 1e-9

export type GapFigure = Pick<SectionFigure, "pieces" | "width" | "height">

export type ShapeSide = "left" | "right" | "bottom" | "top"

// грань, от которой отсчитано расстояние: `face` — координата грани по оси нормали (s для left/right, z для bottom/top),
// `at` — координата вдоль стороны, через которую идёт размерная линия
export interface ShapeGap {
  side: ShapeSide
  distance: number
  face: number
  at: number
}

interface Block {
  s0: number
  s1: number
  z0: number
  z1: number
  recess?: true // сечение стены: сторона внутри него меряется до грани, через которую нормаль выходит наружу
}

// пол — полуплоскость z ≤ 0 на всю ширину: преграда только для нижней стороны
const FLOOR: Block = { s0: -Infinity, s1: Infinity, z0: -Infinity, z1: 0 }

// края фигуры — стены за её прямоугольником; низ — пол
const blocksOf = (figure: GapFigure, others: readonly SectionShape[]): Block[] => {
  const frame = figureFrame(figure)
  return [
  ...figure.pieces.map((p): Block => ({ s0: p.s0, s1: p.s1, z0: 0, z1: p.heightCm, recess: true })),
  ...others,
  FLOOR,
  { s0: -Infinity, s1: frame.left, z0: -Infinity, z1: Infinity },
  { s0: frame.right, s1: Infinity, z0: -Infinity, z1: Infinity },
  { s0: -Infinity, s1: Infinity, z0: frame.height, z1: Infinity },
  ]
}

const overlap = (a0: number, a1: number, b0: number, b1: number): [number, number] | null => {
  const lo = Math.max(a0, b0)
  const hi = Math.min(a1, b1)
  return hi - lo > EPS ? [lo, hi] : null
}

interface Candidate {
  distance: number
  face: number
  at: number
}

// ось нормали: "s" — стороны left/right, "z" — bottom/top; dir = +1 для right/top, −1 для left/bottom
function gapOf(shape: SectionShape, blocks: readonly Block[], axis: "s" | "z", dir: 1 | -1): Candidate | null {
  const [n0, n1, c0, c1] = axis === "s" ? [shape.s0, shape.s1, shape.z0, shape.z1] : [shape.z0, shape.z1, shape.s0, shape.s1]
  const side = dir > 0 ? n1 : n0
  let best: Candidate | null = null
  for (const b of blocks) {
    const [b0, b1, k0, k1] = axis === "s" ? [b.s0, b.s1, b.z0, b.z1] : [b.z0, b.z1, b.s0, b.s1]
    const cross = overlap(c0, c1, k0, k1)
    if (cross === null) continue
    // сторона строго внутри сечения: углубление, расстояние — до грани, через которую нормаль выходит наружу
    if (b.recess && b0 + EPS < side && side < b1 - EPS) {
      const exit = dir > 0 ? b1 : b0
      const inside = Math.abs(exit - side)
      if (best === null || inside < best.distance - EPS) best = { distance: inside, face: exit, at: (cross[0] + cross[1]) / 2 }
      continue
    }
    // грань преграды, обращённая к детали: для dir > 0 нижняя b0, для dir < 0 верхняя b1
    const face = dir > 0 ? b0 : b1
    const distance = dir > 0 ? face - side : side - face
    // преграда целиком за стороной (граница стороны на её дальней грани ещё считается заходом) — не по ходу нормали
    const behind = dir > 0 ? b1 < side - EPS : b0 > side + EPS
    if (behind) continue
    const clipped = Math.max(distance, 0)
    if (best === null || clipped < best.distance - EPS) best = { distance: clipped, face, at: (cross[0] + cross[1]) / 2 }
  }
  return best
}

// расстояния всех четырёх сторон; порядок: left, right, bottom, top
export function shapeGaps(shape: SectionShape, figure: GapFigure, others: readonly SectionShape[]): ShapeGap[] {
  const blocks = blocksOf(figure, others.filter((o) => o.id !== shape.id))
  const sides: [ShapeSide, "s" | "z", 1 | -1][] = [["left", "s", -1], ["right", "s", 1], ["bottom", "z", -1], ["top", "z", 1]]
  return sides.flatMap(([side, axis, dir]) => {
    const c = gapOf(shape, blocks, axis, dir)
    return c === null ? [] : [{ side, ...c }]
  })
}

// деталь сдвинута вдоль нормали стороны так, что расстояние до той же грани стало value; null — не число, отрицательное,
// у стороны нет грани, выход за фигуру или деталь не сдвинулась
export function setGap(shape: SectionShape, gaps: readonly ShapeGap[], side: ShapeSide, value: number, frame: FigureFrame): SectionShape | null {
  const gap = gaps.find((g) => g.side === side)
  if (gap === undefined || !Number.isFinite(value) || value < 0) return null
  const target = side === "left" || side === "bottom" ? gap.face + value : gap.face - value
  const current = { left: shape.s0, right: shape.s1, bottom: shape.z0, top: shape.z1 }[side]
  const shift = target - current
  if (Math.abs(shift) < EPS) return null
  const next: SectionShape = side === "left" || side === "right"
    ? { ...shape, s0: shape.s0 + shift, s1: shape.s1 + shift }
    : { ...shape, z0: shape.z0 + shift, z1: shape.z1 + shift }
  return insideFrame(next, frame) ? next : null
}
