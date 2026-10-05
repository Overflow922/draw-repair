import { attachedEnds, followingEnds, teeEndAttached } from "./geometry"
import { planOrthoStretch } from "./ortho-stretch"
import type { WallEnd } from "./ortho-stretch"
import { findAttachments } from "./tee-bounds"
import type { Attachment } from "./tee-bounds"
import type { Point, Wall } from "./types"
import { add, degenerate, dist, dot, faceCornerTol, mul, sub, unit } from "./wall-geometry"

// Правка как функция вектора (change wall-move-bounds, design D2): план строится по исходной
// геометрии, positions(v) возвращает новые оси изменяемых стен без мутации. Правила следования —
// существующие примитивы (followingEnds, attachedEnds, planOrthoStretch).

export interface Segment {
  a: Point
  b: Point
}

export type EditKind =
  | { kind: "move"; group: readonly Wall[] } // перемещение, группа, стрелки
  | { kind: "end"; wall: Wall; end: WallEnd } // перетаскивание конца, ввод длины

export interface EditPlan {
  positions: (v: Point) => ReadonlyMap<Wall, Segment>
}

// смещаемый конец ставится в anchor + v: anchor — сам конец или точка сварки
interface EndAnchors {
  a: Point | null
  b: Point | null
}

type Anchors = ReadonlyMap<Wall, EndAnchors>

function freeAnchors(walls: Wall[], edit: EditKind): Anchors {
  const out = new Map<Wall, EndAnchors>()
  if (edit.kind === "move") {
    for (const g of edit.group) out.set(g, { a: g.a, b: g.b })
    for (const w of walls) {
      if (edit.group.includes(w) || degenerate(w)) continue
      const ends = followingEnds(w, walls, edit.group)
      if (ends.a || ends.b) out.set(w, { a: ends.a ? w.a : null, b: ends.b ? w.b : null })
    }
    return out
  }
  const base = edit.wall[edit.end]
  out.set(edit.wall, edit.end === "a" ? { a: base, b: null } : { a: null, b: base })
  // сварка: концы соседей ставятся в точное положение перемещаемого конца
  for (const { wall, end } of attachedEnds(walls, base, edit.wall)) {
    const prev = out.get(wall) ?? { a: null, b: null }
    out.set(wall, end === "a" ? { ...prev, a: base } : { ...prev, b: base })
  }
  return out
}

function orthoAnchors(walls: Wall[], edit: EditKind, v: Point): Anchors {
  const seed = edit.kind === "move" ? { kind: "walls" as const, walls: edit.group } : { kind: "end" as const, wall: edit.wall, end: edit.end }
  const out = new Map<Wall, EndAnchors>()
  for (const [w, m] of planOrthoStretch(walls, seed, v).moved) out.set(w, { a: m.a ? w.a : null, b: m.b ? w.b : null })
  return out
}

// конец p стены w свободен: нет стыка с концом другой стены и примыкания к её оси или грани
function endFree(p: Point, w: Wall, walls: readonly Wall[]): boolean {
  return !walls.some((c) => c !== w && !degenerate(c) &&
    (dist(p, c.a) <= faceCornerTol(w, c) || dist(p, c.b) <= faceCornerTol(w, c) || teeEndAttached(p, w, c)))
}

const samePoint = (p: Point, q: Point): boolean => p.x === q.x && p.y === q.y

// новое положение примкнутого конца в системе изменённой опорной: исходное поперечное смещение
// и расстояние вдоль оси от неподвижного конца опорной (от a, если смещены оба)
function followPoint(att: Attachment, host: Segment): Point {
  const h0 = att.host
  const d0 = unit(h0.a, h0.b)
  const along0 = dot(sub(att.leg[att.end], h0.a), d0)
  const len0 = dist(h0.a, h0.b)
  const fromB = !samePoint(host.a, h0.a) && samePoint(host.b, h0.b)
  const d = unit(host.a, host.b)
  const along = fromB ? dist(host.a, host.b) - (len0 - along0) : along0
  return add(add(host.a, mul(d, along)), mul({ x: -d.y, y: d.x }, att.lat))
}

// следование ножек за изменённой опорной (design D2a): конец, не смещённый планом, следует за
// опорной; ножка со свободным вторым концом — целиком; распространение, каждая стена один раз
function followHosts(base: Map<Wall, Segment>, attachments: readonly Attachment[], free: (att: Attachment) => boolean): Map<Wall, Segment> {
  const out = new Map(base)
  const followed = new Set<Wall>()
  let changed = true
  while (changed) {
    changed = false
    for (const att of attachments) {
      if (followed.has(att.leg)) continue
      const host = out.get(att.host)
      if (!host || (samePoint(host.a, att.host.a) && samePoint(host.b, att.host.b))) continue
      const current = out.get(att.leg) ?? { a: att.leg.a, b: att.leg.b }
      // конец уже смещён правилами следования — не трогаем
      if (!samePoint(current[att.end], att.leg[att.end])) continue
      if (dist(host.a, host.b) < 1e-9) continue
      const p = followPoint(att, host)
      const delta = sub(p, att.leg[att.end])
      const whole = !base.has(att.leg) && free(att)
      const other = att.end === "a" ? "b" : "a"
      const otherPoint = whole ? add(att.leg[other], delta) : current[other]
      out.set(att.leg, att.end === "a" ? { a: p, b: otherPoint } : { a: otherPoint, b: p })
      followed.add(att.leg)
      changed = true
    }
  }
  return out
}

export function planEdit(walls: Wall[], edit: EditKind, ortho: boolean): EditPlan {
  const attachments = findAttachments(walls)
  const freeOther = new Map<Attachment, boolean>()
  const free = (att: Attachment): boolean => {
    const known = freeOther.get(att)
    if (known !== undefined) return known
    const value = endFree(att.leg[att.end === "a" ? "b" : "a"], att.leg, walls)
    freeOther.set(att, value)
    return value
  }
  const fixed = ortho ? null : freeAnchors(walls, edit)
  // орто-план зависит от направления v (change ortho-stretch-move, design D2): кэш по направлению
  let cachedDir = ""
  let cached: Anchors = new Map()
  const anchorsFor = (v: Point): Anchors => {
    if (fixed) return fixed
    const len = Math.hypot(v.x, v.y)
    if (len === 0) return new Map()
    const key = `${(v.x / len).toFixed(12)},${(v.y / len).toFixed(12)}`
    if (key !== cachedDir) {
      cachedDir = key
      cached = orthoAnchors(walls, edit, v)
    }
    return cached
  }
  return {
    positions: (v) => {
      const out = new Map<Wall, Segment>()
      for (const [w, m] of anchorsFor(v)) out.set(w, { a: m.a ? add(m.a, v) : w.a, b: m.b ? add(m.b, v) : w.b })
      return followHosts(out, attachments, free)
    },
  }
}
