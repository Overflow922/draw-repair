import type { Room } from "../room-area"
import type { Doorway, Point, Wall } from "../types"
import { clipHalfPlane, dot, lerp, mul, perp, pointInPolygon, polygonArea, sub, unit } from "../wall-geometry"
import type { Seg } from "../wall-geometry"
import { faceRuns, hostOf, hostPoint, jambsT } from "./doorway-faces"
import type { Side } from "./doorway-faces"

// Геометрия отображения проёмов в мировых координатах (change add-doorway, design D2, D7, D10):
// вырез кусков формы стены, контур без граней в проёме, откосы и продолжения граней,
// цепочки размеров, сторона подписи высоты. Каноническая форма стены не меняется.

const TOL = 1e-6
const MIN_AREA = 1e-6
const SIDES: Side[] = [1, -1]

const doorwaysOf = (host: Wall, walls: readonly Wall[], doorways: readonly Doorway[]): Doorway[] =>
  doorways.filter((d) => d.wallId === host.id && hostOf(d, walls) === host)

// куски формы стены без участков её проёмов: каждый кусок режется полуплоскостями t ≤ j1 и t ≥ j2
export function cutPieces(host: Wall, pieces: Point[][], walls: readonly Wall[], doorways: readonly Doorway[]): Point[][] {
  const u = unit(host.a, host.b)
  let out = pieces
  for (const d of doorwaysOf(host, walls, doorways)) {
    const [j1, j2] = jambsT(d, host)
    out = out.flatMap((piece) => [
      clipHalfPlane(piece, host.a, { x: -u.x, y: -u.y }, -j1),
      clipHalfPlane(piece, host.a, u, j2),
    ])
    out = out.filter((p) => p.length >= 3 && polygonArea(p) > MIN_AREA)
  }
  return out
}

const tOf = (host: Wall, p: Point): number => dot(sub(p, host.a), unit(host.a, host.b))

// контур стены без участков, лежащих внутри проёмов (по t)
export function cutContour(host: Wall, segs: Seg[], walls: readonly Wall[], doorways: readonly Doorway[]): Seg[] {
  let out = segs
  for (const d of doorwaysOf(host, walls, doorways)) {
    const [j1, j2] = jambsT(d, host)
    out = out.flatMap((s) => {
      const t1 = tOf(host, s.p1)
      const t2 = tOf(host, s.p2)
      if (Math.abs(t2 - t1) < TOL) return t1 > j1 + TOL && t1 < j2 - TOL ? [] : [s]
      // параметры отрезка, где t попадает в (j1, j2)
      const at = (t: number): number => (t - t1) / (t2 - t1)
      const lo = Math.max(0, Math.min(at(j1), at(j2)))
      const hi = Math.min(1, Math.max(at(j1), at(j2)))
      if (hi - lo <= TOL) return [s]
      const parts: Seg[] = []
      if (lo > TOL) parts.push({ p1: s.p1, p2: lerp(s.p1, s.p2, lo) })
      if (hi < 1 - TOL) parts.push({ p1: lerp(s.p1, s.p2, hi), p2: s.p2 })
      return parts
    })
  }
  return out
}

// участок грани, к которому относится проём
function runFor(host: Wall, walls: readonly Wall[], side: Side, j1: number, j2: number): [number, number] | null {
  let best: [number, number] | null = null
  let score = -Infinity
  for (const r of faceRuns(host, walls, side)) {
    const s = Math.min(r[1], j2) - Math.max(r[0], j1)
    if (s > score) {
      best = r
      score = s
    }
  }
  return best
}

export interface OpeningLines {
  jambs: Seg[] // откосы — линии контура
  faces: Seg[] // продолжения граней через проём — тонкие линии
  outline: Point[] | null // контур участка проёма для подсветки
}

// откосы и продолжения граней только в пределах видимых граней: нарушенный проём не рисуется за гранью
export function openingLines(d: Doorway, walls: readonly Wall[]): OpeningLines | null {
  const host = hostOf(d, walls)
  if (!host) return null
  const h = host.thicknessCm / 2
  const [j1, j2] = jambsT(d, host)
  const runs = SIDES.map((s) => runFor(host, walls, s, j1, j2))
  const within = (t: number): boolean => runs.every((r) => r !== null && t >= r[0] - TOL && t <= r[1] + TOL)
  const jambs = [j1, j2].filter(within).map((t) => ({ p1: hostPoint(host, t, -h), p2: hostPoint(host, t, h) }))
  const faces: Seg[] = []
  SIDES.forEach((s, i) => {
    const r = runs[i]
    if (!r) return
    const lo = Math.max(j1, r[0])
    const hi = Math.min(j2, r[1])
    if (hi - lo > TOL) faces.push({ p1: hostPoint(host, lo, s * h), p2: hostPoint(host, hi, s * h) })
  })
  const len = Math.hypot(host.b.x - host.a.x, host.b.y - host.a.y)
  const lo = Math.max(j1, 0)
  const hi = Math.min(j2, len)
  const outline = hi - lo > TOL ? [hostPoint(host, lo, -h), hostPoint(host, hi, -h), hostPoint(host, hi, h), hostPoint(host, lo, h)] : null
  return { jambs, faces, outline }
}

export interface ChainItem {
  side: Side
  a: Point // начало на грани (по t)
  b: Point
  lengthCm: number
  normal: Point // наружу от грани
  part: ChainPart
}

// цепочки размеров по граням: расстояние в сторону a | ширина | расстояние в сторону b
export function dimensionChains(d: Doorway, walls: readonly Wall[]): ChainItem[] {
  const host = hostOf(d, walls)
  if (!host) return []
  const h = host.thicknessCm / 2
  const [j1, j2] = jambsT(d, host)
  const out: ChainItem[] = []
  for (const side of SIDES) {
    const r = runFor(host, walls, side, j1, j2)
    if (!r) continue
    const normal = mul(perp(unit(host.a, host.b)), side)
    for (const [t0, t1, part] of [
      [r[0], j1, "a"],
      [j1, j2, "width"],
      [j2, r[1], "b"],
    ] as const)
      if (t1 - t0 > -TOL) out.push({ side, a: hostPoint(host, t0, side * h), b: hostPoint(host, t1, side * h), lengthCm: Math.max(0, t1 - t0), normal, part })
  }
  return out
}

const inRoom = (p: Point, rooms: readonly Room[]): boolean =>
  rooms.some((r) => pointInPolygon(p, r.outline) && !r.holes.some((hole) => pointInPolygon(p, hole)))

// сторона подписи высоты: помещение только с одной стороны — там; иначе слева на экране от a → b,
// т.е. сторона нормали (d.y, −d.x) — minus
export function heightLabelSide(d: Doorway, walls: readonly Wall[], rooms: readonly Room[]): Side | null {
  const host = hostOf(d, walls)
  if (!host) return null
  const [j1, j2] = jambsT(d, host)
  const t = (j1 + j2) / 2
  const probe = host.thicknessCm / 2 + 1
  const plus = inRoom(hostPoint(host, t, probe), rooms)
  const minus = inRoom(hostPoint(host, t, -probe), rooms)
  return plus !== minus ? (plus ? 1 : -1) : -1
}

// точка подписи: середина проёма на грани стороны подписи, отодвинутая наружу на gapCm
export function heightLabelAt(d: Doorway, walls: readonly Wall[], side: Side, gapCm: number): Point | null {
  const host = hostOf(d, walls)
  if (!host) return null
  const [j1, j2] = jambsT(d, host)
  return hostPoint(host, (j1 + j2) / 2, side * (host.thicknessCm / 2 + gapCm))
}

export type ChainPart = "a" | "width" | "b"

export interface ChainLabel {
  side: Side
  part: ChainPart
  at: Point // положение числа: середина размера на выносе offsetCm от грани
  lengthCm: number
}

// положения чисел цепочек (те же, что у отрисовки) — для попадания кликом по числу
export function chainLabels(d: Doorway, walls: readonly Wall[], offsetCm: number): ChainLabel[] {
  return dimensionChains(d, walls).map((item) => ({
    side: item.side,
    part: item.part,
    at: {
      x: (item.a.x + item.b.x) / 2 + item.normal.x * offsetCm,
      y: (item.a.y + item.b.y) / 2 + item.normal.y * offsetCm,
    },
    lengthCm: item.lengthCm,
  }))
}
