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

export function moveEndpoint(walls: Wall[], wall: Wall, end: "a" | "b", pos: Point): void {
  const old = wall[end]
  wall[end] = pos
  for (const w of walls) {
    if (w === wall) continue
    if (pointsEqual(w.a, old)) w.a = pos
    if (pointsEqual(w.b, old)) w.b = pos
  }
}

export function moveWall(walls: Wall[], wall: Wall, delta: Point): void {
  const { a, b } = wall
  wall.a = { x: a.x + delta.x, y: a.y + delta.y }
  wall.b = { x: b.x + delta.x, y: b.y + delta.y }
  for (const w of walls) {
    if (w === wall) continue
    if (pointsEqual(w.a, a)) w.a = wall.a
    if (pointsEqual(w.b, a)) w.b = wall.a
    if (pointsEqual(w.a, b)) w.a = wall.b
    if (pointsEqual(w.b, b)) w.b = wall.b
  }
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

export interface EdgeLine {
  p: Point
  d: Point
}

export function edgeLine(wall: Wall, edge: number): EdgeLine {
  const dx = wall.b.x - wall.a.x
  const dy = wall.b.y - wall.a.y
  const len = Math.hypot(dx, dy)
  const ux = dx / len
  const uy = dy / len
  const nx = -uy
  const ny = ux
  const h = wall.thicknessCm / 2
  if (edge === 0) return { p: { x: wall.a.x + nx * h, y: wall.a.y + ny * h }, d: { x: ux, y: uy } }
  if (edge === 1) return { p: { x: wall.a.x - nx * h, y: wall.a.y - ny * h }, d: { x: ux, y: uy } }
  if (edge === 2) return { p: { x: wall.a.x, y: wall.a.y }, d: { x: nx, y: ny } }
  return { p: { x: wall.b.x, y: wall.b.y }, d: { x: nx, y: ny } }
}

export function dimPointPoint(point: DimPoint, walls: Wall[]): Point | null {
  const wa = walls.find((w) => w.id === point.a.wallId)
  const wb = walls.find((w) => w.id === point.b.wallId)
  if (!wa || !wb) return null
  const l1 = edgeLine(wa, point.a.edge)
  const l2 = edgeLine(wb, point.b.edge)
  return lineIntersect(l1.p, l1.d, l2.p, l2.d)
}

export function nearestEdgeIntersection(p: Point, walls: Wall[], radius: number): { point: Point; a: EdgeRef; b: EdgeRef } | null {
  const lines: { ref: EdgeRef; line: EdgeLine }[] = []
  for (const w of walls) {
    if (pointsEqual(w.a, w.b)) continue
    for (let edge = 0; edge < 4; edge++) lines.push({ ref: { wallId: w.id, edge }, line: edgeLine(w, edge) })
  }
  let best: { point: Point; a: EdgeRef; b: EdgeRef } | null = null
  let bestDist = radius
  for (let i = 0; i < lines.length; i++)
    for (let j = i + 1; j < lines.length; j++) {
      const ip = lineIntersect(lines[i].line.p, lines[i].line.d, lines[j].line.p, lines[j].line.d)
      if (!ip) continue
      const d = distance(p, ip)
      if (d < bestDist) {
        best = { point: ip, a: lines[i].ref, b: lines[j].ref }
        bestDist = d
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
