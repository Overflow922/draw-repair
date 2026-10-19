import type { Point, Wall } from "../types"
import { RIGHT_COS, degenerate, dist, dot, jointTol, sub, unit } from "../wall-geometry"

// Коллинеарные продолжения опорной стены (change fix-opening-distance-collinear, design D2): у каждого конца
// цепочка стен на той же прямой. Стена того же материала продолжает грань, стена другого материала обрывает её
// в вершине стыка. Чистые функции, стены не мутируются.

export interface ChainEnd {
  extendCm: number // на сколько цепочка того же материала выходит за конец опорной стены вдоль оси
  limitT: number | null // граница материала по t от конца a опорной стены; null — другой материал не встретился
  walls: readonly Wall[] // продолжения за этим концом, по порядку от опорной стены
}

export interface ChainOptions {
  ignoreMaterial?: boolean // цепочка идёт сквозь стены любого материала (штукатурка), limitT всегда null
}

export interface HostChains {
  a: ChainEnd // за концом a (t < 0)
  b: ChainEnd // за концом b (t > len)
}

interface Link {
  wall: Wall
  near: Point // конец продолжения у стыка
  far: Point
}

// единственное продолжение стены cur за концом at в направлении out; неоднозначность — продолжения нет
function nextLink(cur: Wall, at: Point, out: Point, walls: readonly Wall[], visited: ReadonlySet<Wall>): Link | null {
  const found: Link[] = []
  for (const c of walls) {
    if (visited.has(c) || degenerate(c)) continue
    for (const [near, far] of [[c.a, c.b], [c.b, c.a]] as const) {
      const tol = jointTol(cur, c)
      if (dist(near, at) > tol) continue
      // коллинеарна: тело уходит от стыка вдоль out в допуске прямого угла, концы стены лежат на оси опорной
      const u = unit(near, far)
      if (dot(u, out) < RIGHT_COS) continue
      const lateral = Math.abs(dot(sub(near, at), { x: -out.y, y: out.x }))
      if (lateral > tol) continue
      found.push({ wall: c, near, far })
    }
  }
  return found.length === 1 ? found[0] : null
}

function chainEnd(host: Wall, end: "a" | "b", walls: readonly Wall[], options: ChainOptions): ChainEnd {
  const axis = unit(host.a, host.b)
  const out = end === "b" ? axis : { x: -axis.x, y: -axis.y }
  const tOf = (p: Point): number => dot(sub(p, host.a), axis)
  const edge = tOf(host[end])
  const visited = new Set<Wall>([host])
  const linked: Wall[] = []
  let cur = host
  let at = host[end]
  for (;;) {
    const link = nextLink(cur, at, out, walls, visited)
    if (!link) return { extendCm: Math.abs(tOf(at) - edge), limitT: null, walls: linked }
    if (!options.ignoreMaterial && link.wall.type !== host.type) {
      // граница — вершина стыка: конец ранней в массиве стены из пары
      const vertex = walls.indexOf(link.wall) < walls.indexOf(cur) ? link.near : at
      return { extendCm: Math.abs(tOf(vertex) - edge), limitT: tOf(vertex), walls: linked }
    }
    visited.add(link.wall)
    linked.push(link.wall)
    cur = link.wall
    at = link.far
  }
}

// за концом опорной стены идёт коллинеарная стена того же материала: грань проходит сквозь неё, а положение элемента
// ограничено концом оси (change fix-opening-reach-body-end, design D1); без продолжения границу задаёт сама грань
export const continuesSameMaterial = (end: ChainEnd): boolean => end.limitT === null && end.extendCm > 0

export function hostChains(host: Wall, walls: readonly Wall[], options: ChainOptions = {}): HostChains {
  return { a: chainEnd(host, "a", walls, options), b: chainEnd(host, "b", walls, options) }
}
