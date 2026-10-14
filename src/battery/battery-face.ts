import { findRooms } from "../room-area"
import type { Room } from "../room-area"
import type { Point, Wall } from "../types"
import { dist, pointInPolygon } from "../wall-geometry"

// Грань установки батареи (change add-battery, design D9): внутренняя грань комнаты с заливкой, иначе — грань ближе к
// курсору. Определяется один раз при установке и хранится в батарее.

// проба: точка проекции курсора на ось стены, смещённая на 1 см за грань стороны side
const PROBE_CM = 1

const insideRoom = (p: Point, rooms: readonly Room[]): boolean =>
  rooms.some((room) => pointInPolygon(p, room.outline) && !room.holes.some((hole) => pointInPolygon(p, hole)))

export function chooseFace(wall: Wall, cursor: Point, walls: readonly Wall[]): 1 | -1 {
  const len = dist(wall.a, wall.b)
  if (len === 0) return 1
  const d = { x: (wall.b.x - wall.a.x) / len, y: (wall.b.y - wall.a.y) / len }
  const rel = { x: cursor.x - wall.a.x, y: cursor.y - wall.a.y }
  const t = Math.min(len, Math.max(0, rel.x * d.x + rel.y * d.y))
  const lat = rel.x * -d.y + rel.y * d.x
  const probe = (side: 1 | -1): Point => {
    const off = side * (wall.thicknessCm / 2 + PROBE_CM)
    return { x: wall.a.x + d.x * t - d.y * off, y: wall.a.y + d.y * t + d.x * off }
  }
  const rooms = findRooms([...walls])
  const plus = insideRoom(probe(1), rooms)
  const minus = insideRoom(probe(-1), rooms)
  if (plus !== minus) return plus ? 1 : -1
  return lat >= 0 ? 1 : -1
}
