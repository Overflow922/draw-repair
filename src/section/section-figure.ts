import type { DrywallWall, Point, SectionLine, Wall } from "../types"
import { displayPolygons, pointInPolygon } from "../wall-geometry"
import { sectionSegments, viewAxis } from "./section-line"
import type { SectionSegment } from "./section-line"

// Фигура разреза — вид сбоку, вычисляемый по линии и стенам гипсокартона (change add-section-view, design D2, D3;
// spec section-view «Фигура разреза — содержание и штриховка»). Координаты фигуры: s вдоль линии слева направо, от левого
// края фигуры; z вверх от пола. Фигура нигде не хранится. Чистые функции, входы не мутируются.

const EPS = 1e-9

// сечение стены одним рабочим отрезком: интервал [s0, s1] от левого края фигуры, от пола до высоты стены
export interface SectionPiece {
  wallId: string
  segment: number
  s0: number
  s1: number
  heightCm: number
}

export interface SectionFigure {
  lineId: string
  label: string
  view: SectionLine["view"]
  width: number
  height: number
  pieces: SectionPiece[]
}

const alongU = (p: Point, u: Point): number => p.x * u.x + p.y * u.y

// доли [t0, t1] отрезка a→b, лежащие внутри многоугольника (возможно невыпуклого): границы — пересечения с рёбрами
function insideIntervals(a: Point, b: Point, poly: readonly Point[]): [number, number][] {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const cuts = [0, 1]
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const p = poly[j]
    const q = poly[i]
    const ex = q.x - p.x
    const ey = q.y - p.y
    const denom = dx * ey - dy * ex
    if (Math.abs(denom) < EPS) {
      // ребро параллельно отрезку: его концы, лежащие на отрезке, тоже границы
      for (const v of [p, q]) {
        const t = ((v.x - a.x) * dx + (v.y - a.y) * dy) / len2
        const off = (v.x - a.x) * dy - (v.y - a.y) * dx
        if (Math.abs(off) < EPS * Math.sqrt(len2) && t > 0 && t < 1) cuts.push(t)
      }
      continue
    }
    const t = ((p.x - a.x) * ey - (p.y - a.y) * ex) / denom
    const s = ((p.x - a.x) * dy - (p.y - a.y) * dx) / denom
    if (t > 0 && t < 1 && s >= -EPS && s <= 1 + EPS) cuts.push(t)
  }
  cuts.sort((x, y) => x - y)
  const out: [number, number][] = []
  for (let i = 0; i + 1 < cuts.length; i++) {
    const [t0, t1] = [cuts[i], cuts[i + 1]]
    if (t1 - t0 <= EPS) continue
    const mid = (t0 + t1) / 2
    if (!pointInPolygon({ x: a.x + dx * mid, y: a.y + dy * mid }, [...poly])) continue
    const last = out[out.length - 1]
    if (last !== undefined && t0 - last[1] <= EPS) last[1] = t1
    else out.push([t0, t1])
  }
  return out
}

function mergeIntervals(spans: [number, number][]): [number, number][] {
  const out: [number, number][] = []
  for (const [t0, t1] of [...spans].sort((x, y) => x[0] - y[0])) {
    const last = out[out.length - 1]
    if (last !== undefined && t0 <= last[1] + EPS) last[1] = Math.max(last[1], t1)
    else out.push([t0, t1])
  }
  return out
}

// сечения стены рабочим отрезком: стена режется по контуру, как она нарисована на плане (с достройкой в углах и примыканиях)
function piecesOf(seg: SectionSegment, wall: DrywallWall, scene: Wall[], u: Point, sMin: number): SectionPiece[] {
  if (Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y) < EPS) return []
  const at = (t: number): number => alongU({ x: seg.a.x + (seg.b.x - seg.a.x) * t, y: seg.a.y + (seg.b.y - seg.a.y) * t }, u) - sMin
  // тело стены и достройки в углах — отдельные многоугольники: смежные доли сливаются в одно сечение
  const spans = mergeIntervals(displayPolygons(wall, scene).flatMap((poly) => insideIntervals(seg.a, seg.b, poly)))
  return spans.map(([t0, t1]) => {
    const [p, q] = [at(t0), at(t1)]
    return { wallId: wall.id, segment: seg.index, s0: Math.min(p, q), s1: Math.max(p, q), heightCm: wall.heightCm }
  })
}

// сечения одной высоты, которые перекрываются или касаются, — одно тело разреза (угол двух стен, продолжение стены): один прямоугольник
function mergeSameHeight(pieces: SectionPiece[]): SectionPiece[] {
  const out: SectionPiece[] = []
  const ordered = [...pieces].sort((a, b) => a.segment - b.segment || a.heightCm - b.heightCm || a.s0 - b.s0)
  for (const p of ordered) {
    const last = out[out.length - 1]
    if (last !== undefined && last.segment === p.segment && last.heightCm === p.heightCm && p.s0 <= last.s1 + EPS) out[out.length - 1] = { ...last, s1: Math.max(last.s1, p.s1) }
    else out.push(p)
  }
  return out
}

// сечение, целиком накрытое сечением другой стены такой же или большей высоты, не показывается: это одно и то же тело разреза
function withoutCovered(pieces: SectionPiece[]): SectionPiece[] {
  const covers = (q: SectionPiece, p: SectionPiece): boolean =>
    q.s0 <= p.s0 + EPS && q.s1 >= p.s1 - EPS && q.heightCm >= p.heightCm
  return pieces.filter((p, i) => !pieces.some((q, j) => j !== i && q.wallId !== p.wallId && q.segment === p.segment && covers(q, p) && (!covers(p, q) || j < i)))
}
export function sectionFigure(line: SectionLine, walls: readonly DrywallWall[]): SectionFigure {
  const u = viewAxis(line.view)
  const working = sectionSegments(line.points).filter((s) => s.working)
  const ends = working.flatMap((s) => [alongU(s.a, u), alongU(s.b, u)])
  const sMin = Math.min(...ends)
  const scene: Wall[] = [...walls]
  const pieces = withoutCovered(mergeSameHeight(working.flatMap((seg) => walls.flatMap((w) => piecesOf(seg, w, scene, u, sMin)))))
  return {
    lineId: line.id,
    label: line.label,
    view: line.view,
    width: Math.max(...ends) - sMin,
    height: pieces.reduce((h, p) => Math.max(h, p.heightCm), 0),
    pieces,
  }
}
