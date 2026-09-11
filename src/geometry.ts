import { ZOOM_MAX, ZOOM_MIN } from "./types"
import type { Dimension, DimPoint, EdgeRef, Point, View, Wall } from "./types"

const EPS = 1e-6

export function zoomAt(view: View, factor: number, anchor: Point, pxPerCm: number): View {
  const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, view.zoom * factor))
  const world = { x: view.pan.x + anchor.x / (pxPerCm * view.zoom), y: view.pan.y + anchor.y / (pxPerCm * view.zoom) }
  return { zoom, pan: { x: world.x - anchor.x / (pxPerCm * zoom), y: world.y - anchor.y / (pxPerCm * zoom) } }
}

export function visibleWorld(view: View, w: number, h: number, pxPerCm: number): { min: Point; max: Point } {
  return {
    min: view.pan,
    max: { x: view.pan.x + w / (pxPerCm * view.zoom), y: view.pan.y + h / (pxPerCm * view.zoom) },
  }
}

export function pointsEqual(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function projectOnSegment(p: Point, w: Wall): Point {
  const dx = w.b.x - w.a.x
  const dy = w.b.y - w.a.y
  const len2 = dx * dx + dy * dy
  if (len2 < EPS) return w.a
  const t = Math.max(0, Math.min(1, ((p.x - w.a.x) * dx + (p.y - w.a.y) * dy) / len2))
  return { x: w.a.x + t * dx, y: w.a.y + t * dy }
}

const ORTHO_TAN = Math.tan((15 * Math.PI) / 180)

export function snap(cursor: Point, walls: Wall[], gridStepCm: number, radiusCm: number, orthoFrom?: Point): Point {
  let best: Point | null = null
  let bestDist = radiusCm
  const consider = (p: Point, d: number) => {
    if (d <= bestDist) {
      best = p
      bestDist = d
    }
  }
  for (const w of walls) {
    const dx = w.b.x - w.a.x
    const dy = w.b.y - w.a.y
    const len2 = dx * dx + dy * dy
    if (len2 < EPS) {
      consider(w.a, distance(cursor, w.a))
      continue
    }
    const raw = ((cursor.x - w.a.x) * dx + (cursor.y - w.a.y) * dy) / len2
    const foot = { x: w.a.x + raw * dx, y: w.a.y + raw * dy }
    if (raw < 0 || raw > 1) {
      const end = raw < 0 ? w.a : w.b
      const dEnd = distance(cursor, end)
      consider(dEnd <= radiusCm ? end : foot, dEnd <= radiusCm ? dEnd : distance(cursor, foot))
    } else {
      consider(foot, distance(cursor, foot))
    }
  }
  if (best) return best
  let p = cursor
  if (orthoFrom) {
    const dx = cursor.x - orthoFrom.x
    const dy = cursor.y - orthoFrom.y
    if (Math.abs(dy) <= ORTHO_TAN * Math.abs(dx)) p = { x: cursor.x, y: orthoFrom.y }
    else if (Math.abs(dx) <= ORTHO_TAN * Math.abs(dy)) p = { x: orthoFrom.x, y: cursor.y }
  }
  return {
    x: Math.round(p.x / gridStepCm) * gridStepCm,
    y: Math.round(p.y / gridStepCm) * gridStepCm,
  }
}

export function hitWall(p: Point, walls: Wall[], toleranceCm: number): Wall | null {
  let best: Wall | null = null
  let bestDist = Infinity
  for (const w of walls) {
    const d = distanceToWall(p, w)
    if (d <= Math.max(w.thicknessCm / 2, toleranceCm) && d < bestDist) {
      best = w
      bestDist = d
    }
  }
  return best
}

export function distanceToWall(p: Point, wall: Wall): number {
  return distance(p, projectOnSegment(p, wall))
}

export function endpointAt(p: Point, wall: Wall, radiusCm: number): "a" | "b" | null {
  if (distance(p, wall.a) <= radiusCm) return "a"
  if (distance(p, wall.b) <= radiusCm) return "b"
  return null
}

export function handleAt(p: Point, wall: Wall, radiusCm: number): "a" | "b" | "mid" | null {
  const end = endpointAt(p, wall, radiusCm)
  if (end) return end
  return distance(p, { x: (wall.a.x + wall.b.x) / 2, y: (wall.a.y + wall.b.y) / 2 }) <= radiusCm ? "mid" : null
}

export function segmentIntersectsRect(p1: Point, p2: Point, min: Point, max: Point, pad = 0): boolean {
  let t0 = 0
  let t1 = 1
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const clip = (p: number, q: number): boolean => {
    if (p === 0) return q >= 0
    const r = q / p
    if (p < 0) {
      if (r > t1) return false
      if (r > t0) t0 = r
    } else {
      if (r < t0) return false
      if (r < t1) t1 = r
    }
    return true
  }
  return clip(-dx, p1.x - min.x + pad) && clip(dx, max.x - p1.x + pad) &&
    clip(-dy, p1.y - min.y + pad) && clip(dy, max.y - p1.y + pad)
}

export function jointTol(a: Wall, b: Wall): number {
  return Math.max(a.thicknessCm, b.thicknessCm) / 2
}

export function jointedWalls(a: Wall, b: Wall): boolean {
  const tol = jointTol(a, b) * 1.25
  return distance(a.a, b.a) <= tol || distance(a.a, b.b) <= tol || distance(a.b, b.a) <= tol || distance(a.b, b.b) <= tol
}

export function healJoints(walls: Wall[]): boolean {
  let healed = false
  for (let i = 1; i < walls.length; i++) {
    const w = walls[i]
    if (pointsEqual(w.a, w.b)) continue
    for (const end of ["a", "b"] as const) {
      const p = w[end]
      let best: { x: number; y: number; d: number } | null = null
      for (let j = 0; j < i; j++) {
        const v = walls[j]
        if (pointsEqual(v.a, v.b)) continue
        const tol = jointTol(w, v) * 2
        for (const ve of ["a", "b"] as const) {
          const d = distance(p, v[ve])
          if (d > EPS && d <= tol && (!best || d < best.d)) best = { x: v[ve].x, y: v[ve].y, d }
        }
      }
      if (best && !pointsEqual(p, best)) {
        w[end] = { x: best.x, y: best.y }
        healed = true
      }
    }
  }
  return healed
}

function attachedEnds(walls: Wall[], at: Point, self: Wall): { wall: Wall; end: "a" | "b" }[] {
  const out: { wall: Wall; end: "a" | "b" }[] = []
  for (const w of walls) {
    if (w === self || pointsEqual(w.a, w.b)) continue
    const tol = jointTol(self, w) * 1.25
    const da = distance(w.a, at)
    const db = distance(w.b, at)
    if (da <= tol && da <= db) out.push({ wall: w, end: "a" })
    else if (db <= tol) out.push({ wall: w, end: "b" })
  }
  return out
}

function axisAttached(w: Wall, wall: Wall): boolean {
  const dx = wall.b.x - wall.a.x
  const dy = wall.b.y - wall.a.y
  const len2 = dx * dx + dy * dy
  if (len2 < EPS) return false
  const len = Math.sqrt(len2)
  const tol = jointTol(wall, w)
  const d = { x: dx / len, y: dy / len }
  for (const end of [w.a, w.b] as const) {
    const t = ((end.x - wall.a.x) * dx + (end.y - wall.a.y) * dy) / len2
    if (t * len <= tol || t * len >= len - tol) continue
    if (Math.abs(cross(d, { x: end.x - wall.a.x, y: end.y - wall.a.y })) <= EPS) return true
  }
  return false
}

export function moveEndpoint(walls: Wall[], wall: Wall, end: "a" | "b", pos: Point): void {
  const old = wall[end]
  wall[end] = pos
  for (const { wall: w, end: e } of attachedEnds(walls, old, wall)) {
    w[e] = { x: pos.x, y: pos.y }
  }
}

export function moveWall(walls: Wall[], wall: Wall, delta: Point): void {
  const { a, b } = wall
  wall.a = { x: a.x + delta.x, y: a.y + delta.y }
  wall.b = { x: b.x + delta.x, y: b.y + delta.y }
  for (const w of walls) {
    if (w === wall || pointsEqual(w.a, w.b)) continue
    const tol = jointTol(wall, w) * 1.25
    const endA = distance(w.a, a) <= tol ? "a" : distance(w.b, a) <= tol ? "b" : null
    const endB = distance(w.a, b) <= tol ? "a" : distance(w.b, b) <= tol ? "b" : null
    if (endA) w[endA] = { x: wall.a.x, y: wall.a.y }
    if (endB) w[endB] = { x: wall.b.x, y: wall.b.y }
    if (!endA && !endB && axisAttached(w, wall)) {
      w.a = { x: w.a.x + delta.x, y: w.a.y + delta.y }
      w.b = { x: w.b.x + delta.x, y: w.b.y + delta.y }
    }
  }
}

export function moveWalls(walls: Wall[], group: Wall[], delta: Point): void {
  const pre = group.map((g) => ({ a: { ...g.a }, b: { ...g.b } }))
  for (const g of group) {
    g.a = { x: g.a.x + delta.x, y: g.a.y + delta.y }
    g.b = { x: g.b.x + delta.x, y: g.b.y + delta.y }
  }
  for (const w of walls) {
    if (group.includes(w) || pointsEqual(w.a, w.b)) continue
    let pullA: Point | null = null
    let pullB: Point | null = null
    let axis = false
    group.forEach((g, i) => {
      const tol = jointTol(g, w) * 1.25
      if (!pullA) {
        if (distance(w.a, pre[i].a) <= tol) pullA = g.a
        else if (distance(w.a, pre[i].b) <= tol) pullA = g.b
      }
      if (!pullB) {
        if (distance(w.b, pre[i].a) <= tol) pullB = g.a
        else if (distance(w.b, pre[i].b) <= tol) pullB = g.b
      }
      if (!pullA && !pullB && !axis && axisAttached(w, { ...g, a: pre[i].a, b: pre[i].b })) axis = true
    })
    if (pullA) w.a = pullA
    if (pullB) w.b = pullB
    if (axis && !pullA && !pullB) {
      w.a = { x: w.a.x + delta.x, y: w.a.y + delta.y }
      w.b = { x: w.b.x + delta.x, y: w.b.y + delta.y }
    }
  }
}

export function snapOthers(walls: Wall[], group: Wall[]): Wall[] {
  return walls.filter((w) => !group.includes(w) && !pointsEqual(w.a, w.b) &&
    !group.some((g) => jointedWalls(g, w) || axisAttached(w, g)))
}

const MITER_MIN = Math.PI / 6
const RIGHT_ANGLE_MAX_COS = Math.sin((5 * Math.PI) / 180)

interface Cap {
  plus: Point
  minus: Point
}

function cross(a: Point, b: Point): number {
  return a.x * b.y - a.y * b.x
}

function dot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y
}

function dirOf(from: Point, to: Point): Point {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy)
  return len < EPS ? { x: 0, y: 0 } : { x: dx / len, y: dy / len }
}

function lineIntersect(p1: Point, d1: Point, p2: Point, d2: Point): Point | null {
  const denom = cross(d1, d2)
  if (Math.abs(denom) < 1e-9) return null
  const t = cross({ x: p2.x - p1.x, y: p2.y - p1.y }, d2) / denom
  return { x: p1.x + t * d1.x, y: p1.y + t * d1.y }
}

function capOnFaces(n: Point, u: Point, E: Point, h: number, linePoint: Point, lineDir: Point): Cap | null {
  const plus = lineIntersect({ x: E.x + n.x * h, y: E.y + n.y * h }, u, linePoint, lineDir)
  const minus = lineIntersect({ x: E.x - n.x * h, y: E.y - n.y * h }, u, linePoint, lineDir)
  return plus && minus ? { plus, minus } : null
}

function buttCap(V: Point, v: Point, hT: number, u: Point, n: Point, E: Point, h: number, flat: Cap): Cap {
  const nT = { x: -v.y, y: v.x }
  const side = dot(u, nT)
  if (Math.abs(side) < EPS) return flat
  const sgn = side > 0 ? 1 : -1
  const p0 = {
    x: V.x + nT.x * sgn * hT,
    y: V.y + nT.y * sgn * hT,
  }
  return capOnFaces(n, u, E, h, p0, v) ?? flat
}

interface Joint {
  c: Wall
  cEnd: Point
  vertex: Point
  corner: boolean
}

function jointAt(wall: Wall, E: Point, walls: Wall[]): Joint | null {
  let match: { c: Wall; cEnd: Point; d: number } | null = null
  let count = 0
  for (const w of walls) {
    if (w === wall || pointsEqual(w.a, w.b)) continue
    const tol = Math.max(wall.thicknessCm, w.thicknessCm) / 2
    for (const end of [w.a, w.b] as const) {
      const d = distance(E, end)
      if (d > tol) continue
      count++
      if (!match || d < match.d) match = { c: w, cEnd: end, d }
    }
  }
  if (count > 1) return null
  if (match)
    return {
      c: match.c,
      cEnd: match.cEnd,
      vertex: walls.indexOf(match.c) < walls.indexOf(wall) ? match.cEnd : E,
      corner: true,
    }
  for (const w of walls) {
    if (w === wall || pointsEqual(w.a, w.b)) continue
    const dx = w.b.x - w.a.x
    const dy = w.b.y - w.a.y
    const len2 = dx * dx + dy * dy
    const t = ((E.x - w.a.x) * dx + (E.y - w.a.y) * dy) / len2
    if (t <= 0 || t >= 1) continue
    const d = { x: dx / Math.sqrt(len2), y: dy / Math.sqrt(len2) }
    if (Math.abs(cross(d, { x: E.x - w.a.x, y: E.y - w.a.y })) > EPS) continue
    return { c: w, cEnd: E, vertex: E, corner: false }
  }
  return null
}

function dirFromBody(p: Point, q: Point, end: Point): Point {
  return pointsEqual(p, end) ? dirOf(p, q) : dirOf(q, p)
}

function endCap(wall: Wall, E: Point, u: Point, walls: Wall[]): Cap {
  const n = { x: -u.y, y: u.x }
  const h = wall.thicknessCm / 2
  const capAt = (P: Point): Cap => ({
    plus: { x: P.x + n.x * h, y: P.y + n.y * h },
    minus: { x: P.x - n.x * h, y: P.y - n.y * h },
  })
  const j = jointAt(wall, E, walls)
  if (!j) return capAt(E)
  const hC = j.c.thicknessCm / 2
  if (!j.corner) return buttCap(E, dirFromBody(j.c.a, j.c.b, j.cEnd), hC, u, n, E, h, capAt(E))
  const V = j.vertex
  const flat = capAt(V)
  const v = dirFromBody(j.c.a, j.c.b, j.cEnd)
  const cr = cross(u, v)
  if (Math.abs(cr) < EPS) return flat
  const phi = Math.acos(Math.max(-1, Math.min(1, dot(u, v))))
  const same = j.c.type === wall.type && j.c.thicknessCm === wall.thicknessCm
  const miter = same && phi >= MITER_MIN && Math.abs(dot(u, v)) >= RIGHT_ANGLE_MAX_COS
  if (!miter) {
    return walls.indexOf(j.c) < walls.indexOf(wall) ? buttCap(j.cEnd, v, hC, u, n, E, h, flat) : flat
  }
  const s = cr > 0 ? 1 : -1
  const nC = { x: -v.y, y: v.x }
  const inner = capOnFaces(
    n,
    u,
    E,
    h,
    { x: j.cEnd.x - nC.x * s * hC, y: j.cEnd.y - nC.y * s * hC },
    v,
  )
  const outer = capOnFaces(
    { x: -n.x, y: -n.y },
    u,
    E,
    h,
    { x: j.cEnd.x + nC.x * s * hC, y: j.cEnd.y + nC.y * s * hC },
    v,
  )
  if (inner && outer) return s > 0 ? { plus: inner.plus, minus: outer.plus } : { plus: outer.minus, minus: inner.minus }
  return flat
}

export function pointOn(wall: Wall, t: number): Point {
  return { x: wall.a.x + (wall.b.x - wall.a.x) * t, y: wall.a.y + (wall.b.y - wall.a.y) * t }
}

interface EdgeSeg {
  ref: EdgeRef
  p1: Point
  p2: Point
}

function wallSegments(wall: Wall, walls: Wall[]): EdgeSeg[] {
  const s = wallShape(wall, walls)
  const seg = (edge: number, p1: Point, p2: Point): EdgeSeg => ({ ref: { wallId: wall.id, edge }, p1, p2 })
  return [seg(0, s[0], s[1]), seg(3, s[1], s[2]), seg(1, s[2], s[3]), seg(2, s[3], s[0])]
}

function onSegment(p: Point, s1: Point, s2: Point): boolean {
  const len = distance(s1, s2)
  return distance(s1, p) <= len + EPS && distance(s2, p) <= len + EPS
}

function segTouch(a: EdgeSeg, b: EdgeSeg): Point | null {
  const ip = lineIntersect(a.p1, dirOf(a.p1, a.p2), b.p1, dirOf(b.p1, b.p2))
  if (!ip) return null
  return onSegment(ip, a.p1, a.p2) && onSegment(ip, b.p1, b.p2) ? ip : null
}

function segClamp(a: EdgeSeg, b: EdgeSeg): Point {
  const d1 = { x: a.p2.x - a.p1.x, y: a.p2.y - a.p1.y }
  const d2 = { x: b.p2.x - b.p1.x, y: b.p2.y - b.p1.y }
  const r = { x: a.p1.x - b.p1.x, y: a.p1.y - b.p1.y }
  const len1 = d1.x * d1.x + d1.y * d1.y
  const len2 = d2.x * d2.x + d2.y * d2.y
  const f = d2.x * r.x + d2.y * r.y
  let s = 0
  if (len1 > EPS) {
    const c = d1.x * r.x + d1.y * r.y
    if (len2 <= EPS) {
      s = Math.max(0, Math.min(1, -c / len1))
    } else {
      const b = d1.x * d2.x + d1.y * d2.y
      const denom = len1 * len2 - b * b
      s = denom > EPS ? Math.max(0, Math.min(1, (b * f - c * len2) / denom)) : 0
      const t = (b * s + f) / len2
      if (t < 0) s = Math.max(0, Math.min(1, -c / len1))
      else if (t > 1) s = Math.max(0, Math.min(1, (b - c) / len1))
    }
  }
  return { x: a.p1.x + d1.x * s, y: a.p1.y + d1.y * s }
}

export function dimPointPoint(point: DimPoint, walls: Wall[]): Point | null {
  const wa = walls.find((w) => w.id === point.a.wallId)
  const wb = walls.find((w) => w.id === point.b.wallId)
  if (!wa || !wb) return null
  const sa = wallSegments(wa, walls).find((s) => s.ref.edge === point.a.edge)!
  const sb = wallSegments(wb, walls).find((s) => s.ref.edge === point.b.edge)!
  return segTouch(sa, sb) ?? segClamp(sa, sb)
}

export function nearestEdgeIntersection(p: Point, walls: Wall[], radius: number): { point: Point; a: EdgeRef; b: EdgeRef } | null {
  const segs = walls.flatMap((w) => (pointsEqual(w.a, w.b) ? [] : wallSegments(w, walls)))
  let best: { point: Point; a: EdgeRef; b: EdgeRef } | null = null
  let bestDist = radius
  let bestScore = Infinity
  for (let i = 0; i < segs.length; i++)
    for (let j = i + 1; j < segs.length; j++) {
      const ip = segTouch(segs[i], segs[j])
      if (!ip) continue
      const d = distance(p, ip)
      if (d > radius) continue
      const endA = pointsEqual(ip, segs[i].p1) || pointsEqual(ip, segs[i].p2)
      const endB = pointsEqual(ip, segs[j].p1) || pointsEqual(ip, segs[j].p2)
      const score = (segs[i].ref.wallId === segs[j].ref.wallId ? 0 : 4) + (endA && endB ? 0 : endA || endB ? 1 : 2)
      if (d < bestDist - 1e-9 || (d <= bestDist + 1e-9 && score < bestScore)) {
        best = { point: ip, a: segs[i].ref, b: segs[j].ref }
        bestDist = d
        bestScore = score
      }
    }
  return best
}

export function jointPullback(p: Point, walls: Wall[], distance: number, dir: Point): Point {
  for (const w of walls)
    for (const [end, other] of [[w.a, w.b], [w.b, w.a]] as const)
      if (pointsEqual(p, end)) {
        const d = dirOf(end, other)
        if (Math.abs(dot(d, dir)) > 1 - 1e-9) return p
        return { x: p.x + d.x * distance, y: p.y + d.y * distance }
      }
  return p
}

export interface DimGeometry {
  a: Point
  b: Point
  p1: Point
  p2: Point
  nx: number
  ny: number
}

export function dimGeometry(a: Point, b: Point, offset: number): DimGeometry | null {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  if (len < EPS) return null
  const nx = -dy / len
  const ny = dx / len
  return {
    a,
    b,
    nx,
    ny,
    p1: { x: a.x + nx * offset, y: a.y + ny * offset },
    p2: { x: b.x + nx * offset, y: b.y + ny * offset },
  }
}

export function dimensionOffsetAt(p: Point, geom: DimGeometry): number {
  return (p.x - geom.a.x) * geom.nx + (p.y - geom.a.y) * geom.ny
}

export function dimLevelSnap(p: Point, axis: DimGeometry, dimensions: Dimension[], walls: Wall[], radius: number): { offset: number; point: Point } | null {
  const cur = dimensionOffsetAt(p, axis)
  const u = dirOf(axis.a, axis.b)
  let best: { offset: number; point: Point } | null = null
  for (const d of dimensions) {
    const ea = dimPointPoint(d.from, walls)
    const eb = dimPointPoint(d.to, walls)
    const g = ea && eb ? dimGeometry(ea, eb, d.offset) : null
    if (!g || Math.abs(cross(u, dirOf(g.a, g.b))) >= EPS) continue
    const level = dimensionOffsetAt(g.p1, axis)
    if (Math.abs(level - cur) <= radius && (!best || Math.abs(level - cur) < Math.abs(best.offset - cur)))
      best = { offset: level, point: { x: p.x + axis.nx * (level - cur), y: p.y + axis.ny * (level - cur) } }
  }
  return best
}

export function dimHitDistance(p: Point, dim: Dimension, walls: Wall[], textFactor: number): number | null {
  const fa = dimPointPoint(dim.from, walls)
  const ta = dimPointPoint(dim.to, walls)
  if (!fa || !ta) return null
  const g = dimGeometry(fa, ta, dim.offset)
  if (!g) return null
  const dx = g.p2.x - g.p1.x
  const dy = g.p2.y - g.p1.y
  const len2 = dx * dx + dy * dy
  const t = len2 < EPS ? 0 : Math.max(0, Math.min(1, ((p.x - g.p1.x) * dx + (p.y - g.p1.y) * dy) / len2))
  const foot = { x: g.p1.x + t * dx, y: g.p1.y + t * dy }
  const mid = { x: (g.p1.x + g.p2.x) / 2, y: (g.p1.y + g.p2.y) / 2 }
  return Math.min(distance(p, foot), distance(p, mid) / textFactor)
}

export function sameTypeJoint(wall: Wall, E: Point, walls: Wall[]): boolean {
  const j = jointAt(wall, E, walls)
  if (!j || j.c.type !== wall.type || j.c.thicknessCm !== wall.thicknessCm) return false
  if (!j.corner) return true
  const u = dirFromBody(wall.a, wall.b, E)
  const v = dirFromBody(j.c.a, j.c.b, j.cEnd)
  const cr = cross(u, v)
  if (Math.abs(cr) < EPS) return true
  if (Math.abs(dot(u, v)) < RIGHT_ANGLE_MAX_COS) return false
  return Math.acos(Math.max(-1, Math.min(1, dot(u, v)))) >= MITER_MIN
}

export function wallShape(wall: Wall, walls: Wall[]): Point[] {
  const capA = endCap(wall, wall.a, dirOf(wall.a, wall.b), walls)
  const capB = endCap(wall, wall.b, dirOf(wall.b, wall.a), walls)
  return [capA.plus, capB.minus, capB.plus, capA.minus]
}
