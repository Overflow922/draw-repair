import { findRooms } from "../room-area"
import type { Room } from "../room-area"
import type { Point, Wall } from "../types"
import { pointInPolygon } from "../wall-geometry"

// Стороны помещения, в котором стоит предмет (change furniture-center-snap, design D4): середины этих сторон — линии центра
// стены. Помещения не хранятся: берутся из findRooms по текущим стенам плана. Чистые функции.

export interface Side {
  a: Point
  b: Point
}

// прямой участок короче этого — уступ на стыке стен, а не сторона помещения
export const MIN_SIDE_CM = 30
const COLLINEAR_EPS = 1e-6

const cross = (o: Point, a: Point, b: Point): number => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
const length = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y)

// вершины без тех, что лежат на прямой между соседями: коллинеарные рёбра сливаются в одно
function corners(ring: readonly Point[]): Point[] {
  return ring.filter((p, i) => {
    const prev = ring[(i + ring.length - 1) % ring.length]
    const next = ring[(i + 1) % ring.length]
    return prev && next && Math.abs(cross(prev, p, next)) > COLLINEAR_EPS * length(prev, p) * length(p, next)
  })
}

export function sidesOf(outline: readonly Point[], holes: readonly (readonly Point[])[]): Side[] {
  return [outline, ...holes].flatMap((ring) => {
    const vertices = corners(ring)
    return vertices
      .map((a, i): Side => ({ a, b: vertices[(i + 1) % vertices.length] ?? a }))
      .filter((s) => length(s.a, s.b) >= MIN_SIDE_CM)
  })
}

const holds = (room: Room, p: Point): boolean => pointInPolygon(p, room.outline) && !room.holes.some((h) => pointInPolygon(p, h))

// самое внутреннее помещение, содержащее точку: меньшая площадь
export function roomSidesAt(walls: readonly Wall[], p: Point): Side[] {
  const room = findRooms([...walls])
    .filter((r) => holds(r, p))
    .reduce<Room | null>((best, r) => (best && best.areaCm2 <= r.areaCm2 ? best : r), null)
  return room ? sidesOf(room.outline, room.holes) : []
}
