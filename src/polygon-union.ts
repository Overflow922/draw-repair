import {
  ClipType,
  EndType,
  FillRule,
  JoinType,
  PolyTree64,
  booleanOpWithPolyTree,
  inflatePaths,
  isPositive,
  reversePath,
} from "clipper2-ts"
import type { Path64, PolyPath64 } from "clipper2-ts"
import type { Point } from "./types"

// Адаптер объединения многоугольников на clipper2-ts: целые координаты с шагом
// 1 / SCALE см, замыкание (расширение на δ, объединение, сужение на δ) против
// щелей от погрешности на общих рёбрах кусков. Типы библиотеки наружу не выходят.

const SCALE = 1000

export interface RegionHole {
  path: Point[]
  islands: Region[]
}

export interface Region {
  outer: Point[]
  holes: RegionHole[]
}

const toPath = (poly: Point[]): Path64 => poly.map((p) => ({ x: Math.round(p.x * SCALE), y: Math.round(p.y * SCALE) }))

const fromPath = (path: Path64): Point[] => path.map((p) => ({ x: p.x / SCALE, y: p.y / SCALE }))

const childrenOf = (node: PolyPath64): PolyPath64[] => Array.from({ length: node.count }, (_, i) => node.child(i))

function toRegion(node: PolyPath64): Region {
  return {
    outer: fromPath(node.poly ?? []),
    holes: childrenOf(node).map((hole) => ({ path: fromPath(hole.poly ?? []), islands: childrenOf(hole).map(toRegion) })),
  }
}

// объединение кусков; щели уже 2·closeCm закрываются, остальная форма сохраняется
export function unionRegions(pieces: Point[][], closeCm: number): Region[] {
  const paths = pieces.filter((poly) => poly.length >= 3).map(toPath)
  // расширение трактует отрицательно ориентированные контуры как дыры: куски ориентируются одинаково
  const oriented = paths.map((path) => (isPositive(path) ? path : reversePath(path)))
  const delta = closeCm * SCALE
  const closed = inflatePaths(inflatePaths(oriented, delta, JoinType.Miter, EndType.Polygon), -delta, JoinType.Miter, EndType.Polygon)
  const tree = new PolyTree64()
  booleanOpWithPolyTree(ClipType.Union, closed, null, tree, FillRule.NonZero)
  return childrenOf(tree).map(toRegion)
}
