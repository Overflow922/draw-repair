import type { Room } from "../room-area"
import type { Point, Wall, WallDoor, WallElement, WallWindow } from "../types"
import { RIGHT_SIN, add, clipHalfPlane, dot, lerp, mul, perp, pointInPolygon, polygonArea, sub, unit } from "../wall-geometry"
import type { Seg } from "../wall-geometry"
import { elementRuns, hostOf, hostPoint, jambsT } from "./doorway-faces"
import type { Side } from "./doorway-faces"

// Геометрия отображения проёмов в мировых координатах (change add-doorway, design D2, D7, D10):
// вырез кусков формы стены, контур без граней в проёме, откосы и продолжения граней,
// цепочки размеров, сторона подписи высоты. Каноническая форма стены не меняется.

const TOL = 1e-6
const MIN_AREA = 1e-6
const SIDES: Side[] = [1, -1]

const doorwaysOf = (host: Wall, walls: readonly Wall[], doorways: readonly WallElement[]): WallElement[] =>
  doorways.filter((d) => d.wallId === host.id && hostOf(d, walls) === host)

// куски формы стены без участков её проёмов: каждый кусок режется полуплоскостями t ≤ j1 и t ≥ j2
export function cutPieces(host: Wall, pieces: Point[][], walls: readonly Wall[], doorways: readonly WallElement[]): Point[][] {
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
export function cutContour(host: Wall, segs: Seg[], walls: readonly Wall[], doorways: readonly WallElement[]): Seg[] {
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
function runFor(host: Wall, walls: readonly Wall[], elements: readonly WallElement[], side: Side, d: WallElement): [number, number] | null {
  const [j1, j2] = jambsT(d, host)
  let best: [number, number] | null = null
  let score = -Infinity
  for (const r of elementRuns(host, walls, elements, side, d)) {
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
export function openingLines(d: WallElement, walls: readonly Wall[], elements: readonly WallElement[] = []): OpeningLines | null {
  const host = hostOf(d, walls)
  if (!host) return null
  const h = host.thicknessCm / 2
  const [j1, j2] = jambsT(d, host)
  const runs = SIDES.map((s) => runFor(host, walls, elements, s, d))
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

export interface WindowLines {
  jambs: Seg[] // откосы — линии контура
  faces: Seg[] // грани через окно — линии контура
  squares: Seg[] // квадраты оконного блока у откосов — линии контура
  glass: Seg[] // стёкла — тонкие линии
  outline: Point[] | null
}

// обозначение окна в рамке оси опорной стены (change add-window, design D5): квадраты 0.6·T у откосов
// по центру толщины, стёкла на ±T/6 от квадрата до квадрата; всё отсекается по видимым граням
export function windowLines(w: WallWindow, walls: readonly Wall[], elements: readonly WallElement[] = []): WindowLines | null {
  const opening = openingLines(w, walls, elements)
  const host = hostOf(w, walls)
  if (!opening || !host) return null
  const t = host.thicknessCm
  const s = 0.6 * t
  const [j1, j2] = jambsT(w, host)
  const runs = SIDES.map((side) => runFor(host, walls, elements, side, w))
  // участок оси, видимый на обеих гранях
  const lo = Math.max(j1, ...runs.map((r) => (r ? r[0] : Infinity)))
  const hi = Math.min(j2, ...runs.map((r) => (r ? r[1] : -Infinity)))
  const along = (t0: number, t1: number, lat: number): Seg[] => {
    const a = Math.max(t0, lo)
    const b = Math.min(t1, hi)
    return b - a > TOL ? [{ p1: hostPoint(host, a, lat), p2: hostPoint(host, b, lat) }] : []
  }
  const across = (at: number, lat0: number, lat1: number): Seg[] =>
    at >= lo - TOL && at <= hi + TOL ? [{ p1: hostPoint(host, at, lat0), p2: hostPoint(host, at, lat1) }] : []
  const square = (t0: number, t1: number): Seg[] => [
    ...along(t0, t1, -s / 2),
    ...along(t0, t1, s / 2),
    ...across(t0, -s / 2, s / 2),
    ...across(t1, -s / 2, s / 2),
  ]
  const glass = j2 - j1 > 2 * s ? [...along(j1 + s, j2 - s, -t / 6), ...along(j1 + s, j2 - s, t / 6)] : []
  return {
    jambs: opening.jambs,
    faces: opening.faces,
    squares: [...square(j1, j1 + s), ...square(j2 - s, j2)],
    glass,
    outline: opening.outline,
  }
}

const DOOR_OPEN_RAD = (95 * Math.PI) / 180
const LEAF_CM = 4

export interface DoorLeaf {
  leaf: Point[] // 4 угла прямоугольника полотна
  hinge: Point // петля — центр дуги
  radius: number
  arcFrom: Point // конец закрытого положения полотна
  arcTo: Point // открытый конец полотна
  side: Side // грань открывания по нормали perp(d)
}

// обозначение двери (change add-door, design D3): петля на грани стороны открывания у откоса петель, полотно
// длиной в ширину под 95° от грани в сторону открывания, толщиной 4 см вне сектора, дуга от закрытого положения
export function doorLeaf(d: WallDoor, walls: readonly Wall[]): DoorLeaf | null {
  const host = hostOf(d, walls)
  if (!host) return null
  const axis = unit(host.a, host.b)
  // left — нормаль (d.y, −d.x), то есть −perp(d)
  const side: Side = d.swing === "left" ? -1 : 1
  const [j1, j2] = jambsT(d, host)
  const hinge = hostPoint(host, d.hinge === "a" ? j1 : j2, (side * host.thicknessCm) / 2)
  const u = d.hinge === "a" ? axis : mul(axis, -1)
  const n = mul(perp(axis), side)
  const v = add(mul(u, Math.cos(DOOR_OPEN_RAD)), mul(n, Math.sin(DOOR_OPEN_RAD)))
  const w = d.widthCm
  const arcTo = add(hinge, mul(v, w))
  // толщина полотна — по нормали к нему в сторону, где нет закрытого положения
  const across = perp(v)
  const away = dot(across, u) < 0 ? across : mul(across, -1)
  const thick = mul(away, LEAF_CM)
  return {
    leaf: [hinge, arcTo, add(arcTo, thick), add(hinge, thick)],
    hinge,
    radius: w,
    arcFrom: add(hinge, mul(u, w)),
    arcTo,
    side,
  }
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
export function dimensionChains(d: WallElement, walls: readonly Wall[], elements: readonly WallElement[] = []): ChainItem[] {
  const host = hostOf(d, walls)
  if (!host) return []
  const h = host.thicknessCm / 2
  const [j1, j2] = jambsT(d, host)
  const out: ChainItem[] = []
  for (const side of SIDES) {
    const r = runFor(host, walls, elements, side, d)
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
export function heightLabelSide(d: WallElement, walls: readonly Wall[], rooms: readonly Room[]): Side | null {
  const host = hostOf(d, walls)
  if (!host) return null
  const [j1, j2] = jambsT(d, host)
  const t = (j1 + j2) / 2
  const probe = host.thicknessCm / 2 + 1
  const plus = inRoom(hostPoint(host, t, probe), rooms)
  const minus = inRoom(hostPoint(host, t, -probe), rooms)
  return plus !== minus ? (plus ? 1 : -1) : -1
}

// направление текста подписи вдоль оси опорной стены, не вверх ногами (add-window design D6):
// у вертикальной стены (допуск прямого угла) — вверх на экране, иначе — слева направо
export function labelDirection(d: WallElement, walls: readonly Wall[]): Point | null {
  const host = hostOf(d, walls)
  if (!host) return null
  const u = unit(host.a, host.b)
  const flip = Math.abs(u.x) <= RIGHT_SIN ? u.y > 0 : u.x < 0
  return flip ? mul(u, -1) : u
}

// точка подписи: середина проёма на грани стороны подписи, отодвинутая наружу на gapCm
export function heightLabelAt(d: WallElement, walls: readonly Wall[], side: Side, gapCm: number): Point | null {
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
export function chainLabels(d: WallElement, walls: readonly Wall[], offsetCm: number, elements: readonly WallElement[] = []): ChainLabel[] {
  return dimensionChains(d, walls, elements).map((item) => ({
    side: item.side,
    part: item.part,
    at: {
      x: (item.a.x + item.b.x) / 2 + item.normal.x * offsetCm,
      y: (item.a.y + item.b.y) / 2 + item.normal.y * offsetCm,
    },
    lengthCm: item.lengthCm,
  }))
}
