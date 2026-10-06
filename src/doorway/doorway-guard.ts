import type { Segment } from "../edit-plan"
import type { Doorway, Wall } from "../types"
import { doorwayViolation, hostOf } from "./doorway-faces"

// Правки и рисование стен не нарушают проёмы (change add-doorway, design D5, D6).
// Нарушение каждого проёма после правки не должно превышать его нарушение до правки:
// допустимый проём остаётся допустимым, уже нарушенный не углубляется.

const TOL = 1e-6

export interface DoorwayGuard {
  holds(positions: ReadonlyMap<Wall, Segment>): boolean
}

type Box = [number, number, number, number]

const boxOf = (a: { x: number; y: number }, b: { x: number; y: number }, pad: number): Box => [
  Math.min(a.x, b.x) - pad,
  Math.min(a.y, b.y) - pad,
  Math.max(a.x, b.x) + pad,
  Math.max(a.y, b.y) + pad,
]

const overlap = (p: Box, q: Box): boolean => p[0] <= q[2] && q[0] <= p[2] && p[1] <= q[3] && q[1] <= p[3]

// нарушение растёт сверх исходного
const worse = (before: number, after: number): boolean => after > Math.max(before, TOL)

export function violatesDoorways(before: readonly Wall[], after: readonly Wall[], doorways: readonly Doorway[]): boolean {
  return doorways.some((d) => hostOf(d, after) !== null && worse(doorwayViolation(d, before), doorwayViolation(d, after)))
}

export function thicknessAllowed(walls: readonly Wall[], wall: Wall, thicknessCm: number, doorways: readonly Doorway[]): boolean {
  const after = walls.map((w) => (w === wall ? { ...w, thicknessCm } : w))
  return !violatesDoorways(walls, after, doorways)
}

// проверка позиций плана правки (design D5): только проёмы рядом с изменяемыми стенами
export function doorwayGuard(walls: readonly Wall[], doorways: readonly Doorway[]): DoorwayGuard | null {
  const hosted = doorways.flatMap((d) => {
    const host = hostOf(d, walls)
    return host ? [{ d, host, before: doorwayViolation(d, walls) }] : []
  })
  if (!hosted.length) return null
  const reach = Math.max(...walls.map((w) => w.thicknessCm)) * 2 + 1
  return {
    holds(positions) {
      if (!positions.size) return true
      const boxes = [...positions].flatMap(([w, s]) => [boxOf(w.a, w.b, reach), boxOf(s.a, s.b, reach)])
      const relevant = hosted.filter(({ host }) => positions.has(host) || boxes.some((b) => overlap(b, boxOf(host.a, host.b, reach))))
      if (!relevant.length) return true
      const after = walls.map((w) => {
        const s = positions.get(w)
        return s ? { ...w, a: s.a, b: s.b } : w
      })
      return relevant.every(({ d, before }) => !worse(before, doorwayViolation(d, after)))
    },
  }
}
