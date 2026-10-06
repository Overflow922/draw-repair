import type { Doorway, Point, Wall } from "../types"
import { RIGHT_SIN, dist, dot, sub, unit } from "../wall-geometry"
import { faceRuns, hostOf, jambsT } from "./doorway-faces"
import type { Side } from "./doorway-faces"

// Установка и правка проёма (change add-doorway, design D4): запрос → ближайшее допустимое
// значение по свободным участкам обеих граней. Чистые функции, исходный проём не мутируется.

export type DoorwayEdit = { kind: "applied"; doorway: Doorway } | { kind: "rejected"; reason: "invalid" | "no-change" }

const TOL = 1e-6
const NO_CHANGE: DoorwayEdit = { kind: "rejected", reason: "no-change" }
const INVALID: DoorwayEdit = { kind: "rejected", reason: "invalid" }

type Interval = [number, number]

const isLength = (v: number): boolean => Number.isFinite(v)

// свободные промежутки стены: пересечения участков граней plus и minus
function freeIntervals(host: Wall, walls: readonly Wall[]): Interval[] {
  const out: Interval[] = []
  for (const p of faceRuns(host, walls, 1))
    for (const m of faceRuns(host, walls, -1)) {
      const lo = Math.max(p[0], m[0])
      const hi = Math.min(p[1], m[1])
      if (hi - lo > TOL) out.push([lo, hi])
    }
  return out.sort((x, y) => x[0] - y[0])
}

// промежуток текущего положения: наибольшее перекрытие с проёмом, иначе ближайший
function currentInterval(intervals: Interval[], j1: number, j2: number): Interval | null {
  let best: Interval | null = null
  let bestScore = -Infinity
  for (const iv of intervals) {
    const score = Math.min(iv[1], j2) - Math.max(iv[0], j1)
    if (score > bestScore) {
      best = iv
      bestScore = score
    }
  }
  return best
}

// допустимые положения ближнего к a откоса при ширине width внутри промежутка
const startRange = (iv: Interval, width: number): Interval | null =>
  iv[1] - iv[0] >= width - TOL ? [iv[0], Math.max(iv[0], iv[1] - width)] : null

const clamp = (v: number, [lo, hi]: Interval): number => Math.max(lo, Math.min(hi, v))

function withStart(d: Doorway, host: Wall, j1: number, width: number, anchor: "a" | "b"): Doorway {
  const len = dist(host.a, host.b)
  return { ...d, anchor, widthCm: width, offsetCm: anchor === "a" ? j1 : len - j1 - width }
}

function result(before: Doorway, after: Doorway): DoorwayEdit {
  const same =
    after.anchor === before.anchor &&
    Math.abs(after.offsetCm - before.offsetCm) <= TOL &&
    Math.abs(after.widthCm - before.widthCm) <= TOL &&
    after.heightCm === before.heightCm
  return same ? NO_CHANGE : { kind: "applied", doorway: after }
}

// проекция точки на ось стены: t от конца a
const alongAxis = (host: Wall, p: Point): number => dot(sub(p, host.a), unit(host.a, host.b))

export function placeDoorway(host: Wall, walls: readonly Wall[], cursor: Point, widthCm: number, heightCm: number, id: string): Doorway | null {
  if (!(widthCm > 0) || !(heightCm > 0)) return null
  const want = Math.round(alongAxis(host, cursor)) - widthCm / 2
  let best: number | null = null
  for (const iv of freeIntervals(host, walls)) {
    const range = startRange(iv, widthCm)
    if (!range) continue
    const j1 = clamp(want, range)
    if (best === null || Math.abs(j1 - want) < Math.abs(best - want)) best = j1
  }
  if (best === null) return null
  const len = dist(host.a, host.b)
  const anchor = best <= len - best - widthCm ? "a" : "b"
  return withStart({ id, wallId: host.id, anchor, offsetCm: 0, widthCm, heightCm }, host, best, widthCm, anchor)
}

interface Frame {
  host: Wall
  j1: number
  j2: number
  free: Interval
}

function frameOf(d: Doorway, walls: readonly Wall[]): Frame | null {
  const host = hostOf(d, walls)
  if (!host) return null
  const [j1, j2] = jambsT(d, host)
  const free = currentInterval(freeIntervals(host, walls), j1, j2)
  return free ? { host, j1, j2, free } : null
}

export function setDistance(d: Doorway, walls: readonly Wall[], side: Side, toward: "a" | "b", valueCm: number): DoorwayEdit {
  if (!isLength(valueCm) || valueCm < 0) return INVALID
  const f = frameOf(d, walls)
  if (!f) return NO_CHANGE
  const run = currentInterval(faceRuns(f.host, walls, side), f.j1, f.j2)
  const range = startRange(f.free, d.widthCm)
  if (!run || !range) return NO_CHANGE
  const want = toward === "a" ? run[0] + valueCm : run[1] - valueCm - d.widthCm
  const j1 = Math.abs(want - f.j1) <= TOL ? f.j1 : clamp(want, range)
  return result(d, withStart(d, f.host, j1, d.widthCm, toward))
}

export function setWidth(d: Doorway, walls: readonly Wall[], valueCm: number): DoorwayEdit {
  if (!isLength(valueCm) || valueCm <= 0) return INVALID
  const f = frameOf(d, walls)
  if (!f) return NO_CHANGE
  // неподвижен откос со стороны привязки
  const max = d.anchor === "a" ? f.free[1] - f.j1 : f.j2 - f.free[0]
  const width = Math.min(valueCm, Math.max(0, max))
  if (!(width > 0)) return NO_CHANGE
  const j1 = d.anchor === "a" ? f.j1 : f.j2 - width
  return result(d, withStart(d, f.host, j1, width, d.anchor))
}

export function setHeight(d: Doorway, valueCm: number): DoorwayEdit {
  if (!isLength(valueCm) || valueCm <= 0) return INVALID
  return valueCm === d.heightCm ? NO_CHANGE : { kind: "applied", doorway: { ...d, heightCm: valueCm } }
}

// сдвиг вдоль оси в пределах текущего промежутка: проём не переходит через стыки
function shift(d: Doorway, walls: readonly Wall[], deltaT: number, round: boolean): DoorwayEdit {
  const f = frameOf(d, walls)
  if (!f) return NO_CHANGE
  const range = startRange(f.free, d.widthCm)
  if (!range) return NO_CHANGE
  const sign = d.anchor === "a" ? 1 : -1
  const offset = d.offsetCm + sign * deltaT
  const wanted = { ...d, offsetCm: round ? Math.round(offset) : offset }
  const j1 = clamp(jambsT(wanted, f.host)[0], range)
  return result(d, withStart(d, f.host, j1, d.widthCm, d.anchor))
}

export function slideDoorway(d: Doorway, walls: readonly Wall[], deltaWorld: Point): DoorwayEdit {
  const host = hostOf(d, walls)
  if (!host) return NO_CHANGE
  const deltaT = dot(deltaWorld, unit(host.a, host.b))
  if (Math.abs(deltaT) < TOL) return NO_CHANGE
  return shift(d, walls, deltaT, true)
}

export function arrowSlide(d: Doorway, walls: readonly Wall[], arrow: Point, stepCm: number): DoorwayEdit {
  const host = hostOf(d, walls)
  if (!host) return NO_CHANGE
  const len = Math.hypot(arrow.x, arrow.y)
  if (len < TOL) return NO_CHANGE
  const c = dot(arrow, unit(host.a, host.b)) / len
  // ось перпендикулярна стрелке в пределах допуска прямого угла
  if (Math.abs(c) <= RIGHT_SIN) return NO_CHANGE
  return shift(d, walls, Math.sign(c) * stepCm, false)
}
