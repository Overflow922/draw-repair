import { hostPoint } from "../doorway/doorway-faces"
import type { Side } from "../doorway/doorway-faces"
import type { Point, Wall } from "../types"
import { add, cross, dist, dot, mul, perp, sub, unit } from "../wall-geometry"

// Концы области сноса у соседних стен (change demolition-no-neighbor-overlap, design D1, D3): зона не заходит в тело
// стены, сходящейся с концом оси или принимающей этот конец, и заканчивается у её ближней грани.

// остающаяся полуплоскость: точки p с dot(p − origin, normal) ≥ 0
export interface NeighborCut {
  origin: Point
  normal: Point
}

// косинус угла к оси, ниже которого соседняя стена считается продолжением (ближней грани у неё нет)
const PARALLEL_COS = 0.1

// допуск касания торца стены полосой соседней, см
const TOUCH_CM = 0.5

// расстояние от точки до отрезка pq
export function pointSegmentDist(p: Point, a: Point, b: Point): number {
  const ab = sub(b, a)
  const len2 = dot(ab, ab)
  const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, dot(sub(p, a), ab) / len2))
  return dist(p, add(a, mul(ab, t)))
}

// расстояние между отрезками ab и cd
function distBetweenSegments(a: Point, b: Point, c: Point, d: Point): number {
  const r = sub(b, a)
  const s = sub(d, c)
  const denom = cross(r, s)
  if (Math.abs(denom) > 1e-12) {
    const t = cross(sub(c, a), s) / denom
    const u = cross(sub(c, a), r) / denom
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return 0
  }
  return Math.min(pointSegmentDist(a, c, d), pointSegmentDist(b, c, d), pointSegmentDist(c, a, b), pointSegmentDist(d, a, b))
}

// Стена c срезает конец оси E, если её полоса (ось, расширенная на половину толщины) касается торца стены и либо заходит
// в него (полоса покрывает часть торца: угол, Т, стена, доходящая до оси соседа), либо её ближняя грань не глубже торца
// (стены по обе стороны торца, между которыми проходит стена, например разрыв в стене, заполненный торцевой частью).
// Стена, лишь примкнувшая сбоку к грани стены у самого её торца, срезом не считается: её грань глубже торца, но тело не заходит.
function holdsEnd(c: Wall, wall: Wall, E: Point, faceDepth: number): boolean {
  const n = mul(perp(unit(wall.a, wall.b)), wall.thicknessCm / 2)
  const gap = distBetweenSegments(sub(E, n), add(E, n), c.a, c.b)
  const half = c.thicknessCm / 2
  if (gap > half + TOUCH_CM) return false
  return gap < half - TOUCH_CM || faceDepth <= TOUCH_CM
}

// Владеет ли стена угловым квадратом стыка с соседом c у конца E: область сноса такой стены включает квадрат и по c не
// срезается (change demolition-corner-owner, design D1, D2); решает вызывающий (markRegion)
export type CornerOwner = (c: Wall, E: Point) => boolean

// Угловой квадрат (параллелограмм пересечения полос стен) у конца стены, которым она владеет; end — конец оси стены
export interface CornerCell {
  end: "a" | "b"
  cell: Point[]
}

export function cornerCells(wall: Wall, walls: readonly Wall[], owns: CornerOwner): CornerCell[] {
  const u = unit(wall.a, wall.b)
  const nw = perp(u)
  const cells: CornerCell[] = []
  for (const [end, E, inward] of [
    ["a", wall.a, u],
    ["b", wall.b, mul(u, -1)],
  ] as const) {
    for (const c of walls) {
      if (c === wall) continue
      const nc = perp(unit(c.a, c.b))
      const k = dot(inward, nc)
      if (Math.abs(k) < PARALLEL_COS) continue
      const normal = mul(nc, Math.sign(k))
      const origin = add(c.a, mul(normal, c.thicknessCm / 2))
      if (!holdsEnd(c, wall, E, dot(sub(origin, E), inward)) || !owns(c, E)) continue
      const det = nw.x * nc.y - nw.y * nc.x
      const solve = (s: number, t: number): Point => {
        const a = (s * wall.thicknessCm) / 2
        const b = (t * c.thicknessCm) / 2
        return add(E, { x: (a * nc.y - b * nw.y) / det, y: (nw.x * b - nc.x * a) / det })
      }
      cells.push({ end, cell: [solve(1, 1), solve(1, -1), solve(-1, -1), solve(-1, 1)] })
    }
  }
  return cells
}

// срезы по ближним граням соседей у обоих концов стены
export function neighborCuts(wall: Wall, walls: readonly Wall[], owns: CornerOwner = () => false): NeighborCut[] {
  const u = unit(wall.a, wall.b)
  const cuts: NeighborCut[] = []
  for (const [E, inward] of [
    [wall.a, u],
    [wall.b, mul(u, -1)],
  ] as const) {
    for (const c of walls) {
      if (c === wall) continue
      const n = perp(unit(c.a, c.b))
      const k = dot(inward, n)
      if (Math.abs(k) < PARALLEL_COS) continue
      const normal = mul(n, Math.sign(k))
      const origin = add(c.a, mul(normal, c.thicknessCm / 2))
      if (holdsEnd(c, wall, E, dot(sub(origin, E), inward)) && !owns(c, E)) cuts.push({ origin, normal })
    }
  }
  return cuts
}

// пределы вдоль оси от конца a, до которых срезы пускают грань стены: [lo, hi]
export function faceLimits(wall: Wall, side: Side, cuts: readonly NeighborCut[]): [number, number] {
  const u = unit(wall.a, wall.b)
  const start = hostPoint(wall, 0, (side * wall.thicknessCm) / 2)
  let lo = -Infinity
  let hi = Infinity
  for (const cut of cuts) {
    const k = dot(u, cut.normal)
    if (Math.abs(k) < PARALLEL_COS) continue
    const bound = -dot(sub(start, cut.origin), cut.normal) / k
    if (k > 0) lo = Math.max(lo, bound)
    else hi = Math.min(hi, bound)
  }
  return [lo, hi]
}
