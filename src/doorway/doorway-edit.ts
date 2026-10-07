import type { DoorHinge, DoorSwing, Doorway, Point, Wall, WallDoor, WallElement, WallWindow } from "../types"
import { RIGHT_SIN, dist, dot, sub, unit } from "../wall-geometry"
import { elementRuns, hostOf, hostPoint, jambsT } from "./doorway-faces"
import type { Side } from "./doorway-faces"
import { nextDirection } from "./element-kind"

// Установка и правка элемента стены (change add-doorway design D4; add-window design D3): запрос →
// ближайшее допустимое значение по свободным участкам обеих граней, откосы соседних элементов —
// стыки. Вид и данные вида сохраняются. Чистые функции, исходный элемент не мутируется.

export type ElementEdit<E extends WallElement = WallElement> =
  | { kind: "applied"; doorway: E }
  | { kind: "rejected"; reason: "invalid" | "no-change" }
export type DoorwayEdit = ElementEdit<Doorway>

const TOL = 1e-6
const NO_CHANGE = { kind: "rejected", reason: "no-change" } as const
const INVALID = { kind: "rejected", reason: "invalid" } as const

type Interval = [number, number]

const isLength = (v: number): boolean => Number.isFinite(v)

// свободные промежутки стены для элемента self: пересечения участков граней plus и minus
function freeIntervals(host: Wall, walls: readonly Wall[], elements: readonly WallElement[], self: WallElement): Interval[] {
  const out: Interval[] = []
  for (const p of elementRuns(host, walls, elements, 1, self))
    for (const m of elementRuns(host, walls, elements, -1, self)) {
      const lo = Math.max(p[0], m[0])
      const hi = Math.min(p[1], m[1])
      if (hi - lo > TOL) out.push([lo, hi])
    }
  return out.sort((x, y) => x[0] - y[0])
}

// промежуток текущего положения: наибольшее перекрытие с элементом, иначе ближайший
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

function withStart<E extends WallElement>(d: E, host: Wall, j1: number, width: number, anchor: "a" | "b"): E {
  const len = dist(host.a, host.b)
  return { ...d, anchor, widthCm: width, offsetCm: anchor === "a" ? j1 : len - j1 - width }
}

const sillOf = (e: WallElement): number | null => (e.kind === "window" ? e.sillCm : null)
const directionOf = (e: WallElement): string | null => (e.kind === "door" ? `${e.hinge}/${e.swing}` : null)

function result<E extends WallElement>(before: E, after: E): ElementEdit<E> {
  const same =
    after.anchor === before.anchor &&
    Math.abs(after.offsetCm - before.offsetCm) <= TOL &&
    Math.abs(after.widthCm - before.widthCm) <= TOL &&
    after.heightCm === before.heightCm &&
    sillOf(after) === sillOf(before) &&
    directionOf(after) === directionOf(before)
  return same ? NO_CHANGE : { kind: "applied", doorway: after }
}

// проекция точки на ось стены: t от конца a
const alongAxis = (host: Wall, p: Point): number => dot(sub(p, host.a), unit(host.a, host.b))

// положение призрака: центр в проекции курсора, округлённой до 1 см, иначе ближайшее допустимое
function place<E extends WallElement>(host: Wall, walls: readonly Wall[], cursor: Point, proto: E, elements: readonly WallElement[]): E | null {
  const widthCm = proto.widthCm
  const want = Math.round(alongAxis(host, cursor)) - widthCm / 2
  let best: number | null = null
  for (const iv of freeIntervals(host, walls, elements, proto)) {
    const range = startRange(iv, widthCm)
    if (!range) continue
    const j1 = clamp(want, range)
    if (best === null || Math.abs(j1 - want) < Math.abs(best - want)) best = j1
  }
  if (best === null) return null
  const len = dist(host.a, host.b)
  const anchor = best <= len - best - widthCm ? "a" : "b"
  return withStart(proto, host, best, widthCm, anchor)
}

export function placeDoorway(
  host: Wall,
  walls: readonly Wall[],
  cursor: Point,
  widthCm: number,
  heightCm: number,
  id: string,
  elements: readonly WallElement[] = [],
): Doorway | null {
  if (!(widthCm > 0) || !(heightCm > 0)) return null
  return place(host, walls, cursor, { id, wallId: host.id, anchor: "a", offsetCm: 0, widthCm, heightCm }, elements)
}

export function placeWindow(
  host: Wall,
  walls: readonly Wall[],
  cursor: Point,
  widthCm: number,
  heightCm: number,
  sillCm: number,
  id: string,
  elements: readonly WallElement[],
): WallWindow | null {
  if (!(widthCm > 0) || !(heightCm > 0) || !isLength(sillCm) || sillCm < 0) return null
  const proto: WallWindow = { kind: "window", id, wallId: host.id, anchor: "a", offsetCm: 0, widthCm, heightCm, sillCm }
  return place(host, walls, cursor, proto, elements)
}

// дверь с направлением открывания относительно опорной стены (spec door «Дверь — элемент стены»)
export function placeDoor(
  host: Wall,
  walls: readonly Wall[],
  cursor: Point,
  widthCm: number,
  heightCm: number,
  hinge: DoorHinge,
  swing: DoorSwing,
  id: string,
  elements: readonly WallElement[],
): WallDoor | null {
  if (!(widthCm > 0) || !(heightCm > 0)) return null
  const proto: WallDoor = { kind: "door", id, wallId: host.id, anchor: "a", offsetCm: 0, widthCm, heightCm, hinge, swing }
  return place(host, walls, cursor, proto, elements)
}

// следующее направление по кругу поворота; положение и размеры не меняются (spec door «Поворот двери»)
export function rotateDoor(d: WallDoor): ElementEdit<WallDoor> {
  return { kind: "applied", doorway: { ...d, ...nextDirection(d) } }
}

interface Frame {
  host: Wall
  j1: number
  j2: number
  free: Interval
}

function frameOf(d: WallElement, walls: readonly Wall[], elements: readonly WallElement[]): Frame | null {
  const host = hostOf(d, walls)
  if (!host) return null
  const [j1, j2] = jambsT(d, host)
  const free = currentInterval(freeIntervals(host, walls, elements, d), j1, j2)
  return free ? { host, j1, j2, free } : null
}

export function setDistance<E extends WallElement>(
  d: E,
  walls: readonly Wall[],
  side: Side,
  toward: "a" | "b",
  valueCm: number,
  elements: readonly WallElement[] = [],
): ElementEdit<E> {
  if (!isLength(valueCm) || valueCm < 0) return INVALID
  const f = frameOf(d, walls, elements)
  if (!f) return NO_CHANGE
  const run = currentInterval(elementRuns(f.host, walls, elements, side, d), f.j1, f.j2)
  const range = startRange(f.free, d.widthCm)
  if (!run || !range) return NO_CHANGE
  const want = toward === "a" ? run[0] + valueCm : run[1] - valueCm - d.widthCm
  const j1 = Math.abs(want - f.j1) <= TOL ? f.j1 : clamp(want, range)
  return result(d, withStart(d, f.host, j1, d.widthCm, toward))
}

export function setWidth<E extends WallElement>(d: E, walls: readonly Wall[], valueCm: number, elements: readonly WallElement[] = []): ElementEdit<E> {
  if (!isLength(valueCm) || valueCm <= 0) return INVALID
  const f = frameOf(d, walls, elements)
  if (!f) return NO_CHANGE
  // неподвижен откос со стороны привязки
  const max = d.anchor === "a" ? f.free[1] - f.j1 : f.j2 - f.free[0]
  const width = Math.min(valueCm, Math.max(0, max))
  if (!(width > 0)) return NO_CHANGE
  const j1 = d.anchor === "a" ? f.j1 : f.j2 - width
  return result(d, withStart(d, f.host, j1, width, d.anchor))
}

export function setHeight<E extends WallElement>(d: E, valueCm: number): ElementEdit<E> {
  if (!isLength(valueCm) || valueCm <= 0) return INVALID
  return valueCm === d.heightCm ? NO_CHANGE : { kind: "applied", doorway: { ...d, heightCm: valueCm } }
}

// высота подоконника окна: конечное число ≥ 0 (spec window «Окно — элемент стены»)
export function setSill(w: WallWindow, valueCm: number): ElementEdit<WallWindow> {
  if (!isLength(valueCm) || valueCm < 0) return INVALID
  return valueCm === w.sillCm ? NO_CHANGE : { kind: "applied", doorway: { ...w, sillCm: valueCm } }
}

// сдвиг вдоль оси в пределах текущего промежутка: элемент не переходит через стыки и соседей;
// уже нарушенный элемент может остаться на месте — диапазон расширяется до текущего положения
function shift<E extends WallElement>(d: E, walls: readonly Wall[], deltaT: number, round: boolean, elements: readonly WallElement[]): ElementEdit<E> {
  const f = frameOf(d, walls, elements)
  if (!f) return NO_CHANGE
  const range = startRange(f.free, d.widthCm)
  if (!range) return NO_CHANGE
  const allowed: Interval = [Math.min(range[0], f.j1), Math.max(range[1], f.j1)]
  const sign = d.anchor === "a" ? 1 : -1
  const offset = d.offsetCm + sign * deltaT
  const wanted = { ...d, offsetCm: round ? Math.round(offset) : offset }
  const j1 = clamp(jambsT(wanted, f.host)[0], allowed)
  return result(d, withStart(d, f.host, j1, d.widthCm, d.anchor))
}

export function slideDoorway<E extends WallElement>(d: E, walls: readonly Wall[], deltaWorld: Point, elements: readonly WallElement[] = []): ElementEdit<E> {
  const host = hostOf(d, walls)
  if (!host) return NO_CHANGE
  const deltaT = dot(deltaWorld, unit(host.a, host.b))
  if (Math.abs(deltaT) < TOL) return NO_CHANGE
  return shift(d, walls, deltaT, true, elements)
}

export function arrowSlide<E extends WallElement>(
  d: E,
  walls: readonly Wall[],
  arrow: Point,
  stepCm: number,
  elements: readonly WallElement[] = [],
): ElementEdit<E> {
  const host = hostOf(d, walls)
  if (!host) return NO_CHANGE
  const len = Math.hypot(arrow.x, arrow.y)
  if (len < TOL) return NO_CHANGE
  const c = dot(arrow, unit(host.a, host.b)) / len
  // ось перпендикулярна стрелке в пределах допуска прямого угла
  if (Math.abs(c) <= RIGHT_SIN) return NO_CHANGE
  return shift(d, walls, Math.sign(c) * stepCm, false, elements)
}

// стрелки по нескольким элементам: ведущий по направлению сдвига — первым, каждый — с уже
// обновлённым списком, чтобы пара в касании сдвигалась вместе (add-window design D3)
export function nudgeElements(
  selected: readonly WallElement[],
  walls: readonly Wall[],
  elements: readonly WallElement[],
  arrow: Point,
  stepCm: number,
): WallElement[] {
  // проекция середины элемента на направление стрелки
  const lead = (e: WallElement): number => {
    const host = hostOf(e, walls)
    if (!host) return -Infinity
    const [j1, j2] = jambsT(e, host)
    return dot(hostPoint(host, (j1 + j2) / 2, 0), arrow)
  }
  const ids = new Set(selected.map((e) => e.id))
  const order = [...elements].filter((e) => ids.has(e.id)).sort((p, q) => lead(q) - lead(p))
  let list = [...elements]
  for (const e of order) {
    const current = list.find((x) => x.id === e.id)
    if (!current) continue
    const r = arrowSlide(current, walls, arrow, stepCm, list)
    if (r.kind !== "applied") continue
    list = list.map((x) => (x === current ? r.doorway : x))
  }
  return list
}
