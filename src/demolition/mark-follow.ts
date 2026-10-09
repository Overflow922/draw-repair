import type { DemolitionMark, Point, Wall } from "../types"
import { dist } from "../wall-geometry"
import { lengthOf, span } from "./mark-model"

// Перенос привязки пометок при слиянии стен (change demolition-plan, design D6). Положение пометки хранится
// относительно конца привязки, поэтому перемещение стены и её концов следует за стеной само; единственная операция,
// сохраняющая положение в плане при смене концов, — слияние продолжения (удлинение стены на том же луче).

const TOL = 1e-6
const OFF_AXIS_TOL = 1e-4

const samePoint = (p: Point, q: Point): boolean => Math.abs(p.x - q.x) < TOL && Math.abs(p.y - q.y) < TOL

// конец, у которого стена удлинилась на том же луче (противоположный конец не двигался)
function extendedEnd(before: Wall, after: Wall): "a" | "b" | null {
  for (const end of ["a", "b"] as const) {
    const fixed = end === "a" ? "b" : "a"
    if (!samePoint(before[fixed], after[fixed]) || samePoint(before[end], after[end])) continue
    const len = dist(before[fixed], before[end])
    if (len < TOL) return null
    const ux = (before[end].x - before[fixed].x) / len
    const uy = (before[end].y - before[fixed].y) / len
    const dx = after[end].x - before[end].x
    const dy = after[end].y - before[end].y
    const along = dx * ux + dy * uy
    const off = Math.abs(dx * uy - dy * ux)
    return along > TOL && off < OFF_AXIS_TOL ? end : null
  }
  return null
}

// Пометки удлинённой стены, привязанные к удлинённому концу, получают привязку к неподвижному концу с расстояниями,
// измеренными по старой стене; остальные пометки не меняются.
export function reanchorMarks(marks: readonly DemolitionMark[], before: readonly Wall[], after: readonly Wall[]): DemolitionMark[] {
  const extended = new Map<string, { end: "a" | "b"; wall: Wall }>()
  for (const wall of before) {
    const next = after.find((w) => w.id === wall.id)
    const end = next ? extendedEnd(wall, next) : null
    if (end) extended.set(wall.id, { end, wall })
  }
  if (extended.size === 0) return [...marks]
  return marks.map((m): DemolitionMark => {
    const info = extended.get(m.wallId)
    if (!info || m.anchor !== info.end) return m
    const [start, finish] = span(m, info.wall)
    const len = lengthOf(info.wall)
    return info.end === "b" ? { ...m, anchor: "a", fromCm: start, toCm: finish } : { ...m, anchor: "b", fromCm: len - finish, toCm: len - start }
  })
}
