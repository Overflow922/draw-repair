import { expect } from "vitest"
import { placeWall } from "./auto-dimensions"
import { dimGeometry, dimPointPoint, wallShape } from "./geometry"
import type { Scene } from "./history"
import type { Dimension, Point, Wall } from "./types"

// change auto-wall-dimensions (модель «видимые куски граней»): сцены и независимый разбор размеров
// для тестов (spec dimension-tool «Автоматические размеры стены»). Эталоны выведены из спецификации
// и геометрии сцен (контуры стен), а не из модуля автоматических размеров.

export const OFFSET_CM = 15

export const w = (ax: number, ay: number, bx: number, by: number, id: string, thicknessCm = 20): Wall => ({
  id,
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
  thicknessCm,
  type: "brick",
})

export interface Measured {
  from: Point
  to: Point
  line: readonly [Point, Point]
  length: number
}

// разрешает размер в точки замера, размерную линию и число — только через общую геометрию размеров
export function measure(d: Dimension, walls: readonly Wall[]): Measured {
  const from = dimPointPoint(d.from, [...walls])
  const to = dimPointPoint(d.to, [...walls])
  if (!from || !to) throw new Error("точка замера не разрешилась в позицию")
  const g = dimGeometry(from, to, d.offset)
  if (!g) throw new Error("размер нулевой длины")
  return { from, to, line: [g.p1, g.p2], length: Math.hypot(to.x - from.x, to.y - from.y) }
}

// система координат стены: t — вдоль оси от конца a, s — вдоль нормали (-uy, ux) — стороны «плюс» (s > 0)
export function frameOf(wall: Wall): (p: Point) => { t: number; s: number } {
  const len = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y)
  const u = { x: (wall.b.x - wall.a.x) / len, y: (wall.b.y - wall.a.y) / len }
  const n = { x: -u.y, y: u.x }
  return (p) => ({
    t: (p.x - wall.a.x) * u.x + (p.y - wall.a.y) * u.y,
    s: (p.x - wall.a.x) * n.x + (p.y - wall.a.y) * n.y,
  })
}

// автоматические размеры стены id (поле auto — идентификатор владельца)
export const dimsOf = (scene: Scene, id: string): Dimension[] => scene.dimensions.filter((d) => d.auto === id)

export interface Split {
  // размеры длины по сторонам стены, по возрастанию начала куска вдоль оси
  plus: Measured[]
  minus: Measured[]
  // размеры толщины по возрастанию положения торца вдоль оси
  thickness: Measured[]
}

// разбирает размеры стены по назначению: параллельные оси — длина (со стороны знака s), поперечные — толщина
export function split(scene: Scene, wall: Wall): Split {
  const f = frameOf(wall)
  const out: Split = { plus: [], minus: [], thickness: [] }
  for (const d of dimsOf(scene, wall.id)) {
    const m = measure(d, scene.walls)
    const a = f(m.from)
    const b = f(m.to)
    if (Math.abs(a.s - b.s) < 1e-6) (a.s > 0 ? out.plus : out.minus).push(m)
    else if (Math.abs(a.t - b.t) < 1e-6) out.thickness.push(m)
    else throw new Error(`размер ни параллелен оси, ни перпендикулярен ей: ${JSON.stringify(m)}`)
  }
  const start = (wall0: Wall) => (m: Measured) => Math.min(frameOf(wall0)(m.from).t, frameOf(wall0)(m.to).t)
  const key = start(wall)
  out.plus.sort((p, q) => key(p) - key(q))
  out.minus.sort((p, q) => key(p) - key(q))
  out.thickness.sort((p, q) => f(p.from).t - f(q.from).t)
  return out
}

const DIGITS = 5

// размер длины по грани: точки замера на грани стороны side (±1), по оси от t0 до t1;
// размерная линия — на 15 см снаружи от грани, параллельно ей, число — t1 - t0
export function expectLength(m: Measured, wall: Wall, side: 1 | -1, t0: number, t1: number, digits = DIGITS): void {
  const f = frameOf(wall)
  const half = wall.thicknessCm / 2
  const pts = [f(m.from), f(m.to)].sort((p, q) => p.t - q.t)
  const line = [f(m.line[0]), f(m.line[1])].sort((p, q) => p.t - q.t)
  for (const p of pts) expect(p.s).toBeCloseTo(side * half, digits)
  expect(pts[0].t).toBeCloseTo(t0, digits)
  expect(pts[1].t).toBeCloseTo(t1, digits)
  for (const p of line) expect(p.s).toBeCloseTo(side * (half + OFFSET_CM), digits)
  expect(line[0].t).toBeCloseTo(t0, digits)
  expect(line[1].t).toBeCloseTo(t1, digits)
  expect(m.length).toBeCloseTo(t1 - t0, digits)
}

// размер толщины на торце в t = tEnd: точки замера — два угла торца, размерная линия — за торцом
// (outward = +1 дальше от конца a, -1 в сторону от конца b) на 15 см от него, число — толщина
export function expectThickness(m: Measured, wall: Wall, tEnd: number, outward: 1 | -1, digits = DIGITS): void {
  const f = frameOf(wall)
  const half = wall.thicknessCm / 2
  const pts = [f(m.from), f(m.to)].sort((p, q) => p.s - q.s)
  const line = [f(m.line[0]), f(m.line[1])].sort((p, q) => p.s - q.s)
  for (const p of pts) expect(p.t).toBeCloseTo(tEnd, digits)
  expect(pts[0].s).toBeCloseTo(-half, digits)
  expect(pts[1].s).toBeCloseTo(half, digits)
  for (const p of line) expect(p.t).toBeCloseTo(tEnd + outward * OFFSET_CM, digits)
  expect(line[0].s).toBeCloseTo(-half, digits)
  expect(line[1].s).toBeCloseTo(half, digits)
  expect(m.length).toBeCloseTo(wall.thicknessCm, digits)
}

export function expectPoint(p: Point, x: number, y: number, digits = DIGITS): void {
  expect(p.x).toBeCloseTo(x, digits)
  expect(p.y).toBeCloseTo(y, digits)
}

// сцена, собранная последовательной фиксацией стен через placeWall (новая стена — последняя)
export function placeAll(walls: readonly Wall[]): Scene {
  let scene: Scene = { walls: [], dimensions: [], doorways: [] }
  for (const wall of walls) {
    const next = placeWall(scene, wall)
    if (!next) throw new Error(`стена ${wall.id} не зафиксирована`)
    scene = next
  }
  return scene
}

// строго внутри выпуклого контура (граница не считается), независимо от кода измерения размеров
export function strictlyInsideBody(p: Point, poly: readonly Point[]): boolean {
  let sign = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const e = { x: b.x - a.x, y: b.y - a.y }
    const len = Math.hypot(e.x, e.y)
    if (len < 1e-9) continue
    const side = (e.x * (p.y - a.y) - e.y * (p.x - a.x)) / len
    if (Math.abs(side) <= 1e-6) return false
    const s = side > 0 ? 1 : -1
    if (sign === 0) sign = s
    else if (s !== sign) return false
  }
  return sign !== 0
}

// ни одна внутренняя точка отрезка не лежит строго внутри тела какой-либо стены
export function segmentOutsideBodies(a: Point, b: Point, walls: readonly Wall[]): boolean {
  for (let i = 1; i < 40; i++) {
    const t = i / 40
    const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
    if (walls.some((wall) => strictlyInsideBody(p, wallShape(wall, [...walls])))) return false
  }
  return true
}

// размерная линия и отрезок замера каждого размера сцены лежат вне тел стен
export function expectOutsideBodies(scene: Scene): void {
  for (const d of scene.dimensions) {
    const m = measure(d, scene.walls)
    expect(segmentOutsideBodies(m.from, m.to, scene.walls), `отрезок замера ${JSON.stringify(m.from)}–${JSON.stringify(m.to)}`).toBe(true)
    expect(segmentOutsideBodies(m.line[0], m.line[1], scene.walls), `размерная линия ${JSON.stringify(m.line)}`).toBe(true)
  }
}

export const permutations = <T>(xs: readonly T[]): T[][] =>
  xs.length <= 1 ? [[...xs]] : xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((rest) => [x, ...rest]))
