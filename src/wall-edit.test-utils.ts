import { expect } from "vitest"
import { jointedWalls, teeEndAttached } from "./geometry"
import type { Point, Wall } from "./types"
import { faceCornerTol } from "./wall-geometry"

// change wall-move-bounds: сцены и независимый оракул наложения тел стен для тестов
// (spec wall-collision «Стены не проходят сквозь друг друга», wall-selection
// «Границы перемещения примкнутой стены»).

export const w = (ax: number, ay: number, bx: number, by: number, id: string, thicknessCm: number): Wall => ({
  id,
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
  thicknessCm,
  type: "brick",
})

export const ORTHO = { ortho: true } as const
export const FREE = { ortho: false } as const

export function expectPoint(p: Point, x: number, y: number, digits = 3): void {
  expect(p.x).toBeCloseTo(x, digits)
  expect(p.y).toBeCloseTo(y, digits)
}

export function expectWall(wall: Wall, ax: number, ay: number, bx: number, by: number, digits = 3): void {
  expectPoint(wall.a, ax, ay, digits)
  expectPoint(wall.b, bx, by, digits)
}

export interface Snapshot {
  coords: { a: Point; b: Point }[]
}

export const snapshot = (walls: readonly Wall[]): Snapshot => ({
  coords: walls.map((x) => ({ a: { ...x.a }, b: { ...x.b } })),
})

export function restore(walls: Wall[], snap: Snapshot): void {
  walls.forEach((x, i) => {
    const c = snap.coords[i]
    x.a = { ...c.a }
    x.b = { ...c.b }
  })
}

export function unchanged(walls: readonly Wall[], snap: Snapshot): boolean {
  return walls.every((x, i) => {
    const c = snap.coords[i]
    return x.a.x === c.a.x && x.a.y === c.a.y && x.b.x === c.b.x && x.b.y === c.b.y
  })
}

// --- сцены (test-plan.md) ---

// TS: опорная H, ножка S на правой грани H
export const sceneTS = (): { walls: Wall[]; H: Wall; S: Wall } => {
  const H = w(0, 0, 0, 400, "H", 20)
  const S = w(10, 200, 110, 200, "S", 10)
  return { walls: [H, S], H, S }
}

// CM: препятствие X и свободная M
export const sceneCM = (): { walls: Wall[]; X: Wall; M: Wall } => {
  const X = w(200, 0, 200, 400, "X", 20)
  const M = w(0, 200, 100, 200, "M", 10)
  return { walls: [X, M], X, M }
}

// PP: перегородка P между верхней и нижней стенами (торцы на гранях)
export const scenePP = (): { walls: Wall[]; top: Wall; bottom: Wall; P: Wall } => {
  const top = w(0, 0, 300, 0, "top", 20)
  const bottom = w(0, 300, 300, 300, "bottom", 20)
  const P = w(150, 10, 150, 290, "P", 10)
  return { walls: [top, bottom, P], top, bottom, P }
}

// CR: прямоугольная комната с общими вершинами осей
export const sceneCR = (): { walls: Wall[]; top: Wall; right: Wall; bottom: Wall; left: Wall } => {
  const top = w(0, 0, 300, 0, "top", 20)
  const right = w(300, 0, 300, 200, "right", 20)
  const bottom = w(300, 200, 0, 200, "bottom", 20)
  const left = w(0, 200, 0, 0, "left", 20)
  return { walls: [top, right, bottom, left], top, right, bottom, left }
}

// --- оракул тел (независимо от реализации) ---

export function body(x: Wall): Point[] {
  const dx = x.b.x - x.a.x
  const dy = x.b.y - x.a.y
  const len = Math.hypot(dx, dy)
  const h = x.thicknessCm / 2
  const n = { x: (-dy / len) * h, y: (dx / len) * h }
  return [
    { x: x.a.x + n.x, y: x.a.y + n.y },
    { x: x.b.x + n.x, y: x.b.y + n.y },
    { x: x.b.x - n.x, y: x.b.y - n.y },
    { x: x.a.x - n.x, y: x.a.y - n.y },
  ]
}

function axesOf(poly: Point[]): Point[] {
  return poly.map((p, i) => {
    const q = poly[(i + 1) % poly.length]
    const ex = q.x - p.x
    const ey = q.y - p.y
    const l = Math.hypot(ex, ey)
    return { x: -ey / l, y: ex / l }
  })
}

// глубина наложения двух выпуклых многоугольников (SAT); ≤ 0 — не налагаются
export function overlapDepth(p: Point[], q: Point[]): number {
  let depth = Infinity
  for (const ax of [...axesOf(p), ...axesOf(q)]) {
    const pr = p.map((v) => v.x * ax.x + v.y * ax.y)
    const qr = q.map((v) => v.x * ax.x + v.y * ax.y)
    const o = Math.min(Math.max(...pr), Math.max(...qr)) - Math.max(Math.min(...pr), Math.min(...qr))
    depth = Math.min(depth, o)
  }
  return depth
}

function area(poly: Point[]): number {
  let s = 0
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    s += p.x * q.y - q.x * p.y
  }
  return Math.abs(s) / 2
}

// площадь пересечения выпуклых многоугольников (Сазерленд — Ходжман)
export function overlapArea(p: Point[], q: Point[]): number {
  let out = p
  const sign = Math.sign(q.reduce((s, v, i) => {
    const n = q[(i + 1) % q.length]
    return s + v.x * n.y - n.x * v.y
  }, 0))
  for (let i = 0; i < q.length && out.length; i++) {
    const a = q[i]
    const b = q[(i + 1) % q.length]
    const inside = (v: Point): boolean => sign * ((b.x - a.x) * (v.y - a.y) - (b.y - a.y) * (v.x - a.x)) >= 0
    const next: Point[] = []
    for (let j = 0; j < out.length; j++) {
      const c = out[j]
      const d = out[(j + 1) % out.length]
      const ci = inside(c)
      const di = inside(d)
      if (ci) next.push(c)
      if (ci !== di) {
        const ex = d.x - c.x
        const ey = d.y - c.y
        const den = (b.x - a.x) * ey - (b.y - a.y) * ex
        const t = ((b.y - a.y) * (c.x - a.x) - (b.x - a.x) * (c.y - a.y)) / den
        next.push({ x: c.x + ex * t, y: c.y + ey * t })
      }
    }
    out = next
  }
  return out.length >= 3 ? area(out) : 0
}

// стены связаны стыком или примыканием конца (исключение спецификации)
export function connected(p: Wall, q: Wall): boolean {
  return jointedWalls(p, q) ||
    teeEndAttached(p.a, p, q) || teeEndAttached(p.b, p, q) ||
    teeEndAttached(q.a, q, p) || teeEndAttached(q.b, q, p)
}

export interface Attachment {
  leg: number
  end: "a" | "b"
  host: number
}

// продольная координата и знаковое поперечное смещение точки в системе оси стены
function frame(p: Point, host: Wall): { along: number; lat: number; len: number } {
  const dx = host.b.x - host.a.x
  const dy = host.b.y - host.a.y
  const len = Math.hypot(dx, dy)
  const rx = p.x - host.a.x
  const ry = p.y - host.a.y
  return { along: (rx * dx + ry * dy) / len, lat: (dx * ry - dy * rx) / len, len }
}

// запас грани за концом оси опорной у наружного угла: толщина стены, состыкованной с этим концом
function cornerReach(host: Wall, end: Point, walls: readonly Wall[]): number {
  let reach = 0
  for (const c of walls) {
    if (c === host) continue
    const tol = faceCornerTol(host, c)
    if (Math.hypot(c.a.x - end.x, c.a.y - end.y) <= tol || Math.hypot(c.b.x - end.x, c.b.y - end.y) <= tol)
      reach = Math.max(reach, c.thicknessCm)
  }
  return reach
}

// примыкание сохранено по спецификации: та же линия (поперечное смещение как до правки) и конец
// в пределах грани опорной стены, включая её продолжение до наружного угла
export function attachmentHolds(a: Attachment, before: readonly Wall[], after: readonly Wall[]): boolean {
  const f0 = frame(before[a.leg][a.end], before[a.host])
  const f1 = frame(after[a.leg][a.end], after[a.host])
  const lo = -cornerReach(before[a.host], before[a.host].a, before)
  const hi = f1.len + cornerReach(before[a.host], before[a.host].b, before)
  return Math.abs(f1.lat - f0.lat) <= 1e-6 && f1.along >= lo - 1e-6 && f1.along <= hi + 1e-6
}

// исходные T-примыкания без углового стыка
export function attachments(walls: readonly Wall[]): Attachment[] {
  const out: Attachment[] = []
  walls.forEach((leg, i) => {
    for (const end of ["a", "b"] as const) {
      walls.forEach((host, j) => {
        if (i === j) return
        const p = leg[end]
        const tol = faceCornerTol(leg, host)
        const corner = Math.hypot(p.x - host.a.x, p.y - host.a.y) <= tol || Math.hypot(p.x - host.b.x, p.y - host.b.y) <= tol
        if (!corner && teeEndAttached(p, leg, host)) out.push({ leg: i, end, host: j })
      })
    }
  })
  return out
}
