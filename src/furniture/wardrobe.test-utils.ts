import type { Point } from "../types"
import type { ItemDrawing, ItemDrawingFn, ItemSize } from "./item-drawing"

// Общие проверки рисунков шкафов (change add-furniture-wardrobes): числа в тестах берутся из спеки furniture-plan, здесь — только
// разбор линий и проверки «внутри прямоугольника» и «линии не пересекаются».

const EPS = 1e-9

export const size = (widthCm: number, lengthCm: number): ItemSize => ({ widthCm, lengthCm })
const rounded = (v: number): number => Math.round(v * 1e4) / 1e4
export const pts = (line: readonly Point[] | undefined): number[][] => (line ?? []).map((p) => [rounded(p.x), rounded(p.y)])

const cross = (o: Point, a: Point, b: Point): number => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
const crosses = (a: Point, b: Point, c: Point, d: Point): boolean => cross(a, b, c) * cross(a, b, d) < -EPS && cross(c, d, a) * cross(c, d, b) < -EPS
const segments = (line: readonly Point[]): [Point, Point][] => line.slice(1).flatMap((p, i): [Point, Point][] => (line[i] ? [[line[i] as Point, p]] : []))

export const crossingCount = (lines: readonly (readonly Point[])[]): number => {
  let n = 0
  lines.forEach((la, i) => {
    lines.forEach((lb, j) => {
      if (j < i) return
      segments(la).forEach(([a, b], ia) =>
        segments(lb).forEach(([c, d], ib) => {
          if ((i !== j || ib > ia + 1) && crosses(a, b, c, d)) n++
        }),
      )
    })
  })
  return n
}

export const inside = (lines: readonly (readonly Point[])[], w: number, l: number): boolean =>
  lines.flat().every((p) => p.x >= -EPS && p.x <= w + EPS && p.y >= -EPS && p.y <= l + EPS)

// рисунок на сетке размеров: внутри прямоугольника и без пересечений (спека: «линии не пересекаются при любых размерах»)
export function sweepProblems(drawing: ItemDrawingFn): string[] {
  const problems: string[] = []
  for (let w = 20; w <= 700; w += 17) {
    for (let l = 10; l <= 120; l += 11) {
      const d: ItemDrawing = drawing(size(w, l))
      if (!inside(d.lines, w, l)) problems.push(`${w}×${l}: выходит за прямоугольник`)
      if (crossingCount(d.lines) > 0) problems.push(`${w}×${l}: линии пересекаются`)
    }
  }
  return problems
}
