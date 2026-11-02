import type { Point, SectionLine, SectionView } from "../types"
import type { SectionFigure } from "./section-figure"
import { sectionSegments, viewAxis } from "./section-line"

// Обозначение линии разреза на плане: жирные штрихи на концах, стрелки взгляда, место обозначения (change add-section-view,
// design D2; spec section-view «Обозначение линии разреза на плане»; references/sections.png). Размеры заданы в единицах
// чертежа, чистые функции. Стрелка лежит по ту сторону линии, откуда смотрят (против взгляда), и остриём упирается в конец
// жирного штриха; между штрихами линия штриховая.

export const SECTION_STROKE_CM = 10.72 // длина жирного штриха внутрь линии от её конца: 16 см, укороченные на 33 %
export const SECTION_ARROW_CM = 30 // длина стрелки взгляда
export const SECTION_LABEL_GAP_CM = 12 // обозначение стоит сбоку от стрелки, снаружи от линии
export const SECTION_DASH_CM: readonly number[] = [20, 10] // штрих и промежуток штриховой линии между концевыми штрихами
export const SECTION_BAR_WIDTH_K = 2.5 // концевой штрих в столько раз толще штриховой линии разреза
export const SECTION_BAR_GAP_CM = 10 // зазор между концевым штрихом и началом штриховой линии, а также между штрихом и разрезаемой стеной
export const SECTION_BAR_OVERHANG_CM = 5.36 // концевой штрих выступает наружу за стрелку: 8 см, укороченные на 33 %

// свободная длина у каждого конца линии до разрезаемой стены: Infinity — рядом нет разрезаемых стен
export type EndClearance = readonly [number, number]

// единичный вектор взгляда на экране плана
export const VIEW_VECTORS: Record<SectionView, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

export interface EndMark {
  end: Point // конец линии
  strokeFrom: Point // внешний конец жирного штриха: он выступает за стрелку
  strokeTo: Point // конец жирного штриха внутри линии
  tail: Point // начало стрелки взгляда; остриё стрелки — в конце линии (end), стрелка идёт по взгляду
  labelAt: Point // центр обозначения
}

const unit = (from: Point, to: Point): Point => {
  const len = Math.hypot(to.x - from.x, to.y - from.y)
  return len === 0 ? { x: 0, y: 0 } : { x: (to.x - from.x) / len, y: (to.y - from.y) / len }
}

// длина жирного штриха одна у обоих концов: SECTION_STROKE_CM, а у очень короткого отрезка — весь отрезок
// (место под штрих у разрезаемой стены освобождается выносом конца, section-free)
const barLength = (end: Point, next: Point): number => Math.min(SECTION_STROKE_CM, Math.hypot(next.x - end.x, next.y - end.y))

function markAt(line: SectionLine, end: Point, next: Point): EndMark {
  const into = unit(end, next)
  const length = barLength(end, next)
  const overhang = SECTION_BAR_OVERHANG_CM
  const v = VIEW_VECTORS[line.view]
  return {
    end: { ...end },
    strokeFrom: { x: end.x - into.x * overhang, y: end.y - into.y * overhang },
    strokeTo: { x: end.x + into.x * length, y: end.y + into.y * length },
    tail: { x: end.x - v.x * SECTION_ARROW_CM, y: end.y - v.y * SECTION_ARROW_CM },
    labelAt: {
      x: end.x - v.x * (SECTION_ARROW_CM / 2) - into.x * SECTION_LABEL_GAP_CM,
      y: end.y - v.y * (SECTION_ARROW_CM / 2) - into.y * SECTION_LABEL_GAP_CM,
    },
  }
}

// вершины штриховой линии между концевыми штрихами (с зазором за каждым штрихом); null — линия слишком коротка для штриховой части
export function dashedPath(line: SectionLine): Point[] | null {
  const pts = line.points
  const shift = (from: Point, to: Point): Point => {
    const into = unit(from, to)
    const d = Math.min(barLength(from, to) + SECTION_BAR_GAP_CM, Math.hypot(to.x - from.x, to.y - from.y))
    return { x: from.x + into.x * d, y: from.y + into.y * d }
  }
  const first = shift(pts[0], pts[1])
  const last = shift(pts[pts.length - 1], pts[pts.length - 2])
  if (pts.length === 2 && Math.hypot(last.x - first.x, last.y - first.y) < 1e-9) return null
  // единственный отрезок: штрихи не должны пересечься
  if (pts.length === 2) {
    const dir = unit(pts[0], pts[1])
    if ((last.x - first.x) * dir.x + (last.y - first.y) * dir.y <= 0) return null
  }
  return [first, ...pts.slice(1, -1), last]
}

// метки двух концов линии: от первой и от последней вершины
export function endMarks(line: SectionLine): [EndMark, EndMark] {
  const pts = line.points
  return [markAt(line, pts[0], pts[1]), markAt(line, pts[pts.length - 1], pts[pts.length - 2])]
}

// сколько свободно у каждого конца линии вдоль концевого отрезка до сечения разрезаемой стены (0 — конец уже в стене);
// считается по сечениям фигуры, то есть по тем же стенам, что штрихуются
export function endClearance(line: SectionLine, figure: SectionFigure): EndClearance {
  const segs = sectionSegments(line.points)
  const u = viewAxis(line.view)
  const along = (p: Point): number => p.x * u.x + p.y * u.y
  const first = segs[0]
  const last = segs[segs.length - 1]
  const working = segs.filter((s) => s.working)
  const sMin = Math.min(...working.flatMap((s) => [along(s.a), along(s.b)]))
  // расстояние от точки end вглубь линии (в сторону sign по u) до ближайшего сечения того же рабочего отрезка
  const free = (end: Point, sign: number, index: number): number => {
    const s = along(end) - sMin
    let best = Infinity
    for (const p of figure.pieces) {
      if (p.segment !== index) continue
      const d = sign > 0 ? p.s0 - s : s - p.s1
      const behind = sign > 0 ? p.s1 < s : p.s0 > s
      if (behind) continue
      best = Math.min(best, Math.max(0, d))
    }
    return best
  }
  const sign = Math.sign(along(first.b) - along(first.a)) || 1
  return [free(first.a, sign, first.index), free(last.b, -sign, last.index)]
}
