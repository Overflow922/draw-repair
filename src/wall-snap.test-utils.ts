import { expect } from "vitest"
import { displayPolygons } from "./wall-geometry"
import type { Point, Wall } from "./types"

// Тестовые утилиты change fix-wall-snap-overlap. Геометрия проверки наложения
// независима от продакшн-кода: отсечение выпуклых многоугольников (Сазерленд — Ходжмен).

let seq = 0
export const W = (ax: number, ay: number, bx: number, by: number, thicknessCm = 20): Wall => ({
  id: `s${++seq}`,
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
  thicknessCm,
  type: "brick",
})

const cross = (o: Point, a: Point, b: Point): number => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)

export function polygonArea(poly: Point[]): number {
  let s = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    s += a.x * b.y - b.x * a.y
  }
  return s / 2
}

// пересечение выпуклых многоугольников: subject, отсечённый каждым ребром clip
export function clipConvex(subject: Point[], clip: Point[]): Point[] {
  const orient = Math.sign(polygonArea(clip))
  if (orient === 0) return []
  let out = subject
  for (let i = 0; i < clip.length && out.length > 0; i++) {
    const a = clip[i]
    const b = clip[(i + 1) % clip.length]
    const input = out
    out = []
    const val = (p: Point): number => orient * cross(a, b, p)
    for (let k = 0; k < input.length; k++) {
      const p = input[k]
      const q = input[(k + 1) % input.length]
      const vp = val(p)
      const vq = val(q)
      if (vp >= 0) out.push(p)
      if ((vp > 0 && vq < 0) || (vp < 0 && vq > 0)) {
        const t = vp / (vp - vq)
        out.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t })
      }
    }
  }
  return out
}

// наибольшая площадь пересечения многоугольника с кусками отображаемых тел стен
export function maxOverlap(poly: Point[], walls: Wall[]): number {
  let worst = 0
  for (const w of walls)
    for (const piece of displayPolygons(w, walls)) {
      const inter = clipConvex(poly, piece)
      if (inter.length >= 3) worst = Math.max(worst, Math.abs(polygonArea(inter)))
    }
  return worst
}

// точка строго внутри тела какой-либо стены (с запасом 1e-6 от границы)
export function strictlyInsideAnyBody(p: Point, walls: Wall[]): boolean {
  for (const w of walls)
    for (const piece of displayPolygons(w, walls)) {
      const orient = Math.sign(polygonArea(piece))
      if (orient === 0) continue
      let inside = true
      for (let i = 0; i < piece.length && inside; i++) {
        const a = piece[i]
        const b = piece[(i + 1) % piece.length]
        const len = Math.hypot(b.x - a.x, b.y - a.y)
        if (len < 1e-12) continue
        if ((orient * cross(a, b, p)) / len <= 1e-6) inside = false
      }
      if (inside) return true
    }
  return false
}

// квадрат установки по спецификации: сторона с центром в вершине на линии цели,
// квадрат вытянут на size по наружной нормали
export function squareOnNormal(p: Point, n: Point, size: number): Point[] {
  const t = { x: -n.y, y: n.x }
  const h = size / 2
  return [
    { x: p.x - t.x * h, y: p.y - t.y * h },
    { x: p.x + t.x * h, y: p.y + t.y * h },
    { x: p.x + t.x * h + n.x * size, y: p.y + t.y * h + n.y * size },
    { x: p.x - t.x * h + n.x * size, y: p.y - t.y * h + n.y * size },
  ]
}

export function expectPoint(actual: Point, x: number, y: number): void {
  expect(actual.x).toBeCloseTo(x, 6)
  expect(actual.y).toBeCloseTo(y, 6)
}

// сравнение наборов вершин без учёта порядка обхода
export function expectSameVertices(actual: Point[], expected: Point[]): void {
  const key = (p: Point): [number, number] => [Math.round(p.x * 1e6) / 1e6 + 0, Math.round(p.y * 1e6) / 1e6 + 0]
  const sort = (ps: Point[]): [number, number][] => ps.map(key).sort((p, q) => p[0] - q[0] || p[1] - q[1])
  expect(actual).toHaveLength(expected.length)
  expect(sort(actual)).toEqual(sort(expected))
}

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach(deepFreeze)
    Object.freeze(value)
  }
  return value
}

// сцены test-plan.md
export const sceneL = (): Wall[] => [W(0, 0, 300, 0), W(0, 0, 0, 300)]
export const sceneT = (dx = 0): Wall[] => [W(dx, 0, dx + 300, 0), W(dx + 150, 10, dx + 150, 200)]
export const sceneS = (): Wall[] => [W(0, 0, 100, 0)]
export const sceneN = (): Wall[] => [W(0, 0, 300, 0), W(100, 10, 100, 200), W(125, 10, 125, 200)]
export const sceneLX = (): Wall[] => [W(0, 0, 300, 0, 20), W(0, 0, 0, 300, 40)]
export const sceneAcute = (): Wall[] => [W(0, 0, 300, 0), W(0, 0, 150, 150 * Math.sqrt(3))]
