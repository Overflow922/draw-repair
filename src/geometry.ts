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
const PERP_MAX_DOT = Math.sin((15 * Math.PI) / 180)
const COLIN_MIN_DOT = Math.cos((15 * Math.PI) / 180)

export function lockedDirection(p: Point, v: Point, walls: Wall[]): Point | null {
  for (const w of walls) {
    if (bodyGap(p, w) > 0.01) continue
    const dx = w.b.x - w.a.x
    const dy = w.b.y - w.a.y
    const len2 = dx * dx + dy * dy
    if (len2 < EPS) continue
    const len = Math.sqrt(len2)
    const u = { x: dx / len, y: dy / len }
    const n = { x: -u.y, y: u.x }
    const a1 = dot(v, u)
    if (Math.abs(a1) <= PERP_MAX_DOT) return dot(v, n) >= 0 ? n : { x: -n.x, y: -n.y }
    if (Math.abs(a1) >= COLIN_MIN_DOT) return a1 >= 0 ? u : { x: -u.x, y: -u.y }
  }
  return null
}

export function orthoAxis(p: Point, from: Point): Point {
  const dx = p.x - from.x
  const dy = p.y - from.y
  if (Math.abs(dy) <= ORTHO_TAN * Math.abs(dx)) return { x: p.x, y: from.y }
  if (Math.abs(dx) <= ORTHO_TAN * Math.abs(dy)) return { x: from.x, y: p.y }
  return p
}

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

function bodyGap(p: Point, w: Wall): number {
  const dx = w.b.x - w.a.x
  const dy = w.b.y - w.a.y
  const len2 = dx * dx + dy * dy
  if (len2 < EPS) return distance(p, w.a)
  const len = Math.sqrt(len2)
  const s = ((p.x - w.a.x) * dx + (p.y - w.a.y) * dy) / len2
  const lat = ((p.x - w.a.x) * -dy + (p.y - w.a.y) * dx) / len
  const ds = s < 0 ? -s * len : s > 1 ? (s - 1) * len : 0
  const dl = Math.abs(lat) - w.thicknessCm / 2
  return Math.hypot(ds, Math.max(0, dl))
}

function distToSegment(p: Point, q1: Point, q2: Point): number {
  const dx = q2.x - q1.x
  const dy = q2.y - q1.y
  const len2 = dx * dx + dy * dy
  if (len2 < EPS) return distance(p, q1)
  const t = Math.max(0, Math.min(1, ((p.x - q1.x) * dx + (p.y - q1.y) * dy) / len2))
  return distance(p, { x: q1.x + t * dx, y: q1.y + t * dy })
}

export function findVertexSnap(
  p: Point,
  walls: Wall[],
  hCm: number,
): { point: Point; contact: boolean; block: Point | null } | null {
  let best: { point: Point; d: number; prio: number; block: Point | null } | null = null
  const consider = (point: Point, d: number, prio: number, block: Point | null = null) => {
    if (d > hCm) return
    if (!best || prio < best.prio || (prio === best.prio && d < best.d)) best = { point, d, prio, block }
  }
  for (const w of walls) {
    const dx = w.b.x - w.a.x
    const dy = w.b.y - w.a.y
    const len2 = dx * dx + dy * dy
    if (len2 < EPS) continue
    const len = Math.sqrt(len2)
    const u = { x: dx / len, y: dy / len }
    const n = { x: -u.y, y: u.x }
    const hW = w.thicknessCm / 2
    const s = (p.x - w.a.x) * u.x + (p.y - w.a.y) * u.y
    const d = (p.x - w.a.x) * n.x + (p.y - w.a.y) * n.y
    const sC = len >= 2 * hCm ? Math.max(hCm, Math.min(len - hCm, s)) : len / 2
    // ось/торец: курсор на осевой линии в пределах полблока от торца — продолжение
    if (Math.abs(d) <= hCm) {
      const capEnd = s >= len / 2 ? w.b : w.a
      const capDist = distToSegment(p, { x: capEnd.x - n.x * hW, y: capEnd.y - n.y * hW }, { x: capEnd.x + n.x * hW, y: capEnd.y + n.y * hW })
      if (capDist <= hCm && distance(p, capEnd) <= 2 * hCm) consider(capEnd, capDist, 0)
    }
    // грань: курсор в пределах полблока от линии грани — квадрат прилипает краем к грани
    const faceDist = Math.abs(Math.abs(d) - hW)
    if (faceDist <= hCm) {
      const sd = d >= 0 ? 1 : -1
      const point = { x: w.a.x + u.x * sC + n.x * sd * hW, y: w.a.y + u.y * sC + n.y * sd * hW }
      if (distance(p, point) <= 2 * hCm) {
        const block = { x: point.x + n.x * sd * hCm, y: point.y + n.y * sd * hCm }
        consider(point, faceDist, 0, block)
      }
    }
  }
  if (best !== null) {
    const found = best as { point: Point; d: number; prio: number; block: Point | null }
    return { point: found.point, contact: found.prio === 0, block: found.block }
  }
  return null
}

export function snapVertex(
  p: Point,
  walls: Wall[],
  gridStepCm: number,
  hCm: number,
  orthoFrom?: Point,
): Point {
  const found = findVertexSnap(p, walls, hCm)
  if (found) return found.point
  let q = p
  if (orthoFrom) q = orthoAxis(p, orthoFrom)
  return {
    x: Math.round(q.x / gridStepCm) * gridStepCm,
    y: Math.round(q.y / gridStepCm) * gridStepCm,
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
  if (best) return best
  // fallback: зона залива за пределами полосы (угловое примыкание), принадлежит поздней стене
  for (let i = walls.length - 1; i >= 0; i--) {
    const w = walls[i]
    if (pointsEqual(w.a, w.b) || inBand(p, w)) continue
    if (!pointInConvex(p, wallShape(w, walls))) continue
    let covered = false
    for (let k = 0; k < i; k++) {
      if (jointedWalls(w, walls[k]) && pointInConvex(p, wallShape(walls[k], walls))) {
        covered = true
        break
      }
    }
    if (!covered) return w
  }
  return null
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

export function jointAt(wall: Wall, E: Point, walls: Wall[]): Joint | null {
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
  const iWall = walls.indexOf(wall)
  const earlier = iWall === -1 ? true : walls.indexOf(j.c) < iWall
  if (!earlier) return flat
  const v = dirFromBody(j.c.a, j.c.b, j.cEnd)
  const cr = cross(u, v)
  if (Math.abs(cr) < EPS) return flat
  const s = dot(u, nCOf(v)) > 0 ? 1 : -1
  return (
    capOnFaces(n, u, E, h, { x: j.cEnd.x - nCOf(v).x * s * hC, y: j.cEnd.y - nCOf(v).y * s * hC }, v) ?? flat
  )
}

function nCOf(v: Point): Point {
  return { x: -v.y, y: v.x }
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
  return !!j && j.c.type === wall.type && j.c.thicknessCm === wall.thicknessCm
}

export function wallShape(wall: Wall, walls: Wall[]): Point[] {
  const capA = endCap(wall, wall.a, dirOf(wall.a, wall.b), walls)
  const capB = endCap(wall, wall.b, dirOf(wall.b, wall.a), walls)
  return [capA.plus, capB.minus, capB.plus, capA.minus]
}

function clipHalf(poly: Point[], origin: Point, normal: Point, lo: number): Point[] {
  const out: Point[] = []
  const val = (p: Point) => (p.x - origin.x) * normal.x + (p.y - origin.y) * normal.y - lo
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const va = val(a)
    const vb = val(b)
    if (va >= 0) out.push(a)
    if ((va > 0 && vb < 0) || (va < 0 && vb > 0)) {
      const t = va / (va - vb)
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
    }
  }
  return out
}

function isEarlierWall(w: Wall, of: Wall, walls: Wall[]): boolean {
  const i = walls.indexOf(of)
  return i === -1 ? true : walls.indexOf(w) < i
}

export function wallDisplayPolys(wall: Wall, walls: Wall[]): Point[][] {
  let pieces: Point[][] = [wallShape(wall, walls)]
  for (const end of [wall.a, wall.b] as const) {
    const j = jointAt(wall, end, walls)
    if (!j || !j.corner) continue
    if (!isEarlierWall(j.c, wall, walls)) continue
    const c = j.c
    const dx = c.b.x - c.a.x
    const dy = c.b.y - c.a.y
    const lenC = Math.hypot(dx, dy)
    if (lenC < EPS) continue
    const uC = { x: dx / lenC, y: dy / lenC }
    const nC = { x: -uC.y, y: uC.x }
    const hC = c.thicknessCm / 2
    const into = dirFromBody(c.a, c.b, j.cEnd)
    const next: Point[][] = []
    for (const pc of pieces) {
      next.push(clipHalf(pc, c.a, nC, hC))
      next.push(clipHalf(pc, c.a, { x: -nC.x, y: -nC.y }, hC))
      next.push(clipHalf(pc, j.cEnd, { x: -into.x, y: -into.y }, 0))
    }
    pieces = next
  }
  return pieces.filter((p) => p.length >= 3)
}

export function pointInConvex(p: Point, poly: Point[]): boolean {
  let sign = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const c = cross({ x: b.x - a.x, y: b.y - a.y }, { x: p.x - a.x, y: p.y - a.y })
    if (Math.abs(c) < EPS) continue
    const s = c > 0 ? 1 : -1
    if (sign === 0) sign = s
    else if (s !== sign) return false
  }
  return true
}

function inBand(p: Point, w: Wall): boolean {
  const dx = w.b.x - w.a.x
  const dy = w.b.y - w.a.y
  const len2 = dx * dx + dy * dy
  if (len2 < EPS) return false
  const len = Math.sqrt(len2)
  const s = ((p.x - w.a.x) * dx + (p.y - w.a.y) * dy) / len2
  const lat = ((p.x - w.a.x) * -dy + (p.y - w.a.y) * dx) / len
  return s >= 0 && s <= 1 && Math.abs(lat) <= w.thicknessCm / 2
}

export function subtractCovered(p1: Point, p2: Point, walls: Wall[], self: Wall, exempt: Wall[]): [number, number][] {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const len2 = dx * dx + dy * dy
  if (len2 < EPS) return []
  const len = Math.sqrt(len2)
  const du = { x: dx / len, y: dy / len }
  const hidden: [number, number][] = []
  const SHAVE = 1e-6
  const SLACK = 1e-4
  for (const w of walls) {
    if (w === self) continue
    const wx = w.b.x - w.a.x
    const wy = w.b.y - w.a.y
    const wlen2 = wx * wx + wy * wy
    if (wlen2 < EPS) continue
    const wlen = Math.sqrt(wlen2)
    const u = { x: wx / wlen, y: wy / wlen }
    const n = { x: -u.y, y: u.x }
    const h = w.thicknessCm / 2
    const rx = p1.x - w.a.x
    const ry = p1.y - w.a.y
    const s0 = rx * u.x + ry * u.y
    const dS = dx * u.x + dy * u.y
    const l0 = rx * n.x + ry * n.y
    const dL = dx * n.x + dy * n.y
    let t0 = 0
    let t1 = 1
    const band = (v0: number, dv: number, lo: number, hi: number): boolean => {
      if (Math.abs(dv) < EPS) return v0 >= lo && v0 <= hi
      const ta = (lo - v0) / dv
      const tb = (hi - v0) / dv
      t0 = Math.max(t0, Math.min(ta, tb))
      t1 = Math.min(t1, Math.max(ta, tb))
      return t0 <= t1
    }
    if (band(l0, dL, -h + SHAVE, h - SHAVE) && band(s0, dS, SHAVE, wlen - SHAVE) && t1 > t0 && !exempt.includes(w)) {
      hidden.push([t0, t1])
    }
    // край, лежащий прямо на границе однотипной соседки: контакт монолитных стен не рисуется
    if (w.type === self.type && w.thicknessCm === self.thicknessCm && !exempt.includes(w)) {
      const hFull = w.thicknessCm / 2
      const c1 = { x: w.a.x + n.x * hFull, y: w.a.y + n.y * hFull }
      const c2 = { x: w.b.x + n.x * hFull, y: w.b.y + n.y * hFull }
      const c3 = { x: w.a.x - n.x * hFull, y: w.a.y - n.y * hFull }
      const c4 = { x: w.b.x - n.x * hFull, y: w.b.y - n.y * hFull }
      for (const [q1, q2] of [[c1, c2], [c3, c4], [c1, c3], [c2, c4]] as const) {
        const qx = q2.x - q1.x
        const qy = q2.y - q1.y
        const qlen2 = qx * qx + qy * qy
        if (qlen2 < EPS) continue
        const ql = Math.sqrt(qlen2)
        const qu = { x: qx / ql, y: qy / ql }
        if (Math.abs(cross(du, qu)) > 1e-6) continue
        if (Math.abs(cross(qu, { x: p1.x - q1.x, y: p1.y - q1.y })) > SLACK) continue
        const proj = (p: Point) => ((p.x - q1.x) * qx + (p.y - q1.y) * qy) / qlen2
        const e1 = proj(p1)
        const e2 = proj(p2)
        const lo = Math.max(0, Math.min(e1, e2))
        const hi = Math.min(1, Math.max(e1, e2))
        if (hi - lo <= SLACK || Math.abs(e2 - e1) <= SLACK) continue
        const tA = (lo - e1) / (e2 - e1)
        const tB = (hi - e1) / (e2 - e1)
        hidden.push([Math.min(tA, tB), Math.max(tA, tB)])
      }
    }
  }
  hidden.sort((a, b) => a[0] - b[0])
  const merged: [number, number][] = []
  for (const iv of hidden) {
    const last = merged[merged.length - 1]
    if (last && iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1])
    else merged.push([iv[0], iv[1]])
  }
  const visible: [number, number][] = []
  let cursor = 0
  for (const [a, b] of merged) {
    if (a > cursor) visible.push([cursor, a])
    cursor = Math.max(cursor, b)
  }
  if (cursor < 1) visible.push([cursor, 1])
  return visible
}
