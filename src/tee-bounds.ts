import type { Segment } from "./edit-plan"
import { teeEndAttached } from "./geometry"
import { dominantAxis } from "./ortho-axis"
import type { WallEnd } from "./ortho-stretch"
import type { Point, Wall } from "./types"
import { RIGHT_SIN, add, cross, degenerate, dist, displayPolygons, dot, faceCornerTol, mul, pointInPolygon, sub, unit } from "./wall-geometry"

// Границы примкнутой стены (change wall-move-bounds, design D3): примыкания конца к оси или грани
// опорной стены, диапазон по видимой грани, проекция вектора правки и инвариант «примыкание
// сохраняется». Всё считается по исходной геометрии; стены не мутируются.

export interface Attachment {
  leg: Wall
  end: WallEnd
  host: Wall
  // исходное поперечное смещение конца от оси опорной (0 — на оси, ±h — на грани)
  lat: number
}

const COLLINEAR_SIN = Math.sin((15 * Math.PI) / 180)
const FACE_INSET_CM = 0.05
const WALK_STEP_CM = 0.5
const TOL = 1e-6

interface Frame {
  a: Point
  d: Point
  len: number
}

const frameOf = (s: Segment): Frame => ({ a: s.a, d: unit(s.a, s.b), len: dist(s.a, s.b) })
const alongOf = (f: Frame, p: Point): number => dot(sub(p, f.a), f.d)
const latOf = (f: Frame, p: Point): number => cross(f.d, sub(p, f.a))
// точка рамки: продольная координата и поперечное смещение (cross(d, n) = 1)
const pointOf = (f: Frame, along: number, lat: number): Point => add(f.a, add(mul(f.d, along), mul({ x: -f.d.y, y: f.d.x }, lat)))

export const otherEnd = (end: WallEnd): WallEnd => (end === "a" ? "b" : "a")

// ось орто для вектора — по большей составляющей (change ortho-axis-lock, design D5); null только
// для нулевого вектора
export function orthoAxisOf(v: Point): Point | null {
  const axis = dominantAxis(v)
  if (!axis) return null
  return axis === "x" ? { x: 1, y: 0 } : { x: 0, y: 1 }
}

// T-примыкания без углового стыка (определения «Перемещение стены за средний маркер»)
export function findAttachments(walls: readonly Wall[]): Attachment[] {
  const out: Attachment[] = []
  for (const leg of walls) {
    if (degenerate(leg)) continue
    for (const end of ["a", "b"] as const) {
      const p = leg[end]
      for (const host of walls) {
        if (host === leg || degenerate(host)) continue
        const tol = faceCornerTol(leg, host)
        if (dist(p, host.a) <= tol || dist(p, host.b) <= tol) continue
        if (teeEndAttached(p, leg, host)) out.push({ leg, end, host, lat: latOf(frameOf(host), p) })
      }
    }
  }
  return out
}

// исходный диапазон конца: lo — от начала оси опорной, hiFromB — от её конца; ext — исходная
// продольная координата, если она уже вне диапазона (старые чертежи)
interface RangeData {
  lo: number
  hiFromB: number
  along0: number
  extLo: number | null
  extHi: number | null
}

const footprint = (leg: Segment, legT: number, hostDir: Point): number => {
  const s = Math.abs(cross(unit(leg.a, leg.b), hostDir))
  return s < 1e-12 ? Infinity : legT / 2 / s
}

export interface TeeContext {
  attachments: readonly Attachment[]
  // допустимые продольные координаты конца для положений опорной и ножки
  allowed: (att: Attachment, host: Segment, leg: Segment) => [number, number]
  holds: (positions: ReadonlyMap<Wall, Segment>) => boolean
}

export function teeContext(walls: Wall[]): TeeContext {
  const attachments = findAttachments(walls)
  const ranges = new Map<Attachment, RangeData>()

  const coverPieces = (host: Wall): Point[][] => {
    const hd = unit(host.a, host.b)
    const corners = walls.filter((c) => {
      if (c === host || degenerate(c)) return false
      const tol = faceCornerTol(host, c)
      const atEnd = [host.a, host.b].some((e) => dist(c.a, e) <= tol || dist(c.b, e) <= tol)
      // коллинеарное продолжение грань не расширяет: ножка остаётся на той же опорной
      return atEnd && Math.abs(cross(hd, unit(c.a, c.b))) > COLLINEAR_SIN
    })
    return [host, ...corners].flatMap((w) => displayPolygons(w, walls))
  }

  const rangeData = (att: Attachment): RangeData => {
    const known = ranges.get(att)
    if (known) return known
    const host = att.host
    const f = frameOf(host)
    const p = att.leg[att.end]
    const along0 = alongOf(f, p)
    const lat = latOf(f, att.leg[otherEnd(att.end)])
    const side = att.lat !== 0 ? Math.sign(att.lat) : lat !== 0 ? Math.sign(lat) : 1
    const lineLat = side * (host.thicknessCm / 2 - FACE_INSET_CM)
    const pieces = coverPieces(host)
    const covered = (along: number): boolean => pieces.some((poly) => pointInPolygon(pointOf(f, along, lineLat), poly))
    const reach = walls.reduce((m, w) => Math.max(m, w.thicknessCm), 0) * 2 + WALK_STEP_CM
    const edge = (dir: 1 | -1): number => {
      let inside = along0
      const limit = dir > 0 ? f.len + reach : -reach
      while (dir > 0 ? inside < limit : inside > limit) {
        const next = inside + dir * WALK_STEP_CM
        if (!covered(next)) {
          let outside = next
          for (let i = 0; i < 40; i++) {
            const mid = (inside + outside) / 2
            if (covered(mid)) inside = mid
            else outside = mid
          }
          return inside
        }
        inside = next
      }
      return inside
    }
    const start = covered(along0)
    const lo = start ? edge(-1) : 0
    const hi = start ? edge(1) : f.len
    const fp = footprint(att.leg, att.leg.thicknessCm, f.d)
    const data: RangeData = {
      lo,
      hiFromB: hi - f.len,
      along0,
      extLo: along0 < lo + fp ? along0 : null,
      extHi: along0 > hi - fp ? along0 : null,
    }
    ranges.set(att, data)
    return data
  }

  const allowed = (att: Attachment, host: Segment, leg: Segment): [number, number] => {
    const r = rangeData(att)
    const f = frameOf(host)
    const fp = footprint(leg, att.leg.thicknessCm, f.d)
    let lo = r.lo + fp
    let hi = f.len + r.hiFromB - fp
    if (r.extLo !== null) lo = Math.min(lo, r.extLo)
    if (r.extHi !== null) hi = Math.max(hi, r.extHi)
    return [lo, hi]
  }

  const holds = (positions: ReadonlyMap<Wall, Segment>): boolean =>
    attachments.every((att) => {
      const leg = positions.get(att.leg)
      const host = positions.get(att.host)
      if (!leg && !host) return true
      const ls = leg ?? att.leg
      const hs = host ?? att.host
      if (dist(hs.a, hs.b) < 1e-9) return false
      const f = frameOf(hs)
      const p = ls[att.end]
      if (Math.abs(latOf(f, p) - att.lat) > TOL) return false
      const along = alongOf(f, p)
      const [lo, hi] = allowed(att, hs, ls)
      return along >= lo - TOL && along <= hi + TOL
    })

  return { attachments, allowed, holds }
}

// проекция вектора перемещения стен group (design D3): только вдоль опорных стен в пересечении
// диапазонов; непараллельные опорные или ось орто поперёк опорной — смещения нет
export function projectMove(v: Point, group: readonly Wall[], ctx: TeeContext, ortho: boolean): Point {
  const atts = ctx.attachments.filter((a) => group.includes(a.leg) && !group.includes(a.host))
  if (!atts.length) return v
  const d0 = unit(atts[0].host.a, atts[0].host.b)
  if (atts.some((a) => Math.abs(cross(d0, unit(a.host.a, a.host.b))) > RIGHT_SIN)) return { x: 0, y: 0 }
  if (ortho) {
    const axis = orthoAxisOf(v)
    if (axis && Math.abs(cross(d0, axis)) > RIGHT_SIN) return { x: 0, y: 0 }
  }
  let sMin = -Infinity
  let sMax = Infinity
  for (const a of atts) {
    const f = frameOf(a.host)
    const along0 = alongOf(f, a.leg[a.end])
    const [lo, hi] = ctx.allowed(a, a.host, a.leg)
    const sigma = dot(f.d, d0) > 0 ? 1 : -1
    const r0 = sigma > 0 ? lo - along0 : along0 - hi
    const r1 = sigma > 0 ? hi - along0 : along0 - lo
    sMin = Math.max(sMin, r0)
    sMax = Math.min(sMax, r1)
  }
  if (sMin > sMax) return { x: 0, y: 0 }
  const s = Math.max(sMin, Math.min(sMax, dot(v, d0)))
  return mul(d0, s)
}

// положение примкнутого конца для запрошенной точки (design D3): линия исходного поперечного
// смещения, диапазон с углом ножки для нового положения; при орто — пересечение с осью орто
// через противоположный конец, иначе конец остаётся на месте
export function projectEnd(target: Point, att: Attachment, ctx: TeeContext, ortho: boolean): Point {
  const leg = att.leg
  const base = leg[att.end]
  const other = leg[otherEnd(att.end)]
  const f = frameOf(att.host)
  const segFor = (p: Point): Segment => (att.end === "a" ? { a: p, b: other } : { a: other, b: p })
  const feasible = (along: number): boolean => {
    const p = pointOf(f, along, att.lat)
    if (dist(p, other) < 1e-9) return false
    const [lo, hi] = ctx.allowed(att, att.host, segFor(p))
    return along >= lo && along <= hi
  }
  let along = alongOf(f, target)
  const axis = ortho ? orthoAxisOf(sub(target, other)) : null
  if (axis) {
    const denom = cross(axis, f.d)
    if (Math.abs(denom) < 1e-9) return base
    // точка оси орто other + axis·t на линии поперечного смещения lat
    const t = (att.lat - latOf(f, other)) / cross(f.d, axis)
    along = alongOf(f, add(other, mul(axis, t)))
    return feasible(along) ? pointOf(f, along, att.lat) : base
  }
  if (feasible(along)) return pointOf(f, along, att.lat)
  let ok = alongOf(f, base)
  let bad = along
  for (let i = 0; i < 60; i++) {
    const mid = (ok + bad) / 2
    if (feasible(mid)) ok = mid
    else bad = mid
  }
  return pointOf(f, ok, att.lat)
}
