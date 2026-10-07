import type { Point, Wall, WallElement } from "../types"
import { add, coveredInterval, degenerate, dist, displayPolygons, mergeIntervals, mul, perp, unit } from "../wall-geometry"

// Грани опорной стены, стыки и расстояния проёма (change add-doorway, design D1, D3).
// Свободный участок грани — где внутренняя пробная линия (h − ε) покрыта формами стен,
// а наружная (h + ε) не покрыта ни одной стеной. Чистые функции, стены не мутируются.

export type Side = 1 | -1

export interface FaceDistances {
  a: number // от откоса до ближайшего стыка в сторону конца a
  b: number // в сторону конца b
}

export interface DoorwayDistances {
  plus: FaceDistances // сторона нормали (−d.y, d.x) к оси a → b
  minus: FaceDistances
}

const PROBE_CM = 0.05
const HOLD_TOL = 1e-6
const MIN_RUN = 1e-6

export const hostOf = (d: WallElement, walls: readonly Wall[]): Wall | null => {
  const host = walls.find((w) => w.id === d.wallId)
  return host && !degenerate(host) ? host : null
}

// откосы по координате t вдоль оси от конца a
export function jambsT(d: WallElement, host: Wall): [number, number] {
  const len = dist(host.a, host.b)
  return d.anchor === "a" ? [d.offsetCm, d.offsetCm + d.widthCm] : [len - d.offsetCm - d.widthCm, len - d.offsetCm]
}

// точка рамки опорной стены: t вдоль оси от a, lat — по нормали (−d.y, d.x)
export function hostPoint(host: Wall, t: number, lat: number): Point {
  const d = unit(host.a, host.b)
  return add(host.a, add(mul(d, t), mul(perp(d), lat)))
}

// стены, формы которых могут касаться граней опорной стены
function nearby(host: Wall, walls: readonly Wall[], reach: number): Wall[] {
  const box = (w: Wall, pad: number): [number, number, number, number] => {
    const r = w.thicknessCm / 2 + pad
    return [Math.min(w.a.x, w.b.x) - r, Math.min(w.a.y, w.b.y) - r, Math.max(w.a.x, w.b.x) + r, Math.max(w.a.y, w.b.y) + r]
  }
  const [hx0, hy0, hx1, hy1] = box(host, reach)
  return walls.filter((w) => {
    if (degenerate(w)) return false
    const [x0, y0, x1, y1] = box(w, 0)
    return x0 <= hx1 && hx0 <= x1 && y0 <= hy1 && hy0 <= y1
  })
}

// интервалы t, где линия на смещении lat покрыта формами стен
function covered(host: Wall, lat: number, from: number, to: number, pieces: Point[][]): [number, number][] {
  const p1 = hostPoint(host, from, lat)
  const p2 = hostPoint(host, to, lat)
  const span = to - from
  const out: [number, number][] = []
  for (const piece of pieces) {
    const iv = coveredInterval(p1, p2, piece)
    if (iv && iv[1] - iv[0] > 0) out.push([from + iv[0] * span, from + iv[1] * span])
  }
  return mergeIntervals(out)
}

function subtract(base: [number, number][], cut: [number, number][]): [number, number][] {
  let parts = base
  for (const [c0, c1] of cut) {
    const next: [number, number][] = []
    for (const [b0, b1] of parts) {
      if (c1 <= b0 || c0 >= b1) next.push([b0, b1])
      else {
        if (c0 > b0) next.push([b0, c0])
        if (c1 < b1) next.push([c1, b1])
      }
    }
    parts = next
  }
  return parts.filter(([t0, t1]) => t1 - t0 > MIN_RUN)
}

// свободные участки грани стороны side по координате t (по возрастанию)
export function faceRuns(host: Wall, walls: readonly Wall[], side: Side): [number, number][] {
  if (degenerate(host)) return []
  const reach = Math.max(...walls.map((w) => w.thicknessCm), host.thicknessCm) + 1
  const all = walls as Wall[]
  const pieces = nearby(host, walls, reach).flatMap((w) => displayPolygons(w, all))
  const h = host.thicknessCm / 2
  const from = -reach
  const to = dist(host.a, host.b) + reach
  const inner = covered(host, side * (h - PROBE_CM), from, to, pieces)
  const outer = covered(host, side * (h + PROBE_CM), from, to, pieces)
  return subtract(inner, outer)
}

// участок, к которому относится проём: наибольшее перекрытие, иначе ближайший
function runOf(runs: [number, number][], j1: number, j2: number): [number, number] | null {
  let best: [number, number] | null = null
  let bestScore = -Infinity
  for (const r of runs) {
    const overlap = Math.min(r[1], j2) - Math.max(r[0], j1)
    if (overlap > bestScore) {
      best = r
      bestScore = overlap
    }
  }
  return best
}

function faceDistances(runs: [number, number][], j1: number, j2: number): FaceDistances {
  const run = runOf(runs, j1, j2)
  // грани нет совсем — проём целиком вне стены
  if (!run) return { a: -Infinity, b: -Infinity }
  return { a: j1 - run[0], b: run[1] - j2 }
}

// свободные участки грани для элемента self: участки других элементов этой стены — стыки обеих граней
// (change add-window, design D2)
export function elementRuns(
  host: Wall,
  walls: readonly Wall[],
  elements: readonly WallElement[],
  side: Side,
  self: WallElement,
): [number, number][] {
  const others = elements
    .filter((e) => e.wallId === host.id && e.id !== self.id)
    .map((e) => jambsT(e, host))
    .sort((p, q) => p[0] - q[0])
  return subtract(faceRuns(host, walls, side), others)
}

export function doorwayDistances(d: WallElement, walls: readonly Wall[], elements: readonly WallElement[] = []): DoorwayDistances | null {
  const host = hostOf(d, walls)
  if (!host) return null
  const [j1, j2] = jambsT(d, host)
  return {
    plus: faceDistances(elementRuns(host, walls, elements, 1, d), j1, j2),
    minus: faceDistances(elementRuns(host, walls, elements, -1, d), j1, j2),
  }
}

// наибольшее нарушение (отрицательное расстояние) элемента; 0 — инвариант выполнен
export function doorwayViolation(d: WallElement, walls: readonly Wall[], elements: readonly WallElement[] = []): number {
  const ds = doorwayDistances(d, walls, elements)
  if (!ds) return Infinity
  return Math.max(0, -Math.min(ds.plus.a, ds.plus.b, ds.minus.a, ds.minus.b))
}

export function doorwayHolds(d: WallElement, walls: readonly Wall[], elements: readonly WallElement[] = []): boolean {
  return doorwayViolation(d, walls, elements) <= HOLD_TOL
}
