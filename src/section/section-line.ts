import type { Point, SectionView } from "../types"

// Правила линии разреза (change add-section-view, design D1, D3; spec section-view «Линия разреза»). Чистые функции.

const EPS = 1e-6

// ось u наблюдателя, смотрящего в сторону view (слева направо); s точки — её проекция на u (ось Y чертежа направлена вниз)
const AXES: Record<SectionView, Point> = {
  up: { x: 1, y: 0 },
  down: { x: -1, y: 0 },
  right: { x: 0, y: 1 },
  left: { x: 0, y: -1 },
}

export const viewAxis = (view: SectionView): Point => ({ ...AXES[view] })

// отрезок линии: рабочие (перпендикулярны взгляду) — первый, третий, …; ступеньки (вдоль взгляда) — между ними.
// index — номер рабочего отрезка; у ступеньки — номер рабочего отрезка перед ней
export interface SectionSegment {
  a: Point
  b: Point
  working: boolean
  index: number
}

export function sectionSegments(points: readonly Point[]): SectionSegment[] {
  const out: SectionSegment[] = []
  for (let i = 0; i + 1 < points.length; i++) {
    const working = i % 2 === 0
    out.push({ a: { ...points[i] }, b: { ...points[i + 1] }, working, index: Math.floor(i / 2) })
  }
  return out
}

export type SectionLineCheck =
  | { ok: true }
  | { ok: false; reason: "too-few" | "zero-length" | "not-axis" | "even-segments" | "backwards" }

const near = (a: number, b: number): boolean => Math.abs(a - b) <= EPS

// допустимость вершин для направления взгляда: оси, нечётное число отрезков, рабочие отрезки без возврата назад
export function checkSectionLine(points: readonly Point[], view: SectionView): SectionLineCheck {
  if (points.length < 2) return { ok: false, reason: "too-few" }
  const u = AXES[view]
  const segs = sectionSegments(points)
  if (segs.some((s) => near(s.a.x, s.b.x) && near(s.a.y, s.b.y))) return { ok: false, reason: "zero-length" }
  for (const s of segs) {
    const alongU = u.x !== 0 ? near(s.a.y, s.b.y) : near(s.a.x, s.b.x)
    const alongView = u.x !== 0 ? near(s.a.x, s.b.x) : near(s.a.y, s.b.y)
    if (s.working ? !alongU : !alongView) return { ok: false, reason: "not-axis" }
  }
  if (segs.length % 2 === 0) return { ok: false, reason: "even-segments" }
  const signs = segs.filter((s) => s.working).map((s) => Math.sign((s.b.x - s.a.x) * u.x + (s.b.y - s.a.y) * u.y))
  if (signs.some((sg) => sg !== signs[0])) return { ok: false, reason: "backwards" }
  return { ok: true }
}

// первое обозначение, не занятое линиями плана: A…Z, затем A1…Z1, A2…
export function nextSectionLabel(taken: readonly string[]): string {
  const used = new Set(taken)
  for (let round = 0; ; round++) {
    for (let c = 65; c <= 90; c++) {
      const label = String.fromCharCode(c) + (round === 0 ? "" : String(round))
      if (!used.has(label)) return label
    }
  }
}
