import { faceRuns, jambsT } from "../doorway/doorway-faces"
import { isWindow } from "../types"
import type { Wall, WallElement } from "../types"
import { degenerate, dist } from "../wall-geometry"

// Участки стены, где можно и нельзя сносить (change demolition-window-sections, design D1): окно блокирует снос не всей
// стены, а своего участка между ближайшими разрывами граней (Т-примыкания перегородок); остальное — чистые участки.

// железобетон не сносится (несущая стена); вырожденная стена не имеет оси
export const canDemolish = (wall: Wall): boolean => wall.type !== "reinforced" && !degenerate(wall)

type Range = [number, number]

// разрывы свободных участков граней обеих сторон (вдоль оси от конца a), по возрастанию
function faceGaps(wall: Wall, walls: readonly Wall[]): Range[] {
  const gaps: Range[] = []
  for (const side of [1, -1] as const) {
    const runs = faceRuns(wall, walls, side)
    for (let i = 1; i < runs.length; i++) {
      const prev = runs[i - 1]
      const next = runs[i]
      if (prev && next && next[0] > prev[1]) gaps.push([prev[1], next[0]])
    }
  }
  return gaps.sort((p, q) => p[0] - q[0])
}

function union(ranges: Range[]): Range[] {
  const out: Range[] = []
  for (const r of [...ranges].sort((p, q) => p[0] - q[0])) {
    const last = out[out.length - 1]
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1])
    else out.push([r[0], r[1]])
  }
  return out
}

// Участок окна: от дальнего от окна края ближайшего разрыва слева (иначе от конца a) до ближнего к окну края ближайшего
// разрыва справа (иначе до конца b); сам разрыв относится к соседнему участку.
export function windowBlocks(wall: Wall, walls: readonly Wall[], elements: readonly WallElement[]): Range[] {
  if (degenerate(wall)) return []
  const windows = elements.filter((e) => isWindow(e) && e.wallId === wall.id)
  if (windows.length === 0) return []
  const gaps = faceGaps(wall, walls)
  const length = dist(wall.a, wall.b)
  return union(
    windows.map((e): Range => {
      const [j1, j2] = jambsT(e, wall)
      return [Math.max(0, ...gaps.filter((g) => g[1] <= j1).map((g) => g[1])), Math.min(length, ...gaps.filter((g) => g[0] >= j2).map((g) => g[0]))]
    }),
  )
}

// чистые участки: вся стена без участков окон; у железобетонной и вырожденной стены — пусто
export function cleanRanges(wall: Wall, walls: readonly Wall[], elements: readonly WallElement[]): Range[] {
  if (!canDemolish(wall)) return []
  const out: Range[] = []
  let from = 0
  for (const [lo, hi] of windowBlocks(wall, walls, elements)) {
    if (lo > from) out.push([from, lo])
    from = Math.max(from, hi)
  }
  const length = dist(wall.a, wall.b)
  if (length > from) out.push([from, length])
  return out
}
